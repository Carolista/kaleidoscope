begin;
set local timezone = 'UTC';

create or replace function pg_temp.fixture_id(value integer)
returns uuid language sql immutable as $$
	select ('ef000000-0000-4000-8000-' || lpad(value::text, 12, '0'))::uuid;
$$;
create or replace function pg_temp.assert_true(condition boolean, label text)
returns text language plpgsql as $$
begin
	if condition is distinct from true then raise exception 'FAILED: %', label; end if;
	return 'PASS: ' || label;
end;
$$;
create or replace function pg_temp.expect_error(statement text, expected_state text, label text)
returns text language plpgsql as $$
begin
	begin
		execute statement;
	exception when others then
		if sqlstate = expected_state then return 'PASS: ' || label; end if;
		raise exception 'FAILED: % (expected %, got %: %)', label, expected_state, sqlstate, sqlerrm;
	end;
	raise exception 'FAILED: % (statement unexpectedly succeeded)', label;
end;
$$;

insert into auth.users(id) values (pg_temp.fixture_id(1)), (pg_temp.fixture_id(2));
delete from public.admin_account;
insert into public.admin_account(user_id) values (pg_temp.fixture_id(1));
select set_config('request.jwt.claim.sub', pg_temp.fixture_id(1)::text, true);
set local role authenticated;

insert into public.palettes(id, name, colors, published_at, release_at) values
	('lifecycle-test', 'Lifecycle', array['#111111','#222222','#333333','#444444','#555555'],
		now(), now() + interval '1 day');
update public.palettes set name = 'Edited scheduled palette', release_at = now() + interval '2 days'
	where id = 'lifecycle-test';
update public.palettes set published_at = null, release_at = null where id = 'lifecycle-test';
select pg_temp.assert_true((select published_at is null from public.palettes where id = 'lifecycle-test'),
	'admin can cancel a future palette release') as test;
update public.palettes set published_at = now(), release_at = now() + interval '1 day'
	where id = 'lifecycle-test';

insert into public.puzzle_collections(id, name, kind, shape_id) values
	(pg_temp.fixture_id(10), 'Scheduled core set', 'core', 'hexagon'),
	(pg_temp.fixture_id(11), 'Reward set', 'reward', 'hexagon');
insert into public.puzzles (
	id, name, usage, shape_id, palette_id, board_size, rotation_allowed, difficulty, definition
)
select pg_temp.fixture_id(n), 'Lifecycle puzzle', 'collection', 'hexagon',
	'lifecycle-test', 'sm', false, 'easy',
	'{"version":2,"geometry":{"radius":3},"target":{"0,0":0},"pieces":[
		{"id":"p1","tiles":[{"q":0,"r":0,"color_slot":0}]}]}'::jsonb
from generate_series(100, 102) n;
insert into public.puzzle_authoring(puzzle_id, seed, generator_version, known_solution)
	select pg_temp.fixture_id(n), 'seed', 'test', '{}'::jsonb from generate_series(100, 102) n;
update public.puzzles set published_at = now(), release_at = now() + interval '2 days'
	where id in (pg_temp.fixture_id(100),pg_temp.fixture_id(101),pg_temp.fixture_id(102));
insert into public.collection_puzzles(puzzle_id, collection_id, shape_id, position) values
	(pg_temp.fixture_id(100),pg_temp.fixture_id(10),'hexagon',1),
	(pg_temp.fixture_id(101),pg_temp.fixture_id(11),'hexagon',1);
insert into public.completion_routes(id, collection_id, name, position)
	values(pg_temp.fixture_id(20),pg_temp.fixture_id(10),'Route',1);
insert into public.route_puzzles(route_id,collection_id,puzzle_id)
	values(pg_temp.fixture_id(20),pg_temp.fixture_id(10),pg_temp.fixture_id(100));
insert into public.reward_rules(id, collection_id) values(pg_temp.fixture_id(30),pg_temp.fixture_id(10));
insert into public.reward_palettes values(pg_temp.fixture_id(30),'lifecycle-test');
insert into public.reward_sets values(pg_temp.fixture_id(30),pg_temp.fixture_id(11));
update public.puzzle_collections set published_at = now(), release_at = now() + interval '3 days'
	where id in(pg_temp.fixture_id(10),pg_temp.fixture_id(11));
