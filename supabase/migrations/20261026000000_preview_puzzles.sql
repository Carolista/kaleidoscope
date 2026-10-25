begin;

-- A signed-in player may be offline when they finish a set, and still gets what it earns. To
-- have the puzzles of that reward ready beforehand, the app asks for the next tier of free
-- puzzles ahead of time: bonus (reward) groups of shapes the player has, and the core and bonus
-- groups of the one shape after the shapes they have.
--
-- The rules for reading and recording are not changed. `puzzles` rows still read through
-- `can_play_puzzle`, and `record_puzzle_completions` still accepts only puzzles the player
-- may play, so a preview earns nothing: the player's own device decides what it shows, and the
-- database confirms the same unlock when the solves are recorded. Packs and daily puzzles are never previewed.
create function private.can_preview_puzzle(puzzle_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
	select (select auth.uid()) is not null and exists (
		select 1
		from public.puzzles p
		join public.puzzle_group_members member on member.puzzle_id = p.id
		join public.puzzle_groups g on g.id = member.group_id
		where p.id = can_preview_puzzle.puzzle_id
			and private.is_released(p.published_at, p.release_at)
			and g.purpose in ('core', 'reward')
			and private.is_released(g.published_at, g.release_at)
			and (
				private.has_shape(g.shape_id)
				or exists (
					select 1 from public.shape_progression current_shape
					join public.shape_progression previous_shape
						on previous_shape.position = current_shape.position - 1
					where current_shape.shape_id = g.shape_id
						and private.has_shape(previous_shape.shape_id)
				)
			)
	);
$$;

-- The previewable puzzles the player cannot play yet. Puzzles they can already play come
-- from the usual table read.
create function public.preview_puzzles()
returns setof public.puzzles
language sql stable security definer set search_path = ''
as $$
	select p.*
	from public.puzzles p
	where (select auth.uid()) is not null
		and private.can_preview_puzzle(p.id)
		and not private.can_play_puzzle(p.id);
$$;

revoke all on function private.can_preview_puzzle(uuid) from public, anon, authenticated;
revoke all on function public.preview_puzzles() from public, anon;
grant execute on function public.preview_puzzles() to authenticated;

commit;
