begin;
set local timezone = 'UTC';

create function pg_temp.fixture_id(value integer)
returns uuid language sql immutable
as $$
	select ('ee000000-0000-4000-8000-' || lpad(value::text, 12, '0'))::uuid;
$$;

create function pg_temp.assert_true(condition boolean, label text)
returns text language plpgsql
as $$
begin
	if condition is distinct from true then
		raise exception 'FAILED: %', label;
	end if;
	return 'PASS: ' || label;
end;
$$;

create function pg_temp.expect_error(statement text, expected_state text, label text)
returns text language plpgsql
as $$
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

create function pg_temp.assert_player_mutations_denied()
returns text language plpgsql
as $$
declare
	table_name text;
	column_name text;
	affected bigint;
begin
	for table_name in select tablename from pg_tables where schemaname = 'public' loop
		execute format('delete from public.%I', table_name);
		get diagnostics affected = row_count;
		if affected <> 0 then raise exception 'Player deleted rows from %', table_name; end if;
		if table_name = 'profiles' then continue; end if;
		select a.attname into column_name from pg_attribute a
			where a.attrelid = format('public.%I', table_name)::regclass
				and a.attnum > 0 and not a.attisdropped and a.attidentity = ''
				and a.attgenerated = ''
			order by a.attnum limit 1;
		execute format('update public.%I set %I = %I', table_name, column_name, column_name);
		get diagnostics affected = row_count;
		if affected <> 0 then raise exception 'Player updated rows in %', table_name; end if;
	end loop;
	return 'PASS: regular players cannot delete any table rows or update non-profile tables';
end;
$$;

select pg_temp.assert_true(
	(select count(*) = 31 and bool_and(relrowsecurity) from pg_class c
		join pg_namespace n on n.oid = c.relnamespace
		where n.nspname = 'public' and c.relkind = 'r'),
	'all 31 application tables enable RLS'
) as test;
select pg_temp.assert_true(
	not has_schema_privilege('authenticated', 'public', 'CREATE')
		and not has_schema_privilege('anon', 'public', 'CREATE'),
	'application roles cannot create schema objects'
) as test;
select pg_temp.assert_true(
	not exists (
		select 1 from pg_policies where schemaname = 'public'
			and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
			and policyname not in ('admin_crud', 'profile_create', 'profile_update')
	), 'only admin and own-profile policies permit application writes'
) as test;
select pg_temp.assert_true(
	not exists (
		select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
		where n.nspname = 'public' and c.relkind = 'r'
			and not exists (
				select 1 from pg_policies p
				where p.schemaname = n.nspname and p.tablename = c.relname
					and p.policyname = 'admin_crud'
			)
	), 'every table has an explicit admin policy'
) as test;

insert into auth.users(id) values
	(pg_temp.fixture_id(1)), (pg_temp.fixture_id(2)), (pg_temp.fixture_id(3));
delete from public.admin_account;
insert into public.admin_account(user_id) values (pg_temp.fixture_id(1));
insert into public.profiles(user_id, username) values
	(pg_temp.fixture_id(1), 'schema-test-admin'),
	(pg_temp.fixture_id(2), 'schema-test-player'),
	(pg_temp.fixture_id(3), 'schema-test-other');

update public.shapes set release_at = now() - interval '20 days';
update public.palettes set published_at = now(), release_at = now() - interval '20 days'
	where id in ('cabo', 'tahiti');
update public.palettes set published_at = now(), release_at = now() + interval '1 day'
	where id = 'regatta';
insert into public.starter_palettes(palette_id) values ('cabo');

insert into public.puzzle_collections(id, name, kind, shape_id) values
	(pg_temp.fixture_id(10), 'Initial set', 'core', 'hexagon'),
	(pg_temp.fixture_id(11), 'Second set', 'core', 'triangle'),
	(pg_temp.fixture_id(12), 'Reward set', 'reward', 'hexagon'),
	(pg_temp.fixture_id(13), 'Paid pack', 'paid', 'triangle'),
	(pg_temp.fixture_id(14), 'Scheduled set', 'reward', 'hexagon'),
	(pg_temp.fixture_id(15), 'Draft set', 'reward', 'hexagon');
