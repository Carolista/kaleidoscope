begin;
create function public.delete_draft_set(p_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
	current_set public.puzzle_collections;
begin
	if not private.is_admin() then
		raise exception 'Only the admin can delete draft sets.' using errcode = '42501';
	end if;
	if current_setting('transaction_isolation') <> 'read committed' then
		raise exception 'Catalog editing requires READ COMMITTED isolation.' using errcode = '25001';
	end if;
	perform pg_catalog.pg_advisory_xact_lock(71429, 1);
	select * into current_set from public.puzzle_collections where id = p_id for update;
	if not found then
		raise exception 'The draft set no longer exists.' using errcode = 'P0002';
	end if;
	if current_set.published_at is not null or current_set.release_at is not null then
		raise exception 'Only unpublished draft sets can be deleted here.' using errcode = '23514';
	end if;
	if exists(select 1 from public.core_steps where collection_id = p_id)
		or exists(select 1 from public.reward_sets where collection_id = p_id)
		or exists(select 1 from public.reward_rules where collection_id = p_id)
		or exists(select 1 from public.completion_routes where collection_id = p_id)
		or exists(select 1 from public.set_qualifications where collection_id = p_id)
		or exists(select 1 from public.collection_grants where collection_id = p_id) then
		raise exception 'Remove progression, route, and reward dependencies before deleting this set.' using errcode = '23514';
	end if;
	if exists(select 1 from public.collection_puzzles m join public.puzzles p on p.id = m.puzzle_id
		where m.collection_id = p_id and (p.published_at is not null or p.release_at is not null)) then
		raise exception 'Unassign prepared puzzles before deleting this set.' using errcode = '23514';
	end if;
	delete from public.collection_puzzles where collection_id = p_id;
	delete from public.puzzle_collections where id = p_id;
	return p_id;
end;
$$;
revoke all on function public.delete_draft_set(uuid) from public, anon;
grant execute on function public.delete_draft_set(uuid) to authenticated;
commit;
