begin;

-- The Zen randomizer is the prize for finishing every free puzzle set. The first time a player has
-- completed every released core and bonus (reward) group, and at least four groups for each shape in
-- the progression (a basic and a rotation core group and bonus group per shape), they are granted
-- `zen_randomizer`. The grant is permanent: groups released later never take it back. It is
-- written by `record_puzzle_completions`, the same function that records the solves.
create function private.grant_zen_randomizer(player uuid)
returns void
language sql security definer set search_path = ''
as $$
	insert into public.feature_grants (user_id, feature, source)
	select player, 'zen_randomizer', 'progression'
	where (
			select count(*) from public.group_completions completed
			join public.puzzle_groups g on g.id = completed.group_id
			where completed.user_id = player and g.purpose in ('core', 'reward')
		) >= 4 * (select count(*) from public.shape_progression)
		and not exists (
			select 1 from public.puzzle_groups g
			where g.purpose in ('core', 'reward')
				and private.is_released(g.published_at, g.release_at)
				and exists (
					select 1 from public.puzzle_group_members member
					join public.puzzles p on p.id = member.puzzle_id
					where member.group_id = g.id and private.is_released(p.published_at, p.release_at)
				)
				and not exists (
					select 1 from public.group_completions completed
					where completed.user_id = player and completed.group_id = g.id
				)
		)
	on conflict do nothing;
$$;
revoke all on function private.grant_zen_randomizer(uuid) from public, anon, authenticated;

create or replace function public.record_puzzle_completions(p_puzzle_ids uuid[])
returns uuid[]
language plpgsql security definer set search_path = ''
as $$
declare
	player uuid := (select auth.uid());
	changed integer;
	progressed boolean;
begin
	if player is null then
		raise exception 'Sign in to save progress.' using errcode = '42501';
	end if;
	p_puzzle_ids := coalesce(p_puzzle_ids, '{}');
	if cardinality(p_puzzle_ids) > 2000 then
		raise exception 'Too many puzzles to record at once.' using errcode = '22023';
	end if;

	loop
		progressed := false;

		insert into public.puzzle_completions (user_id, puzzle_id)
		select player, candidate.id
		from (select distinct unnest(p_puzzle_ids) as id) candidate
		where private.can_play_puzzle(candidate.id)
		on conflict do nothing;
		get diagnostics changed = row_count;
		progressed := progressed or changed > 0;

		-- A group is complete when every released puzzle in it is solved.
		insert into public.group_completions (user_id, group_id)
		select player, g.id
		from public.puzzle_groups g
		where g.purpose in ('core', 'reward')
			and private.can_play_puzzle_group(g.id)
			and exists (
				select 1 from public.puzzle_group_members member
				join public.puzzles p on p.id = member.puzzle_id
				where member.group_id = g.id and private.is_released(p.published_at, p.release_at)
			)
			and not exists (
				select 1 from public.puzzle_group_members member
				join public.puzzles p on p.id = member.puzzle_id
				where member.group_id = g.id
					and private.is_released(p.published_at, p.release_at)
					and not exists (
						select 1 from public.puzzle_completions done
						where done.user_id = player and done.puzzle_id = member.puzzle_id
					)
			)
		on conflict do nothing;
		get diagnostics changed = row_count;
		progressed := progressed or changed > 0;

		insert into public.puzzle_group_grants (user_id, group_id, source, reward_rule_id)
		select player, awarded.group_id, 'reward', rule.id
		from public.group_completions completed
		join public.reward_rules rule on rule.group_id = completed.group_id
		join public.reward_puzzle_groups awarded on awarded.reward_rule_id = rule.id
		where completed.user_id = player
		on conflict do nothing;
		get diagnostics changed = row_count;
		progressed := progressed or changed > 0;

		insert into public.palette_grants (user_id, palette_id, source, reward_rule_id)
		select player, awarded.palette_id, 'reward', rule.id
		from public.group_completions completed
		join public.reward_rules rule on rule.group_id = completed.group_id
		join public.reward_palettes awarded on awarded.reward_rule_id = rule.id
		where completed.user_id = player
		on conflict do nothing;
		get diagnostics changed = row_count;
		progressed := progressed or changed > 0;

		exit when not progressed;
	end loop;

	perform private.grant_zen_randomizer(player);

	return coalesce(
		(
			select array_agg(done.puzzle_id order by done.puzzle_id)
			from public.puzzle_completions done
			where done.user_id = player and done.puzzle_id = any(p_puzzle_ids)
		),
		'{}'
	);
end;
$$;

commit;