insert into public.core_progression(name) values ('Test core');
insert into public.core_steps(collection_id, position) values
	(pg_temp.fixture_id(10), 1), (pg_temp.fixture_id(11), 2);

insert into public.puzzles (
	id, name, usage, shape_id, palette_id, board_size, rotation_allowed, difficulty, definition
)
select pg_temp.fixture_id(v.id), 'Fixture ' || v.id, v.usage, v.shape, 'cabo',
	v.size, v.rotation, v.difficulty,
	'{"version":2,"geometry":{"radius":3},"target":{"0,0":0},"pieces":[
		{"id":"p1","tiles":[{"q":0,"r":0,"color_slot":0}]}
	]}'::jsonb
from (values
	(100, 'collection', 'hexagon', 'sm', false, 'easy'),
	(101, 'collection', 'hexagon', 'lg', false, 'hard'),
	(102, 'collection', 'triangle', 'md', false, 'moderate'),
	(103, 'collection', 'hexagon', 'sm', true, 'moderate'),
	(104, 'collection', 'triangle', 'md', true, 'hard'),
	(105, 'collection', 'hexagon', 'lg', true, 'super_hard'),
	(106, 'collection', 'hexagon', 'sm', false, 'easy'),
	(107, 'daily', 'triangle', 'sm', false, 'easy'),
	(108, 'daily', 'triangle', 'sm', false, 'easy'),
	(109, 'daily', 'triangle', 'sm', false, 'easy'),
	(110, 'collection', 'triangle', 'sm', false, 'easy'),
	(111, 'daily', 'triangle', 'sm', false, 'easy'),
	(112, 'daily', 'triangle', 'sm', false, 'easy'),
	(113, 'daily', 'triangle', 'sm', false, 'easy'),
	(114, 'daily', 'triangle', 'sm', false, 'easy'),
	(115, 'daily', 'triangle', 'sm', false, 'easy')
) as v(id, usage, shape, size, rotation, difficulty);
insert into public.puzzle_authoring(puzzle_id, seed, generator_version, known_solution)
	select id, 'test-seed', 'test-v2', '{}'::jsonb
	from public.puzzles where id::text like 'ee000000-%';
update public.puzzles set published_at = now(), release_at = now() - interval '10 days'
	where id::text like 'ee000000-%' and id <> pg_temp.fixture_id(106);

insert into public.collection_puzzles(puzzle_id, collection_id, shape_id, position) values
	(pg_temp.fixture_id(100), pg_temp.fixture_id(10), 'hexagon', 1),
	(pg_temp.fixture_id(101), pg_temp.fixture_id(10), 'hexagon', 2),
	(pg_temp.fixture_id(102), pg_temp.fixture_id(11), 'triangle', 1),
	(pg_temp.fixture_id(110), pg_temp.fixture_id(11), 'triangle', 2),
	(pg_temp.fixture_id(103), pg_temp.fixture_id(12), 'hexagon', 1),
	(pg_temp.fixture_id(104), pg_temp.fixture_id(13), 'triangle', 1),
	(pg_temp.fixture_id(105), pg_temp.fixture_id(14), 'hexagon', 1),
	(pg_temp.fixture_id(106), pg_temp.fixture_id(15), 'hexagon', 1);
update public.puzzle_collections set selection_mode = 'fixed' where id = pg_temp.fixture_id(11);
insert into public.completion_routes(id, collection_id, name, position) values
	(pg_temp.fixture_id(20), pg_temp.fixture_id(10), 'Accessible', 1),
	(pg_temp.fixture_id(21), pg_temp.fixture_id(10), 'Challenge', 2),
	(pg_temp.fixture_id(22), pg_temp.fixture_id(11), 'Accessible', 1);
insert into public.route_puzzles(route_id, collection_id, puzzle_id) values
	(pg_temp.fixture_id(20), pg_temp.fixture_id(10), pg_temp.fixture_id(100)),
	(pg_temp.fixture_id(21), pg_temp.fixture_id(10), pg_temp.fixture_id(101)),
	(pg_temp.fixture_id(22), pg_temp.fixture_id(11), pg_temp.fixture_id(102));
