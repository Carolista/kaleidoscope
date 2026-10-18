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
create function pg_temp.replace_draft(p_id uuid, p_seed text default 'replacement-seed')
returns uuid language sql as $$
	select public.replace_hex_puzzle_draft(
		p_id, ' Replacement ', 'daily', 'cabo', 'md', false, 'moderate',
		'{"version":2,"geometry":{"radius":4},"target":{"0,0":1},"pieces":[{"id":"p2","tiles":[{"q":0,"r":0,"color_slot":1}]}]}',
		p_seed, 'hexagon-v2', '{"p2":{"q":0,"r":0}}'
	);
$$;

insert into auth.users(id) values
	('ed000000-0000-4000-8000-000000000001'),
	('ed000000-0000-4000-8000-000000000002');
delete from public.admin_account;
insert into public.admin_account(user_id) values ('ed000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub', 'ed000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.save_hex_puzzle_draft(
	'ed000000-0000-4000-8000-000000000010', 'Original', 'collection', 'cabo', 'sm', false, 'easy',
	'{"version":2,"geometry":{"radius":3},"target":{"0,0":0},"pieces":[{"id":"p1","tiles":[{"q":0,"r":0,"color_slot":0}]}]}',
	'original-seed', 'hexagon-v2', '{"p1":{"q":0,"r":0}}'
);
select pg_temp.assert_true(
	pg_temp.replace_draft('ed000000-0000-4000-8000-000000000010') = 'ed000000-0000-4000-8000-000000000010'::uuid,
	'replacement retains the original puzzle ID'
) as test;
select pg_temp.assert_true(
	(select name = 'Replacement' and usage = 'daily' and board_size = 'md'
		and difficulty = 'moderate' and not rotation_allowed
		and definition -> 'target' = '{"0,0":1}'::jsonb
		and published_at is null and release_at is null
		from public.puzzles where id = 'ed000000-0000-4000-8000-000000000010')
	and (select seed = 'replacement-seed' and generator_version = 'hexagon-v2'
		and known_solution = '{"p2":{"q":0,"r":0}}'::jsonb
		from public.puzzle_authoring where puzzle_id = 'ed000000-0000-4000-8000-000000000010'),
	'replacement updates metadata, recipe, public design and private provenance together'
) as test;
select pg_temp.assert_true(
	pg_temp.replace_draft('ed000000-0000-4000-8000-000000000010') = 'ed000000-0000-4000-8000-000000000010'::uuid,
	'retrying an identical replacement succeeds without a duplicate'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.replace_draft('ed000000-0000-4000-8000-000000000099')$$,
	'P0002', 'missing drafts cannot be replaced'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.replace_draft('ed000000-0000-4000-8000-000000000010', ' ')$$,
	'23514', 'invalid private provenance aborts replacement'
) as test;
select pg_temp.assert_true(
	(select seed = 'replacement-seed' from public.puzzle_authoring
		where puzzle_id = 'ed000000-0000-4000-8000-000000000010'),
	'failed private updates preserve the saved provenance'
) as test;

reset role;
create function pg_temp.reject_replacement() returns trigger language plpgsql as $$
begin
	raise exception 'Test authoring write failure.' using errcode = '23514';
end;
$$;
create trigger replacement_test_failure before update on public.puzzle_authoring
	for each row execute function pg_temp.reject_replacement();
set local role authenticated;
update public.puzzles set name = 'Before failure' where id = 'ed000000-0000-4000-8000-000000000010';
select pg_temp.expect_error(
	$$select pg_temp.replace_draft('ed000000-0000-4000-8000-000000000010', 'failed-seed')$$,
	'23514', 'a private write-time failure aborts the replacement'
) as test;
select pg_temp.assert_true(
	(select name = 'Before failure' from public.puzzles where id = 'ed000000-0000-4000-8000-000000000010')
	and (select seed = 'replacement-seed' from public.puzzle_authoring
		where puzzle_id = 'ed000000-0000-4000-8000-000000000010'),
	'private write failure rolls back the public update as well'
) as test;
reset role;
drop trigger replacement_test_failure on public.puzzle_authoring;
set local role authenticated;

