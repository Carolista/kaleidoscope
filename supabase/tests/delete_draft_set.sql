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
	select ('ef000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
insert into auth.users(id) values(pg_temp.id(1)), (pg_temp.id(2));
delete from public.admin_account;
insert into public.admin_account(user_id) values(pg_temp.id(1));
select set_config('request.jwt.claim.sub', pg_temp.id(1)::text, true);
set local role authenticated;
select public.manage_draft_set(pg_temp.id(10), 'create', 'Delete me', 'core');
select public.manage_draft_set(pg_temp.id(11), 'create', 'Reward', 'reward');
select public.save_hex_puzzle_draft(
	pg_temp.id(20), 'Keep puzzle', 'collection', 'cabo', 'sm', false, 'easy',
	'{"version":2,"geometry":{"radius":3},"target":{"0,0":0},"pieces":[{"id":"p1","tiles":[{"q":0,"r":0,"color_slot":0}]}]}',
	'keep-seed', 'hexagon-v2', '{"p1":{"q":0,"r":0}}'
);
select public.manage_draft_set(pg_temp.id(10), 'append', p_puzzle_ids => array[pg_temp.id(20)]);
insert into public.core_steps(collection_id, position) values(pg_temp.id(10), 1);
select pg_temp.expect_error($$select public.delete_draft_set(pg_temp.id(10))$$,
	'23514', 'core progression dependencies block deletion') as test;
delete from public.core_steps where collection_id = pg_temp.id(10);
insert into public.completion_routes(id, collection_id, name, position)
	values(pg_temp.id(30), pg_temp.id(10), 'Route', 1);
select pg_temp.expect_error($$select public.delete_draft_set(pg_temp.id(10))$$,
	'23514', 'qualifying routes block deletion') as test;
delete from public.completion_routes where id = pg_temp.id(30);
insert into public.reward_rules(id, collection_id) values(pg_temp.id(31), pg_temp.id(10));
insert into public.reward_sets(reward_rule_id, collection_id) values(pg_temp.id(31), pg_temp.id(11));
select pg_temp.expect_error($$select public.delete_draft_set(pg_temp.id(10))$$,
	'23514', 'outgoing rewards block deletion') as test;
select pg_temp.expect_error($$select public.delete_draft_set(pg_temp.id(11))$$,
	'23514', 'incoming rewards block deletion') as test;
delete from public.reward_rules where id = pg_temp.id(31);
reset role;
create function pg_temp.reject_set_delete() returns trigger language plpgsql as $$
begin
	raise exception 'Test set write failure.' using errcode = '23514';
end;
$$;
create trigger set_delete_test before delete on public.puzzle_collections
	for each row execute function pg_temp.reject_set_delete();
set local role authenticated;
select pg_temp.expect_error($$select public.delete_draft_set(pg_temp.id(10))$$,
	'23514', 'set write failure aborts deletion') as test;
select pg_temp.assert_true(
	exists(select 1 from public.collection_puzzles where collection_id = pg_temp.id(10) and puzzle_id = pg_temp.id(20)),
	'set write failure rolls back membership removal'
) as test;
reset role;
drop trigger set_delete_test on public.puzzle_collections;
set local role authenticated;
select pg_temp.assert_true(public.delete_draft_set(pg_temp.id(10)) = pg_temp.id(10),
	'admin deletes a populated draft set') as test;
select pg_temp.assert_true(
	not exists(select 1 from public.puzzle_collections where id = pg_temp.id(10))
	and not exists(select 1 from public.collection_puzzles where puzzle_id = pg_temp.id(20))
	and exists(select 1 from public.puzzles where id = pg_temp.id(20) and name = 'Keep puzzle')
	and exists(select 1 from public.puzzle_authoring where puzzle_id = pg_temp.id(20) and seed = 'keep-seed'),
	'deletion unassigns but preserves the puzzle and private solution'
) as test;
select pg_temp.expect_error($$select public.delete_draft_set(pg_temp.id(10))$$,
	'P0002', 'missing set deletion fails explicitly') as test;
select pg_temp.assert_true(public.delete_draft_set(pg_temp.id(11)) = pg_temp.id(11),
	'empty draft sets can also be deleted') as test;

select public.manage_draft_set(pg_temp.id(12), 'create', 'Scheduled', 'paid');
insert into public.palettes(id, name, colors, published_at, release_at)
	values('delete-set-test', 'Delete set test', array['#111111','#222222','#333333','#444444','#555555'],
		now(), now() - interval '1 minute');
update public.puzzles set palette_id = 'delete-set-test', published_at = now(), release_at = now() + interval '1 day'
	where id = pg_temp.id(20);
-- A prepared puzzle cannot be silently unassigned, even if the containing set is still a draft.
insert into public.collection_puzzles(puzzle_id, collection_id, shape_id, position)
	values(pg_temp.id(20), pg_temp.id(12), 'hexagon', 1);
select pg_temp.expect_error($$select public.delete_draft_set(pg_temp.id(12))$$,
	'23514', 'prepared member puzzles block draft set deletion') as test;
update public.puzzle_collections set published_at = now(), release_at = now() + interval '2 days'
	where id = pg_temp.id(12);
select pg_temp.expect_error($$select public.delete_draft_set(pg_temp.id(12))$$,
	'23514', 'scheduled sets cannot be deleted') as test;
update public.puzzles set release_at = now() - interval '1 second' where id = pg_temp.id(20);
update public.puzzle_collections set release_at = now() - interval '1 second' where id = pg_temp.id(12);
select pg_temp.expect_error($$select public.delete_draft_set(pg_temp.id(12))$$,
	'23514', 'live sets cannot be deleted') as test;
reset role;
select set_config('request.jwt.claim.sub', pg_temp.id(2)::text, true);
set local role authenticated;
select pg_temp.expect_error($$select public.delete_draft_set(pg_temp.id(12))$$,
	'42501', 'ordinary users cannot delete sets') as test;
reset role;
set local role anon;
select pg_temp.expect_error($$select public.delete_draft_set(pg_temp.id(12))$$,
	'42501', 'anonymous callers cannot delete sets') as test;
reset role;
set constraints all immediate;
rollback;
