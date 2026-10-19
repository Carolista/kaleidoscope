begin;
create function pg_temp.assert_true(condition boolean, label text)
returns text language plpgsql as $$
begin
	if condition is distinct from true then raise exception 'FAILED: %', label; end if;
	return 'PASS: ' || label;
end;
$$;
create function pg_temp.expect_error(statement text, expected_state text, label text)
returns text language plpgsql as $$
begin
	begin execute statement;
	exception when others then
		if sqlstate = expected_state then return 'PASS: ' || label; end if;
		raise exception 'FAILED: % (expected %, got %: %)', label, expected_state, sqlstate, sqlerrm;
	end;
	raise exception 'FAILED: % (statement unexpectedly succeeded)', label;
end;
$$;
create function pg_temp.replace_puzzle(p_id uuid, p_usage text, p_seed text)
returns uuid language sql as $$
	select public.replace_hex_puzzle_draft(
		p_id, 'Replacement', p_usage, 'prerelease-test', 'md', false, 'moderate',
		'{"version":2,"geometry":{"radius":4},"target":{"0,0":1},"pieces":[{"id":"p2","tiles":[{"q":0,"r":0,"color_slot":1}]}]}',
		p_seed, 'hexagon-v2', '{"p2":{"q":0,"r":0}}'
	);
$$;
create function pg_temp.design_is(p_id uuid, p_seed text)
returns boolean language sql as $$
	select (select definition -> 'target' = '{"0,0":1}'::jsonb and board_size = 'md'
			from public.puzzles where id = p_id)
		and (select seed = p_seed from public.puzzle_authoring where puzzle_id = p_id);
$$;

insert into auth.users(id) values
	('fc000000-0000-4000-8000-000000000001'),
	('fc000000-0000-4000-8000-000000000002');
delete from public.admin_account;
insert into public.admin_account(user_id) values ('fc000000-0000-4000-8000-000000000001');
insert into public.palettes(id, name, colors, published_at, release_at)
	values ('prerelease-test', 'Prerelease test', array['#111111','#222222','#333333','#444444','#555555'],
		now(), now() - interval '1 minute');
select set_config('request.jwt.claim.sub', 'fc000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.save_hex_puzzle_draft(
	'fc000000-0000-4000-8000-000000000010', 'Set puzzle', 'collection', 'prerelease-test', 'sm', false, 'easy',
	'{"version":2,"geometry":{"radius":3},"target":{"0,0":0},"pieces":[{"id":"p1","tiles":[{"q":0,"r":0,"color_slot":0}]}]}',
	'set-original', 'hexagon-v2', '{"p1":{"q":0,"r":0}}'
);
select public.save_hex_puzzle_draft(
	'fc000000-0000-4000-8000-000000000011', 'Daily puzzle', 'daily', 'prerelease-test', 'sm', false, 'easy',
	'{"version":2,"geometry":{"radius":3},"target":{"0,0":0},"pieces":[{"id":"p1","tiles":[{"q":0,"r":0,"color_slot":0}]}]}',
	'daily-original', 'hexagon-v2', '{"p1":{"q":0,"r":0}}'
);
reset role;
insert into public.puzzle_collections(id, name, kind, shape_id)
	values ('fc000000-0000-4000-8000-000000000020', 'Prerelease set', 'reward', 'hexagon');
insert into public.collection_puzzles(puzzle_id, collection_id, shape_id, position)
	values ('fc000000-0000-4000-8000-000000000010', 'fc000000-0000-4000-8000-000000000020', 'hexagon', 1);
set local role authenticated;

