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
create function pg_temp.id(n integer) returns uuid language sql immutable as $$
	select ('ee000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
insert into auth.users(id) values (pg_temp.id(1)), (pg_temp.id(2));
delete from public.admin_account;
insert into public.admin_account(user_id) values (pg_temp.id(1));
select set_config('request.jwt.claim.sub', pg_temp.id(1)::text, true);
set local role authenticated;

select pg_temp.assert_true(
	public.manage_draft_set(pg_temp.id(10), 'create', ' Core set ', 'core') = pg_temp.id(10)
	and public.manage_draft_set(pg_temp.id(11), 'create', 'Reward set', 'reward') = pg_temp.id(11)
	and public.manage_draft_set(pg_temp.id(12), 'create', 'Paid set', 'paid') = pg_temp.id(12),
	'admin creates all three roles with no required puzzle count'
) as test;
select pg_temp.assert_true(
	public.manage_draft_set(pg_temp.id(10), 'create', 'Core set', 'core') = pg_temp.id(10),
	'identical create retries retain the same set ID'
) as test;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(10), 'create', 'Other name', 'core')$$,
	'23505', 'a create retry cannot overwrite different content'
) as test;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(13), 'create', ' ', 'paid')$$,
	'22023', 'blank set names are rejected'
) as test;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(13), 'create', 'Set', 'unknown')$$,
	'22023', 'unknown set roles are rejected'
) as test;
select public.manage_draft_set(pg_temp.id(10), 'rename', ' Renamed core ');
select pg_temp.assert_true(
	(select name = 'Renamed core' and kind = 'core' and selection_mode = 'any'
		and shape_id = 'hexagon' and published_at is null from public.puzzle_collections where id = pg_temp.id(10)),
	'renaming trims the name without configuring play rules or publishing'
) as test;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(10), 'rename', 'Other', 'reward')$$,
	'22023', 'existing roles cannot be silently reclassified'
) as test;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(99), 'rename', 'Missing')$$,
	'P0002', 'missing sets fail explicitly'
) as test;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(10), 'unknown')$$,
	'22023', 'unsupported actions fail explicitly'
) as test;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(10), 'append', 'Unexpected name')$$,
	'22023', 'membership changes cannot overwrite metadata'
) as test;

do $$
begin
	for n in 20..39 loop
		perform public.save_hex_puzzle_draft(
			pg_temp.id(n), 'Puzzle ' || n, case when n = 39 then 'daily' else 'collection' end,
			'cabo', 'sm', false, 'easy',
			'{"version":2,"geometry":{"radius":3},"target":{"0,0":0},"pieces":[{"id":"p1","tiles":[{"q":0,"r":0,"color_slot":0}]}]}',
			'set-seed-' || n, 'hexagon-v2', '{"p1":{"q":0,"r":0}}'
		);
	end loop;
end;
$$;
select public.manage_draft_set(pg_temp.id(10), 'append', p_puzzle_ids =>
	array(select pg_temp.id(n) from generate_series(20,37) as n order by n));
select pg_temp.assert_true(
	(select count(*) = 18 and min(position) = 1 and max(position) = 18
		from public.collection_puzzles where collection_id = pg_temp.id(10)),
	'18 puzzles can be assigned in supplied order without a fixed-size rule'
) as test;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(11), 'append', p_puzzle_ids => array[pg_temp.id(38),pg_temp.id(20)])$$,
	'23514', 'one already-assigned puzzle rejects the entire batch'
) as test;
select pg_temp.assert_true(
	not exists(select 1 from public.collection_puzzles where puzzle_id = pg_temp.id(38)),
	'blocked assignment leaves eligible puzzles unassigned'
) as test;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(11), 'append', p_puzzle_ids => array[pg_temp.id(39)])$$,
	'23514', 'daily-use puzzles cannot be assigned to sets'
) as test;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(11), 'append', p_puzzle_ids => array[pg_temp.id(38),pg_temp.id(38)])$$,
	'22023', 'duplicate IDs are rejected'
) as test;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(11), 'append', p_puzzle_ids => array[null::uuid])$$,
	'22023', 'null puzzle IDs are rejected'
) as test;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(11), 'append')$$,
	'22023', 'empty assignment is rejected'
) as test;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(11), 'append', p_puzzle_ids => array[pg_temp.id(99)])$$,
	'P0002', 'missing puzzles reject assignment'
) as test;
savepoint wrong_shape;
update public.puzzles set shape_id = 'triangle' where id = pg_temp.id(38);
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(11), 'append', p_puzzle_ids => array[pg_temp.id(38)])$$,
	'23514', 'wrong-shape puzzles cannot be assigned to hexagon sets'
) as test;
rollback to savepoint wrong_shape;
select public.manage_draft_set(pg_temp.id(10), 'reorder', p_puzzle_ids =>
	array(select pg_temp.id(n) from generate_series(20,37) as n order by n desc));
select pg_temp.assert_true(
	(select puzzle_id = pg_temp.id(37) from public.collection_puzzles
		where collection_id = pg_temp.id(10) and position = 1),
	'reordering avoids position collisions and persists the requested order'
) as test;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(10), 'reorder', p_puzzle_ids => array[pg_temp.id(37)])$$,
	'23514', 'stale membership cannot overwrite the current set'
) as test;
insert into public.completion_routes(id, collection_id, name, position)
	values (pg_temp.id(50), pg_temp.id(10), 'Route', 1);
