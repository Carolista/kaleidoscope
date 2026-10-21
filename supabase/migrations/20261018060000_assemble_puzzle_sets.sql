begin;

create function public.manage_draft_set(
	p_id uuid,
	p_action text,
	p_name text default null,
	p_kind text default null,
	p_puzzle_ids uuid[] default '{}'
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
	elsif p_kind is not null then
		raise exception 'An existing set role cannot be changed here.' using errcode = '22023';
	end if;
	perform pg_catalog.pg_advisory_xact_lock(71429, 1);
	select * into current_set from public.puzzle_collections where id = p_id for update;
	if p_action = 'create' then
		if found then
			if current_set.name = btrim(p_name) and current_set.kind = p_kind
				and current_set.shape_id = 'hexagon' and current_set.published_at is null then
				return p_id;
			end if;
			raise exception 'This set ID already belongs to different content.' using errcode = '23505';
		end if;
		insert into public.puzzle_collections(id, name, kind, shape_id)
			values (p_id, btrim(p_name), p_kind, 'hexagon');
		return p_id;
	end if;
	if not found then
		raise exception 'The draft set no longer exists.' using errcode = 'P0002';
	end if;
	if current_set.published_at is not null or current_set.release_at is not null then
		raise exception 'Only unpublished draft sets can be assembled here.' using errcode = '23514';
	end if;
	if current_set.shape_id <> 'hexagon' then
		raise exception 'Only hexagon sets can be assembled here.' using errcode = '23514';
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
			raise exception 'Puzzle "%" must be an unassigned, unpublished hexagon Set/pack draft.', blocker using errcode = '23514';
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

revoke all on function public.manage_draft_set(uuid, text, text, text, uuid[]) from public, anon;
grant execute on function public.manage_draft_set(uuid, text, text, text, uuid[]) to authenticated;
commit;
