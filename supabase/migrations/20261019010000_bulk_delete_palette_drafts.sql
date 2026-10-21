begin;

create function public.bulk_delete_palette_drafts(p_ids text[])
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
		if exists(select 1 from public.palette_pack_palettes where palette_id = palette.id) then
			raise exception 'Palette "%" is in a set; remove it before deleting. No selected palettes were deleted.', palette.name
				using errcode = '23514';
		end if;
		if exists(select 1 from public.puzzles where palette_id = palette.id)
			or exists(select 1 from public.starter_palettes where palette_id = palette.id)
			or exists(select 1 from public.reward_palettes where palette_id = palette.id)
			or exists(select 1 from public.palette_grants where palette_id = palette.id)
			or exists(select 1 from public.palette_corrections where palette_id = palette.id) then
			raise exception 'Palette "%" is in use by puzzles, starter offerings, rewards, grants, or correction history. No selected palettes were deleted.', palette.name
				using errcode = '23514';
		end if;
	end loop;
	delete from public.palettes where id = any(p_ids);
	return p_ids;
end;
$$;

revoke all on function public.bulk_delete_palette_drafts(text[]) from public, anon;
grant execute on function public.bulk_delete_palette_drafts(text[]) to authenticated;

commit;
