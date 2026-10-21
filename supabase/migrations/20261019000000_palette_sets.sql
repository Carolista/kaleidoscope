begin;

-- Reuse the existing palette grouping records; labels do not grant access.
alter table public.palette_packs
	add column kind text not null default 'paid'
	check (kind in ('undecided', 'core', 'reward', 'paid'));
alter table public.palette_pack_palettes
	add constraint palette_membership_exclusive unique (palette_id);

create function public.manage_palette_set(
	p_id uuid,
	p_action text,
	p_name text default null,
	p_kind text default null,
	p_palette_ids text[] default '{}'
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
	current_set public.palette_packs;
	current_ids text[];
	target_id uuid;
begin
	if not private.is_admin() then
		raise exception 'Only the admin can manage palette sets.' using errcode = '42501';
	end if;
	if current_setting('transaction_isolation') <> 'read committed' then
		raise exception 'Catalog editing requires READ COMMITTED isolation.' using errcode = '25001';
	end if;
	if p_id is null or p_action is null or p_action not in ('create', 'update', 'assign', 'remove', 'reorder', 'delete') then
		raise exception 'Choose a valid palette set action.' using errcode = '22023';
	end if;
	if p_palette_ids is null or array_position(p_palette_ids, null) is not null
		or cardinality(p_palette_ids) <> (select count(distinct id) from unnest(p_palette_ids) as ids(id)) then
		raise exception 'Palette IDs must be distinct and non-null.' using errcode = '22023';
	end if;
	if p_action in ('create', 'update') then
		if p_name is null or btrim(p_name) = '' or p_kind is null
			or p_kind not in ('undecided', 'core', 'reward', 'paid')
			or cardinality(p_palette_ids) <> 0 then
			raise exception 'Enter a set name and choose Undecided, Core, Reward, or Pack.' using errcode = '22023';
		end if;
	elsif p_name is not null or p_kind is not null then
		raise exception 'This action cannot change set metadata.' using errcode = '22023';
	end if;
	perform pg_catalog.pg_advisory_xact_lock(71429, 1);
	select * into current_set from public.palette_packs where id = p_id for update;
	if p_action = 'create' then
		if found then
			if current_set.name = btrim(p_name) and current_set.kind = p_kind
				and current_set.published_at is null and current_set.release_at is null then
				return p_id;
			end if;
			raise exception 'This set ID already belongs to different content.' using errcode = '23505';
		end if;
		insert into public.palette_packs(id, name, kind) values(p_id, btrim(p_name), p_kind);
		return p_id;
	end if;
	if not found then
		raise exception 'The palette set no longer exists. Refresh the library.' using errcode = 'P0002';
	end if;
	if current_set.published_at is not null or current_set.release_at is not null then
		raise exception 'Only unpublished palette sets can be changed here.' using errcode = '23514';
	end if;
	if p_action = 'update' then
		update public.palette_packs set name = btrim(p_name), kind = p_kind where id = p_id;
		return p_id;
	end if;
	select coalesce(array_agg(palette_id order by position), '{}'::text[]) into current_ids
		from public.palette_pack_palettes where pack_id = p_id;
	if p_action = 'delete' then
		if cardinality(p_palette_ids) <> 0 then
			raise exception 'Set deletion cannot specify palettes.' using errcode = '22023';
		end if;
		delete from public.palette_pack_palettes where pack_id = p_id;
		delete from public.palette_packs where id = p_id;
		return p_id;
	end if;
	if p_action in ('assign', 'remove') and cardinality(p_palette_ids) = 0 then
		raise exception 'Select at least one palette.' using errcode = '22023';
	end if;
	if p_action = 'assign' then
		if exists(select 1 from unnest(p_palette_ids) as ids(id)
			where not exists(select 1 from public.palettes p where p.id = ids.id)) then
			raise exception 'A selected palette no longer exists. Refresh the library.' using errcode = 'P0002';
		end if;
		if exists(select 1 from public.palette_pack_palettes m
			join public.palette_packs s on s.id = m.pack_id
			where m.palette_id = any(p_palette_ids)
				and (s.published_at is not null or s.release_at is not null)) then
			raise exception 'Palettes cannot be moved out of a prepared set.' using errcode = '23514';
		end if;
		-- Keep existing destination order; append moved palettes in selection order.
		delete from public.palette_pack_palettes
			where palette_id = any(p_palette_ids) and pack_id <> p_id;
		insert into public.palette_pack_palettes(pack_id, palette_id, position)
			select p_id, id,
				(select coalesce(max(position), 0) from public.palette_pack_palettes where pack_id = p_id)
				+ row_number() over (order by ordinality)::integer
			from unnest(p_palette_ids) with ordinality as ids(id, ordinality)
			where not exists(select 1 from public.palette_pack_palettes where palette_id = ids.id);
		return p_id;
	end if;
	if p_action = 'remove' then
		if not p_palette_ids <@ current_ids then
			raise exception 'Set membership changed. Refresh before removing palettes.' using errcode = '40001';
		end if;
		delete from public.palette_pack_palettes where pack_id = p_id and palette_id = any(p_palette_ids);
	else
		if not (p_palette_ids @> current_ids and p_palette_ids <@ current_ids) then
			raise exception 'Set membership changed. Refresh before reordering palettes.' using errcode = '40001';
		end if;
		delete from public.palette_pack_palettes where pack_id = p_id;
		insert into public.palette_pack_palettes(pack_id, palette_id, position)
			select p_id, id, ordinality::integer from unnest(p_palette_ids) with ordinality as ids(id, ordinality);
	end if;
	return p_id;
end;
$$;
revoke all on function public.manage_palette_set(uuid, text, text, text, text[]) from public, anon;
grant execute on function public.manage_palette_set(uuid, text, text, text, text[]) to authenticated;

create function public.delete_palette_draft(
	p_id text,
	p_expected_name text,
	p_expected_colors text[],
	p_expected_revision bigint
)
returns text language plpgsql security invoker set search_path = '' as $$
begin
	if not private.is_admin() then
		raise exception 'Only the admin can delete palette drafts.' using errcode = '42501';
	end if;
	if current_setting('transaction_isolation') <> 'read committed' then
		raise exception 'Catalog editing requires READ COMMITTED isolation.' using errcode = '25001';
	end if;
	perform pg_catalog.pg_advisory_xact_lock(71429, 1);
	if exists(select 1 from public.palette_pack_palettes m
		join public.palette_packs s on s.id = m.pack_id
		where m.palette_id = p_id and (s.published_at is not null or s.release_at is not null)) then
		raise exception 'A prepared palette set references this palette.' using errcode = '23514';
	end if;
	delete from public.palette_pack_palettes where palette_id = p_id;
	-- The existing operation checks palette state, stale edits, and all other references.
	-- Any failure also rolls back the membership removal.
	return public.manage_palette_draft(
		p_id, 'delete', p_expected_name => p_expected_name,
		p_expected_colors => p_expected_colors, p_expected_revision => p_expected_revision
	);
end;
$$;
revoke all on function public.delete_palette_draft(text, text, text[], bigint) from public, anon;
grant execute on function public.delete_palette_draft(text, text, text[], bigint) to authenticated;

commit;
