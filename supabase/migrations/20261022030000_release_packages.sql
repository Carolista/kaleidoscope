begin;

-- A shape's four core and bonus groups (basic and rotation core, basic and rotation bonus) are
-- released as one package: scheduling, rescheduling, and cancelling always cover all four, with
-- their puzzles and palettes. A package needs all four slots filled. Those groups can no longer
-- be released on their own; daily, pack, and undecided groups and palettes work as before.
create or replace function public.preview_release(
	p_action text,
	p_kind text,
	p_id text,
	p_release_at timestamptz default null
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
	now_at timestamptz := clock_timestamp();
	target timestamptz;
	group_ids uuid[];
	puzzle_group public.puzzle_groups;
	palette_group public.palette_groups;
	single_palette public.palettes;
	shape_row public.shapes;
	main_name text;
	main_state text;
	plan_items jsonb := '[]'::jsonb;
	blockers text[] := '{}';
	warnings text[] := '{}';
begin
	if not private.is_admin() then
		raise exception 'Only the admin can manage releases.' using errcode = '42501';
	end if;
	if p_action not in ('schedule', 'cancel')
		or not (
			(p_action = 'schedule' and p_kind in ('shape_package', 'puzzle_group', 'palette_group'))
			or (p_action = 'cancel' and p_kind in ('shape_package', 'puzzle_group', 'palette_group', 'palette'))
		) then
		raise exception 'Choose a valid release action and kind.' using errcode = '22023';
	end if;
	if p_id is null then
		raise exception 'Choose what to release.' using errcode = '22023';
	end if;

	if p_kind = 'puzzle_group' then
		select * into puzzle_group from public.puzzle_groups where id = p_id::uuid;
		if not found then
			raise exception 'The puzzle group no longer exists. Refresh and try again.' using errcode = 'P0002';
		end if;
		main_name := puzzle_group.name;
		main_state := case when puzzle_group.published_at is null then 'draft'
			when puzzle_group.release_at > now_at then 'scheduled' else 'live' end;
	elsif p_kind = 'shape_package' then
		select * into shape_row from public.shapes where id = p_id;
		if not found then
			raise exception 'The shape no longer exists. Refresh and try again.' using errcode = 'P0002';
		end if;
		-- A shape's core and bonus groups are released together as one package.
		select coalesce(array_agg(g.id order by g.purpose, g.track), '{}') into group_ids
			from public.puzzle_groups g
			where g.shape_id = p_id and g.purpose in ('core', 'reward') and g.track is not null;
		main_name := shape_row.name || ' package';
		main_state := case
			when not exists (select 1 from public.puzzle_groups g
				where g.id = any(group_ids) and g.published_at is not null) then 'draft'
			when not exists (select 1 from public.puzzle_groups g
				where g.id = any(group_ids) and (g.published_at is null or g.release_at > now_at)) then 'live'
			else 'scheduled' end;
		if main_state <> 'live' and exists (select 1 from public.puzzle_groups g
			where g.id = any(group_ids) and g.published_at is not null and g.release_at <= now_at) then
			blockers := blockers || array['Some groups in this package are already live, so it can no longer be changed as a whole.'];
		end if;
	elsif p_kind = 'palette_group' then
		select * into palette_group from public.palette_groups where id = p_id::uuid;
		if not found then
			raise exception 'The palette group no longer exists. Refresh and try again.' using errcode = 'P0002';
		end if;
		main_name := palette_group.name;
		main_state := case when palette_group.published_at is null then 'draft'
			when palette_group.release_at > now_at then 'scheduled' else 'live' end;
	else
		select * into single_palette from public.palettes where id = p_id;
		if not found then
			raise exception 'The palette no longer exists. Refresh and try again.' using errcode = 'P0002';
		end if;
		main_name := single_palette.name;
		main_state := case when single_palette.published_at is null then 'draft'
			when single_palette.release_at > now_at then 'scheduled' else 'live' end;
	end if;

	if main_state = 'live' then
		blockers := blockers || array[format('"%s" is live and can no longer be changed.', main_name)];
	end if;
	-- Core and bonus groups never release on their own.
	if p_kind = 'puzzle_group' and puzzle_group.purpose in ('core', 'reward')
		and puzzle_group.shape_id is not null and puzzle_group.track is not null then
		blockers := blockers || array[format(
			'"%s" is released with the other core and bonus groups of its shape. Use the %s package instead.',
			main_name, (select s.name from public.shapes s where s.id = puzzle_group.shape_id))];
	end if;

	if p_action = 'schedule' then
		target := coalesce(p_release_at, now_at);
		if p_release_at is not null and p_release_at <= now_at then
			blockers := blockers || array['Choose a future release time, or release now.'];
		end if;

		if p_kind in ('puzzle_group', 'shape_package') then
			if p_kind = 'puzzle_group' then
				-- The group and every bonus group its reward rule awards.
				with recursive reachable(id) as (
					select puzzle_group.id
					union
					select link.group_id from reachable
						join public.reward_rules rule on rule.group_id = reachable.id
						join public.reward_puzzle_groups link on link.reward_rule_id = rule.id
				)
				select array_agg(id) into group_ids from reachable;
			else
				blockers := blockers || coalesce((
					select array_agg(format('%s has no %s %s group.', shape_row.name, slot.track,
						case when slot.purpose = 'core' then 'core' else 'bonus' end)
						order by slot.purpose, slot.track)
					from (values ('core', 'basic'), ('core', 'rotation'),
						('reward', 'basic'), ('reward', 'rotation')) as slot(purpose, track)
					where not exists (
						select 1 from public.puzzle_groups g
						where g.id = any(group_ids) and g.purpose = slot.purpose and g.track = slot.track
					)
				), '{}');
			end if;

			select coalesce(jsonb_agg(item order by ord, name), '[]'::jsonb) into plan_items
			from (
				select ord, name, jsonb_build_object(
					'kind', kind, 'id', id, 'name', name,
					'state', case when published_at is null then 'draft'
						when release_at > now_at then 'scheduled' else 'live' end,
					'change', change,
					'previous_release_at', release_at,
					'release_at', case when change in ('live', 'keep') then release_at else target end
				) as item
				from (
					select ord, kind, id, name, published_at, release_at,
						case
							when published_at is not null and release_at <= now_at then 'live'
							when published_at is null then 'release'
							when is_main and release_at <> target then 'reschedule'
							when release_at > target then 'earlier'
							else 'keep'
						end as change
					from (
						select 1 as ord, 'palette' as kind, p.id::text as id, p.name,
							p.published_at, p.release_at, false as is_main
						from public.palettes p
						where p.id in (
								select puzzle.palette_id from public.puzzle_group_members m
								join public.puzzles puzzle on puzzle.id = m.puzzle_id
								where m.group_id = any(group_ids)
							)
							or p.id in (
								select reward.palette_id from public.reward_rules rule
								join public.reward_palettes reward on reward.reward_rule_id = rule.id
								where rule.group_id = any(group_ids)
							)
						union all
						select 2, 'puzzle', puzzle.id::text, puzzle.name,
							puzzle.published_at, puzzle.release_at, false
						from public.puzzles puzzle
						where puzzle.id in (
							select m.puzzle_id from public.puzzle_group_members m
							where m.group_id = any(group_ids)
						)
						union all
						select case when p_kind = 'shape_package' or g.id = puzzle_group.id then 4 else 3 end,
							'puzzle_group', g.id::text, g.name, g.published_at, g.release_at,
							p_kind = 'shape_package' or g.id = puzzle_group.id
						from public.puzzle_groups g where g.id = any(group_ids)
					) as everything
				) as planned
			) as ordered;

			-- Hard rules.
			blockers := blockers || coalesce((
				select array_agg(format('Choose a purpose for "%s" before releasing it.', g.name) order by g.name)
				from public.puzzle_groups g where g.id = any(group_ids) and g.purpose = 'undecided'
			), '{}');
			blockers := blockers || coalesce((
				select array_agg(
					case when counted.puzzles = 0 then format('"%s" has no puzzles.', counted.name)
						else format('"%s" has %s puzzles; %s groups need exactly 24.', counted.name,
							counted.puzzles, case when counted.purpose = 'core' then 'core' else 'bonus' end)
					end order by counted.name)
				from (
					select g.name, g.purpose, (
						select count(*) from public.puzzle_group_members m where m.group_id = g.id
					) as puzzles
					from public.puzzle_groups g where g.id = any(group_ids)
				) as counted
				where counted.puzzles = 0
					or (counted.purpose in ('core', 'reward') and counted.puzzles <> 24)
			), '{}');
			blockers := blockers || coalesce((
				select array_agg(format('"%s" awards no palette.', g.name) order by g.name)
				from public.puzzle_groups g
				where g.id = any(group_ids) and g.purpose in ('core', 'reward')
					and not exists (
						select 1 from public.reward_rules rule
						join public.reward_palettes reward on reward.reward_rule_id = rule.id
						where rule.group_id = g.id
					)
			), '{}');
			blockers := blockers || coalesce((
				select array_agg(format('Puzzle "%s" has no saved solution data.', puzzle.name) order by puzzle.name)
				from public.puzzles puzzle
				join public.puzzle_group_members m on m.puzzle_id = puzzle.id
				where m.group_id = any(group_ids)
					and not exists (select 1 from public.puzzle_authoring a where a.puzzle_id = puzzle.id)
			), '{}');
			blockers := blockers || coalesce((
				select array_agg(format('Release the %s shape first.', s.name) order by s.name)
				from public.shapes s
				where s.id in (select g.shape_id from public.puzzle_groups g where g.id = any(group_ids))
					and (s.published_at is null or s.release_at > target)
			), '{}');
			-- Moving a group later must not break a scheduled group that awards it.
			if p_kind = 'puzzle_group' and main_state = 'scheduled' and target > puzzle_group.release_at then
				blockers := blockers || coalesce((
					select array_agg(format('"%s" awards this group and releases earlier; reschedule or cancel it first.', owner.name)
						order by owner.name)
					from public.reward_puzzle_groups link
					join public.reward_rules rule on rule.id = link.reward_rule_id
					join public.puzzle_groups owner on owner.id = rule.group_id
					where link.group_id = puzzle_group.id
						and owner.published_at is not null and owner.release_at < target
				), '{}');
			end if;

			-- Warnings.
			warnings := warnings || coalesce((
				select array_agg(format('Palette "%s" is awarded by more than one group.', p.name) order by p.name)
				from public.palettes p
				where p.id in (
						select reward.palette_id from public.reward_rules rule
						join public.reward_palettes reward on reward.reward_rule_id = rule.id
						where rule.group_id = any(group_ids)
					)
					and (select count(*) from public.reward_palettes r2 where r2.palette_id = p.id) > 1
			), '{}');
			warnings := warnings || coalesce((
				select array_agg(format('"%s" awards more than one palette.', g.name) order by g.name)
				from public.puzzle_groups g
				where g.id = any(group_ids) and g.purpose in ('core', 'reward')
					and (
						select count(*) from public.reward_rules rule
						join public.reward_palettes reward on reward.reward_rule_id = rule.id
						where rule.group_id = g.id
					) > 1
			), '{}');
			warnings := warnings || coalesce((
				select array_agg(format('Palette "%s" is in no core, reward, or pack palette group, so players cannot get it.', p.name)
					order by p.name)
				from public.palettes p
				where p.id in (
						select puzzle.palette_id from public.puzzle_group_members m
						join public.puzzles puzzle on puzzle.id = m.puzzle_id
						where m.group_id = any(group_ids)
					)
					and not exists (
						select 1 from public.palette_group_members pm
						join public.palette_groups pg on pg.id = pm.group_id
						where pm.palette_id = p.id and pg.purpose in ('core', 'reward', 'pack')
					)
			), '{}');
			if exists (select 1 from public.puzzle_groups g where g.id = any(group_ids) and g.purpose = 'core')
				and not exists (select 1 from public.puzzle_groups g where g.purpose = 'core' and g.published_at is not null) then
				warnings := warnings || array['Releasing the first core group locks the shape order.'];
			end if;
		else
			select coalesce(jsonb_agg(item order by ord, name), '[]'::jsonb) into plan_items
			from (
				select ord, name, jsonb_build_object(
					'kind', kind, 'id', id, 'name', name,
					'state', case when published_at is null then 'draft'
						when release_at > now_at then 'scheduled' else 'live' end,
					'change', change,
					'previous_release_at', release_at,
					'release_at', case when change in ('live', 'keep') then release_at else target end
				) as item
				from (
					select ord, kind, id, name, published_at, release_at,
						case
							when published_at is not null and release_at <= now_at then 'live'
							when published_at is null then 'release'
							when is_main and release_at <> target then 'reschedule'
							when release_at > target then 'earlier'
							else 'keep'
						end as change
					from (
						select 1 as ord, 'palette' as kind, p.id::text as id, p.name,
							p.published_at, p.release_at, false as is_main
						from public.palettes p
						where p.id in (
							select m.palette_id from public.palette_group_members m
							where m.group_id = palette_group.id
						)
						union all
						select 2, 'palette_group', palette_group.id::text, palette_group.name,
							palette_group.published_at, palette_group.release_at, true
					) as everything
				) as planned
			) as ordered;

			blockers := blockers || case when palette_group.purpose = 'undecided'
				then array[format('Choose a purpose for "%s" before releasing it.', palette_group.name)]
				else '{}'::text[] end;
			blockers := blockers || case
				when not exists (select 1 from public.palette_group_members m where m.group_id = palette_group.id)
					then array[format('"%s" has no palettes.', palette_group.name)]
				when palette_group.purpose in ('core', 'reward') and (
						select count(*) from public.palette_group_members m where m.group_id = palette_group.id
					) <> 6
					then array[format('"%s" has %s palettes; core and reward palette groups need exactly 6.',
						palette_group.name, (
							select count(*) from public.palette_group_members m where m.group_id = palette_group.id
						))]
				else '{}'::text[] end;
			warnings := warnings || coalesce((
				select array_agg(format('Palette "%s" is also used by daily puzzles, which would make it public.', p.name)
					order by p.name)
				from public.palettes p
				where p.id in (
						select m.palette_id from public.palette_group_members m where m.group_id = palette_group.id
					)
					and (p.published_at is null or p.release_at > now_at)
					and exists (
						select 1 from public.puzzles puzzle
						join public.puzzle_group_members gm on gm.puzzle_id = puzzle.id
						join public.puzzle_groups g on g.id = gm.group_id
						where puzzle.palette_id = p.id and g.purpose = 'daily'
					)
			), '{}');
		end if;

		if p_kind in ('puzzle_group', 'shape_package') then
			warnings := warnings || coalesce((
				select array_agg(format('Palette "%s" is also used by daily puzzles, which would make it public.', p.name)
					order by p.name)
				from public.palettes p
				where p.id in (
						select puzzle.palette_id from public.puzzle_group_members m
						join public.puzzles puzzle on puzzle.id = m.puzzle_id
						where m.group_id = any(group_ids)
					)
					and (p.published_at is null or p.release_at > now_at)
					and exists (
						select 1 from public.puzzles puzzle
						join public.puzzle_group_members gm on gm.puzzle_id = puzzle.id
						join public.puzzle_groups g on g.id = gm.group_id
						where puzzle.palette_id = p.id and g.purpose = 'daily' and g.id <> all(group_ids)
					)
			), '{}');
		end if;
	else
		if main_state = 'draft' then
			blockers := blockers || array[format('"%s" is not scheduled.', main_name)];
		end if;

		if p_kind in ('puzzle_group', 'shape_package') then
			if p_kind = 'puzzle_group' then
				-- A scheduled group that awards this one as a bonus cannot stay without it.
				with recursive owners(id) as (
					select puzzle_group.id
					union
					select rule.group_id from owners
						join public.reward_puzzle_groups link on link.group_id = owners.id
						join public.reward_rules rule on rule.id = link.reward_rule_id
						join public.puzzle_groups g on g.id = rule.group_id
					where g.published_at is not null
				)
				select array_agg(id) into group_ids from owners;
			end if;

			select coalesce(jsonb_agg(item order by ord, name), '[]'::jsonb) into plan_items
			from (
				select ord, name, jsonb_build_object(
					'kind', kind, 'id', id, 'name', name,
					'state', case when published_at is null then 'draft'
						when release_at > now_at then 'scheduled' else 'live' end,
					'change', case
						when published_at is null or release_at <= now_at then
							case when published_at is null then 'keep' else 'live' end
						else 'cancel' end,
					'previous_release_at', release_at,
					'release_at', null
				) as item
				from (
					select 1 as ord, 'puzzle_group' as kind, g.id::text as id, g.name,
						g.published_at, g.release_at
					from public.puzzle_groups g where g.id = any(group_ids)
					union all
					select 2, 'puzzle', puzzle.id::text, puzzle.name, puzzle.published_at, puzzle.release_at
					from public.puzzles puzzle
					where puzzle.id in (
						select m.puzzle_id from public.puzzle_group_members m where m.group_id = any(group_ids)
					)
				) as everything
			) as ordered;

			blockers := blockers || coalesce((
				select array_agg(format('"%s" is live and cannot be cancelled with this group.', g.name) order by g.name)
				from public.puzzle_groups g
				where g.id = any(group_ids) and g.id is distinct from puzzle_group.id
					and g.published_at is not null and g.release_at <= now_at
			), '{}');
			blockers := blockers || coalesce((
				select array_agg(format('Remove "%s" from the daily schedule first.', puzzle.name) order by puzzle.name)
				from public.puzzles puzzle
				join public.puzzle_group_members m on m.puzzle_id = puzzle.id
				join public.daily_puzzles d on d.puzzle_id = puzzle.id
				where m.group_id = any(group_ids)
			), '{}');
			warnings := warnings || coalesce((
				select array_agg(format('"%s" awards this group, so it is cancelled too.', g.name) order by g.name)
				from public.puzzle_groups g where g.id = any(group_ids) and g.id <> puzzle_group.id
			), '{}');
			if exists (
				select 1 from public.palettes p
				where p.published_at is not null and p.release_at > now_at and p.id in (
					select puzzle.palette_id from public.puzzle_group_members m
					join public.puzzles puzzle on puzzle.id = m.puzzle_id
					where m.group_id = any(group_ids)
				)
			) then
				warnings := warnings || array['Palettes used by these puzzles stay scheduled until you cancel them in Palettes.'];
			end if;
		elsif p_kind = 'palette_group' then
			plan_items := jsonb_build_array(jsonb_build_object(
				'kind', 'palette_group', 'id', palette_group.id::text, 'name', palette_group.name,
				'state', main_state,
				'change', case main_state when 'scheduled' then 'cancel' when 'live' then 'live' else 'keep' end,
				'previous_release_at', palette_group.release_at, 'release_at', null
			));
			if main_state = 'scheduled' then
				warnings := warnings || array['The palettes in this group stay scheduled until you cancel them in Palettes.'];
			end if;
		else
			plan_items := jsonb_build_array(jsonb_build_object(
				'kind', 'palette', 'id', single_palette.id, 'name', single_palette.name,
				'state', main_state,
				'change', case main_state when 'scheduled' then 'cancel' when 'live' then 'live' else 'keep' end,
				'previous_release_at', single_palette.release_at, 'release_at', null
			));
			blockers := blockers || coalesce((
				select array[case when count(*) = 1
					then format('Puzzle "%s" uses this palette and is scheduled.', min(puzzle.name))
					else format('Puzzle "%s" and %s more use this palette and are scheduled.', min(puzzle.name), count(*) - 1)
				end]
				from public.puzzles puzzle
				where puzzle.palette_id = single_palette.id and puzzle.published_at is not null
				having count(*) > 0
			), '{}');
			blockers := blockers || coalesce((
				select array_agg(format('"%s" awards this palette and is scheduled.', g.name) order by g.name)
				from public.reward_palettes reward
				join public.reward_rules rule on rule.id = reward.reward_rule_id
				join public.puzzle_groups g on g.id = rule.group_id
				where reward.palette_id = single_palette.id and g.published_at is not null
			), '{}');
			blockers := blockers || coalesce((
				select array_agg(format('Palette group "%s" contains this palette and is scheduled.', pg.name) order by pg.name)
				from public.palette_group_members pm
				join public.palette_groups pg on pg.id = pm.group_id
				where pm.palette_id = single_palette.id and pg.published_at is not null
			), '{}');
		end if;
	end if;

	return jsonb_build_object(
		'action', p_action, 'kind', p_kind, 'id', p_id, 'name', main_name,
		'state', main_state, 'release_at', target,
		'items', plan_items,
		'blockers', to_jsonb(blockers), 'warnings', to_jsonb(warnings)
	);
end;
$$;

commit;