insert into public.core_progression(name) values('Scheduled core');
insert into public.core_steps values(pg_temp.fixture_id(10),1);
update public.core_progression set published_at = now(), release_at = now() + interval '4 days';
insert into public.palette_packs(id,name) values(pg_temp.fixture_id(40),'Scheduled palette pack');
insert into public.palette_pack_palettes values(pg_temp.fixture_id(40),'lifecycle-test',1);
update public.palette_packs set published_at = now(),release_at = now() + interval '3 days'
	where id = pg_temp.fixture_id(40);
set constraints all immediate;
set constraints all deferred;

update public.puzzles set name = 'Last-minute edit' where id = pg_temp.fixture_id(100);
update public.puzzle_authoring set seed = 'new-seed' where puzzle_id = pg_temp.fixture_id(100);
update public.completion_routes set name = 'Edited route' where id = pg_temp.fixture_id(20);
update public.collection_puzzles set position = 2 where puzzle_id = pg_temp.fixture_id(100);
update public.core_progression set name = 'Edited scheduled core';
delete from public.reward_palettes where reward_rule_id = pg_temp.fixture_id(30);
insert into public.reward_palettes values(pg_temp.fixture_id(30),'lifecycle-test');
set constraints all immediate;
select pg_temp.assert_true((select name = 'Last-minute edit' from public.puzzles where id = pg_temp.fixture_id(100)),
	'admin can edit scheduled puzzles, authoring, membership, routes, rewards and core') as test;

select pg_temp.expect_error(
	$$update public.puzzles set published_at = null, release_at = null where id = pg_temp.fixture_id(100)$$,
	'23514','cannot cancel a puzzle still needed by a prepared set') as test;
select pg_temp.expect_error(
	$$update public.puzzles set release_at = now() + interval '5 days' where id = pg_temp.fixture_id(100)$$,
	'23514','cannot move a puzzle past its set release') as test;
select pg_temp.expect_error(
	$$update public.palettes set release_at = now() + interval '5 days' where id = 'lifecycle-test'$$,
	'23514','reverse palette dependencies block delayed releases') as test;
select pg_temp.expect_error(
	$$update public.palettes set published_at = null,release_at = null where id = 'lifecycle-test'$$,
	'23514','cannot cancel a palette needed by scheduled content') as test;
select pg_temp.expect_error(
	$$delete from public.route_puzzles where route_id = pg_temp.fixture_id(20)$$,
	'23514','cannot leave a scheduled route empty') as test;
select pg_temp.expect_error(
	$$update public.puzzle_collections set published_at = null,release_at = null
		where id = pg_temp.fixture_id(11)$$,
	'23514','cannot cancel a reward set needed by scheduled reward rules') as test;
select pg_temp.expect_error(
	$$delete from public.core_steps where collection_id = pg_temp.fixture_id(10)$$,
	'23514','cannot leave scheduled core empty') as test;
select pg_temp.expect_error(
	$$delete from public.palette_pack_palettes where pack_id = pg_temp.fixture_id(40)$$,
	'23514','cannot leave a scheduled palette pack empty') as test;

set constraints all deferred;
update public.core_progression set published_at = null,release_at = null;
update public.puzzle_collections set published_at = null,release_at = null
	where id = pg_temp.fixture_id(10);
update public.puzzles set published_at = null,release_at = null where id = pg_temp.fixture_id(100);
set constraints all immediate;
select pg_temp.assert_true((select published_at is null from public.puzzles where id = pg_temp.fixture_id(100)),
	'coordinated cancellation succeeds when dependent offerings also return to draft') as test;
update public.puzzles set published_at = now(),release_at = now() + interval '2 days'
	where id = pg_temp.fixture_id(100);
update public.puzzle_collections set published_at = now(),release_at = now() + interval '3 days'
	where id = pg_temp.fixture_id(10);
update public.core_progression set published_at = now(),release_at = now() + interval '4 days';
update public.puzzles set published_at = null,release_at = null where id = pg_temp.fixture_id(102);
delete from public.puzzles where id = pg_temp.fixture_id(102);
select pg_temp.assert_true(not exists(select 1 from public.puzzles where id = pg_temp.fixture_id(102)),
	'unassigned future content can be cancelled and deleted') as test;

