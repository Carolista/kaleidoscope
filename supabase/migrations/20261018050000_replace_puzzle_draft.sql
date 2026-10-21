begin;

create function public.replace_hex_puzzle_draft(
	p_id uuid,
	p_name text,
	p_usage text,
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
	if current_puzzle.published_at is not null or current_puzzle.release_at is not null then
		raise exception 'Only unpublished drafts can be replaced here.' using errcode = '23514';
	end if;
	if current_puzzle.shape_id <> 'hexagon' then
		raise exception 'Only hexagon drafts can be replaced here.' using errcode = '23514';
	end if;
	if exists(select 1 from public.collection_puzzles where puzzle_id = p_id)
		or exists(select 1 from public.daily_puzzles where puzzle_id = p_id) then
		raise exception 'Unassign the puzzle before replacing its design.' using errcode = '23514';
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

revoke all on function public.replace_hex_puzzle_draft(
	uuid, text, text, text, text, boolean, text, jsonb, text, text, jsonb
) from public, anon;
grant execute on function public.replace_hex_puzzle_draft(
	uuid, text, text, text, text, boolean, text, jsonb, text, text, jsonb
) to authenticated;

commit;
