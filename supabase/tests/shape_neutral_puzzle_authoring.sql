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
	select ('e5000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.save(p_id uuid, p_shape text, p_seed text default 'shape-seed')
returns uuid language sql as $$
	select public.save_puzzle_draft(
		p_id, 'Shape draft', 'collection', p_shape, 'shape-test', 'sm', false, 'easy',
		'{"version":2,"geometry":{"size":4},"target":{"-1,2":0},"pieces":[{"id":"p1","tiles":[{"q":-1,"r":2,"color_slot":0}]}]}',
		p_seed, p_shape || '-test', '{"p1":{"q":0,"r":0}}'
	);
$$;
create function pg_temp.replace(p_id uuid, p_shape text)
returns uuid language sql as $$
	select public.replace_puzzle_draft(
		p_id, 'Replaced', 'collection', p_shape, 'shape-test', 'md', true, 'hard',
		'{"version":2,"geometry":{"size":7},"target":{"-1,2":1},"pieces":[{"id":"p2","tiles":[{"q":-1,"r":2,"color_slot":1}]}]}',
		'replacement-seed', p_shape || '-test', '{"p2":{"q":0,"r":0,"rotation":1}}'
	);
$$;

insert into auth.users(id) values (pg_temp.id(1)), (pg_temp.id(2));
delete from public.admin_account;
insert into public.admin_account(user_id) values (pg_temp.id(1));
insert into public.palettes(id, name, colors)
	values ('shape-test', 'Shape test', array['#111111','#222222','#333333','#444444','#555555']);

select pg_temp.assert_true(
	to_regprocedure('public.save_hex_puzzle_draft(uuid, text, text, text, text, boolean, text, jsonb, text, text, jsonb)') is null
	and to_regprocedure('public.replace_hex_puzzle_draft(uuid, text, text, text, text, boolean, text, jsonb, text, text, jsonb)') is null
	and to_regprocedure('public.manage_draft_set(uuid, text, text, text, uuid[])') is null,
	'hexagon-only RPC signatures are removed'
) as test;

set local role anon;
select pg_temp.expect_error(
	$$select pg_temp.save(pg_temp.id(10), 'triangle')$$,
	'42501', 'anonymous callers cannot save drafts'
) as test;
reset role;
select set_config('request.jwt.claim.sub', pg_temp.id(2)::text, true);
set local role authenticated;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(20), 'create', 'Blocked', 'core', '{}', 'triangle')$$,
	'42501', 'regular users cannot create sets'
) as test;
reset role;
select set_config('request.jwt.claim.sub', pg_temp.id(1)::text, true);
set local role authenticated;

select pg_temp.assert_true(
	pg_temp.save(pg_temp.id(10), 'triangle') = pg_temp.id(10)
	and pg_temp.save(pg_temp.id(11), 'triangle') = pg_temp.id(11)
	and pg_temp.save(pg_temp.id(12), 'hexagon') = pg_temp.id(12),
	'admin saves triangle and hexagon drafts'
) as test;
select pg_temp.assert_true(
	(select shape_id = 'triangle' and published_at is null from public.puzzles where id = pg_temp.id(10))
	and (select generator_version = 'triangle-test' from public.puzzle_authoring where puzzle_id = pg_temp.id(10)),
	'draft keeps its shape and generator version'
) as test;
select pg_temp.assert_true(
	pg_temp.save(pg_temp.id(10), 'triangle') = pg_temp.id(10),
	'identical save retries return the same draft'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.save(pg_temp.id(10), 'hexagon')$$,
	'23505', 'a retry with another shape cannot overwrite the draft'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.save(pg_temp.id(13), 'square')$$,
	'22023', 'unknown shapes are rejected'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.save(pg_temp.id(13), null)$$,
	'22023', 'a shape is required'
) as test;

select pg_temp.assert_true(
	pg_temp.replace(pg_temp.id(11), 'triangle') = pg_temp.id(11),
	'admin replaces a triangle draft'
) as test;
select pg_temp.assert_true(
	(select shape_id = 'triangle' and board_size = 'md' and rotation_allowed
		from public.puzzles where id = pg_temp.id(11))
	and (select seed = 'replacement-seed' from public.puzzle_authoring where puzzle_id = pg_temp.id(11)),
	'replacement keeps the ID and shape with the new design'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.replace(pg_temp.id(11), 'hexagon')$$,
	'23514', 'replacement cannot change the puzzle shape'
) as test;

select pg_temp.assert_true(
	public.manage_draft_set(pg_temp.id(20), 'create', ' Triangle core ', 'core', '{}', 'triangle') = pg_temp.id(20),
	'admin creates a triangle set'
) as test;
select pg_temp.assert_true(
	(select shape_id = 'triangle' and name = 'Triangle core' from public.puzzle_collections where id = pg_temp.id(20)),
	'the new set stores its shape and trimmed name'
) as test;
select pg_temp.assert_true(
	public.manage_draft_set(pg_temp.id(20), 'create', 'Triangle core', 'core', '{}', 'triangle') = pg_temp.id(20),
	'identical set create retries return the same set'
) as test;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(20), 'create', 'Triangle core', 'core', '{}', 'hexagon')$$,
	'23505', 'a set create retry cannot change shape'
) as test;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(21), 'create', 'No shape', 'core')$$,
	'22023', 'set creation requires a shape'
) as test;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(21), 'create', 'Bad shape', 'core', '{}', 'square')$$,
	'22023', 'set creation rejects unknown shapes'
) as test;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(20), 'rename', 'Renamed', null, '{}', 'hexagon')$$,
	'22023', 'an existing set shape cannot be changed'
) as test;
select public.manage_draft_set(pg_temp.id(20), 'append', p_puzzle_ids => array[pg_temp.id(10), pg_temp.id(11)]);
select pg_temp.assert_true(
	(select count(*) = 2 from public.collection_puzzles
		where collection_id = pg_temp.id(20) and shape_id = 'triangle'),
	'triangle drafts join a triangle set'
) as test;
select pg_temp.expect_error(
	$$select public.manage_draft_set(pg_temp.id(20), 'append', p_puzzle_ids => array[pg_temp.id(12)])$$,
	'23514', 'drafts of another shape cannot join the set'
) as test;
select public.manage_draft_set(pg_temp.id(20), 'reorder', p_puzzle_ids => array[pg_temp.id(11), pg_temp.id(10)]);
select pg_temp.assert_true(
	(select array_agg(puzzle_id order by position) = array[pg_temp.id(11), pg_temp.id(10)]
		from public.collection_puzzles where collection_id = pg_temp.id(20)),
	'triangle sets reorder members'
) as test;
select public.manage_draft_set(pg_temp.id(20), 'remove', p_puzzle_ids => array[pg_temp.id(11)]);
select pg_temp.assert_true(
	(select array_agg(puzzle_id order by position) = array[pg_temp.id(10)]
		from public.collection_puzzles where collection_id = pg_temp.id(20)),
	'triangle sets remove members without deleting them'
) as test;

reset role;
set constraints all immediate;
select 'All shape-neutral authoring assertions passed; fixtures will be rolled back.' as result;
rollback;
