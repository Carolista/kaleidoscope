begin;

create function pg_temp.id(value integer) returns uuid language sql immutable as $$
	select ('eb000000-0000-4000-8000-' || lpad(value::text, 12, '0'))::uuid;
$$;
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
insert into auth.users(id) values (pg_temp.id(1)), (pg_temp.id(2));
delete from public.admin_account;
insert into public.admin_account(user_id) values (pg_temp.id(1));
select set_config('request.jwt.claim.sub', pg_temp.id(1)::text, true);
set local role authenticated;
insert into public.palettes(id, name, colors, published_at, release_at) values
	('bulk-test-a', 'Bulk A', array['#111111','#222222','#333333','#444444','#555555'], now(), now() - interval '1 minute'),
	('bulk-test-b', 'Bulk B', array['#666666','#777777','#888888','#999999','#aaaaaa'], null, null);
select public.save_hex_puzzle_draft(
	pg_temp.id(n), 'Bulk puzzle ' || n, case when n = 13 then 'daily' else 'collection' end,
	'bulk-test-a', 'sm', false, 'easy',
	'{"version":2,"geometry":{"radius":3},"target":{"0,0":0},"pieces":[{"id":"p1","tiles":[{"q":0,"r":0,"color_slot":0}]}]}',
	'bulk-seed-' || n, 'hexagon-v2', '{"p1":{"q":0,"r":0}}'
) from generate_series(10, 13) n;

select pg_temp.expect_error(
	$$select public.bulk_puzzle_drafts('{}', 'delete')$$,
	'22023', 'empty selection is rejected'
) as test;
select pg_temp.expect_error(
	$$select public.bulk_puzzle_drafts(null, 'delete')$$,
	'22023', 'null selection is rejected'
) as test;
select pg_temp.expect_error(
	$$select public.bulk_puzzle_drafts(array[pg_temp.id(10), null], 'delete')$$,
	'22023', 'null IDs are rejected'
) as test;
select pg_temp.expect_error(
	$$select public.bulk_puzzle_drafts(array[pg_temp.id(10), pg_temp.id(10)], 'delete')$$,
	'22023', 'duplicate IDs are rejected'
) as test;
select pg_temp.expect_error(
	$$select public.bulk_puzzle_drafts(array[pg_temp.id(10)], 'unknown')$$,
	'22023', 'unsupported actions are rejected'
) as test;
select pg_temp.expect_error(
	$$select public.bulk_puzzle_drafts(array[pg_temp.id(10)], 'palette')$$,
	'22023', 'palette action requires a palette'
) as test;
select pg_temp.expect_error(
	$$select public.bulk_puzzle_drafts(array[pg_temp.id(10)], 'delete', 'bulk-test-b')$$,
	'22023', 'delete cannot accidentally receive a palette action'
) as test;
select pg_temp.expect_error(
	$$select public.bulk_puzzle_drafts(array[pg_temp.id(10), pg_temp.id(99)], 'palette', 'bulk-test-b')$$,
	'P0002', 'missing draft rejects the entire batch'
) as test;
select pg_temp.expect_error(
	$$select public.bulk_puzzle_drafts(array[pg_temp.id(10), pg_temp.id(11)], 'palette', 'missing')$$,
	'23503', 'missing palette rejects the entire batch'
) as test;
select pg_temp.assert_true(
	(select count(*) = 4 from public.puzzles where id = any(array[pg_temp.id(10),pg_temp.id(11),pg_temp.id(12),pg_temp.id(13)]) and palette_id = 'bulk-test-a'),
	'invalid batches leave all previous palettes intact'
) as test;

insert into public.puzzle_collections(id, name, kind, shape_id)
	values (pg_temp.id(20), 'Bulk set', 'reward', 'hexagon');
insert into public.collection_puzzles(puzzle_id, collection_id, shape_id, position)
	values (pg_temp.id(12), pg_temp.id(20), 'hexagon', 1);
select pg_temp.expect_error(
	$$select public.bulk_puzzle_drafts(array[pg_temp.id(10),pg_temp.id(12)], 'delete')$$,
	'23514', 'one assigned draft prevents deleting every selected draft'
) as test;
select pg_temp.assert_true(
	(select count(*) = 2 from public.puzzles where id = any(array[pg_temp.id(10),pg_temp.id(12)]))
	and (select count(*) = 2 from public.puzzle_authoring where puzzle_id = any(array[pg_temp.id(10),pg_temp.id(12)])),
	'assignment blocker preserves all definitions and saved seeds'
) as test;
select pg_temp.assert_true(
	public.bulk_puzzle_drafts(array[pg_temp.id(10),pg_temp.id(12),pg_temp.id(13)], 'palette', 'bulk-test-b')
		= array[pg_temp.id(10),pg_temp.id(12),pg_temp.id(13)],
	'admin can recolor mixed uses including assigned unpublished drafts'
) as test;
select pg_temp.assert_true(
	(select count(*) = 3 from public.puzzles where id = any(array[pg_temp.id(10),pg_temp.id(12),pg_temp.id(13)])
		and palette_id = 'bulk-test-b' and definition -> 'target' = '{"0,0":0}'::jsonb)
	and (select count(*) = 3 from public.puzzle_authoring where puzzle_id = any(array[pg_temp.id(10),pg_temp.id(12),pg_temp.id(13)])
		and known_solution = '{"p1":{"q":0,"r":0}}'::jsonb),
	'bulk palettes preserve public slots and private solutions'
) as test;

