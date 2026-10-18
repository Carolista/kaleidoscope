begin;

-- Serialize catalog transactions before row locks; player saves do not use this lock.
create function private.lock_content_edit()
returns trigger
language plpgsql set search_path = ''
as $$
begin
	if current_setting('transaction_isolation') <> 'read committed' then
		raise exception 'Catalog editing requires READ COMMITTED isolation.'
			using errcode = '25001';
	end if;
	perform pg_catalog.pg_advisory_xact_lock(71429, 1);
	return null;
end;
$$;

do $$
declare
	table_name text;
begin
	foreach table_name in array array[
		'palettes', 'shapes', 'puzzles', 'puzzle_authoring', 'puzzle_collections',
		'collection_puzzles', 'completion_routes', 'route_puzzles',
		'core_progression', 'core_steps', 'reward_rules', 'reward_palettes',
		'reward_sets', 'reward_shapes', 'daily_schedule', 'daily_puzzles',
		'palette_packs', 'palette_pack_palettes', 'starter_palettes', 'starter_shapes'
	] loop
		execute format(
			'create trigger content_edit_lock before insert or update or delete on public.%I
			 for each statement execute function private.lock_content_edit()', table_name
		);
	end loop;
end;
$$;

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
		and tg_table_name in ('puzzles', 'puzzle_collections') then
		raise exception 'Content IDs are permanent.' using errcode = '23514';
	end if;
	if tg_op = 'DELETE' then return old; end if;
	return new;
end;
$$;

-- core_progression has no id column, so give it its own row guard.
create function private.guard_core_release()
returns trigger
language plpgsql set search_path = ''
as $$
begin
	if old.published_at is not null and old.release_at <= clock_timestamp() then
		raise exception 'Live core progression cannot be changed.' using errcode = '23514';
	end if;
	if tg_op = 'DELETE' then return old; end if;
	return new;
end;
$$;
drop trigger core_immutable on public.core_progression;
create trigger core_immutable before update or delete on public.core_progression
	for each row execute function private.guard_core_release();

create or replace function private.guard_collection_configuration()
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
		if tg_table_name = 'core_steps' then
			perform 1 from public.core_progression for update;
			if exists (
				select 1 from public.core_progression
				where published_at is not null and release_at <= clock_timestamp()
			) then
				raise exception 'Live core progression cannot be changed.' using errcode = '23514';
			end if;
			if tg_op <> 'DELETE' and not exists (
				select 1 from public.puzzle_collections
				where id = (row_data ->> 'collection_id')::uuid and kind = 'core'
			) then
				raise exception 'Core steps require a core collection.' using errcode = '23514';
			end if;
		elsif tg_table_name = 'puzzle_authoring' then
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
			if tg_table_name in ('reward_palettes', 'reward_sets', 'reward_shapes') then
				select collection_id into parent_id from public.reward_rules
					where id = (row_data ->> 'reward_rule_id')::uuid;
			else
				parent_id := (row_data ->> 'collection_id')::uuid;
			end if;
			perform 1 from public.puzzle_collections where id = parent_id for update;
			if exists (
				select 1 from public.puzzle_collections where id = parent_id
					and published_at is not null and release_at <= clock_timestamp()
			) then
				raise exception 'Live collection configuration cannot be changed.' using errcode = '23514';
			end if;
			if tg_op <> 'DELETE' and tg_table_name = 'reward_sets' and not exists (
				select 1 from public.puzzle_collections
				where id = (row_data ->> 'collection_id')::uuid and kind = 'reward'
			) then
				raise exception 'Puzzle rewards must reference optional reward sets.' using errcode = '23514';
			end if;
		end if;
	end loop;
	if tg_op = 'DELETE' then return old; end if;
	return new;
end;
$$;

create or replace function private.track_palette_correction()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
	if new.id is distinct from old.id then
		raise exception 'Palette IDs are permanent.' using errcode = '23514';
	end if;
	if old.published_at is not null and old.release_at <= clock_timestamp() and (
		new.published_at is distinct from old.published_at
		or new.release_at is distinct from old.release_at
	) then
		raise exception 'Live palette release metadata cannot change.' using errcode = '23514';
	end if;
	new.revision := old.revision;
	if new.colors is distinct from old.colors then
		new.revision := old.revision + 1;
		if old.published_at is not null then
			insert into public.palette_corrections (
				palette_id, revision, old_colors, new_colors, changed_by
			) values (old.id, new.revision, old.colors, new.colors, auth.uid());
		end if;
	end if;
	return new;
end;
$$;

create function private.guard_catalog_release()
returns trigger
language plpgsql set search_path = ''
as $$
begin
	if old.published_at is not null and old.release_at <= clock_timestamp() then
		if tg_op = 'DELETE' then
			raise exception 'Live catalog entries cannot be deleted.' using errcode = '23514';
		end if;
		if new.published_at is distinct from old.published_at
			or new.release_at is distinct from old.release_at then
			raise exception 'Live catalog release metadata cannot change.' using errcode = '23514';
		end if;
	end if;
	if tg_op = 'UPDATE' and new.id is distinct from old.id then
		raise exception 'Catalog IDs are permanent.' using errcode = '23514';
	end if;
	if tg_op = 'DELETE' then return old; end if;
	return new;