insert into public.route_puzzles(route_id, collection_id, puzzle_id)
	values (pg_temp.id(50), pg_temp.id(10), pg_temp.id(37));
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(10), 'remove', p_puzzle_ids => array[pg_temp.id(37)])$$,
	'23514', 'route members cannot be silently unassigned'
) as test;
select public.manage_draft_set(pg_temp.id(10), 'reorder', p_puzzle_ids =>
	array(select pg_temp.id(n) from generate_series(20,37) as n order by n));
select pg_temp.assert_true(
	exists(select 1 from public.route_puzzles where route_id = pg_temp.id(50) and puzzle_id = pg_temp.id(37)),
	'reordering preserves existing qualifying routes'
) as test;
delete from public.route_puzzles where route_id = pg_temp.id(50);
select public.manage_draft_set(pg_temp.id(10), 'remove', p_puzzle_ids => array[pg_temp.id(37)]);
select pg_temp.assert_true(
	(select count(*) = 17 and min(position) = 1 and max(position) = 17
		from public.collection_puzzles where collection_id = pg_temp.id(10))
	and exists(select 1 from public.puzzles where id = pg_temp.id(37))
	and exists(select 1 from public.puzzle_authoring where puzzle_id = pg_temp.id(37)),
	'unassigning compacts positions without deleting the puzzle or private solution'
) as test;
select public.manage_draft_set(pg_temp.id(11), 'append', p_puzzle_ids => array[pg_temp.id(37)]);
select pg_temp.assert_true(
	(select collection_id = pg_temp.id(11) from public.collection_puzzles where puzzle_id = pg_temp.id(37)),
	'unassigned puzzles can be assigned to another draft set'
) as test;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(10), 'remove', p_puzzle_ids => array[pg_temp.id(37)])$$,
	'23514', 'stale removal cannot remove another set membership'
) as test;

reset role;
create function pg_temp.reject_set_member() returns trigger language plpgsql as $$
begin
	if new.puzzle_id = pg_temp.id(38) then
		raise exception 'Test membership write failure.' using errcode = '23514';
	end if;
	return new;
end;
$$;
create trigger set_test_failure before insert on public.collection_puzzles
	for each row execute function pg_temp.reject_set_member();
set local role authenticated;
select public.manage_draft_set(pg_temp.id(10), 'remove', p_puzzle_ids => array[pg_temp.id(36)]);
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(12), 'append', p_puzzle_ids => array[pg_temp.id(36),pg_temp.id(38)])$$,
	'23514', 'write-time failure aborts the whole assignment'
) as test;
select pg_temp.assert_true(
	not exists(select 1 from public.collection_puzzles where collection_id = pg_temp.id(12)),
	'write failure rolls back earlier members in the same batch'
) as test;
reset role;
drop trigger set_test_failure on public.collection_puzzles;
set local role authenticated;

insert into public.palettes(id, name, colors, published_at, release_at)
	values ('sets-test', 'Sets test', array['#111111','#222222','#333333','#444444','#555555'],
		now(), now() - interval '1 minute');
update public.puzzles set palette_id = 'sets-test', published_at = now(), release_at = now() + interval '1 day'
	where id = pg_temp.id(38);
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(12), 'append', p_puzzle_ids => array[pg_temp.id(38)])$$,
	'23514', 'scheduled puzzles cannot be assigned by the draft tool'
) as test;
update public.puzzles set palette_id = 'sets-test', published_at = now(), release_at = now() + interval '1 day'
	where id = pg_temp.id(37);
update public.puzzle_collections set published_at = now(), release_at = now() + interval '2 days'
	where id = pg_temp.id(11);
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(11), 'rename', 'Blocked')$$,
	'23514', 'scheduled sets cannot be renamed here'
) as test;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(11), 'remove', p_puzzle_ids => array[pg_temp.id(37)])$$,
	'23514', 'scheduled set memberships cannot be removed here'
) as test;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(11), 'reorder', p_puzzle_ids => array[pg_temp.id(37)])$$,
	'23514', 'scheduled sets cannot be reordered here'
) as test;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(11), 'append', p_puzzle_ids => array[pg_temp.id(36)])$$,
	'23514', 'stale scheduled sets cannot receive puzzles'
) as test;
update public.puzzles set release_at = now() - interval '1 second' where id = pg_temp.id(37);
update public.puzzle_collections set release_at = now() - interval '1 second' where id = pg_temp.id(11);
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(11), 'rename', 'Blocked')$$,
	'23514', 'live sets remain protected'
) as test;
reset role;
select set_config('request.jwt.claim.sub', pg_temp.id(2)::text, true);
set local role authenticated;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(12), 'rename', 'Blocked')$$,
	'42501', 'ordinary users cannot assemble draft sets'
) as test;
reset role;
set local role anon;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(12), 'rename', 'Blocked')$$,
	'42501', 'anonymous callers cannot assemble draft sets'
) as test;
reset role;
set constraints all immediate;
rollback;
