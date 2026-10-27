begin;

-- Corrects the name or colors of a palette that is already scheduled or live. The palettes trigger
-- bumps `revision` and records each published color change in `palette_corrections`; players read
-- palette colors by ID, so a correction reaches them without further steps. Drafts keep using
-- `manage_palette_draft`.
create function public.correct_published_palette(
	p_id text,
	p_name text,
	p_colors text[],
	p_expected_name text,
	p_expected_colors text[],
	p_expected_revision bigint
)
returns text
language plpgsql security invoker set search_path = ''
as $$
declare
	current_palette public.palettes;
	result_revision bigint;
begin
	if not private.is_admin() then
		raise exception 'Only the admin can correct palettes.' using errcode = '42501';
	end if;
	if current_setting('transaction_isolation') <> 'read committed' then
		raise exception 'Catalog editing requires READ COMMITTED isolation.' using errcode = '25001';
	end if;
	if p_id is null or p_id = '' or p_id <> btrim(p_id) then
		raise exception 'A permanent palette ID is required.' using errcode = '23514';
	end if;
	if p_name is null or btrim(p_name) = '' or p_colors is null
		or p_expected_name is null or p_expected_colors is null or p_expected_revision is null then
		raise exception 'Load the palette before correcting it.' using errcode = '23514';
	end if;
	perform pg_catalog.pg_advisory_xact_lock(71429, 1);
	select * into current_palette from public.palettes where id = p_id for update;
	if not found then
		raise exception 'The palette no longer exists. Refresh the catalog.' using errcode = 'P0002';
	end if;
	if current_palette.published_at is null and current_palette.release_at is null then
		raise exception 'Draft palettes are edited as drafts.' using errcode = '23514';
	end if;

	result_revision := p_expected_revision + case when p_colors is distinct from p_expected_colors then 1 else 0 end;
	-- Confirm a lost-response retry without incrementing revision again.
	if current_palette.name = btrim(p_name) and current_palette.colors = p_colors
		and current_palette.revision = result_revision then
		return p_id;
	end if;
	if current_palette.name is distinct from p_expected_name
		or current_palette.colors is distinct from p_expected_colors
		or current_palette.revision is distinct from p_expected_revision then
		raise exception 'This palette changed since it was loaded. Refresh and review before retrying.'
			using errcode = '40001';
	end if;
	update public.palettes set name = btrim(p_name), colors = p_colors where id = p_id;
	return p_id;
end;
$$;

revoke all on function public.correct_published_palette(text, text, text[], text, text[], bigint)
	from public, anon;
grant execute on function public.correct_published_palette(text, text, text[], text, text[], bigint)
	to authenticated;

commit;
