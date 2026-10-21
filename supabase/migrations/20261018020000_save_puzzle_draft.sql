begin;

create function public.save_hex_puzzle_draft(
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
	perform pg_catalog.pg_advisory_xact_lock(71429, 1);

	-- A retried request must return the same draft, not create another copy.
	if exists (select 1 from public.puzzles where id = p_id) then
		if exists (
			select 1 from public.puzzles p
			join public.puzzle_authoring a on a.puzzle_id = p.id
			where p.id = p_id and p.name = btrim(p_name) and p.usage = p_usage
				and p.shape_id = 'hexagon' and p.palette_id = p_palette_id
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
		p_id, btrim(p_name), p_usage, 'hexagon', p_palette_id, p_board_size,
		p_rotation_allowed, p_difficulty, p_definition
	);
	insert into public.puzzle_authoring(puzzle_id, seed, generator_version, known_solution)
		values (p_id, p_seed, p_generator_version, p_known_solution);
	return p_id;
end;
$$;

revoke all on function public.save_hex_puzzle_draft(
	uuid, text, text, text, text, boolean, text, jsonb, text, text, jsonb
) from public, anon;
grant execute on function public.save_hex_puzzle_draft(
	uuid, text, text, text, text, boolean, text, jsonb, text, text, jsonb
) to authenticated;

commit;
