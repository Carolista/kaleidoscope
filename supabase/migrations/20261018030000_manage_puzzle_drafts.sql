begin;

create function public.edit_puzzle_draft(p_id uuid, p_name text, p_palette_id text, p_usage text)
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
	if current_puzzle.published_at is not null then
		raise exception 'Only unpublished drafts can be edited here.' using errcode = '23514';
	end if;
	if current_puzzle.usage is distinct from p_usage and (
		exists(select 1 from public.collection_puzzles where puzzle_id = p_id)
		or exists(select 1 from public.daily_puzzles where puzzle_id = p_id)
	) then
		raise exception 'Unassign the puzzle before changing its intended use.' using errcode = '23514';
	end if;
	update public.puzzles set name = btrim(p_name), palette_id = p_palette_id, usage = p_usage
		where id = p_id;
	return p_id;
end;
$$;

create function public.delete_puzzle_draft(p_id uuid)
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
	if exists(select 1 from public.collection_puzzles where puzzle_id = p_id)
		or exists(select 1 from public.daily_puzzles where puzzle_id = p_id) then
		raise exception 'Unassign the puzzle before deleting it.' using errcode = '23514';
	end if;
	delete from public.puzzles where id = p_id;
	return p_id;
end;
$$;

revoke all on function public.edit_puzzle_draft(uuid, text, text, text) from public, anon;
revoke all on function public.delete_puzzle_draft(uuid) from public, anon;
grant execute on function public.edit_puzzle_draft(uuid, text, text, text) to authenticated;
grant execute on function public.delete_puzzle_draft(uuid) to authenticated;

commit;
