begin;

-- A "group" is any ordered collection of puzzles or palettes. Its purpose says how it is used:
-- core (free progression), reward (free unlock), daily (puzzles only), pack (sold), or
-- undecided (still a draft decision). Puzzle groups also carry a track: basic (no rotation),
-- rotation, or mixed (packs only).

create function pg_temp.drop_constraints(tbl regclass, kind "char", pattern text)
returns void language plpgsql as $$
declare
	found_constraint record;
begin
	for found_constraint in
		select conname from pg_constraint
		where conrelid = tbl and contype = kind and pg_get_constraintdef(oid) like pattern
	loop
		execute format('alter table %s drop constraint %I', tbl, found_constraint.conname);
	end loop;
end;
$$;

-- Deferred triggers and guards are recreated at the end; drop them so data moves and
-- table changes cannot hit pending trigger events or functions that are being replaced.
do $$
declare
	table_name text;
begin
	foreach table_name in array array[
		'palettes', 'shapes', 'puzzles', 'puzzle_authoring', 'puzzle_collections',
		'collection_puzzles', 'completion_routes', 'route_puzzles', 'core_progression',
		'core_steps', 'reward_rules', 'reward_palettes', 'reward_sets', 'reward_shapes',
		'daily_puzzles', 'palette_packs', 'palette_pack_palettes'
	] loop
		execute format('drop trigger release_dependencies on public.%I', table_name);
	end loop;
end;
$$;
drop trigger members_guard on public.collection_puzzles;
drop trigger authoring_guard on public.puzzle_authoring;
drop trigger rewards_guard on public.reward_rules;
drop trigger reward_palettes_guard on public.reward_palettes;
drop trigger reward_sets_guard on public.reward_sets;
drop trigger pack_membership_guard on public.palette_pack_palettes;
drop trigger collections_publication on public.puzzle_collections;
drop trigger puzzles_publication on public.puzzles;
drop trigger daily_assignment_guard on public.daily_puzzles;

-- Routes, the linear core chain, per-shape reward mappings, and starters are replaced by
-- group completion, a shape progression, and core palette groups.
drop table public.set_qualifications;
drop table public.route_puzzles;
alter table public.reward_rules drop column route_id;
drop table public.completion_routes;
drop table public.core_steps;
drop table public.core_progression;
drop table public.reward_shapes;
drop table public.starter_palettes;
drop table public.starter_shapes;
drop function private.guard_core_release();

-- Puzzle groups.
select pg_temp.drop_constraints('public.puzzle_collections'::regclass, 'c', '%kind%');
alter table public.puzzle_collections rename column kind to purpose;
alter table public.puzzle_collections add column track text;
update public.puzzle_collections g set
	purpose = case
		when g.purpose = 'paid' then 'pack'
		when d.track in ('basic', 'rotation') then g.purpose
		else 'undecided'
	end,
	track = case
		when g.purpose = 'paid' then coalesce(d.track, 'mixed')
		when d.track in ('basic', 'rotation') then d.track
		else null
	end
from (
	select c.id, case
		when count(p.id) = 0 then null
		when bool_and(not p.rotation_allowed) then 'basic'
		when bool_and(p.rotation_allowed) then 'rotation'
		else 'mixed'
	end as track
	from public.puzzle_collections c
	left join public.collection_puzzles m on m.collection_id = c.id
	left join public.puzzles p on p.id = m.puzzle_id
	group by c.id
) d
where d.id = g.id;

alter table public.collection_puzzles rename to puzzle_group_members;
alter table public.puzzle_group_members rename column collection_id to group_id;
-- Dropping these columns also drops the composite foreign keys that tied members to a shape.
alter table public.puzzle_group_members drop column puzzle_usage;
alter table public.puzzle_group_members drop column shape_id;
select pg_temp.drop_constraints('public.puzzle_collections'::regclass, 'u', 'UNIQUE (id, shape_id)');
alter table public.puzzle_collections rename to puzzle_groups;
alter table public.puzzle_groups alter column shape_id drop not null;

-- Puzzles that were meant for the daily feature move into one daily group.
alter table public.daily_puzzles drop column puzzle_usage;
alter table public.daily_puzzles
	add constraint daily_puzzles_puzzle_id_fkey
	foreign key (puzzle_id) references public.puzzles(id) on delete restrict;
do $$
declare
	daily_group uuid := gen_random_uuid();
begin
	if exists (select 1 from public.puzzles where usage = 'daily') then
		insert into public.puzzle_groups(id, name, purpose, shape_id, track)
			values (daily_group, 'Daily drafts', 'daily', null, null);
		insert into public.puzzle_group_members(puzzle_id, group_id, position)
			select p.id, daily_group, row_number() over (order by p.name, p.id)::integer
			from public.puzzles p where p.usage = 'daily';
	end if;
end;
$$;
alter table public.puzzles drop column usage;

alter table public.puzzle_groups
	add constraint puzzle_groups_purpose_check
		check (purpose in ('undecided', 'core', 'reward', 'daily', 'pack')),
	add constraint puzzle_groups_shape_check
		check ((purpose = 'daily') = (shape_id is null)),
	add constraint puzzle_groups_track_check check (
		(purpose in ('core', 'reward') and track in ('basic', 'rotation'))
		or (purpose = 'pack' and track in ('basic', 'rotation', 'mixed'))
		or (purpose in ('undecided', 'daily') and track is null)
	);
alter table public.puzzle_group_members
	add constraint puzzle_group_members_group_id_fkey
		foreign key (group_id) references public.puzzle_groups(id) on delete cascade,
	add constraint puzzle_group_members_puzzle_id_fkey
		foreign key (puzzle_id) references public.puzzles(id) on delete restrict;

-- Palette groups.
select pg_temp.drop_constraints('public.palette_packs'::regclass, 'c', '%kind%');
alter table public.palette_packs rename column kind to purpose;
alter table public.palette_packs alter column purpose drop default;
update public.palette_packs set purpose = 'pack' where purpose = 'paid';
alter table public.palette_packs
	add constraint palette_groups_purpose_check
	check (purpose in ('undecided', 'core', 'reward', 'pack'));
alter table public.palette_packs rename to palette_groups;
alter table public.palette_pack_palettes rename to palette_group_members;
alter table public.palette_group_members rename column pack_id to group_id;

-- Rewards are keyed on group completion.
alter table public.reward_rules rename column collection_id to group_id;
alter table public.reward_sets rename to reward_puzzle_groups;
alter table public.reward_puzzle_groups rename column collection_id to group_id;
alter table public.collection_grants rename to puzzle_group_grants;
alter table public.puzzle_group_grants rename column collection_id to group_id;

select pg_temp.drop_constraints('public.feature_grants'::regclass, 'c', '%core_progression%');
update public.feature_grants set source = 'progression' where source = 'core_progression';
alter table public.feature_grants
	add constraint feature_grants_source_check check (source in ('progression', 'admin'));

-- Constraint and index names follow the new table and column names.
do $$
declare
	item record;
	renamed text;
