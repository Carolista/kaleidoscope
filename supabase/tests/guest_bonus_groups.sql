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
	select ('ea000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.puzzle(n integer, p_shape text)
returns uuid language sql as $$
	select public.save_puzzle_draft(
		pg_temp.id(n), 'Puzzle ' || n, p_shape, 'guest-bonus-test', 'sm', false, 'easy',
		'{"version":2,"geometry":{"size":4},"target":{"-1,2":0},"pieces":[{"id":"p1","tiles":[{"q":-1,"r":2,"color_slot":0}]}]}',
		'guest-bonus-seed-' || n, p_shape || '-test', '{"p1":{"q":0,"r":0}}'
	);
$$;

insert into auth.users(id) values (pg_temp.id(1)), (pg_temp.id(2));
delete from public.admin_account;
insert into public.admin_account(user_id) values (pg_temp.id(1));
insert into public.palettes(id, name, colors) values
	('guest-bonus-test', 'Guest bonus test', array['#111111','#222222','#333333','#444444','#555555']);

select set_config('request.jwt.claim.sub', pg_temp.id(1)::text, true);
set local role authenticated;
select pg_temp.puzzle(10, 'hexagon');
select pg_temp.puzzle(11, 'hexagon');
select pg_temp.puzzle(12, 'triangle');
select pg_temp.puzzle(13, 'hexagon');
reset role;

update public.palettes set published_at = now(), release_at = now() where id = 'guest-bonus-test';
update public.puzzles set published_at = now(), release_at = now()
	where id in (pg_temp.id(10), pg_temp.id(11), pg_temp.id(12), pg_temp.id(13));

-- Released content already fills the bonus slots, so these fixtures are inserted directly with
-- the slot index and guard triggers set aside. All of it rolls back.
drop index public.puzzle_groups_reward_slot_idx;
alter table public.puzzle_groups disable trigger user;
alter table public.puzzle_group_members disable trigger user;
insert into public.puzzle_groups(id, name, purpose, shape_id, track, published_at, release_at) values
	(pg_temp.id(20), 'Hex bonus', 'reward', 'hexagon', 'basic', now(), now()),
	(pg_temp.id(21), 'Hex bonus draft', 'reward', 'hexagon', 'rotation', null, null),
	(pg_temp.id(22), 'Triangle bonus', 'reward', 'triangle', 'basic', now(), now()),
	(pg_temp.id(23), 'Hex pack', 'pack', 'hexagon', 'basic', now(), now());
insert into public.puzzle_group_members(puzzle_id, group_id, position) values
	(pg_temp.id(10), pg_temp.id(20), 1),
	(pg_temp.id(11), pg_temp.id(21), 1),
	(pg_temp.id(12), pg_temp.id(22), 1),
	(pg_temp.id(13), pg_temp.id(23), 1);
alter table public.puzzle_group_members enable trigger user;
alter table public.puzzle_groups enable trigger user;

select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select pg_temp.assert_true(
	(select count(*) from public.puzzle_groups where id = pg_temp.id(20)) = 1
	and (select count(*) from public.puzzle_group_members where group_id = pg_temp.id(20)) = 1
	and (select count(*) from public.puzzles where id = pg_temp.id(10)) = 1,
	'guests read a released bonus group of the first shape and its puzzles'
) as test;
select pg_temp.assert_true(
	(select count(*) from public.puzzles where id = pg_temp.id(11)) = 0,
	'guests cannot read a bonus group that is not released'
) as test;
select pg_temp.assert_true(
	(select count(*) from public.puzzles where id = pg_temp.id(12)) = 0,
	'guests cannot read a bonus group of a later shape'
) as test;
select pg_temp.assert_true(
	(select count(*) from public.puzzles where id = pg_temp.id(13)) = 0,
	'guests still cannot read pack puzzles'
) as test;
reset role;

select set_config('request.jwt.claim.sub', pg_temp.id(2)::text, true);
set local role authenticated;
select pg_temp.assert_true(
	(select count(*) from public.puzzles where id = pg_temp.id(10)) = 0,
	'signed-in players still need a grant for a bonus group'
) as test;
reset role;
insert into public.puzzle_group_grants(user_id, group_id, source)
	values (pg_temp.id(2), pg_temp.id(20), 'admin');
set local role authenticated;
select pg_temp.assert_true(
	(select count(*) from public.puzzles where id = pg_temp.id(10)) = 1,
	'a granted bonus group plays for its signed-in player'
) as test;
reset role;

rollback;