savepoint missing_authoring;
delete from public.puzzle_authoring where puzzle_id = 'ed000000-0000-4000-8000-000000000010';
select pg_temp.expect_error(
	$$select pg_temp.replace_draft('ed000000-0000-4000-8000-000000000010')$$,
	'P0002', 'missing private authoring is an explicit error'
) as test;
select pg_temp.assert_true(
	(select name = 'Before failure' from public.puzzles where id = 'ed000000-0000-4000-8000-000000000010'),
	'missing authoring rolls back the public update'
) as test;
rollback to savepoint missing_authoring;
savepoint wrong_shape;
update public.puzzles set shape_id = 'triangle' where id = 'ed000000-0000-4000-8000-000000000010';
select pg_temp.expect_error(
	$$select pg_temp.replace_draft('ed000000-0000-4000-8000-000000000010')$$,
	'23514', 'hexagon replacement rejects other shapes'
) as test;
rollback to savepoint wrong_shape;

insert into public.palettes(id, name, colors, published_at, release_at)
	values ('replacement-test', 'Replacement test', array['#111111','#222222','#333333','#444444','#555555'],
		now(), now() - interval '1 minute');
update public.puzzles set palette_id = 'replacement-test', published_at = now(), release_at = now() + interval '1 hour'
	where id = 'ed000000-0000-4000-8000-000000000010';
insert into public.daily_schedule(rollover_time_utc) values ((now() at time zone 'UTC')::time);
insert into public.daily_puzzles(puzzle_id, release_at, expires_at) values (
	'ed000000-0000-4000-8000-000000000010', now() + interval '1 day', now() + interval '6 days'
);
select pg_temp.expect_error(
	$$select pg_temp.replace_draft('ed000000-0000-4000-8000-000000000010')$$,
	'23514', 'daily assignments created after loading block replacement'
) as test;
delete from public.daily_puzzles where puzzle_id = 'ed000000-0000-4000-8000-000000000010';
update public.puzzles set usage = 'collection', published_at = null, release_at = null
	where id = 'ed000000-0000-4000-8000-000000000010';
insert into public.puzzle_collections(id, name, kind, shape_id)
	values ('ed000000-0000-4000-8000-000000000020', 'Replacement test set', 'reward', 'hexagon');
insert into public.collection_puzzles(puzzle_id, collection_id, shape_id, position)
	values ('ed000000-0000-4000-8000-000000000010', 'ed000000-0000-4000-8000-000000000020', 'hexagon', 1);
select pg_temp.expect_error(
	$$select pg_temp.replace_draft('ed000000-0000-4000-8000-000000000010')$$,
	'23514', 'collection assignments created after loading block replacement'
) as test;
select pg_temp.assert_true(
	public.edit_puzzle_draft('ed000000-0000-4000-8000-000000000010', 'Metadata allowed', 'cabo', 'collection')
		= 'ed000000-0000-4000-8000-000000000010'::uuid,
	'assigned drafts retain existing metadata editing'
) as test;
delete from public.collection_puzzles where puzzle_id = 'ed000000-0000-4000-8000-000000000010';

reset role;
select set_config('request.jwt.claim.sub', 'ed000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select pg_temp.expect_error(
	$$select pg_temp.replace_draft('ed000000-0000-4000-8000-000000000010')$$,
	'42501', 'ordinary users cannot replace puzzle drafts'
) as test;
reset role;
set local role anon;
select pg_temp.expect_error(
	$$select pg_temp.replace_draft('ed000000-0000-4000-8000-000000000010')$$,
	'42501', 'anonymous callers cannot replace puzzle drafts'
) as test;
reset role;
select set_config('request.jwt.claim.sub', 'ed000000-0000-4000-8000-000000000001', true);
set local role authenticated;
update public.puzzles set palette_id = 'replacement-test', published_at = now(), release_at = now() + interval '1 day'
	where id = 'ed000000-0000-4000-8000-000000000010';
select pg_temp.expect_error(
	$$select pg_temp.replace_draft('ed000000-0000-4000-8000-000000000010')$$,
	'23514', 'scheduled puzzles cannot be replaced'
) as test;
update public.puzzles set release_at = now() - interval '1 second'
	where id = 'ed000000-0000-4000-8000-000000000010';
select pg_temp.expect_error(
	$$select pg_temp.replace_draft('ed000000-0000-4000-8000-000000000010')$$,
	'23514', 'live puzzles cannot be replaced'
) as test;
set constraints all immediate;
rollback;
