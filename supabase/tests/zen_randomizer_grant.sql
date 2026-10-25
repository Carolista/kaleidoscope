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
	select ('ec000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.puzzle(n integer)
returns uuid language sql as $$
	select public.save_puzzle_draft(
		pg_temp.id(n), 'Puzzle ' || n, 'hexagon', 'randomizer-test', 'sm', false, 'easy',
		'{"version":2,"geometry":{"size":4},"target":{"-1,2":0},"pieces":[{"id":"p1","tiles":[{"q":-1,"r":2,"color_slot":0}]}]}',
		'randomizer-seed-' || n, 'hexagon-test', '{"p1":{"q":0,"r":0}}'
	);
$$;

insert into auth.users(id) values (pg_temp.id(1)), (pg_temp.id(2));
delete from public.admin_account;
insert into public.admin_account(user_id) values (pg_temp.id(1));
insert into public.palettes(id, name, colors) values
	('randomizer-test', 'Randomizer test', array['#111111','#222222','#333333','#444444','#555555']);

select set_config('request.jwt.claim.sub', pg_temp.id(1)::text, true);
set local role authenticated;
select pg_temp.puzzle(10);
select pg_temp.puzzle(11);
select pg_temp.puzzle(12);
select pg_temp.puzzle(13);
reset role;

update public.palettes set published_at = now(), release_at = now() where id = 'randomizer-test';
update public.puzzles set published_at = now(), release_at = now()
	where id in (pg_temp.id(10), pg_temp.id(11), pg_temp.id(12), pg_temp.id(13));

-- The real catalog is set aside inside this transaction so that exactly one shape with four
-- groups counts: the released groups are unreleased, and the progression is cut to Hexagon.
-- All of it rolls back.
drop index public.puzzle_groups_core_slot_idx;
drop index public.puzzle_groups_reward_slot_idx;
alter table public.puzzle_groups disable trigger user;
alter table public.puzzle_group_members disable trigger user;
alter table public.shape_progression disable trigger user;
update public.puzzle_groups set published_at = null, release_at = null;
delete from public.shape_progression where shape_id <> 'hexagon';
insert into public.puzzle_groups(id, name, purpose, shape_id, track, published_at, release_at) values
	(pg_temp.id(20), 'Randomizer basic core', 'core', 'hexagon', 'basic', now(), now()),
	(pg_temp.id(21), 'Randomizer rotation core', 'core', 'hexagon', 'rotation', now(), now()),
	(pg_temp.id(22), 'Randomizer basic bonus', 'reward', 'hexagon', 'basic', now(), now()),
	(pg_temp.id(23), 'Randomizer rotation bonus', 'reward', 'hexagon', 'rotation', now(), now());
insert into public.puzzle_group_members(puzzle_id, group_id, position) values
	(pg_temp.id(10), pg_temp.id(20), 1),
	(pg_temp.id(11), pg_temp.id(21), 1),
	(pg_temp.id(12), pg_temp.id(22), 1),
	(pg_temp.id(13), pg_temp.id(23), 1);
alter table public.shape_progression enable trigger user;
alter table public.puzzle_group_members enable trigger user;
alter table public.puzzle_groups enable trigger user;
-- Bonus groups open with a grant, as the rewards would give them.
insert into public.puzzle_group_grants(user_id, group_id, source)
	values (pg_temp.id(2), pg_temp.id(22), 'admin'), (pg_temp.id(2), pg_temp.id(23), 'admin');

select set_config('request.jwt.claim.sub', pg_temp.id(2)::text, true);
set local role authenticated;
select public.record_puzzle_completions(array[pg_temp.id(10), pg_temp.id(11), pg_temp.id(12)]);
select pg_temp.assert_true(
	(select count(*) from public.feature_grants where feature = 'zen_randomizer') = 0,
	'three of four groups complete grants nothing'
) as test;
select public.record_puzzle_completions(array[pg_temp.id(13)]);
select pg_temp.assert_true(
	(select count(*) from public.feature_grants
		where feature = 'zen_randomizer' and source = 'progression') = 1,
	'finishing every released core and bonus group grants the randomizer'
) as test;
select public.record_puzzle_completions(array[pg_temp.id(10), pg_temp.id(13)]);
select pg_temp.assert_true(
	(select count(*) from public.feature_grants where feature = 'zen_randomizer') = 1,
	'repeating a call does not grant it twice'
) as test;
reset role;

-- Another player with the same shape unfinished is not granted it.
select set_config('request.jwt.claim.sub', pg_temp.id(1)::text, true);
set local role authenticated;
select public.record_puzzle_completions(array[pg_temp.id(10), pg_temp.id(11)]);
select pg_temp.assert_true(
	(select count(*) from public.feature_grants where user_id = pg_temp.id(1)) = 0,
	'a player with groups unfinished is not granted the randomizer'
) as test;
reset role;

rollback;