insert into public.reward_rules(id, collection_id, route_id) values
	(pg_temp.fixture_id(30), pg_temp.fixture_id(10), null),
	(pg_temp.fixture_id(31), pg_temp.fixture_id(10), pg_temp.fixture_id(21));
insert into public.reward_shapes(reward_rule_id, shape_id)
	values (pg_temp.fixture_id(30), 'triangle');
insert into public.reward_palettes(reward_rule_id, palette_id)
	values (pg_temp.fixture_id(31), 'tahiti');
insert into public.reward_sets(reward_rule_id, collection_id)
	values (pg_temp.fixture_id(31), pg_temp.fixture_id(12));
update public.puzzle_collections set published_at = now(), release_at = now()
	where id::text like 'ee000000-%' and id not in (pg_temp.fixture_id(14), pg_temp.fixture_id(15));
update public.puzzle_collections set published_at = now(), release_at = now() + interval '1 day'
	where id = pg_temp.fixture_id(14);
update public.core_progression set published_at = now(), release_at = now();

insert into public.daily_schedule(rollover_time_utc) values ((now() at time zone 'UTC')::time);
insert into public.daily_puzzles(id, puzzle_id, release_at, expires_at) values
	(pg_temp.fixture_id(40), pg_temp.fixture_id(107), now() - interval '1 day', now() + interval '4 days'),
	(pg_temp.fixture_id(41), pg_temp.fixture_id(108), now() - interval '6 days', now() - interval '1 day'),
	(pg_temp.fixture_id(42), pg_temp.fixture_id(109), now() + interval '1 day', now() + interval '6 days'),
	(pg_temp.fixture_id(43), pg_temp.fixture_id(111), now(), now() + interval '5 days'),
	(pg_temp.fixture_id(44), pg_temp.fixture_id(112), now() - interval '2 days', now() + interval '3 days'),
	(pg_temp.fixture_id(45), pg_temp.fixture_id(113), now() - interval '3 days', now() + interval '2 days'),
	(pg_temp.fixture_id(46), pg_temp.fixture_id(114), now() - interval '4 days', now() + interval '1 day'),
	(pg_temp.fixture_id(47), pg_temp.fixture_id(115), now() - interval '5 days', now());

insert into public.palette_packs(id, name, published_at, release_at) values
	(pg_temp.fixture_id(50), 'Released palette pack', now(), now()),
	(pg_temp.fixture_id(51), 'Future palette pack', now(), now() + interval '1 day');
insert into public.palette_pack_palettes(pack_id, palette_id, position) values
	(pg_temp.fixture_id(50), 'tahiti', 1), (pg_temp.fixture_id(51), 'regatta', 1);