insert into public.puzzles (
	id, name, usage, shape_id, palette_id, board_size, rotation_allowed, difficulty, definition
)
select pg_temp.fixture_id(103), 'Daily lifecycle', 'daily', shape_id, palette_id,
	board_size, rotation_allowed, difficulty, definition from public.puzzles
	where id = pg_temp.fixture_id(100);
insert into public.puzzle_authoring(puzzle_id,seed,generator_version,known_solution)
	values(pg_temp.fixture_id(103),'daily-seed','test','{}');
update public.puzzles set published_at = now(),release_at = now() + interval '2 days'
	where id = pg_temp.fixture_id(103);
insert into public.daily_schedule(rollover_time_utc) values((now() at time zone 'UTC')::time);
insert into public.daily_puzzles(id,puzzle_id,release_at,expires_at)
	values(pg_temp.fixture_id(50),pg_temp.fixture_id(103),
		now() + interval '3 days',now() + interval '8 days');
update public.daily_puzzles set release_at = now() + interval '4 days',
	expires_at = now() + interval '9 days' where id = pg_temp.fixture_id(50);
select pg_temp.assert_true((select release_at = now() + interval '4 days'
	from public.daily_puzzles where id = pg_temp.fixture_id(50)),
	'future daily assignments can be rescheduled') as test;
select pg_temp.expect_error(
	$$update public.puzzles set published_at = null,release_at = null where id = pg_temp.fixture_id(103)$$,
	'23514','daily assignment prevents cancelling its prepared puzzle') as test;
delete from public.daily_puzzles where id = pg_temp.fixture_id(50);
select pg_temp.assert_true(not exists(select 1 from public.daily_puzzles where id = pg_temp.fixture_id(50)),
	'future daily assignments can be cancelled') as test;

reset role;
set local role anon;
select pg_temp.assert_true((select count(*) = 0 from public.puzzles where id = pg_temp.fixture_id(100)),
	'scheduled puzzle remains hidden from guests after edits') as test;
reset role;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id(2)::text,true);
set local role authenticated;
select pg_temp.assert_true((select count(*) = 0 from public.puzzle_collections where id = pg_temp.fixture_id(10)),
	'scheduled sets remain hidden from players') as test;
with changed as (
	update public.puzzles set name = 'Forged edit' where id = pg_temp.fixture_id(100) returning id
)
select pg_temp.assert_true((select count(*) = 0 from changed),
	'ordinary users still cannot edit scheduled puzzles') as test;
select pg_temp.expect_error(
	$$insert into public.palettes(id,name,colors) values
		('forged','Forged',array['#111111','#222222','#333333','#444444','#555555'])$$,
	'42501','RLS still denies non-admin authoring') as test;

reset role;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id(1)::text,true);
set local role authenticated;
-- Move the complete dependency chain live in one valid transaction.
set constraints all deferred;
update public.palettes set release_at = now() where id = 'lifecycle-test';
update public.puzzles set release_at = now()
	where id in(pg_temp.fixture_id(100),pg_temp.fixture_id(101),pg_temp.fixture_id(103));
update public.puzzle_collections set release_at = now()
	where id in(pg_temp.fixture_id(10),pg_temp.fixture_id(11));
update public.core_progression set release_at = now();
update public.palette_packs set release_at = now() where id = pg_temp.fixture_id(40);
set constraints all immediate;
insert into public.daily_puzzles(id,puzzle_id,release_at,expires_at)
	values(pg_temp.fixture_id(50),pg_temp.fixture_id(103),now(),now() + interval '5 days');
select pg_temp.expect_error(
	$$delete from public.daily_puzzles where id = pg_temp.fixture_id(50)$$,
	'23514','live daily assignments cannot be cancelled') as test;

select pg_temp.expect_error(
	$$update public.puzzles set release_at = now() + interval '1 day' where id = pg_temp.fixture_id(100)$$,
	'23514','live puzzles cannot be reopened by moving release into the future') as test;
select pg_temp.expect_error(
	$$update public.puzzles set published_at = null,release_at = null where id = pg_temp.fixture_id(100)$$,
	'23514','live puzzles cannot return to draft') as test;
select pg_temp.expect_error(
	$$update public.puzzles set name = 'Live edit' where id = pg_temp.fixture_id(100)$$,
	'23514','live puzzle definitions stay fixed') as test;
select pg_temp.expect_error(
	$$delete from public.puzzles where id = pg_temp.fixture_id(100)$$,
	'23514','live puzzles cannot be deleted') as test;
