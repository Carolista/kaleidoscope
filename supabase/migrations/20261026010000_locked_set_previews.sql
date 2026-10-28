begin;

-- Players see what they could earn: sets and palettes of shapes they have not reached yet are
-- shown locked, with a color preview of each set. Names, shapes, tracks, and reward links of
-- released groups are already readable by everyone; only the puzzles themselves are withheld
-- (`can_play_puzzle`), so this returns just the cards' preview puzzles: the first puzzle of each
-- difficulty in a released core or bonus group, the three a set shows on its card.
--
-- Nothing else about the rules changes. These rows are not readable through `puzzles`, and
-- `record_puzzle_completions` still accepts only puzzles the player may play, so seeing a preview
-- earns nothing. Packs and daily puzzles are never previewed, and neither are the rest of a set's puzzles.
-- Puzzles a player can already play come from the usual table read, so they are left out here.
create function public.locked_set_previews()
returns setof public.puzzles
language sql stable security definer set search_path = ''
as $$
	with firsts as (
		select distinct on (member.group_id, p.difficulty) p.id
		from public.puzzle_group_members member
		join public.puzzle_groups g on g.id = member.group_id
		join public.puzzles p on p.id = member.puzzle_id
		where g.purpose in ('core', 'reward')
			and private.is_released(g.published_at, g.release_at)
			and private.is_released(p.published_at, p.release_at)
		order by member.group_id, p.difficulty, member.position
	)
	select p.*
	from public.puzzles p
	join firsts on firsts.id = p.id
	where not private.can_play_puzzle(p.id);
$$;

revoke all on function public.locked_set_previews() from public;
grant execute on function public.locked_set_previews() to anon, authenticated;

commit;
