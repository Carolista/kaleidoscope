begin;

-- Each shape has four progression slots: a basic and a rotation core group, and a basic and a
-- rotation bonus (reward) group. A slot holds at most one group.
do $$
declare
	duplicate record;
begin
	select shape_id, track, string_agg(name, ', ' order by name) as names
		into duplicate
		from public.puzzle_groups
		where purpose = 'reward'
		group by shape_id, track
		having count(*) > 1
		limit 1;
	if found then
		raise exception 'More than one % reward group exists for %: %. Change all but one to another purpose, then run this migration again.',
			duplicate.track, duplicate.shape_id, duplicate.names using errcode = '23505';
	end if;
end;
$$;

create unique index puzzle_groups_reward_slot_idx
	on public.puzzle_groups (shape_id, track) where purpose = 'reward';

-- A friendlier message than the indexes', raised first; now covers reward groups too.
create or replace function private.guard_core_group_slot()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
	existing text;
begin
	if new.purpose in ('core', 'reward') then
		select g.name into existing from public.puzzle_groups g
			where g.purpose = new.purpose and g.shape_id = new.shape_id
				and g.track = new.track and g.id <> new.id
			limit 1;
		if found then
			raise exception 'This shape already has a % % group: "%".', new.track, new.purpose, existing
				using errcode = '23505';
		end if;
	end if;
	return new;
end;
$$;