begin
	for item in
		select c.conrelid::regclass::text as tbl, c.conname
		from pg_constraint c
		where c.conrelid = any (array[
			'public.puzzle_groups'::regclass, 'public.puzzle_group_members'::regclass,
			'public.palette_groups'::regclass, 'public.palette_group_members'::regclass,
			'public.reward_rules'::regclass, 'public.reward_puzzle_groups'::regclass,
			'public.puzzle_group_grants'::regclass
		])
	loop
		renamed := item.conname;
		renamed := replace(renamed, 'puzzle_collections', 'puzzle_groups');
		renamed := replace(renamed, 'collection_puzzles', 'puzzle_group_members');
		renamed := replace(renamed, 'palette_packs', 'palette_groups');
		renamed := replace(renamed, 'palette_pack_palettes', 'palette_group_members');
		renamed := replace(renamed, 'reward_sets', 'reward_puzzle_groups');
		renamed := replace(renamed, 'collection_grants', 'puzzle_group_grants');
		renamed := replace(renamed, 'collection_id', 'group_id');
		renamed := replace(renamed, 'pack_id', 'group_id');
		if renamed <> item.conname then
			execute format('alter table %s rename constraint %I to %I', item.tbl, item.conname, renamed);
		end if;
	end loop;
	for item in
		select i.schemaname, i.indexname from pg_indexes i
		where i.schemaname = 'public' and i.tablename in (
			'puzzle_groups', 'puzzle_group_members', 'palette_groups', 'palette_group_members',
			'reward_rules', 'reward_puzzle_groups', 'puzzle_group_grants'
		)
	loop
		renamed := item.indexname;
		renamed := replace(renamed, 'collections_shape', 'puzzle_groups_shape');
		renamed := replace(renamed, 'reward_sets', 'reward_puzzle_groups');
		renamed := replace(renamed, 'collection_grants', 'puzzle_group_grants');
		renamed := replace(renamed, 'palette_pack_palettes', 'palette_group_members');
		renamed := replace(renamed, 'reward_rules_collection', 'reward_rules_group');
		if renamed <> item.indexname then
			execute format('alter index public.%I rename to %I', item.indexname, renamed);
		end if;
	end loop;
end;
$$;
alter trigger collections_immutable on public.puzzle_groups rename to groups_immutable;
alter trigger packs_release_guard on public.palette_groups rename to palette_groups_release_guard;

-- Shape unlock order and player completions.
create table public.shape_progression (
	shape_id text primary key references public.shapes(id) on delete restrict,
	position integer not null check (position > 0) unique deferrable initially deferred
);
insert into public.shape_progression (shape_id, position) values
	('hexagon', 1), ('triangle', 2), ('diamondStar', 3),
	('hexagram', 4), ('circleRings', 5), ('pinwheel', 6);

create table public.group_completions (
	user_id uuid not null references auth.users(id) on delete cascade,
	group_id uuid not null references public.puzzle_groups(id) on delete restrict,
	completed_at timestamptz not null default now(),
	primary key (user_id, group_id)
);
create index group_completions_group_idx on public.group_completions(group_id);

create trigger content_edit_lock before insert or update or delete on public.shape_progression
	for each statement execute function private.lock_content_edit();

alter table public.shape_progression enable row level security;
alter table public.group_completions enable row level security;
create policy admin_crud on public.shape_progression for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.group_completions for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy catalog_read on public.shape_progression for select to anon, authenticated
	using (exists (select 1 from public.shapes s where s.id = shape_id));
create policy own_read on public.group_completions for select to authenticated
	using (user_id = (select auth.uid()));
revoke all on public.shape_progression, public.group_completions from anon, authenticated;
grant select, insert, update, delete on public.shape_progression, public.group_completions
	to authenticated;
grant select on public.shape_progression to anon;

-- Access helpers.
drop policy catalog_read on public.puzzle_group_members;
drop policy catalog_read on public.reward_rules;
drop policy catalog_read on public.reward_puzzle_groups;
drop function private.collection_released(uuid);
drop function private.can_play_collection(uuid);