select pg_temp.expect_error(
	$$update public.puzzles set name = 'Changed' where id = pg_temp.fixture_id(100)$$,
	'23514', 'published puzzles cannot be edited even by database owner'
) as test;
select pg_temp.expect_error(
	$$delete from public.puzzle_collections where id = pg_temp.fixture_id(10)$$,
	'23514', 'published sets cannot be deleted'
) as test;
select pg_temp.expect_error(
	$$update public.collection_puzzles set position = 9 where puzzle_id = pg_temp.fixture_id(100)$$,
	'23514', 'published set membership cannot be changed'
) as test;
select pg_temp.expect_error(
	$$delete from public.route_puzzles where route_id = pg_temp.fixture_id(20)$$,
	'23514', 'published route requirements cannot be removed'
) as test;
select pg_temp.expect_error(
	$$insert into public.reward_palettes values (pg_temp.fixture_id(31), 'cabo')$$,
	'23514', 'rewards cannot be added to published sets'
) as test;
select pg_temp.expect_error(
	$$update public.core_steps set position = 3 where collection_id = pg_temp.fixture_id(11)$$,
	'23514', 'published core sequence cannot be extended or reordered'
) as test;
select pg_temp.expect_error(
	$$update public.daily_puzzles set expires_at = expires_at + interval '1 day'
		where id = pg_temp.fixture_id(40)$$,
	'23514', 'released daily assignments cannot be rescheduled'
) as test;
select pg_temp.expect_error(
	$$update public.daily_puzzles set release_at = release_at + interval '1 second',
		expires_at = expires_at + interval '1 second' where id = pg_temp.fixture_id(42)$$,
	'23514', 'every daily assignment uses the same global rollover time'
) as test;
select pg_temp.expect_error(
	$$update public.daily_schedule set rollover_time_utc = '00:00:00'$$,
	'23514', 'daily schedule cannot shift underneath existing assignments'
) as test;
select pg_temp.expect_error(
	$$update public.collection_puzzles set shape_id = 'triangle'
		where puzzle_id = pg_temp.fixture_id(106)$$,
	'23503', 'collection membership enforces matching shapes'
) as test;
select pg_temp.expect_error(
	$$update public.puzzles set definition = '{"version":2}' where id = pg_temp.fixture_id(106)$$,
	'23514', 'malformed puzzle definitions are rejected'
) as test;
select pg_temp.expect_error(
	$$update public.puzzles set definition = definition || '{"solution":{}}'
		where id = pg_temp.fixture_id(106)$$,
	'23514', 'public definitions cannot accidentally include authoring solution fields'
) as test;
select pg_temp.expect_error(
	$$update public.puzzles set difficulty = 'super_hard' where id = pg_temp.fixture_id(106)$$,
	'23514', 'size and rotation must agree with difficulty'
) as test;
select pg_temp.expect_error(
	$$update public.palettes set colors = array['#ffffff'] where id = 'cabo'$$,
	'23514', 'palettes require exactly five colors'
) as test;
select pg_temp.expect_error(
	$$update public.palettes set colors[1] = null where id = 'cabo'$$,
	'23514', 'palette slots cannot be null'
) as test;

set local role anon;
select pg_temp.assert_true((select count(*) = 2 from public.palettes),
	'guests see released palettes only') as test;
select pg_temp.assert_true((select count(*) = 2 from public.puzzles
	where id in (pg_temp.fixture_id(100), pg_temp.fixture_id(101))),
	'guests can read the initial set') as test;
select pg_temp.assert_true((select count(*) = 1 from public.puzzles
	where id in (pg_temp.fixture_id(107), pg_temp.fixture_id(108), pg_temp.fixture_id(109))),
	'guests can read current daily puzzles despite locked shape, but not expired/future ones') as test;
select pg_temp.assert_true((select count(*) = 0 from public.puzzles
	where id in (pg_temp.fixture_id(102), pg_temp.fixture_id(103), pg_temp.fixture_id(104),
		pg_temp.fixture_id(105), pg_temp.fixture_id(106))),
	'guests cannot read next-set, reward, paid, future, or draft definitions') as test;
select pg_temp.assert_true((select count(*) = 5 from public.daily_puzzles),
	'daily catalog includes exactly five slots, including launch and excluding exact expiry') as test;
set local timezone = 'America/Los_Angeles';
select pg_temp.assert_true((select count(*) = 5 from public.daily_puzzles),
	'daily window is unchanged in another timezone') as test;
set local timezone = 'UTC';
select pg_temp.assert_true((select count(*) = 1 from public.palette_packs),
	'future packs stay hidden') as test;
select pg_temp.assert_true((select count(*) = 1 from public.palette_pack_palettes),
	'future pack membership stays hidden') as test;
select pg_temp.expect_error($$select * from public.profiles$$, '42501',
	'guests cannot read profiles') as test;
select pg_temp.expect_error($$select * from public.puzzle_authoring$$, '42501',
	'guests cannot read generator seeds or known solutions') as test;
select pg_temp.expect_error($$delete from public.palettes$$, '42501',
	'guests cannot write catalog data') as test;

reset role;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id(2)::text, true);
set local role authenticated;
select pg_temp.assert_true(not private.is_admin(), 'ordinary player is not admin') as test;
select pg_temp.assert_true((select count(*) = 1 from public.profiles),
	'players see only their own profile') as test;