select pg_temp.expect_error(
	$$update public.puzzle_collections set release_at = now() + interval '1 day'
		where id = pg_temp.fixture_id(10)$$,
	'23514','live sets cannot be reopened through scheduling') as test;
select pg_temp.expect_error(
	$$update public.collection_puzzles set collection_id = pg_temp.fixture_id(11),position = 9
		where puzzle_id = pg_temp.fixture_id(100)$$,
	'23514','moving membership checks the old live parent') as test;
select pg_temp.expect_error(
	$$insert into public.completion_routes(id,collection_id,name,position)
		values(pg_temp.fixture_id(21),pg_temp.fixture_id(10),'New route',2)$$,
	'23514','inserting configuration checks the new live parent') as test;
select pg_temp.expect_error(
	$$delete from public.route_puzzles where route_id = pg_temp.fixture_id(20)$$,
	'23514','live route membership stays fixed') as test;
select pg_temp.expect_error(
	$$delete from public.reward_palettes where reward_rule_id = pg_temp.fixture_id(30)$$,
	'23514','live rewards stay fixed') as test;
select pg_temp.expect_error(
	$$delete from public.puzzle_authoring where puzzle_id = pg_temp.fixture_id(100)$$,
	'23514','live authoring provenance stays fixed') as test;
select pg_temp.expect_error(
	$$update public.core_progression set release_at = now() + interval '1 day'$$,
	'23514','live core cannot be reopened') as test;
select pg_temp.expect_error(
	$$delete from public.core_steps where collection_id = pg_temp.fixture_id(10)$$,
	'23514','live core membership stays fixed') as test;
select pg_temp.expect_error(
	$$update public.palettes set published_at = null,release_at = null where id = 'lifecycle-test'$$,
	'23514','live palette cannot be hidden by cancelling release') as test;
select pg_temp.expect_error(
	$$delete from public.palette_pack_palettes where pack_id = pg_temp.fixture_id(40)$$,
	'23514','live palette pack membership stays fixed') as test;

update public.palettes set colors[1] = '#121212' where id = 'lifecycle-test';
select pg_temp.assert_true((select colors[1] = '#121212' and revision = 2
	from public.palettes where id = 'lifecycle-test'),
	'exceptional live palette correction remains permitted and revisioned') as test;
select pg_temp.assert_true(exists(
	select 1 from public.palette_corrections where palette_id = 'lifecycle-test'
		and revision = 2 and old_colors[1] = '#111111' and new_colors[1] = '#121212'
		and changed_by = pg_temp.fixture_id(1)
), 'live palette correction retains its before/after audit and admin identity') as test;
select pg_temp.assert_true((select definition -> 'target' -> '0,0' = '0'::jsonb
	from public.puzzles where id = pg_temp.fixture_id(100)),
	'palette correction preserves immutable puzzle slot assignments') as test;

insert into public.puzzles (
	id,name,usage,shape_id,palette_id,board_size,rotation_allowed,difficulty,definition
)
select pg_temp.fixture_id(104),'Boundary puzzle',usage,shape_id,palette_id,
	board_size,rotation_allowed,difficulty,definition
	from public.puzzles where id = pg_temp.fixture_id(100);
insert into public.puzzle_authoring(puzzle_id,seed,generator_version,known_solution)
	values(pg_temp.fixture_id(104),'boundary','test','{}');
update public.puzzles set published_at = now(),release_at = clock_timestamp() + interval '1 second'
	where id = pg_temp.fixture_id(104);
select pg_sleep(1.05);
select pg_temp.expect_error(
	$$update public.puzzles set name = 'Too late' where id = pg_temp.fixture_id(104)$$,
	'23514','release boundary freezes content even inside a transaction begun before release') as test;

select 'All pre-release lifecycle assertions passed; fixtures will be rolled back.' as result;
reset role;
rollback;

-- The serialization lock must not run checks against a stale transaction snapshot.
begin isolation level repeatable read;
do $$
begin
	begin
		update public.palettes set name = name where false;
	exception when sqlstate '25001' then
		return;
	end;
	raise exception 'FAILED: stale-snapshot catalog editing must be rejected';
end;
$$;
select 'PASS: stale-snapshot isolation cannot bypass serialized catalog checks' as test;
rollback;