create function private.puzzle_group_released(group_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
	select exists (
		select 1 from public.puzzle_groups g
		where g.id = puzzle_group_released.group_id
			and private.is_released(g.published_at, g.release_at)
	);
$$;

create or replace function private.has_shape(shape_id text)
returns boolean
language sql stable security definer set search_path = ''
as $$
	select exists (
			select 1 from public.shape_progression p
			where p.shape_id = has_shape.shape_id and p.position = 1
		)
		or exists (
			select 1 from public.shape_grants g
			where g.shape_id = has_shape.shape_id and g.user_id = (select auth.uid())
		)
		or exists (
			select 1 from public.shape_progression current_shape
			join public.shape_progression previous_shape
				on previous_shape.position = current_shape.position - 1
			where current_shape.shape_id = has_shape.shape_id
				and exists (
					select 1 from public.group_completions completed
					join public.puzzle_groups g on g.id = completed.group_id
					where completed.user_id = (select auth.uid())
						and g.purpose = 'core' and g.shape_id = previous_shape.shape_id
				)
		);
$$;

create function private.can_play_puzzle_group(group_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
	select exists (
		select 1 from public.puzzle_groups g
		where g.id = can_play_puzzle_group.group_id
			and g.purpose in ('core', 'reward', 'pack')
			and private.is_released(g.published_at, g.release_at)
			and private.has_shape(g.shape_id)
			and (
				g.purpose = 'core'
				or ((select auth.uid()) is not null and exists (
					select 1 from public.puzzle_group_grants grant_row
					where grant_row.group_id = g.id and grant_row.user_id = (select auth.uid())
				))
			)
	);
$$;

create or replace function private.can_play_puzzle(puzzle_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
	select exists (
		select 1 from public.puzzles p
		where p.id = puzzle_id and private.is_released(p.published_at, p.release_at)
			and (
				exists (
					select 1 from public.puzzle_group_members member
					join public.puzzle_groups g on g.id = member.group_id
					where member.puzzle_id = p.id
						and private.can_play_puzzle_group(g.id)
						and (
							g.selection_mode = 'any'
							or (select auth.uid()) is null
							or not exists (
								select 1 from public.puzzle_group_members previous
								where previous.group_id = g.id
									and previous.position < member.position
									and not exists (
										select 1 from public.puzzle_completions completed
										where completed.user_id = (select auth.uid())
											and completed.puzzle_id = previous.puzzle_id
									)
							)
						)
				)
				or exists (
					select 1 from public.daily_puzzles d
					where d.puzzle_id = p.id and (
						(d.release_at <= now() and now() < d.expires_at)
						or exists (
							select 1 from public.daily_play_sessions session
							where session.daily_id = d.id
								and session.user_id = (select auth.uid())
								and session.opened_at >= d.release_at
								and session.opened_at < d.expires_at
								and session.closed_at is null
						)
					)
				)
			)
	);
$$;

create or replace function private.reward_rule_released(reward_rule_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
	select exists (
		select 1 from public.reward_rules rule
		where rule.id = reward_rule_id and private.puzzle_group_released(rule.group_id)
	);
$$;

create policy catalog_read on public.puzzle_group_members for select to anon, authenticated
	using (private.puzzle_group_released(group_id));
create policy catalog_read on public.reward_rules for select to anon, authenticated
	using (private.puzzle_group_released(group_id));
create policy catalog_read on public.reward_puzzle_groups for select to anon, authenticated
	using (private.reward_rule_released(reward_rule_id) and private.puzzle_group_released(group_id));

revoke all on function private.puzzle_group_released(uuid) from public, anon, authenticated;
revoke all on function private.can_play_puzzle_group(uuid) from public, anon, authenticated;
grant execute on function private.puzzle_group_released(uuid) to anon, authenticated;

-- Guards.
create or replace function private.guard_published_content()
returns trigger
language plpgsql set search_path = ''
as $$
begin
	if old.published_at is not null and old.release_at <= clock_timestamp() then
		raise exception 'Live % cannot be updated or deleted.', tg_table_name
			using errcode = '23514';
	end if;
	if tg_op = 'UPDATE' and new.id is distinct from old.id
		and tg_table_name in ('puzzles', 'puzzle_groups') then
		raise exception 'Content IDs are permanent.' using errcode = '23514';
	end if;
	if tg_op = 'DELETE' then return old; end if;
	return new;
end;
$$;

create function private.guard_group_configuration()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
	old_row jsonb;
	new_row jsonb;
	row_data jsonb;
	parent_id uuid;
begin
	if tg_op <> 'INSERT' then old_row := to_jsonb(old); end if;
	if tg_op <> 'DELETE' then new_row := to_jsonb(new); end if;
	foreach row_data in array array[old_row, new_row] loop
		if row_data is null then continue; end if;
		if tg_table_name = 'puzzle_authoring' then
			perform 1 from public.puzzles
				where id = (row_data ->> 'puzzle_id')::uuid for update;
			if exists (
				select 1 from public.puzzles
				where id = (row_data ->> 'puzzle_id')::uuid
					and published_at is not null and release_at <= clock_timestamp()
			) then
				raise exception 'Live puzzle authoring cannot be changed.' using errcode = '23514';
			end if;
		else
			if tg_table_name in ('reward_palettes', 'reward_puzzle_groups') then
				select group_id into parent_id from public.reward_rules
					where id = (row_data ->> 'reward_rule_id')::uuid;
			else
				parent_id := (row_data ->> 'group_id')::uuid;
			end if;
			perform 1 from public.puzzle_groups where id = parent_id for update;
			if exists (
				select 1 from public.puzzle_groups where id = parent_id
					and published_at is not null and release_at <= clock_timestamp()
			) then
				raise exception 'Live group configuration cannot be changed.' using errcode = '23514';
			end if;
			if tg_op <> 'DELETE' and tg_table_name = 'reward_puzzle_groups' and not exists (
				select 1 from public.puzzle_groups
				where id = (row_data ->> 'group_id')::uuid and purpose = 'reward'
			) then
				raise exception 'Puzzle rewards must reference reward groups.' using errcode = '23514';
			end if;
		end if;
	end loop;
	if tg_op = 'DELETE' then return old; end if;
	return new;
end;
$$;

-- Members must match their group's shape (except daily groups) and track.
create function private.guard_puzzle_group_composition()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
	mismatch text;
begin
	if tg_table_name = 'puzzle_group_members' then
		select p.name into mismatch
		from public.puzzle_groups g, public.puzzles p
		where g.id = new.group_id and p.id = new.puzzle_id and (
			(g.shape_id is not null and p.shape_id <> g.shape_id)
			or (g.track = 'basic' and p.rotation_allowed)
			or (g.track = 'rotation' and not p.rotation_allowed)
		);
	elsif tg_table_name = 'puzzle_groups' then
		if new.purpose is distinct from old.purpose and new.purpose <> 'reward'
			and exists (select 1 from public.reward_puzzle_groups where group_id = new.id) then
			raise exception 'Groups used as bonus rewards must keep the reward purpose.'
				using errcode = '23514';
		end if;
		select p.name into mismatch
		from public.puzzle_group_members m join public.puzzles p on p.id = m.puzzle_id
		where m.group_id = new.id and (
			(new.shape_id is not null and p.shape_id <> new.shape_id)
			or (new.track = 'basic' and p.rotation_allowed)
			or (new.track = 'rotation' and not p.rotation_allowed)
		) limit 1;
	else
		select p.name into mismatch
		from public.puzzle_group_members m
		join public.puzzle_groups g on g.id = m.group_id
		join public.puzzles p on p.id = m.puzzle_id
		where m.puzzle_id = new.id and (
			(g.shape_id is not null and new.shape_id <> g.shape_id)
			or (g.track = 'basic' and new.rotation_allowed)
			or (g.track = 'rotation' and not new.rotation_allowed)
		);
	end if;
	if mismatch is not null then
		raise exception 'Puzzle "%" does not match the group''s shape or track.', mismatch
			using errcode = '23514';
	end if;
	return new;
end;
$$;

create function private.guard_palette_group_membership()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
	row_data jsonb;
	old_row jsonb;
	new_row jsonb;
begin
	if tg_op <> 'INSERT' then old_row := to_jsonb(old); end if;
	if tg_op <> 'DELETE' then new_row := to_jsonb(new); end if;
	foreach row_data in array array[old_row, new_row] loop
		if exists (
			select 1 from public.palette_groups
			where id = (row_data ->> 'group_id')::uuid
				and published_at is not null and release_at <= clock_timestamp()
		) then
			raise exception 'Live palette group membership cannot change.' using errcode = '23514';
		end if;
	end loop;
	if tg_op = 'DELETE' then return old; end if;
	return new;
end;
$$;

create or replace function private.validate_daily_assignment()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
	if tg_op <> 'INSERT' and old.release_at <= clock_timestamp() then
		raise exception 'Released daily assignments cannot be changed.' using errcode = '23514';
	end if;
	if tg_op = 'DELETE' then return old; end if;
	perform 1 from public.daily_schedule
		where rollover_time_utc = (new.release_at at time zone 'UTC')::time for share;
	if not found then
		raise exception 'Daily releases must use the configured global UTC rollover time.'
			using errcode = '23514';
	end if;
	if not exists (
		select 1 from public.puzzles p
		join public.puzzle_group_members m on m.puzzle_id = p.id
		join public.puzzle_groups g on g.id = m.group_id and g.purpose = 'daily'
		where p.id = new.puzzle_id and p.published_at is not null
			and p.release_at <= new.release_at
	) then
		raise exception 'Daily assignments require a published puzzle from a daily group ready by release.'
			using errcode = '23514';
	end if;
	return new;
end;
$$;

create or replace function private.validate_publication()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
	if new.published_at is null then return new; end if;
	if tg_table_name = 'puzzles' then
		if not exists (
			select 1 from public.shapes s where s.id = new.shape_id
				and s.published_at is not null and s.release_at <= new.release_at
		) then
			raise exception 'Publish the shape before this release.' using errcode = '23514';
		end if;
		if not exists (
			select 1 from public.palettes p where p.id = new.palette_id
				and p.published_at is not null and p.release_at <= new.release_at
		) then
			raise exception 'Publish the palette before this release.' using errcode = '23514';
		end if;
		if not exists (select 1 from public.puzzle_authoring where puzzle_id = new.id) then
			raise exception 'Save generator provenance and a known solution before publishing.'
				using errcode = '23514';
		end if;
	elsif tg_table_name = 'puzzle_groups' then
		if new.purpose = 'undecided' then
			raise exception 'Choose a purpose before publishing this group.' using errcode = '23514';
		end if;
		if new.shape_id is not null and not exists (
			select 1 from public.shapes s where s.id = new.shape_id
				and s.published_at is not null and s.release_at <= new.release_at
		) then
			raise exception 'Publish the shape before this release.' using errcode = '23514';
		end if;
		if not exists (select 1 from public.puzzle_group_members where group_id = new.id)
			or exists (
				select 1 from public.puzzle_group_members m join public.puzzles p on p.id = m.puzzle_id
				where m.group_id = new.id
					and (p.published_at is null or p.release_at > new.release_at)
			) then
			raise exception 'A published group requires published puzzles ready by its release.'
				using errcode = '23514';
		end if;
		if exists (
			select 1 from public.reward_rules r where r.group_id = new.id
				and not exists (select 1 from public.reward_palettes where reward_rule_id = r.id)
				and not exists (select 1 from public.reward_puzzle_groups where reward_rule_id = r.id)
		) then
			raise exception 'Every reward rule requires at least one reward.' using errcode = '23514';
		end if;
	end if;
	return new;
end;
$$;

-- Check the final transaction state, including reverse dependencies after cancellation.
create or replace function private.check_release_dependencies()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
	if exists (
		select 1 from public.puzzles p
		join public.shapes s on s.id = p.shape_id
		join public.palettes palette on palette.id = p.palette_id
		where p.published_at is not null and (
			s.published_at is null or s.release_at > p.release_at
			or palette.published_at is null or palette.release_at > p.release_at
			or not exists (select 1 from public.puzzle_authoring where puzzle_id = p.id)
		)
	) then
		raise exception 'A prepared puzzle requires its shape, palette, and authoring data ready by release.'
			using errcode = '23514';
	end if;
	if exists (
		select 1 from public.puzzle_groups g
		left join public.shapes s on s.id = g.shape_id
		where g.published_at is not null and (
			g.purpose = 'undecided'
			or (g.shape_id is not null and (s.published_at is null or s.release_at > g.release_at))
			or not exists (select 1 from public.puzzle_group_members where group_id = g.id)
			or exists (
				select 1 from public.puzzle_group_members m join public.puzzles p on p.id = m.puzzle_id
				where m.group_id = g.id and (p.published_at is null or p.release_at > g.release_at)
			)
		)
	) then
		raise exception 'A prepared group requires a purpose, its shape, and puzzles ready by release.'
			using errcode = '23514';
	end if;
	if exists (
		select 1 from public.reward_rules rule
		join public.puzzle_groups source on source.id = rule.group_id
		where source.published_at is not null and (
			(not exists (select 1 from public.reward_palettes where reward_rule_id = rule.id)
				and not exists (select 1 from public.reward_puzzle_groups where reward_rule_id = rule.id))
			or exists (
				select 1 from public.reward_palettes r join public.palettes p on p.id = r.palette_id
				where r.reward_rule_id = rule.id and (p.published_at is null or p.release_at > source.release_at)
			)
			or exists (
				select 1 from public.reward_puzzle_groups r join public.puzzle_groups g on g.id = r.group_id
				where r.reward_rule_id = rule.id
					and (g.purpose <> 'reward' or g.published_at is null or g.release_at > source.release_at)
			)
		)
	) then
		raise exception 'Prepared rewards must be nonempty and available by their source group release.'
			using errcode = '23514';
	end if;
	if exists (
		select 1 from public.daily_puzzles d join public.puzzles p on p.id = d.puzzle_id
		where p.published_at is null or p.release_at > d.release_at
	) then
		raise exception 'A scheduled daily requires its puzzle ready by release.' using errcode = '23514';
	end if;
	if exists (
		select 1 from public.palette_groups pg where pg.published_at is not null and (
			pg.purpose = 'undecided'
			or not exists (select 1 from public.palette_group_members where group_id = pg.id)
			or exists (
				select 1 from public.palette_group_members m join public.palettes p on p.id = m.palette_id
				where m.group_id = pg.id and (p.published_at is null or p.release_at > pg.release_at)
			)
		)
	) then
		raise exception 'A prepared palette group requires a purpose and palettes ready by release.'
			using errcode = '23514';
	end if;
	return null;
end;
$$;

drop function private.guard_collection_configuration();
drop function private.guard_pack_membership();

revoke all on function private.guard_group_configuration() from public, anon, authenticated;
revoke all on function private.guard_puzzle_group_composition() from public, anon, authenticated;
revoke all on function private.guard_palette_group_membership() from public, anon, authenticated;

create trigger members_guard before insert or update or delete on public.puzzle_group_members
	for each row execute function private.guard_group_configuration();
create trigger authoring_guard before insert or update or delete on public.puzzle_authoring
	for each row execute function private.guard_group_configuration();
create trigger rewards_guard before insert or update or delete on public.reward_rules
	for each row execute function private.guard_group_configuration();
create trigger reward_palettes_guard before insert or update or delete on public.reward_palettes
	for each row execute function private.guard_group_configuration();
create trigger reward_puzzle_groups_guard before insert or update or delete on public.reward_puzzle_groups
	for each row execute function private.guard_group_configuration();
create trigger palette_group_membership_guard
	before insert or update or delete on public.palette_group_members
	for each row execute function private.guard_palette_group_membership();
create trigger members_composition before insert or update on public.puzzle_group_members
	for each row execute function private.guard_puzzle_group_composition();
create trigger groups_composition before update on public.puzzle_groups
	for each row execute function private.guard_puzzle_group_composition();
create trigger puzzles_composition before update of shape_id, rotation_allowed on public.puzzles
	for each row execute function private.guard_puzzle_group_composition();
create trigger puzzles_publication before insert or update on public.puzzles
	for each row execute function private.validate_publication();
create trigger groups_publication before insert or update on public.puzzle_groups
	for each row execute function private.validate_publication();
create trigger daily_assignment_guard before insert or update or delete on public.daily_puzzles
	for each row execute function private.validate_daily_assignment();

do $$
declare
	table_name text;
begin
	foreach table_name in array array[
		'palettes', 'shapes', 'puzzles', 'puzzle_authoring', 'puzzle_groups',
		'puzzle_group_members', 'reward_rules', 'reward_palettes', 'reward_puzzle_groups',
		'daily_puzzles', 'palette_groups', 'palette_group_members'
	] loop
		execute format(
			'create constraint trigger release_dependencies
			 after insert or update or delete on public.%I
			 deferrable initially deferred for each row
			 execute function private.check_release_dependencies()', table_name
		);
	end loop;
end;
$$;

-- Admin operations.
drop function public.manage_draft_set(uuid, text, text, text, uuid[], text);
drop function public.delete_draft_set(uuid);
drop function public.manage_palette_set(uuid, text, text, text, text[]);
drop function public.save_puzzle_draft(
	uuid, text, text, text, text, text, boolean, text, jsonb, text, text, jsonb
);
drop function public.replace_puzzle_draft(
	uuid, text, text, text, text, text, boolean, text, jsonb, text, text, jsonb
);
drop function public.edit_puzzle_draft(uuid, text, text, text);

create function public.save_puzzle_draft(
	p_id uuid,
	p_name text,
	p_shape_id text,
	p_palette_id text,
	p_board_size text,
	p_rotation_allowed boolean,
	p_difficulty text,
	p_definition jsonb,
	p_seed text,
	p_generator_version text,
	p_known_solution jsonb
)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
begin
	if not private.is_admin() then
		raise exception 'Only the admin can save puzzle drafts.' using errcode = '42501';
	end if;
	if current_setting('transaction_isolation') <> 'read committed' then
		raise exception 'Catalog editing requires READ COMMITTED isolation.' using errcode = '25001';
	end if;
	if p_shape_id is null or not exists(select 1 from public.shapes where id = p_shape_id) then
		raise exception 'Choose a valid puzzle shape.' using errcode = '22023';
	end if;
	perform pg_catalog.pg_advisory_xact_lock(71429, 1);

	-- A retried request must return the same draft, not create another copy.
	if exists (select 1 from public.puzzles where id = p_id) then
		if exists (
			select 1 from public.puzzles p
			join public.puzzle_authoring a on a.puzzle_id = p.id
			where p.id = p_id and p.name = btrim(p_name)
				and p.shape_id = p_shape_id and p.palette_id = p_palette_id
				and p.board_size = p_board_size and p.rotation_allowed = p_rotation_allowed
				and p.difficulty = p_difficulty and p.definition = p_definition
				and p.published_at is null and p.release_at is null
				and a.seed = p_seed and a.generator_version = p_generator_version
				and a.known_solution = p_known_solution
		) then
			return p_id;
		end if;
		raise exception 'This draft ID already belongs to different content.' using errcode = '23505';
	end if;

	insert into public.puzzles(
		id, name, shape_id, palette_id, board_size, rotation_allowed, difficulty, definition
	) values (
		p_id, btrim(p_name), p_shape_id, p_palette_id, p_board_size,
		p_rotation_allowed, p_difficulty, p_definition
	);
	insert into public.puzzle_authoring(puzzle_id, seed, generator_version, known_solution)
		values (p_id, p_seed, p_generator_version, p_known_solution);
	return p_id;
end;
$$;

create function public.replace_puzzle_draft(
	p_id uuid,
	p_name text,
	p_shape_id text,
	p_palette_id text,
	p_board_size text,
	p_rotation_allowed boolean,
	p_difficulty text,
	p_definition jsonb,
	p_seed text,
	p_generator_version text,
	p_known_solution jsonb
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
	current_puzzle public.puzzles;
begin
	if not private.is_admin() then
		raise exception 'Only the admin can replace puzzle drafts.' using errcode = '42501';
	end if;
	if current_setting('transaction_isolation') <> 'read committed' then
		raise exception 'Catalog editing requires READ COMMITTED isolation.' using errcode = '25001';
	end if;
	perform pg_catalog.pg_advisory_xact_lock(71429, 1);
	select * into current_puzzle from public.puzzles where id = p_id for update;
	if not found then
		raise exception 'The puzzle draft no longer exists.' using errcode = 'P0002';
	end if;
	if current_puzzle.published_at is not null and current_puzzle.release_at <= clock_timestamp() then
		raise exception 'Live puzzles cannot be replaced.' using errcode = '23514';
	end if;
	if current_puzzle.shape_id is distinct from p_shape_id then
		raise exception 'A puzzle''s shape cannot change.' using errcode = '23514';
	end if;

	update public.puzzles set
		name = btrim(p_name), palette_id = p_palette_id,
		board_size = p_board_size, rotation_allowed = p_rotation_allowed,
		difficulty = p_difficulty, definition = p_definition
		where id = p_id;
	update public.puzzle_authoring set
		seed = p_seed, generator_version = p_generator_version, known_solution = p_known_solution
		where puzzle_id = p_id;
	if not found then
		raise exception 'The draft authoring record no longer exists.' using errcode = 'P0002';
	end if;
	return p_id;
end;
$$;

create function public.edit_puzzle_draft(p_id uuid, p_name text, p_palette_id text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
	current_puzzle public.puzzles;
begin
	if not private.is_admin() then
		raise exception 'Only the admin can edit puzzle drafts.' using errcode = '42501';
	end if;
	if current_setting('transaction_isolation') <> 'read committed' then
		raise exception 'Catalog editing requires READ COMMITTED isolation.' using errcode = '25001';
	end if;
	perform pg_catalog.pg_advisory_xact_lock(71429, 1);
	select * into current_puzzle from public.puzzles where id = p_id for update;
	if not found then
		raise exception 'The puzzle draft no longer exists.' using errcode = 'P0002';
	end if;
	if current_puzzle.published_at is not null and current_puzzle.release_at <= clock_timestamp() then
		raise exception 'Live puzzles cannot be edited.' using errcode = '23514';
	end if;
	update public.puzzles set name = btrim(p_name), palette_id = p_palette_id where id = p_id;
	return p_id;
end;
$$;

create or replace function public.delete_puzzle_draft(p_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
	current_puzzle public.puzzles;
begin
	if not private.is_admin() then
		raise exception 'Only the admin can delete puzzle drafts.' using errcode = '42501';
	end if;
	if current_setting('transaction_isolation') <> 'read committed' then
		raise exception 'Catalog editing requires READ COMMITTED isolation.' using errcode = '25001';
	end if;
	perform pg_catalog.pg_advisory_xact_lock(71429, 1);
	select * into current_puzzle from public.puzzles where id = p_id for update;
	if not found then
		raise exception 'The puzzle draft no longer exists.' using errcode = 'P0002';
	end if;
	if current_puzzle.published_at is not null then
		raise exception 'Only unpublished drafts can be deleted here.' using errcode = '23514';
	end if;
	if exists(select 1 from public.puzzle_group_members where puzzle_id = p_id)
		or exists(select 1 from public.daily_puzzles where puzzle_id = p_id) then
		raise exception 'Unassign the puzzle before deleting it.' using errcode = '23514';
	end if;
	delete from public.puzzles where id = p_id;
	return p_id;
end;
$$;

create or replace function public.bulk_puzzle_drafts(p_ids uuid[], p_action text, p_palette_id text default null)
returns uuid[] language plpgsql security invoker set search_path = '' as $$
declare
	puzzle public.puzzles;
begin
	if not private.is_admin() then
		raise exception 'Only the admin can manage puzzle drafts.' using errcode = '42501';
	end if;
	if current_setting('transaction_isolation') <> 'read committed' then
		raise exception 'Catalog editing requires READ COMMITTED isolation.' using errcode = '25001';
	end if;
	if p_ids is null or cardinality(p_ids) = 0
		or exists(select 1 from unnest(p_ids) id where id is null)
		or cardinality(p_ids) <> (select count(distinct id) from unnest(p_ids) id) then
		raise exception 'Select a nonempty list of distinct puzzle IDs.' using errcode = '22023';
	end if;
	if p_action is null or p_action not in ('delete', 'palette')
		or (p_action = 'delete' and p_palette_id is not null)
		or (p_action = 'palette' and p_palette_id is null) then
		raise exception 'Choose delete or a palette change.' using errcode = '22023';
	end if;
	perform pg_catalog.pg_advisory_xact_lock(71429, 1);
	if (select count(*) from public.puzzles where id = any(p_ids)) <> cardinality(p_ids) then
		raise exception 'A selected draft no longer exists. Refresh the library.' using errcode = 'P0002';
	end if;
	for puzzle in select * from public.puzzles where id = any(p_ids) order by id for update loop
		if puzzle.published_at is not null then
			raise exception 'Puzzle "%" is scheduled or live; no selected drafts were changed.', puzzle.name
				using errcode = '23514';
		end if;
		if p_action = 'delete' and (
			exists(select 1 from public.puzzle_group_members where puzzle_id = puzzle.id)
			or exists(select 1 from public.daily_puzzles where puzzle_id = puzzle.id)
		) then
			raise exception 'Puzzle "%" is assigned; unassign it before deleting. No selected drafts were deleted.', puzzle.name
				using errcode = '23514';
		end if;
	end loop;
	if p_action = 'palette' then
		if not exists(select 1 from public.palettes where id = p_palette_id) then
			raise exception 'The selected palette no longer exists.' using errcode = '23503';
		end if;
		update public.puzzles set palette_id = p_palette_id where id = any(p_ids);
	else
		delete from public.puzzles where id = any(p_ids);
	end if;
	return p_ids;
end;
$$;

create function public.manage_puzzle_group(
	p_id uuid,
	p_action text,
	p_name text default null,
	p_purpose text default null,
	p_shape_id text default null,
	p_track text default null,
	p_puzzle_ids uuid[] default '{}'
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
	current_group public.puzzle_groups;
	current_ids uuid[];
	blocker text;
	offset_position integer;
begin
	if not private.is_admin() then
		raise exception 'Only the admin can manage puzzle groups.' using errcode = '42501';
	end if;
	if current_setting('transaction_isolation') <> 'read committed' then
		raise exception 'Catalog editing requires READ COMMITTED isolation.' using errcode = '25001';
	end if;
	if p_id is null or p_action is null
		or p_action not in ('create', 'update', 'delete', 'append', 'remove', 'reorder') then
		raise exception 'Choose a valid puzzle group and action.' using errcode = '22023';
	end if;
	if p_puzzle_ids is null or array_position(p_puzzle_ids, null) is not null
		or cardinality(p_puzzle_ids) <> (select count(distinct id) from unnest(p_puzzle_ids) as ids(id)) then
		raise exception 'Puzzle IDs must be distinct and non-null.' using errcode = '22023';
	end if;
	if p_action in ('create', 'update') then
		if p_name is null or btrim(p_name) = '' or cardinality(p_puzzle_ids) <> 0 then
			raise exception 'Enter a group name without puzzle IDs.' using errcode = '22023';
		end if;
		if p_purpose is null or p_purpose not in ('undecided', 'core', 'reward', 'daily', 'pack') then
			raise exception 'Choose a valid group purpose.' using errcode = '22023';
		end if;
		if p_purpose = 'daily' then
			if p_shape_id is not null then
				raise exception 'Daily groups can mix shapes, so they have no shape.' using errcode = '22023';
			end if;
		elsif p_shape_id is null or not exists(select 1 from public.shapes where id = p_shape_id) then
			raise exception 'Choose a valid shape for this group.' using errcode = '22023';
		end if;
		if p_purpose in ('core', 'reward') and (p_track is null or p_track not in ('basic', 'rotation')) then
			raise exception 'Choose a Basic or Rotation track.' using errcode = '22023';
		elsif p_purpose = 'pack' and (p_track is null or p_track not in ('basic', 'rotation', 'mixed')) then
			raise exception 'Choose a Basic, Rotation, or Mixed track.' using errcode = '22023';
		elsif p_purpose in ('undecided', 'daily') and p_track is not null then
			raise exception 'Undecided and daily groups have no track.' using errcode = '22023';
		end if;
	elsif p_name is not null or p_purpose is not null or p_shape_id is not null or p_track is not null then
		raise exception 'This action cannot change group details.' using errcode = '22023';
	end if;
	if p_action = 'delete' and cardinality(p_puzzle_ids) <> 0 then
		raise exception 'Group deletion cannot specify puzzles.' using errcode = '22023';
	end if;
	perform pg_catalog.pg_advisory_xact_lock(71429, 1);
	select * into current_group from public.puzzle_groups where id = p_id for update;
	if p_action = 'create' then
		if found then
			if current_group.name = btrim(p_name) and current_group.purpose = p_purpose
				and current_group.shape_id is not distinct from p_shape_id
				and current_group.track is not distinct from p_track
				and current_group.published_at is null then
				return p_id;
			end if;
			raise exception 'This group ID already belongs to different content.' using errcode = '23505';
		end if;
		insert into public.puzzle_groups(id, name, purpose, shape_id, track)
			values (p_id, btrim(p_name), p_purpose, p_shape_id, p_track);
		return p_id;
	end if;
	if not found then
		raise exception 'The puzzle group no longer exists. Refresh the library.' using errcode = 'P0002';
	end if;
	if current_group.published_at is not null or current_group.release_at is not null then
		raise exception 'Only unpublished puzzle groups can be changed here.' using errcode = '23514';
	end if;
	if p_action = 'update' then
		if exists(select 1 from public.puzzle_group_members m
			join public.daily_puzzles d on d.puzzle_id = m.puzzle_id where m.group_id = p_id)
			and (p_purpose <> current_group.purpose or p_shape_id is distinct from current_group.shape_id
				or p_track is distinct from current_group.track) then
			raise exception 'Remove scheduled daily puzzles before changing this group.' using errcode = '23514';
		end if;
		if p_purpose <> current_group.purpose and (
			exists(select 1 from public.reward_rules where group_id = p_id)
			or exists(select 1 from public.reward_puzzle_groups where group_id = p_id)
			or exists(select 1 from public.puzzle_group_grants where group_id = p_id)
			or exists(select 1 from public.group_completions where group_id = p_id)
		) then
			raise exception 'Remove reward, grant, and completion dependencies before changing this group''s purpose.'
				using errcode = '23514';
		end if;
		update public.puzzle_groups set
			name = btrim(p_name), purpose = p_purpose, shape_id = p_shape_id, track = p_track
			where id = p_id;
		return p_id;
	end if;
	if p_action = 'delete' then
		if exists(select 1 from public.reward_puzzle_groups where group_id = p_id)
			or exists(select 1 from public.reward_rules where group_id = p_id)
			or exists(select 1 from public.puzzle_group_grants where group_id = p_id)
			or exists(select 1 from public.group_completions where group_id = p_id) then
			raise exception 'Remove reward, grant, and completion dependencies before deleting this group.' using errcode = '23514';
		end if;
		if exists(select 1 from public.puzzle_group_members m join public.puzzles p on p.id = m.puzzle_id
			where m.group_id = p_id and (p.published_at is not null or p.release_at is not null)) then
			raise exception 'Unassign prepared puzzles before deleting this group.' using errcode = '23514';
		end if;
		if exists(select 1 from public.puzzle_group_members m
			join public.daily_puzzles d on d.puzzle_id = m.puzzle_id where m.group_id = p_id) then
			raise exception 'Remove scheduled daily puzzles before deleting this group.' using errcode = '23514';
		end if;
		delete from public.puzzle_group_members where group_id = p_id;
		delete from public.puzzle_groups where id = p_id;
		return p_id;
	end if;
	select coalesce(array_agg(puzzle_id order by position), '{}'::uuid[]) into current_ids
		from public.puzzle_group_members where group_id = p_id;
	if p_action in ('append', 'remove') and cardinality(p_puzzle_ids) = 0 then
		raise exception 'Select at least one puzzle.' using errcode = '22023';
	end if;
	if p_action = 'append' then
		if exists(select 1 from unnest(p_puzzle_ids) as ids(id)
			where not exists(select 1 from public.puzzles where puzzles.id = ids.id)) then
			raise exception 'A selected puzzle no longer exists. Refresh the library.' using errcode = 'P0002';
		end if;
		select p.name into blocker from public.puzzles p where p.id = any(p_puzzle_ids) and (
			p.published_at is not null or p.release_at is not null
			or (current_group.shape_id is not null and p.shape_id <> current_group.shape_id)
			or (current_group.track = 'basic' and p.rotation_allowed)
			or (current_group.track = 'rotation' and not p.rotation_allowed)
			or exists(select 1 from public.puzzle_group_members m where m.puzzle_id = p.id)
			or exists(select 1 from public.daily_puzzles d where d.puzzle_id = p.id)
		) order by p.id limit 1;
		if found then
			raise exception 'Puzzle "%" must be an unassigned, unpublished draft matching the group''s shape and track.', blocker using errcode = '23514';
		end if;
		select coalesce(max(position), 0) into offset_position
			from public.puzzle_group_members where group_id = p_id;
		insert into public.puzzle_group_members(puzzle_id, group_id, position)
			select id, p_id, offset_position + ordinality::integer
				from unnest(p_puzzle_ids) with ordinality as ids(id, ordinality);
		return p_id;
	end if;
	if p_action = 'remove' then
		if not p_puzzle_ids <@ current_ids then
			raise exception 'Group membership changed. Refresh before removing puzzles.' using errcode = '23514';
		end if;
		select p.name into blocker from public.puzzles p where p.id = any(p_puzzle_ids) and (
			p.published_at is not null or p.release_at is not null
			or exists(select 1 from public.daily_puzzles d where d.puzzle_id = p.id)
		) order by p.id limit 1;
		if found then
			raise exception 'Puzzle "%" must be unpublished and unscheduled before unassigning.', blocker using errcode = '23514';
		end if;
		delete from public.puzzle_group_members where group_id = p_id and puzzle_id = any(p_puzzle_ids);
		select coalesce(array_agg(puzzle_id order by position), '{}'::uuid[]) into p_puzzle_ids
			from public.puzzle_group_members where group_id = p_id;
	elsif cardinality(p_puzzle_ids) <> cardinality(current_ids) or not p_puzzle_ids <@ current_ids then
		raise exception 'Group membership changed. Refresh before reordering puzzles.' using errcode = '23514';
	end if;
	-- Move existing positions out of the way before assigning the final contiguous order.
	select coalesce(max(position), 0) into offset_position
		from public.puzzle_group_members where group_id = p_id;
	update public.puzzle_group_members set position = position + offset_position
		where group_id = p_id;
	update public.puzzle_group_members m set position = ids.ordinality::integer
		from unnest(p_puzzle_ids) with ordinality as ids(id, ordinality)
		where m.group_id = p_id and m.puzzle_id = ids.id;
	return p_id;
end;
$$;

create function public.manage_palette_group(
	p_id uuid,
	p_action text,
	p_name text default null,
	p_purpose text default null,
	p_palette_ids text[] default '{}'
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
	current_group public.palette_groups;
	current_ids text[];
begin
	if not private.is_admin() then
		raise exception 'Only the admin can manage palette groups.' using errcode = '42501';
	end if;
	if current_setting('transaction_isolation') <> 'read committed' then
		raise exception 'Catalog editing requires READ COMMITTED isolation.' using errcode = '25001';
	end if;
	if p_id is null or p_action is null or p_action not in ('create', 'update', 'assign', 'remove', 'reorder', 'delete') then
		raise exception 'Choose a valid palette group action.' using errcode = '22023';
	end if;
	if p_palette_ids is null or array_position(p_palette_ids, null) is not null
		or cardinality(p_palette_ids) <> (select count(distinct id) from unnest(p_palette_ids) as ids(id)) then
		raise exception 'Palette IDs must be distinct and non-null.' using errcode = '22023';
	end if;
	if p_action in ('create', 'update') then
		if p_name is null or btrim(p_name) = '' or p_purpose is null
			or p_purpose not in ('undecided', 'core', 'reward', 'pack')
			or cardinality(p_palette_ids) <> 0 then
			raise exception 'Enter a group name and choose Undecided, Core, Reward, or Pack.' using errcode = '22023';
		end if;
	elsif p_name is not null or p_purpose is not null then
		raise exception 'This action cannot change group details.' using errcode = '22023';
	end if;
	perform pg_catalog.pg_advisory_xact_lock(71429, 1);
	select * into current_group from public.palette_groups where id = p_id for update;
	if p_action = 'create' then
		if found then
			if current_group.name = btrim(p_name) and current_group.purpose = p_purpose
				and current_group.published_at is null and current_group.release_at is null then
				return p_id;
			end if;
			raise exception 'This group ID already belongs to different content.' using errcode = '23505';
		end if;
		insert into public.palette_groups(id, name, purpose) values(p_id, btrim(p_name), p_purpose);
		return p_id;
	end if;
	if not found then
		raise exception 'The palette group no longer exists. Refresh the library.' using errcode = 'P0002';
	end if;
	if current_group.published_at is not null or current_group.release_at is not null then
		raise exception 'Only unpublished palette groups can be changed here.' using errcode = '23514';
	end if;
	if p_action = 'update' then
		update public.palette_groups set name = btrim(p_name), purpose = p_purpose where id = p_id;
		return p_id;
	end if;
	select coalesce(array_agg(palette_id order by position), '{}'::text[]) into current_ids
		from public.palette_group_members where group_id = p_id;
	if p_action = 'delete' then
		if cardinality(p_palette_ids) <> 0 then
			raise exception 'Group deletion cannot specify palettes.' using errcode = '22023';
		end if;
		delete from public.palette_group_members where group_id = p_id;
		delete from public.palette_groups where id = p_id;
		return p_id;
	end if;
	if p_action in ('assign', 'remove') and cardinality(p_palette_ids) = 0 then
		raise exception 'Select at least one palette.' using errcode = '22023';
	end if;
	if p_action = 'assign' then
		if exists(select 1 from unnest(p_palette_ids) as ids(id)
			where not exists(select 1 from public.palettes p where p.id = ids.id)) then
			raise exception 'A selected palette no longer exists. Refresh the library.' using errcode = 'P0002';
		end if;
		if exists(select 1 from public.palette_group_members m
			join public.palette_groups s on s.id = m.group_id
			where m.palette_id = any(p_palette_ids)
				and (s.published_at is not null or s.release_at is not null)) then
			raise exception 'Palettes cannot be moved out of a prepared group.' using errcode = '23514';
		end if;
		-- Keep existing destination order; append moved palettes in selection order.
		delete from public.palette_group_members
			where palette_id = any(p_palette_ids) and group_id <> p_id;
		insert into public.palette_group_members(group_id, palette_id, position)
			select p_id, id,
				(select coalesce(max(position), 0) from public.palette_group_members where group_id = p_id)
				+ row_number() over (order by ordinality)::integer
			from unnest(p_palette_ids) with ordinality as ids(id, ordinality)
			where not exists(select 1 from public.palette_group_members where palette_id = ids.id);
		return p_id;
	end if;
	if p_action = 'remove' then
		if not p_palette_ids <@ current_ids then
			raise exception 'Group membership changed. Refresh before removing palettes.' using errcode = '40001';
		end if;
		delete from public.palette_group_members where group_id = p_id and palette_id = any(p_palette_ids);
	else
		if not (p_palette_ids @> current_ids and p_palette_ids <@ current_ids) then
			raise exception 'Group membership changed. Refresh before reordering palettes.' using errcode = '40001';
		end if;
		delete from public.palette_group_members where group_id = p_id;
		insert into public.palette_group_members(group_id, palette_id, position)
			select p_id, id, ordinality::integer from unnest(p_palette_ids) with ordinality as ids(id, ordinality);
	end if;
	return p_id;
end;
$$;

create or replace function public.manage_palette_draft(
	p_id text,
	p_action text,
	p_name text default null,
	p_colors text[] default null,
	p_expected_name text default null,
	p_expected_colors text[] default null,
	p_expected_revision bigint default null
)
returns text
language plpgsql security invoker set search_path = ''
as $$
declare
	current_palette public.palettes;
	result_revision bigint;
begin
	if not private.is_admin() then
		raise exception 'Only the admin can manage palette drafts.' using errcode = '42501';
	end if;
	if current_setting('transaction_isolation') <> 'read committed' then
		raise exception 'Catalog editing requires READ COMMITTED isolation.' using errcode = '25001';
	end if;
	if p_action is null or p_action not in ('create', 'update', 'delete') then
		raise exception 'Choose a valid palette action.' using errcode = '23514';
	end if;
	if p_id is null or p_id = '' or p_id <> btrim(p_id) then
		raise exception 'A permanent palette ID is required.' using errcode = '23514';
	end if;
	perform pg_catalog.pg_advisory_xact_lock(71429, 1);
	select * into current_palette from public.palettes where id = p_id for update;

	if p_action = 'create' then
		if found then
			if current_palette.published_at is null and current_palette.release_at is null
				and current_palette.revision = 1
				and current_palette.name = btrim(p_name) and current_palette.colors = p_colors then
				return p_id;
			end if;
			raise exception 'This palette ID already belongs to different content.' using errcode = '23505';
		end if;
		insert into public.palettes(id, name, colors) values(p_id, btrim(p_name), p_colors);
		return p_id;
	end if;

	if not found then
		raise exception 'The palette no longer exists. Refresh the catalog.' using errcode = 'P0002';
	end if;
	if current_palette.published_at is not null or current_palette.release_at is not null then
		raise exception 'Only unpublished draft palettes can be changed here.' using errcode = '23514';
	end if;
	if p_expected_name is null or p_expected_colors is null or p_expected_revision is null then
		raise exception 'Load the palette before changing it.' using errcode = '23514';
	end if;

	if p_action = 'update' then
		result_revision := p_expected_revision + case when p_colors is distinct from p_expected_colors then 1 else 0 end;
		-- Confirm a lost-response retry without incrementing revision again.
		if current_palette.name = btrim(p_name) and current_palette.colors = p_colors
			and current_palette.revision = result_revision then
			return p_id;
		end if;
	end if;
	if current_palette.name is distinct from p_expected_name
		or current_palette.colors is distinct from p_expected_colors
		or current_palette.revision is distinct from p_expected_revision then
		raise exception 'This palette changed since it was loaded. Refresh and review before retrying.'
			using errcode = '40001';
	end if;

	if p_action = 'update' then
		update public.palettes set name = btrim(p_name), colors = p_colors where id = p_id;
	else
		if exists(select 1 from public.puzzles where palette_id = p_id)
			or exists(select 1 from public.reward_palettes where palette_id = p_id)
			or exists(select 1 from public.palette_group_members where palette_id = p_id)
			or exists(select 1 from public.palette_grants where palette_id = p_id)
			or exists(select 1 from public.palette_corrections where palette_id = p_id) then
			raise exception 'This palette is in use by puzzles, rewards, palette groups, grants, or correction history. Remove dependencies before deleting it.'
				using errcode = '23514';
		end if;
		delete from public.palettes where id = p_id;
	end if;
	return p_id;
end;
$$;

create or replace function public.delete_palette_draft(
	p_id text,
	p_expected_name text,
	p_expected_colors text[],
	p_expected_revision bigint
)
returns text language plpgsql security invoker set search_path = '' as $$
begin
	if not private.is_admin() then
		raise exception 'Only the admin can delete palette drafts.' using errcode = '42501';
	end if;
	if current_setting('transaction_isolation') <> 'read committed' then
		raise exception 'Catalog editing requires READ COMMITTED isolation.' using errcode = '25001';
	end if;
	perform pg_catalog.pg_advisory_xact_lock(71429, 1);
	if exists(select 1 from public.palette_group_members m
		join public.palette_groups s on s.id = m.group_id
		where m.palette_id = p_id and (s.published_at is not null or s.release_at is not null)) then
		raise exception 'A prepared palette group references this palette.' using errcode = '23514';
	end if;
	delete from public.palette_group_members where palette_id = p_id;
	-- The existing operation checks palette state, stale edits, and all other references.
	-- Any failure also rolls back the membership removal.
	return public.manage_palette_draft(
		p_id, 'delete', p_expected_name => p_expected_name,
		p_expected_colors => p_expected_colors, p_expected_revision => p_expected_revision
	);
end;
$$;

create or replace function public.bulk_delete_palette_drafts(p_ids text[])
returns text[] language plpgsql security invoker set search_path = '' as $$
declare
	palette public.palettes;
begin
	if not private.is_admin() then
		raise exception 'Only the admin can delete palette drafts.' using errcode = '42501';
	end if;
	if current_setting('transaction_isolation') <> 'read committed' then
		raise exception 'Catalog editing requires READ COMMITTED isolation.' using errcode = '25001';
	end if;
	if p_ids is null or cardinality(p_ids) = 0
		or exists(select 1 from unnest(p_ids) id where id is null)
		or cardinality(p_ids) <> (select count(distinct id) from unnest(p_ids) id) then
		raise exception 'Select a nonempty list of distinct palette IDs.' using errcode = '22023';
	end if;
	perform pg_catalog.pg_advisory_xact_lock(71429, 1);
	if (select count(*) from public.palettes where id = any(p_ids)) <> cardinality(p_ids) then
		raise exception 'A selected palette no longer exists. Refresh the library.' using errcode = 'P0002';
	end if;
	for palette in select * from public.palettes where id = any(p_ids) order by id for update loop
		if palette.published_at is not null or palette.release_at is not null then
			raise exception 'Palette "%" is scheduled or live; no selected palettes were deleted.', palette.name
				using errcode = '23514';
		end if;
		if exists(select 1 from public.palette_group_members where palette_id = palette.id) then
			raise exception 'Palette "%" is in a group; remove it before deleting. No selected palettes were deleted.', palette.name
				using errcode = '23514';
		end if;
		if exists(select 1 from public.puzzles where palette_id = palette.id)
			or exists(select 1 from public.reward_palettes where palette_id = palette.id)
			or exists(select 1 from public.palette_grants where palette_id = palette.id)
			or exists(select 1 from public.palette_corrections where palette_id = palette.id) then
			raise exception 'Palette "%" is in use by puzzles, rewards, grants, or correction history. No selected palettes were deleted.', palette.name
				using errcode = '23514';
		end if;
	end loop;
	delete from public.palettes where id = any(p_ids);
	return p_ids;
end;
$$;

revoke all on function public.save_puzzle_draft(
	uuid, text, text, text, text, boolean, text, jsonb, text, text, jsonb
) from public, anon;
grant execute on function public.save_puzzle_draft(
	uuid, text, text, text, text, boolean, text, jsonb, text, text, jsonb
) to authenticated;
revoke all on function public.replace_puzzle_draft(
	uuid, text, text, text, text, boolean, text, jsonb, text, text, jsonb
) from public, anon;
grant execute on function public.replace_puzzle_draft(
	uuid, text, text, text, text, boolean, text, jsonb, text, text, jsonb
) to authenticated;
revoke all on function public.edit_puzzle_draft(uuid, text, text) from public, anon;
grant execute on function public.edit_puzzle_draft(uuid, text, text) to authenticated;
revoke all on function public.manage_puzzle_group(uuid, text, text, text, text, text, uuid[])
	from public, anon;
grant execute on function public.manage_puzzle_group(uuid, text, text, text, text, text, uuid[])
	to authenticated;
revoke all on function public.manage_palette_group(uuid, text, text, text, text[]) from public, anon;
grant execute on function public.manage_palette_group(uuid, text, text, text, text[]) to authenticated;

drop function pg_temp.drop_constraints(regclass, "char", text);

commit;