update public.profiles set username = 'schema-test-renamed' where user_id = auth.uid();
select pg_temp.assert_true((select username = 'schema-test-renamed' from public.profiles),
	'players can update their own username') as test;
select pg_temp.assert_player_mutations_denied() as test;
select pg_temp.assert_true((select count(*) = 0 from public.admin_account),
	'players cannot enumerate admin assignments') as test;
select pg_temp.assert_true((select count(*) = 0 from public.puzzle_authoring),
	'players cannot read private authoring data') as test;
select pg_temp.expect_error(
	$$insert into public.admin_account(user_id) values (auth.uid())$$,
	'42501', 'players cannot promote themselves'
) as test;
select pg_temp.expect_error(
	$$insert into public.profiles(user_id, username) values (pg_temp.fixture_id(99), 'forged')$$,
	'42501', 'players cannot create another profile'
) as test;
select pg_temp.expect_error(
	$$insert into public.palettes(id,name,colors) values
		('forged','Forged',array['#ffffff','#ffffff','#ffffff','#ffffff','#ffffff'])$$,
	'42501', 'players cannot author palettes'
) as test;
select pg_temp.expect_error(
	$$insert into public.puzzle_completions(user_id,puzzle_id)
		values(auth.uid(),pg_temp.fixture_id(100))$$,
	'42501', 'players cannot forge completions'
) as test;
select pg_temp.expect_error(
	$$insert into public.set_qualifications(user_id,collection_id,route_id)
		values(auth.uid(),pg_temp.fixture_id(10),pg_temp.fixture_id(20))$$,
	'42501', 'players cannot forge set qualification'
) as test;
select pg_temp.expect_error(
	$$insert into public.shape_grants(user_id,shape_id,source) values(auth.uid(),'triangle','admin')$$,
	'42501', 'players cannot grant themselves shapes'
) as test;
select pg_temp.expect_error(
	$$insert into public.palette_grants(user_id,palette_id,source) values(auth.uid(),'tahiti','admin')$$,
	'42501', 'players cannot grant themselves palettes'
) as test;
select pg_temp.expect_error(
	$$insert into public.collection_grants(user_id,collection_id,source)
		values(auth.uid(),pg_temp.fixture_id(13),'admin')$$,
	'42501', 'players cannot grant themselves packs'
) as test;
select pg_temp.expect_error(
	$$insert into public.feature_grants(user_id,feature,source) values(auth.uid(),'zen_randomizer','admin')$$,
	'42501', 'players cannot unlock the randomizer directly'
) as test;
select pg_temp.expect_error(
	$$insert into public.puzzle_attempts(user_id,puzzle_id) values(auth.uid(),pg_temp.fixture_id(100))$$,
	'42501', 'attempt writes wait for a concurrency-safe server operation'
) as test;
select pg_temp.expect_error(
	$$insert into public.daily_play_sessions(user_id,daily_id)
		values(auth.uid(),pg_temp.fixture_id(41))$$,
	'42501', 'players cannot invent expired-daily sessions'
) as test;
select pg_temp.assert_true((select count(*) = 0 from public.puzzles where id = pg_temp.fixture_id(102)),
	'registration alone does not unlock the next set') as test;

reset role;
insert into public.puzzle_completions(user_id,puzzle_id)
	values (pg_temp.fixture_id(2),pg_temp.fixture_id(100));
insert into public.set_qualifications(user_id,collection_id,route_id)
	values (pg_temp.fixture_id(2),pg_temp.fixture_id(10),pg_temp.fixture_id(20));
insert into public.collection_grants(user_id,collection_id,source) values
	(pg_temp.fixture_id(2),pg_temp.fixture_id(12),'admin'),
	(pg_temp.fixture_id(2),pg_temp.fixture_id(13),'admin');
set local role authenticated;
select pg_temp.assert_true((select count(*) = 0 from public.puzzles where id = pg_temp.fixture_id(104)),
	'pack access still requires shape ownership') as test;
select pg_temp.assert_true((select count(*) = 1 from public.puzzles where id = pg_temp.fixture_id(103)),
	'reward sets open independently once granted') as test;
