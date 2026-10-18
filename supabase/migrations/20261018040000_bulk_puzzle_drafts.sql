begin;

create function public.bulk_puzzle_drafts(p_ids uuid[], p_action text, p_palette_id text default null)
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
			exists(select 1 from public.collection_puzzles where puzzle_id = puzzle.id)
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

revoke all on function public.bulk_puzzle_drafts(uuid[], text, text) from public, anon;
grant execute on function public.bulk_puzzle_drafts(uuid[], text, text) to authenticated;

commit;