end;
$$;
create trigger palettes_release_guard before delete on public.palettes
	for each row execute function private.guard_catalog_release();
create trigger shapes_release_guard before update or delete on public.shapes
	for each row execute function private.guard_catalog_release();
create trigger packs_release_guard before update or delete on public.palette_packs
	for each row execute function private.guard_catalog_release();

create function private.guard_pack_membership()
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
			select 1 from public.palette_packs
			where id = (row_data ->> 'pack_id')::uuid
				and published_at is not null and release_at <= clock_timestamp()
		) then
			raise exception 'Live palette pack membership cannot change.' using errcode = '23514';
		end if;
	end loop;
	if tg_op = 'DELETE' then return old; end if;
	return new;
end;
$$;
create trigger pack_membership_guard before insert or update or delete on public.palette_pack_palettes
	for each row execute function private.guard_pack_membership();

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
		select 1 from public.puzzles p where p.id = new.puzzle_id
			and p.usage = 'daily' and p.published_at is not null
			and p.release_at <= new.release_at
	) then
		raise exception 'Daily assignments require a published daily puzzle ready by release.'
			using errcode = '23514';
	end if;
	return new;
end;
$$;

-- Check the final transaction state, including reverse dependencies after cancellation.
create function private.check_release_dependencies()
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
		select 1 from public.puzzle_collections c join public.shapes s on s.id = c.shape_id
		where c.published_at is not null and (
			s.published_at is null or s.release_at > c.release_at
			or not exists (select 1 from public.collection_puzzles where collection_id = c.id)
			or exists (
				select 1 from public.collection_puzzles m join public.puzzles p on p.id = m.puzzle_id
				where m.collection_id = c.id and (p.published_at is null or p.release_at > c.release_at)
			)
			or (c.kind = 'core' and not exists (
				select 1 from public.completion_routes where collection_id = c.id
			))
			or exists (
				select 1 from public.completion_routes r where r.collection_id = c.id
					and not exists (select 1 from public.route_puzzles where route_id = r.id)
			)
		)
	) then
		raise exception 'A prepared set requires its shape, puzzles, and nonempty routes ready by release.'
			using errcode = '23514';
	end if;
	if exists (
		select 1 from public.core_progression core where core.published_at is not null and (
			not exists (select 1 from public.core_steps)
			or (select max(position) from public.core_steps) <> (select count(*) from public.core_steps)
			or exists (
				select 1 from public.core_steps step
				join public.puzzle_collections c on c.id = step.collection_id
				where c.kind <> 'core' or c.published_at is null or c.release_at > core.release_at
			)
		)
	) then
		raise exception 'Prepared core progression requires contiguous core sets ready by launch.'
			using errcode = '23514';
	end if;
	if exists (
		select 1 from public.reward_rules rule
		join public.puzzle_collections source on source.id = rule.collection_id
		where source.published_at is not null and (
			(not exists (select 1 from public.reward_palettes where reward_rule_id = rule.id)
				and not exists (select 1 from public.reward_shapes where reward_rule_id = rule.id)
				and not exists (select 1 from public.reward_sets where reward_rule_id = rule.id))
			or exists (
				select 1 from public.reward_palettes r join public.palettes p on p.id = r.palette_id
				where r.reward_rule_id = rule.id and (p.published_at is null or p.release_at > source.release_at)
			)
			or exists (
				select 1 from public.reward_shapes r join public.shapes s on s.id = r.shape_id
				where r.reward_rule_id = rule.id and (s.published_at is null or s.release_at > source.release_at)
			)
			or exists (
				select 1 from public.reward_sets r join public.puzzle_collections c on c.id = r.collection_id
				where r.reward_rule_id = rule.id
					and (c.kind <> 'reward' or c.published_at is null or c.release_at > source.release_at)
			)
		)
	) then
		raise exception 'Prepared rewards must be nonempty and available by their source set release.'
			using errcode = '23514';
	end if;
	if exists (
		select 1 from public.daily_puzzles d join public.puzzles p on p.id = d.puzzle_id
		where p.published_at is null or p.release_at > d.release_at
	) then
		raise exception 'A scheduled daily requires its puzzle ready by release.' using errcode = '23514';
	end if;
	if exists (
		select 1 from public.palette_packs pack where pack.published_at is not null and (
			not exists (select 1 from public.palette_pack_palettes where pack_id = pack.id)
			or exists (
				select 1 from public.palette_pack_palettes m join public.palettes p on p.id = m.palette_id
				where m.pack_id = pack.id and (p.published_at is null or p.release_at > pack.release_at)
			)
		)
	) then
		raise exception 'A prepared palette pack requires palettes ready by release.' using errcode = '23514';
	end if;
	return null;
end;
$$;

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
		execute format(
			'create constraint trigger release_dependencies
			 after insert or update or delete on public.%I
			 deferrable initially deferred for each row
			 execute function private.check_release_dependencies()', table_name
		);
	end loop;
end;
$$;

revoke all on function private.lock_content_edit() from public, anon, authenticated;
revoke all on function private.guard_core_release() from public, anon, authenticated;
revoke all on function private.guard_catalog_release() from public, anon, authenticated;
revoke all on function private.guard_pack_membership() from public, anon, authenticated;
revoke all on function private.check_release_dependencies() from public, anon, authenticated;

commit;