reset role;
insert into public.shape_grants(user_id,shape_id,source)
	values (pg_temp.fixture_id(2),'triangle','admin');
insert into public.puzzle_attempts(user_id,puzzle_id)
	values (pg_temp.fixture_id(2),pg_temp.fixture_id(100)),
		(pg_temp.fixture_id(3),pg_temp.fixture_id(101));
insert into public.daily_play_sessions(id,user_id,daily_id,opened_at)
	values(pg_temp.fixture_id(60),pg_temp.fixture_id(2),pg_temp.fixture_id(41),
		now() - interval '2 days');
set local role authenticated;
select pg_temp.assert_true((select count(*) = 1 from public.puzzles where id = pg_temp.fixture_id(102)),
	'qualification plus registered shape ownership opens next set') as test;
select pg_temp.assert_true((select count(*) = 0 from public.puzzles where id = pg_temp.fixture_id(110)),
	'fixed sequence checks previous puzzle completion') as test;
select pg_temp.assert_true((select count(*) = 1 from public.puzzles where id = pg_temp.fixture_id(104)),
	'pack grant plus shape ownership opens pack without palette ownership') as test;
select pg_temp.assert_true((select count(*) = 1 from public.puzzle_attempts),
	'players cannot read another account attempt') as test;
select pg_temp.assert_true((select count(*) = 1 from public.puzzles where id = pg_temp.fixture_id(108)),
	'trusted active daily session can finish after expiry') as test;
reset role;
update public.daily_play_sessions set closed_at = now() where id = pg_temp.fixture_id(60);
set local role authenticated;
select pg_temp.assert_true((select count(*) = 0 from public.puzzles where id = pg_temp.fixture_id(108)),
	'exiting removes expired daily access') as test;

reset role;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id(3)::text, true);
set local role authenticated;
select pg_temp.assert_true((select count(*) = 0 from public.puzzle_completions),
	'switching accounts does not expose or merge completions') as test;
select pg_temp.assert_true((select count(*) = 0 from public.shape_grants),
	'switching accounts does not expose another account grants') as test;
select pg_temp.assert_true((select count(*) = 0 from public.puzzles where id = pg_temp.fixture_id(102)),
	'other account has not inherited progression') as test;

reset role;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id(1)::text, true);
set local role authenticated;
select pg_temp.assert_true(private.is_admin(), 'assigned owner is admin') as test;
select pg_temp.assert_true((select count(*) = 16 from public.puzzles where id::text like 'ee000000-%'),
	'admin can preview draft, future, paid, and locked puzzle definitions') as test;
select pg_temp.assert_true((select count(*) = 16 from public.puzzle_authoring
	where puzzle_id::text like 'ee000000-%'), 'admin can read authoring data') as test;
insert into public.palettes(id,name,colors)
	values('schema-test-draft','Draft',array['#ffffff','#ffffff','#ffffff','#ffffff','#ffffff']);
update public.palettes set name = 'Edited draft' where id = 'schema-test-draft';
delete from public.palettes where id = 'schema-test-draft';
select pg_temp.assert_true(not exists(select 1 from public.palettes where id = 'schema-test-draft'),
	'admin has insert/update/delete on editable drafts') as test;
update public.palettes set colors[1] = colors[2] where id = 'cabo';
select pg_temp.assert_true((select revision = 2 from public.palettes where id = 'cabo'),
	'palette corrections increment revision, including duplicate hex values') as test;
select pg_temp.assert_true((select count(*) = 1 from public.palette_corrections where palette_id = 'cabo'),
	'published palette correction is recorded') as test;
select pg_temp.assert_true((select definition -> 'target' -> '0,0' = '0'::jsonb
	from public.puzzles where id = pg_temp.fixture_id(100)),
	'palette correction leaves published target slot unchanged') as test;
select pg_temp.assert_true((select count(*) = 0 from public.puzzle_completions where user_id = auth.uid()),
	'admin preview created no player completions') as test;

reset role;
select 'All schema/RLS assertions passed; fixtures will be rolled back.' as result;
rollback;
