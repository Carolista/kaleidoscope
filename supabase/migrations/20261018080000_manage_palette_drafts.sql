begin;

create function public.manage_palette_draft(
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
			or exists(select 1 from public.starter_palettes where palette_id = p_id)
			or exists(select 1 from public.reward_palettes where palette_id = p_id)
			or exists(select 1 from public.palette_pack_palettes where palette_id = p_id)
			or exists(select 1 from public.palette_grants where palette_id = p_id)
			or exists(select 1 from public.palette_corrections where palette_id = p_id) then
			raise exception 'This palette is in use by puzzles, starter offerings, rewards, packs, grants, or correction history. Remove dependencies before deleting it.'
				using errcode = '23514';
		end if;
		delete from public.palettes where id = p_id;
	end if;
	return p_id;
end;
$$;

revoke all on function public.manage_palette_draft(text, text, text, text[], text, text[], bigint) from public, anon;
grant execute on function public.manage_palette_draft(text, text, text, text[], text, text[], bigint) to authenticated;

commit;
