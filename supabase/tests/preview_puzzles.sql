begin;
set local timezone = 'UTC';

create function pg_temp.assert_true(condition boolean, label text)
returns text language plpgsql as $$
begin
	if condition is distinct from true then raise exception 'FAILED: %', label; end if;
	return 'PASS: ' || label;
end;
$$;
-- Runs a statement as the current role and reports whether it failed with the given SQLSTATE.
create function pg_temp.raises(statement text, expected_state text)
returns boolean language plpgsql as $$
begin
	execute statement;
	return false;
exception when others then
	return sqlstate = expected_state;
end;
$$;
create function pg_temp.id(n integer) returns uuid language sql immutable as $$
	select ('ec000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.puzzle(n integer, p_shape text)
returns uuid language sql as $$
	select public.save_puzzle_draft(
		pg_temp.id(n), 'Puzzle ' || n, p_shape, 'preview-test', 'sm', false, 'easy',
		'{"version":2,"geometry":{"size":4},"target":{"-1,2":0},"pieces":[{"id":"p1","tiles":[{"q":-1,"r":2,"color_slot":0}]}]}',
		'preview-seed-' || n, p_shape || '-test', '{"p1":{"q":0,"r":0}}'
	);
$$;
-- The fixture puzzles among those previewed, since released content also fills the catalog.
create function pg_temp.previewed()
returns uuid[] language sql as $$
	select coalesce(array_agg(id order by id), '{}')
	from public.preview_puzzles()
	where id in (pg_temp.id(10), pg_temp.id(11), pg_temp.id(12), pg_temp.id(13),
		pg_temp.id(14), pg_temp.id(15), pg_temp.id(16));
$$;

insert into auth.users(id) values (pg_temp.id(1)), (pg_temp.id(2));
delete from public.admin_account;
insert into public.admin_account(user_id) values (pg_temp.id(1));
insert into public.palettes(id, name, colors) values
	('preview-test', 'Preview test', array['#111111','#222222','#333333','#444444','#555555']);

select set_config('request.jwt.claim.sub', pg_temp.id(1)::text, true);
set local role authenticated;
select pg_temp.puzzle(10, 'hexagon');
select pg_temp.puzzle(11, 'hexagon');
select pg_temp.puzzle(12, 'triangle');
select pg_temp.puzzle(13, 'triangle');
select pg_temp.puzzle(14, 'diamondStar');
select pg_temp.puzzle(15, 'hexagon');
select pg_temp.puzzle(16, 'hexagon');
reset role;

update public.palettes set published_at = now(), release_at = now() where id = 'preview-test';
update public.puzzles set published_at = now(), release_at = now()
	where id in (pg_temp.id(10), pg_temp.id(11), pg_temp.id(12), pg_temp.id(13),
		pg_temp.id(14), pg_temp.id(15), pg_temp.id(16));

-- Released content already fills the slots, so these fixtures are inserted directly with the slot
-- indexes and guard triggers set aside. All of it rolls back.
--   20: Hexagon core (puzzle 10)         21: Hexagon bonus (puzzle 11)
--   22: Triangle core (puzzle 12)        23: Triangle bonus (puzzle 13)
--   24: Diamond Star core (puzzle 14)    25: Hexagon pack (puzzle 15)
--   26: Hexagon bonus, not released (puzzle 16)
drop index public.puzzle_groups_core_slot_idx;
drop index public.puzzle_groups_reward_slot_idx;
alter table public.puzzle_groups disable trigger user;
alter table public.puzzle_group_members disable trigger user;
insert into public.puzzle_groups(id, name, purpose, shape_id, track, published_at, release_at) values
	(pg_temp.id(20), 'Preview hex core', 'core', 'hexagon', 'basic', now(), now()),
	(pg_temp.id(21), 'Preview hex bonus', 'reward', 'hexagon', 'basic', now(), now()),
	(pg_temp.id(22), 'Preview triangle core', 'core', 'triangle', 'basic', now(), now()),
	(pg_temp.id(23), 'Preview triangle bonus', 'reward', 'triangle', 'basic', now(), now()),
	(pg_temp.id(24), 'Preview diamond star core', 'core', 'diamondStar', 'basic', now(), now()),
	(pg_temp.id(25), 'Preview hex pack', 'pack', 'hexagon', 'basic', now(), now()),
	(pg_temp.id(26), 'Preview hex bonus draft', 'reward', 'hexagon', 'rotation', null, null);
insert into public.puzzle_group_members(puzzle_id, group_id, position) values
	(pg_temp.id(10), pg_temp.id(20), 1),
	(pg_temp.id(11), pg_temp.id(21), 1),
	(pg_temp.id(12), pg_temp.id(22), 1),
	(pg_temp.id(13), pg_temp.id(23), 1),
	(pg_temp.id(14), pg_temp.id(24), 1),
	(pg_temp.id(15), pg_temp.id(25), 1),
	(pg_temp.id(16), pg_temp.id(26), 1);
alter table public.puzzle_group_members enable trigger user;
alter table public.puzzle_groups enable trigger user;

-- Player 2 has completed nothing.
select set_config('request.jwt.claim.sub', pg_temp.id(2)::text, true);
set local role authenticated;
select pg_temp.assert_true(
	pg_temp.previewed() = array[pg_temp.id(11), pg_temp.id(12), pg_temp.id(13)],
	'a player previews the bonus sets of their shapes and the core and bonus sets of the next shape, nothing else'
) as test;
select pg_temp.assert_true(
	(select count(*) from public.puzzles where id in (pg_temp.id(11), pg_temp.id(12), pg_temp.id(13))) = 0
	and (select count(*) from public.puzzles where id = pg_temp.id(10)) = 1,
	'previewing does not change what the puzzles table lets the player read'
) as test;
select pg_temp.assert_true(
	public.record_puzzle_completions(array[pg_temp.id(11), pg_temp.id(12), pg_temp.id(13)]) = '{}'::uuid[],
	'a previewed puzzle cannot be recorded before it is earned'
) as test;
reset role;

-- After finishing the Hexagon core group, the next shape opens, so its puzzles are no longer previews.
insert into public.group_completions(user_id, group_id) values (pg_temp.id(2), pg_temp.id(20));
set local role authenticated;
select pg_temp.assert_true(
	pg_temp.previewed() = array[pg_temp.id(11), pg_temp.id(13), pg_temp.id(14)],
	'an earned shape plays from the table and the shape after it is previewed'
) as test;
reset role;

-- Guests and signed-out requests have no preview.
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select pg_temp.assert_true(
	pg_temp.raises('select * from public.preview_puzzles()', '42501'),
	'guests cannot preview puzzles'
) as test;
reset role;
set local role authenticated;
select pg_temp.assert_true(
	pg_temp.previewed() = '{}'::uuid[],
	'a request with no signed-in user previews nothing'
) as test;
reset role;

rollback;
