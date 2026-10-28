begin;
set local timezone = 'UTC';

create function pg_temp.assert_true(condition boolean, label text)
returns text language plpgsql as $$
begin
	if condition is distinct from true then raise exception 'FAILED: %', label; end if;
	return 'PASS: ' || label;
end;
$$;
create function pg_temp.id(n integer) returns uuid language sql immutable as $$
	select ('eb000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
-- A puzzle with the given difficulty, using the board size that difficulty allows.
create function pg_temp.puzzle(n integer, p_shape text, p_difficulty text)
returns uuid language sql as $$
	select public.save_puzzle_draft(
		pg_temp.id(n), 'Puzzle ' || n, p_shape, 'locked-preview-test',
		case p_difficulty when 'easy' then 'sm' else 'md' end, false, p_difficulty,
		'{"version":2,"geometry":{"size":4},"target":{"-1,2":0},"pieces":[{"id":"p1","tiles":[{"q":-1,"r":2,"color_slot":0}]}]}',
		'locked-preview-seed-' || n, p_shape || '-test', '{"p1":{"q":0,"r":0}}'
	);
$$;
-- The fixture puzzles among those previewed, since released content also fills the catalog.
create function pg_temp.previewed()
returns uuid[] language sql as $$
	select coalesce(array_agg(id order by id), '{}')
	from public.locked_set_previews()
	where id in (select pg_temp.id(n) from generate_series(10, 20) n);
$$;

insert into auth.users(id) values (pg_temp.id(1)), (pg_temp.id(2));
delete from public.admin_account;
insert into public.admin_account(user_id) values (pg_temp.id(1));
insert into public.palettes(id, name, colors) values
	('locked-preview-test', 'Locked preview test', array['#111111','#222222','#333333','#444444','#555555']);

select set_config('request.jwt.claim.sub', pg_temp.id(1)::text, true);
set local role authenticated;
-- 10-13: a Triangle core set, two easy then two moderate. 14: Triangle bonus. 15: Triangle pack.
-- 16: an unreleased Triangle core set. 17: a Hexagon core set (playable by everyone).
select pg_temp.puzzle(10, 'triangle', 'easy');
select pg_temp.puzzle(11, 'triangle', 'easy');
select pg_temp.puzzle(12, 'triangle', 'moderate');
select pg_temp.puzzle(13, 'triangle', 'moderate');
select pg_temp.puzzle(14, 'triangle', 'easy');
select pg_temp.puzzle(15, 'triangle', 'easy');
select pg_temp.puzzle(16, 'triangle', 'easy');
select pg_temp.puzzle(17, 'hexagon', 'easy');
reset role;

update public.palettes set published_at = now(), release_at = now() where id = 'locked-preview-test';
update public.puzzles set published_at = now(), release_at = now()
	where id in (select pg_temp.id(n) from generate_series(10, 17) n);

-- Released content already fills the slots, so these fixtures are inserted directly with the slot
-- indexes and guard triggers set aside. All of it rolls back.
drop index public.puzzle_groups_core_slot_idx;
drop index public.puzzle_groups_reward_slot_idx;
alter table public.puzzle_groups disable trigger user;
alter table public.puzzle_group_members disable trigger user;
insert into public.puzzle_groups(id, name, purpose, shape_id, track, published_at, release_at) values
	(pg_temp.id(20), 'Locked triangle core', 'core', 'triangle', 'basic', now(), now()),
	(pg_temp.id(21), 'Locked triangle bonus', 'reward', 'triangle', 'basic', now(), now()),
	(pg_temp.id(22), 'Locked triangle pack', 'pack', 'triangle', 'basic', now(), now()),
	(pg_temp.id(23), 'Locked triangle draft', 'core', 'triangle', 'rotation', null, null),
	(pg_temp.id(24), 'Locked hex core', 'core', 'hexagon', 'rotation', now(), now());
insert into public.puzzle_group_members(puzzle_id, group_id, position) values
	(pg_temp.id(10), pg_temp.id(20), 1),
	(pg_temp.id(11), pg_temp.id(20), 2),
	(pg_temp.id(12), pg_temp.id(20), 3),
	(pg_temp.id(13), pg_temp.id(20), 4),
	(pg_temp.id(14), pg_temp.id(21), 1),
	(pg_temp.id(15), pg_temp.id(22), 1),
	(pg_temp.id(16), pg_temp.id(23), 1),
	(pg_temp.id(17), pg_temp.id(24), 1);
alter table public.puzzle_group_members enable trigger user;
alter table public.puzzle_groups enable trigger user;

-- A guest previews the first puzzle of each difficulty of a locked set, and of a locked bonus set.
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select pg_temp.assert_true(
	pg_temp.previewed() = array[pg_temp.id(10), pg_temp.id(12), pg_temp.id(14)],
	'a guest previews the first puzzle of each difficulty of core and bonus sets, and nothing else'
) as test;
select pg_temp.assert_true(
	(select count(*) from public.puzzles where id in (pg_temp.id(10), pg_temp.id(12), pg_temp.id(14))) = 0
	and (select count(*) from public.puzzles where id = pg_temp.id(17)) = 1,
	'previewing does not change what the puzzles table lets a guest read'
) as test;
reset role;

-- A signed-in player sees the same previews, and cannot record one before earning it.
select set_config('request.jwt.claim.sub', pg_temp.id(2)::text, true);
set local role authenticated;
select pg_temp.assert_true(
	pg_temp.previewed() = array[pg_temp.id(10), pg_temp.id(12), pg_temp.id(14)],
	'a signed-in player previews the same puzzles'
) as test;
select pg_temp.assert_true(
	public.record_puzzle_completions(array[pg_temp.id(10), pg_temp.id(12), pg_temp.id(14)]) = '{}'::uuid[],
	'a previewed puzzle cannot be recorded before it is earned'
) as test;
reset role;

-- Once the Hexagon core group is complete, the Triangle core set can be played, so its first
-- puzzle is no longer previewed; the bonus set still needs a grant.
insert into public.group_completions(user_id, group_id) values (pg_temp.id(2), pg_temp.id(24));
set local role authenticated;
select pg_temp.assert_true(
	not (pg_temp.id(10) = any(pg_temp.previewed())) and pg_temp.id(14) = any(pg_temp.previewed()),
	'a set the player can play is no longer previewed'
) as test;
reset role;

rollback;