select pg_temp.assert_true(
	pg_temp.replace_puzzle('fc000000-0000-4000-8000-000000000010', 'collection', 'set-replacement')
		= 'fc000000-0000-4000-8000-000000000010'::uuid
	and pg_temp.design_is('fc000000-0000-4000-8000-000000000010', 'set-replacement'),
	'assigned set puzzles can have their design replaced'
) as test;
select pg_temp.assert_true(
	exists(select 1 from public.collection_puzzles
		where puzzle_id = 'fc000000-0000-4000-8000-000000000010'
			and collection_id = 'fc000000-0000-4000-8000-000000000020' and position = 1),
	'replacement keeps the set assignment and position'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.replace_puzzle('fc000000-0000-4000-8000-000000000010', 'daily', 'set-usage')$$,
	'23514', 'assigned set puzzles cannot switch intended use during replacement'
) as test;
select pg_temp.assert_true(
	pg_temp.design_is('fc000000-0000-4000-8000-000000000010', 'set-replacement'),
	'rejected replacement leaves the saved design unchanged'
) as test;

update public.puzzles set published_at = now(), release_at = now() + interval '1 hour'
	where id = 'fc000000-0000-4000-8000-000000000011';
reset role;
insert into public.daily_schedule(rollover_time_utc) values ((now() at time zone 'UTC')::time);
insert into public.daily_puzzles(puzzle_id, release_at, expires_at) values (
	'fc000000-0000-4000-8000-000000000011', now() + interval '1 day', now() + interval '6 days'
);
set local role authenticated;
select pg_temp.assert_true(
	pg_temp.replace_puzzle('fc000000-0000-4000-8000-000000000011', 'daily', 'daily-replacement')
		= 'fc000000-0000-4000-8000-000000000011'::uuid
	and pg_temp.design_is('fc000000-0000-4000-8000-000000000011', 'daily-replacement'),
	'scheduled daily puzzles can have their design replaced before release'
) as test;
select pg_temp.assert_true(
	(select published_at is not null and release_at > now() from public.puzzles
		where id = 'fc000000-0000-4000-8000-000000000011')
	and exists(select 1 from public.daily_puzzles where puzzle_id = 'fc000000-0000-4000-8000-000000000011'),
	'replacement keeps the release schedule and daily assignment'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.replace_puzzle('fc000000-0000-4000-8000-000000000011', 'collection', 'daily-usage')$$,
	'23514', 'scheduled daily puzzles cannot switch intended use during replacement'
) as test;
select public.edit_puzzle_draft(
	'fc000000-0000-4000-8000-000000000011', 'Renamed daily', 'prerelease-test', 'daily'
);
select pg_temp.assert_true(
	(select name = 'Renamed daily' from public.puzzles where id = 'fc000000-0000-4000-8000-000000000011'),
	'scheduled puzzles can have metadata edited before release'
) as test;

reset role;
select set_config('request.jwt.claim.sub', 'fc000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select pg_temp.expect_error(
	$$select pg_temp.replace_puzzle('fc000000-0000-4000-8000-000000000010', 'collection', 'user-seed')$$,
	'42501', 'ordinary users cannot replace prepared puzzles'
) as test;
reset role;
set local role anon;
select pg_temp.expect_error(
	$$select pg_temp.replace_puzzle('fc000000-0000-4000-8000-000000000010', 'collection', 'anon-seed')$$,
	'42501', 'anonymous callers cannot replace prepared puzzles'
) as test;
reset role;
select set_config('request.jwt.claim.sub', 'fc000000-0000-4000-8000-000000000001', true);
set local role authenticated;

update public.puzzles set published_at = now(), release_at = now() - interval '1 second'
	where id = 'fc000000-0000-4000-8000-000000000010';
select pg_temp.expect_error(
	$$select pg_temp.replace_puzzle('fc000000-0000-4000-8000-000000000010', 'collection', 'live-seed')$$,
	'23514', 'live puzzles cannot be replaced'
) as test;
select pg_temp.expect_error(
	$$select public.edit_puzzle_draft('fc000000-0000-4000-8000-000000000010', 'Live', 'prerelease-test', 'collection')$$,
	'23514', 'live puzzles cannot be edited'
) as test;
select pg_temp.expect_error(
	$$select public.delete_puzzle_draft('fc000000-0000-4000-8000-000000000011')$$,
	'23514', 'scheduled puzzles still cannot be deleted'
) as test;
set constraints all immediate;
rollback;
