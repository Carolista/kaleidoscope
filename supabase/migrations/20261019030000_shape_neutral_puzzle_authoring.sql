begin;

-- Puzzle authoring works for any catalog shape; each set keeps one shape.
drop function public.save_hex_puzzle_draft(
	uuid, text, text, text, text, boolean, text, jsonb, text, text, jsonb
);
drop function public.replace_hex_puzzle_draft(
	uuid, text, text, text, text, boolean, text, jsonb, text, text, jsonb
);
drop function public.manage_draft_set(uuid, text, text, text, uuid[]);

create function public.save_puzzle_draft(
	p_id uuid,
	p_name text,
	p_usage text,
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
			where p.id = p_id and p.name = btrim(p_name) and p.usage = p_usage
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
		id, name, usage, shape_id, palette_id, board_size, rotation_allowed, difficulty, definition
	) values (
		p_id, btrim(p_name), p_usage, p_shape_id, p_palette_id, p_board_size,
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
	p_usage text,
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
	if current_puzzle.usage is distinct from p_usage and (
		exists(select 1 from public.collection_puzzles where puzzle_id = p_id)
		or exists(select 1 from public.daily_puzzles where puzzle_id = p_id)
	) then
		raise exception 'Unassign the puzzle before changing its intended use.' using errcode = '23514';
	end if;

	update public.puzzles set
		name = btrim(p_name), usage = p_usage, palette_id = p_palette_id,
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

create function public.manage_draft_set(
	p_id uuid,
	p_action text,
	p_name text default null,
	p_kind text default null,
	p_puzzle_ids uuid[] default '{}',
	p_shape_id text default null
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
	current_set public.puzzle_collections;
	current_ids uuid[];
	blocker text;
	offset_position integer;
begin
	if not private.is_admin() then
		raise exception 'Only the admin can assemble draft sets.' using errcode = '42501';
	end if;
	if current_setting('transaction_isolation') <> 'read committed' then
		raise exception 'Catalog editing requires READ COMMITTED isolation.' using errcode = '25001';
	end if;
	if p_id is null or p_action is null or p_action not in ('create', 'rename', 'append', 'remove', 'reorder') then
		raise exception 'Choose a valid draft set and action.' using errcode = '22023';
	end if;
	if p_puzzle_ids is null or array_position(p_puzzle_ids, null) is not null
		or cardinality(p_puzzle_ids) <> (select count(distinct id) from unnest(p_puzzle_ids) as ids(id)) then
		raise exception 'Puzzle IDs must be distinct and non-null.' using errcode = '22023';
	end if;
	if p_action in ('create', 'rename') then
		if p_name is null or btrim(p_name) = '' or cardinality(p_puzzle_ids) <> 0 then
			raise exception 'Enter a set name without puzzle IDs.' using errcode = '22023';
		end if;
	elsif p_name is not null or p_kind is not null then
		raise exception 'Membership actions cannot change set metadata.' using errcode = '22023';
	end if;
	if p_action = 'create' then
		if p_kind is null or p_kind not in ('core', 'reward', 'paid') then
			raise exception 'Choose Core, Reward, or Paid for the set role.' using errcode = '22023';
		end if;
		if p_shape_id is null or not exists(select 1 from public.shapes where id = p_shape_id) then
			raise exception 'Choose a valid set shape.' using errcode = '22023';
		end if;
	elsif p_kind is not null then
		raise exception 'An existing set role cannot be changed here.' using errcode = '22023';
	elsif p_shape_id is not null then
		raise exception 'An existing set shape cannot be changed.' using errcode = '22023';
	end if;
	perform pg_catalog.pg_advisory_xact_lock(71429, 1);
	select * into current_set from public.puzzle_collections where id = p_id for update;
	if p_action = 'create' then
		if found then
			if current_set.name = btrim(p_name) and current_set.kind = p_kind
				and current_set.shape_id = p_shape_id and current_set.published_at is null then
				return p_id;
			end if;
			raise exception 'This set ID already belongs to different content.' using errcode = '23505';
		end if;
		insert into public.puzzle_collections(id, name, kind, shape_id)
			values (p_id, btrim(p_name), p_kind, p_shape_id);
		return p_id;
	end if;
	if not found then
		raise exception 'The draft set no longer exists.' using errcode = 'P0002';
	end if;
	if current_set.published_at is not null or current_set.release_at is not null then
		raise exception 'Only unpublished draft sets can be assembled here.' using errcode = '23514';
	end if;
	if p_action = 'rename' then
		update public.puzzle_collections set name = btrim(p_name) where id = p_id;
		return p_id;
	end if;
	select coalesce(array_agg(puzzle_id order by position), '{}'::uuid[]) into current_ids
		from public.collection_puzzles where collection_id = p_id;
	if p_action in ('append', 'remove') and cardinality(p_puzzle_ids) = 0 then
		raise exception 'Select at least one puzzle.' using errcode = '22023';
	end if;
	if p_action = 'append' then
		if exists(select 1 from unnest(p_puzzle_ids) as ids(id)
			where not exists(select 1 from public.puzzles where puzzles.id = ids.id)) then
			raise exception 'A selected puzzle no longer exists. Refresh the library.' using errcode = 'P0002';
		end if;
		select p.name into blocker from public.puzzles p where p.id = any(p_puzzle_ids) and (
			p.published_at is not null or p.release_at is not null or p.shape_id <> current_set.shape_id
			or p.usage <> 'collection'
			or exists(select 1 from public.collection_puzzles m where m.puzzle_id = p.id)
			or exists(select 1 from public.daily_puzzles d where d.puzzle_id = p.id)
		) order by p.id limit 1;
		if found then
			raise exception 'Puzzle "%" must be an unassigned, unpublished Set/pack draft of the set''s shape.', blocker using errcode = '23514';
		end if;
		select coalesce(max(position), 0) into offset_position
			from public.collection_puzzles where collection_id = p_id;
		insert into public.collection_puzzles(puzzle_id, collection_id, shape_id, position)
			select id, p_id, current_set.shape_id, offset_position + ordinality::integer
				from unnest(p_puzzle_ids) with ordinality as ids(id, ordinality);
		return p_id;
	end if;
	if p_action = 'remove' then
		if not p_puzzle_ids <@ current_ids then
			raise exception 'Set membership changed. Refresh before removing puzzles.' using errcode = '23514';
		end if;
		select p.name into blocker from public.puzzles p where p.id = any(p_puzzle_ids) and (
			p.published_at is not null or p.release_at is not null
			or exists(select 1 from public.route_puzzles r where r.puzzle_id = p.id)
		) order by p.id limit 1;
		if found then
			raise exception 'Puzzle "%" must be unpublished and removed from qualifying routes before unassigning.', blocker using errcode = '23514';
		end if;
		delete from public.collection_puzzles where collection_id = p_id and puzzle_id = any(p_puzzle_ids);
		select coalesce(array_agg(puzzle_id order by position), '{}'::uuid[]) into p_puzzle_ids
			from public.collection_puzzles where collection_id = p_id;
	elsif cardinality(p_puzzle_ids) <> cardinality(current_ids) or not p_puzzle_ids <@ current_ids then
		raise exception 'Set membership changed. Refresh before reordering puzzles.' using errcode = '23514';
	end if;
	-- Move existing positions out of the way before assigning the final contiguous order.
	select coalesce(max(position), 0) into offset_position
		from public.collection_puzzles where collection_id = p_id;
	update public.collection_puzzles set position = position + offset_position
		where collection_id = p_id;
	update public.collection_puzzles m set position = ids.ordinality::integer
		from unnest(p_puzzle_ids) with ordinality as ids(id, ordinality)
		where m.collection_id = p_id and m.puzzle_id = ids.id;
	return p_id;
end;
$$;

revoke all on function public.save_puzzle_draft(
	uuid, text, text, text, text, text, boolean, text, jsonb, text, text, jsonb
) from public, anon;
grant execute on function public.save_puzzle_draft(
	uuid, text, text, text, text, text, boolean, text, jsonb, text, text, jsonb
) to authenticated;
revoke all on function public.replace_puzzle_draft(
	uuid, text, text, text, text, text, boolean, text, jsonb, text, text, jsonb
) from public, anon;
grant execute on function public.replace_puzzle_draft(
	uuid, text, text, text, text, text, boolean, text, jsonb, text, text, jsonb
) to authenticated;
revoke all on function public.manage_draft_set(uuid, text, text, text, uuid[], text) from public, anon;
grant execute on function public.manage_draft_set(uuid, text, text, text, uuid[], text) to authenticated;

commit;