-- The rotation core group of a shape awards the shape's bonus groups. Those links follow the
-- slots automatically, so nobody picks them by hand.
create function private.sync_bonus_groups(p_shape_id text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
	core_group public.puzzle_groups;
	rule_id uuid;
	desired uuid[];
begin
	if p_shape_id is null then return; end if;
	select * into core_group from public.puzzle_groups
		where purpose = 'core' and track = 'rotation' and shape_id = p_shape_id;
	if not found then return; end if;
	-- A prepared group's rewards are fixed with it.
	if core_group.published_at is not null or core_group.release_at is not null then return; end if;
	select coalesce(array_agg(id order by track, id), '{}'::uuid[]) into desired
		from public.puzzle_groups where purpose = 'reward' and shape_id = p_shape_id;
	select id into rule_id from public.reward_rules where group_id = core_group.id;
	if rule_id is null and cardinality(desired) = 0 then return; end if;
	if rule_id is null then
		insert into public.reward_rules(group_id) values (core_group.id) returning id into rule_id;
	end if;
	delete from public.reward_puzzle_groups
		where reward_rule_id = rule_id and not (group_id = any(desired));
	insert into public.reward_puzzle_groups(reward_rule_id, group_id)
		select rule_id, id from unnest(desired) as ids(id)
		where not exists(select 1 from public.reward_puzzle_groups
			where reward_rule_id = rule_id and group_id = ids.id);
	if not exists(select 1 from public.reward_palettes where reward_rule_id = rule_id)
		and not exists(select 1 from public.reward_puzzle_groups where reward_rule_id = rule_id) then
		delete from public.reward_rules where id = rule_id;
	end if;
end;
$$;
revoke all on function private.sync_bonus_groups(text) from public, anon, authenticated;

create function private.sync_bonus_groups_trigger()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
	if tg_op in ('UPDATE', 'DELETE') then
		perform private.sync_bonus_groups(old.shape_id);
	end if;
	if tg_op in ('INSERT', 'UPDATE') then
		perform private.sync_bonus_groups(new.shape_id);
	end if;
	return null;
end;
$$;
revoke all on function private.sync_bonus_groups_trigger() from public, anon, authenticated;
create trigger bonus_groups_sync after insert or update of purpose, shape_id, track or delete
	on public.puzzle_groups
	for each row execute function private.sync_bonus_groups_trigger();

select private.sync_bonus_groups(shape_id) from public.shape_progression;

-- Replaced by manage_progression_slot, which also assigns the group.
drop function public.manage_group_reward(uuid, text[], uuid[]);

-- Fills one progression slot with a puzzle group and sets the palette it awards, atomically.
-- Assigning a group sets its purpose, shape, and track; the group that held the slot becomes
-- Undecided and loses its reward. A null group empties the slot.
create function public.manage_progression_slot(
	p_shape_id text,
	p_purpose text,
	p_track text,
	p_group_id uuid default null,
	p_palette_ids text[] default '{}'
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
	occupant public.puzzle_groups;
	chosen public.puzzle_groups;
	has_occupant boolean;
	rule_id uuid;
	blocker text;
begin
	if not private.is_admin() then
		raise exception 'Only the admin can manage progression slots.' using errcode = '42501';
	end if;
	if current_setting('transaction_isolation') <> 'read committed' then
		raise exception 'Catalog editing requires READ COMMITTED isolation.' using errcode = '25001';
	end if;
	if p_purpose is null or p_purpose not in ('core', 'reward')
		or p_track is null or p_track not in ('basic', 'rotation')
		or p_shape_id is null or not exists(select 1 from public.shapes where id = p_shape_id) then
		raise exception 'Choose a valid shape, purpose, and track for this slot.' using errcode = '22023';
	end if;
	if p_palette_ids is null or array_position(p_palette_ids, null) is not null
		or cardinality(p_palette_ids) <> (select count(distinct id) from unnest(p_palette_ids) as ids(id)) then
		raise exception 'Palette IDs must be distinct and non-null.' using errcode = '22023';
	end if;
	if p_group_id is null and cardinality(p_palette_ids) <> 0 then
		raise exception 'An empty slot cannot award a palette.' using errcode = '22023';
	end if;
	perform pg_catalog.pg_advisory_xact_lock(71429, 1);

	select * into occupant from public.puzzle_groups
		where purpose = p_purpose and shape_id = p_shape_id and track = p_track for update;
	has_occupant := found;
	if p_group_id is not null then
		select * into chosen from public.puzzle_groups where id = p_group_id for update;
		if not found then
			raise exception 'The puzzle group no longer exists. Refresh and try again.' using errcode = 'P0002';
		end if;
		if chosen.published_at is not null or chosen.release_at is not null then
			raise exception 'Published groups cannot be changed here.' using errcode = '23514';
		end if;
		if chosen.purpose in ('core', 'reward') and (not has_occupant or chosen.id <> occupant.id) then
			raise exception 'Group "%" already fills another slot. Empty that slot first.', chosen.name
				using errcode = '23514';
		end if;
	end if;

	if has_occupant and (p_group_id is null or occupant.id <> p_group_id) then
		if occupant.published_at is not null or occupant.release_at is not null then
			raise exception 'The group in this slot is published and cannot be replaced.'
				using errcode = '23514';
		end if;
		delete from public.reward_puzzle_groups
			where group_id = occupant.id
				or reward_rule_id in (select id from public.reward_rules where group_id = occupant.id);
		delete from public.reward_palettes
			where reward_rule_id in (select id from public.reward_rules where group_id = occupant.id);
		delete from public.reward_rules where group_id = occupant.id;
		update public.puzzle_groups set purpose = 'undecided', track = null where id = occupant.id;
	end if;
	if p_group_id is null then
		return null;
	end if;
	if not has_occupant or occupant.id <> p_group_id then
		update public.puzzle_groups
			set purpose = p_purpose, shape_id = p_shape_id, track = p_track where id = p_group_id;
	end if;

	if exists(select 1 from unnest(p_palette_ids) as ids(id)
		where not exists(select 1 from public.palettes p where p.id = ids.id)) then
		raise exception 'A selected palette no longer exists. Refresh and try again.' using errcode = 'P0002';
	end if;
	select p.name into blocker from public.palettes p where p.id = any(p_palette_ids)
		and not exists(
			select 1 from public.palette_group_members m
			join public.palette_groups g on g.id = m.group_id
			where m.palette_id = p.id and g.purpose = 'reward'
		) order by p.id limit 1;
	if found then
		raise exception 'Palette "%" is not in a reward palette group.', blocker using errcode = '23514';
	end if;

	select id into rule_id from public.reward_rules where group_id = p_group_id;
	if cardinality(p_palette_ids) = 0 then
		if rule_id is not null then
			delete from public.reward_palettes where reward_rule_id = rule_id;
			if not exists(select 1 from public.reward_puzzle_groups where reward_rule_id = rule_id) then
				delete from public.reward_rules where id = rule_id;
			end if;
		end if;
	else
		if rule_id is null then
			insert into public.reward_rules(group_id) values (p_group_id) returning id into rule_id;
		end if;
		delete from public.reward_palettes where reward_rule_id = rule_id;
		insert into public.reward_palettes(reward_rule_id, palette_id)
			select rule_id, id from unnest(p_palette_ids) as ids(id);
	end if;
	return p_group_id;
end;
$$;

revoke all on function public.manage_progression_slot(text, text, text, uuid, text[])
	from public, anon;
grant execute on function public.manage_progression_slot(text, text, text, uuid, text[])
	to authenticated;

commit;