reset role;
create function pg_temp.reject_bulk_palette() returns trigger language plpgsql as $$
begin
	if new.id = pg_temp.id(12) and new.palette_id = 'bulk-test-a' then
		raise exception 'Test write failure.' using errcode = '23514';
	end if;
	return new;
end;
$$;
create trigger bulk_test_failure before update on public.puzzles
	for each row execute function pg_temp.reject_bulk_palette();
set local role authenticated;
select pg_temp.expect_error(
	$$select public.bulk_puzzle_drafts(array[pg_temp.id(10),pg_temp.id(12),pg_temp.id(13)], 'palette', 'bulk-test-a')$$,
	'23514', 'a write-time failure aborts the entire bulk update'
) as test;
select pg_temp.assert_true(
	(select count(*) = 3 from public.puzzles where id = any(array[pg_temp.id(10),pg_temp.id(12),pg_temp.id(13)])
		and palette_id = 'bulk-test-b'),
	'write-time failure rolls back changes to all selected rows'
) as test;
reset role;
drop trigger bulk_test_failure on public.puzzles;
set local role authenticated;

update public.puzzles set published_at = now(), release_at = now() + interval '1 day' where id = pg_temp.id(11);
select pg_temp.expect_error(
	$$select public.bulk_puzzle_drafts(array[pg_temp.id(10),pg_temp.id(11)], 'palette', 'bulk-test-a')$$,
	'23514', 'scheduled draft blocks the whole palette change'
) as test;
select pg_temp.assert_true(
	(select palette_id = 'bulk-test-b' from public.puzzles where id = pg_temp.id(10)),
	'scheduled blocker leaves eligible draft unchanged'
) as test;
select pg_temp.expect_error(
	$$select public.bulk_puzzle_drafts(array[pg_temp.id(10),pg_temp.id(11)], 'delete')$$,
	'23514', 'scheduled puzzle blocks the whole delete'
) as test;
update public.puzzles set release_at = now() - interval '1 second' where id = pg_temp.id(11);
select pg_temp.expect_error(
	$$select public.bulk_puzzle_drafts(array[pg_temp.id(10),pg_temp.id(11)], 'palette', 'bulk-test-a')$$,
	'23514', 'live puzzle blocks the whole palette change'
) as test;
select pg_temp.expect_error(
	$$select public.bulk_puzzle_drafts(array[pg_temp.id(10),pg_temp.id(11)], 'delete')$$,
	'23514', 'live puzzle blocks the whole delete'
) as test;

reset role;
select set_config('request.jwt.claim.sub', pg_temp.id(2)::text, true);
set local role authenticated;
select pg_temp.expect_error(
	$$select public.bulk_puzzle_drafts(array[pg_temp.id(10)], 'palette', 'bulk-test-a')$$,
	'42501', 'regular users cannot recolor drafts in bulk'
) as test;
select pg_temp.expect_error(
	$$select public.bulk_puzzle_drafts(array[pg_temp.id(10)], 'delete')$$,
	'42501', 'regular users cannot delete drafts in bulk'
) as test;
reset role;
set local role anon;
select pg_temp.expect_error(
	$$select public.bulk_puzzle_drafts(array[pg_temp.id(10)], 'delete')$$,
	'42501', 'anonymous callers cannot use bulk actions'
) as test;
reset role;
select set_config('request.jwt.claim.sub', pg_temp.id(1)::text, true);
set local role authenticated;
select pg_temp.assert_true(
	public.bulk_puzzle_drafts(array[pg_temp.id(10),pg_temp.id(13)], 'delete') = array[pg_temp.id(10),pg_temp.id(13)],
	'admin deletes every eligible selected draft in one operation'
) as test;
select pg_temp.assert_true(
	not exists(select 1 from public.puzzles where id = any(array[pg_temp.id(10),pg_temp.id(13)]))
	and not exists(select 1 from public.puzzle_authoring where puzzle_id = any(array[pg_temp.id(10),pg_temp.id(13)]))
	and (select count(*) = 2 from public.puzzles where id = any(array[pg_temp.id(11),pg_temp.id(12)])),
	'bulk delete removes selected definitions and seeds but preserves unselected puzzles'
) as test;
set constraints all immediate;
rollback;
