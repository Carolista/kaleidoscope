begin;

-- Guests have no account to hold grants, so they earn bonus (reward) groups on their own device.
-- The database lets them read a released bonus group of the first shape, just as it lets them
-- read a released core group. Signed-in players still need a grant, and shapes after the first
-- still require an account (`has_shape` is unchanged and decides which shape a guest may read).
create or replace function private.can_play_puzzle_group(group_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
	select exists (
		select 1 from public.puzzle_groups g
		where g.id = can_play_puzzle_group.group_id
			and g.purpose in ('core', 'reward', 'pack')
			and private.is_released(g.published_at, g.release_at)
			and private.has_shape(g.shape_id)
			and (
				g.purpose = 'core'
				or ((select auth.uid()) is null and g.purpose = 'reward')
				or ((select auth.uid()) is not null and exists (
					select 1 from public.puzzle_group_grants grant_row
					where grant_row.group_id = g.id and grant_row.user_id = (select auth.uid())
				))
			)
	);
$$;

commit;
