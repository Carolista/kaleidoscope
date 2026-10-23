begin;

-- Each core group of a shape awards bonus groups: the basic core group awards the basic bonus
-- group, and the rotation core group awards both bonus groups. A player who completes both core
-- groups is granted the basic bonus group once. Those links follow the slots automatically, so
-- nobody picks them by hand.
create or replace function private.sync_bonus_groups(p_shape_id text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
	core_group public.puzzle_groups;
	rule_id uuid;
	desired uuid[];
begin
	if p_shape_id is null then return; end if;
	for core_group in select * from public.puzzle_groups
		where purpose = 'core' and shape_id = p_shape_id order by track
	loop
		-- A prepared group's rewards are fixed with it.
		continue when core_group.published_at is not null or core_group.release_at is not null;
		select coalesce(array_agg(id order by track, id), '{}'::uuid[]) into desired
			from public.puzzle_groups
			where purpose = 'reward' and shape_id = p_shape_id
				and (core_group.track = 'rotation' or track = core_group.track);
		select id into rule_id from public.reward_rules where group_id = core_group.id;
		continue when rule_id is null and cardinality(desired) = 0;
		if rule_id is null then
			insert into public.reward_rules(group_id) values (core_group.id) returning id into rule_id;
		end if;
		delete from public.reward_puzzle_groups
			where reward_rule_id = rule_id and not (group_id = any(desired));
		insert into public.reward_puzzle_groups(reward_rule_id, group_id)
			select rule_id, id from unnest(desired) as ids(id)
			where not exists(select 1 from public.reward_puzzle_groups
				where reward_rule_id = rule_id and group_id = ids.id);
		if not exists(select 1 from public.reward_palettes where reward_rule_id = rule_id)
			and not exists(select 1 from public.reward_puzzle_groups where reward_rule_id = rule_id) then
			delete from public.reward_rules where id = rule_id;
		end if;
	end loop;
end;
$$;
revoke all on function private.sync_bonus_groups(text) from public, anon, authenticated;

select private.sync_bonus_groups(shape_id) from public.shape_progression;

commit;
