begin;

-- Each shape has one basic and one rotation core group; stop a second one before it exists.
do $$
declare
	duplicate record;
begin
	select shape_id, track, string_agg(name, ', ' order by name) as names
		into duplicate
		from public.puzzle_groups
		where purpose = 'core'
		group by shape_id, track
		having count(*) > 1
		limit 1;
	if found then
		raise exception 'More than one % core group exists for %: %. Change all but one to another purpose, then run this migration again.',
			duplicate.track, duplicate.shape_id, duplicate.names using errcode = '23505';
	end if;
end;
$$;

create unique index puzzle_groups_core_slot_idx
	on public.puzzle_groups (shape_id, track) where purpose = 'core';

-- A friendlier message than the index's, raised first.
create function private.guard_core_group_slot()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
	existing text;
begin
	if new.purpose = 'core' then
		select g.name into existing from public.puzzle_groups g
			where g.purpose = 'core' and g.shape_id = new.shape_id
				and g.track = new.track and g.id <> new.id
			limit 1;
		if found then
			raise exception 'This shape already has a % core group: "%".', new.track, existing
				using errcode = '23505';
		end if;
	end if;
	return new;
end;
$$;
revoke all on function private.guard_core_group_slot() from public, anon, authenticated;
create trigger core_slot_guard before insert or update of purpose, shape_id, track
	on public.puzzle_groups
	for each row execute function private.guard_core_group_slot();

-- A group has one reward rule; its palettes and bonus groups are children of that rule.
alter table public.reward_rules add constraint reward_rules_group_id_key unique (group_id);

-- The shape order decides who unlocks what, so it is fixed once a core group is published.
create function private.guard_shape_progression()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
	if exists (
		select 1 from public.puzzle_groups where purpose = 'core' and published_at is not null
	) then
		raise exception 'The shape order is locked once a core group is published.'
			using errcode = '23514';
	end if;
	if tg_op = 'DELETE' then return old; end if;
	return new;
end;
$$;
revoke all on function private.guard_shape_progression() from public, anon, authenticated;
create trigger shape_progression_guard before update or delete on public.shape_progression
	for each row execute function private.guard_shape_progression();

create function public.manage_shape_progression(p_shape_ids text[])
returns text[] language plpgsql security invoker set search_path = '' as $$
declare
	current_ids text[];
begin
	if not private.is_admin() then
		raise exception 'Only the admin can order the shapes.' using errcode = '42501';
	end if;
	if current_setting('transaction_isolation') <> 'read committed' then
		raise exception 'Catalog editing requires READ COMMITTED isolation.' using errcode = '25001';
	end if;
	if p_shape_ids is null or array_position(p_shape_ids, null) is not null
		or cardinality(p_shape_ids) <> (select count(distinct id) from unnest(p_shape_ids) as ids(id)) then
		raise exception 'Shape IDs must be distinct and non-null.' using errcode = '22023';
	end if;
	perform pg_catalog.pg_advisory_xact_lock(71429, 1);
	select coalesce(array_agg(shape_id order by position), '{}'::text[]) into current_ids
		from public.shape_progression;
	if not (p_shape_ids @> current_ids and p_shape_ids <@ current_ids) then
		raise exception 'The shape order must list every shape exactly once. Refresh and try again.'
			using errcode = '40001';
	end if;
	if p_shape_ids = current_ids then return current_ids; end if;
	-- The position constraint is deferred, so the swap is checked once at the end.
	update public.shape_progression p set position = ids.ordinality::integer
		from unnest(p_shape_ids) with ordinality as ids(id, ordinality)
		where p.shape_id = ids.id;
	return p_shape_ids;
end;
$$;

create function public.manage_group_reward(
	p_group_id uuid,
	p_palette_ids text[] default '{}',
	p_bonus_group_ids uuid[] default '{}'
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
	current_group public.puzzle_groups;
	rule_id uuid;
	blocker text;
begin
	if not private.is_admin() then
		raise exception 'Only the admin can manage rewards.' using errcode = '42501';
	end if;
	if current_setting('transaction_isolation') <> 'read committed' then
		raise exception 'Catalog editing requires READ COMMITTED isolation.' using errcode = '25001';
	end if;
	if p_group_id is null or p_palette_ids is null or p_bonus_group_ids is null
		or array_position(p_palette_ids, null) is not null
		or array_position(p_bonus_group_ids, null) is not null
		or cardinality(p_palette_ids) <> (select count(distinct id) from unnest(p_palette_ids) as ids(id))
		or cardinality(p_bonus_group_ids) <> (select count(distinct id) from unnest(p_bonus_group_ids) as ids(id)) then
		raise exception 'Palette and bonus group IDs must be distinct and non-null.' using errcode = '22023';
	end if;
	perform pg_catalog.pg_advisory_xact_lock(71429, 1);
	select * into current_group from public.puzzle_groups where id = p_group_id for update;
	if not found then
		raise exception 'The puzzle group no longer exists. Refresh and try again.' using errcode = 'P0002';
	end if;
	if current_group.published_at is not null or current_group.release_at is not null then
		raise exception 'Only unpublished groups can have their rewards changed.' using errcode = '23514';
	end if;
	if current_group.purpose not in ('core', 'reward') then
		raise exception 'Only core and reward groups award rewards.' using errcode = '23514';
	end if;
	if exists(select 1 from unnest(p_palette_ids) as ids(id)
		where not exists(select 1 from public.palettes p where p.id = ids.id))
		or exists(select 1 from unnest(p_bonus_group_ids) as ids(id)
		where not exists(select 1 from public.puzzle_groups g where g.id = ids.id)) then
		raise exception 'A selected palette or bonus group no longer exists. Refresh and try again.'
			using errcode = 'P0002';
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
	select g.name into blocker from public.puzzle_groups g where g.id = any(p_bonus_group_ids)
		and (g.purpose <> 'reward' or g.id = p_group_id) order by g.id limit 1;
	if found then
		raise exception 'Group "%" cannot be a bonus reward; choose a different reward group.', blocker
			using errcode = '23514';
	end if;

	select id into rule_id from public.reward_rules where group_id = p_group_id;
	if cardinality(p_palette_ids) = 0 and cardinality(p_bonus_group_ids) = 0 then
		if rule_id is not null then
			delete from public.reward_palettes where reward_rule_id = rule_id;
			delete from public.reward_puzzle_groups where reward_rule_id = rule_id;
			delete from public.reward_rules where id = rule_id;
		end if;
		return p_group_id;
	end if;
	if rule_id is null then
		insert into public.reward_rules(group_id) values (p_group_id) returning id into rule_id;
	end if;
	delete from public.reward_palettes where reward_rule_id = rule_id;
	delete from public.reward_puzzle_groups where reward_rule_id = rule_id;
	insert into public.reward_palettes(reward_rule_id, palette_id)
		select rule_id, id from unnest(p_palette_ids) as ids(id);
	insert into public.reward_puzzle_groups(reward_rule_id, group_id)
		select rule_id, id from unnest(p_bonus_group_ids) as ids(id);
	return p_group_id;
end;
$$;

revoke all on function public.manage_shape_progression(text[]) from public, anon;
grant execute on function public.manage_shape_progression(text[]) to authenticated;
revoke all on function public.manage_group_reward(uuid, text[], uuid[]) from public, anon;
grant execute on function public.manage_group_reward(uuid, text[], uuid[]) to authenticated;

commit;
