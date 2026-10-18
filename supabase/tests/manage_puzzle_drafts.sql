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
insert into auth.users(id) values
	('ec000000-0000-4000-8000-000000000001'),
	('ec000000-0000-4000-8000-000000000002');
delete from public.admin_account;
insert into public.admin_account(user_id) values ('ec000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub', 'ec000000-0000-4000-8000-000000000001', true);
set local role authenticated;

select public.save_hex_puzzle_draft(
	'ec000000-0000-4000-8000-000000000010', 'Draft', 'collection', 'cabo', 'sm', false, 'easy',
	'{"version":2,"geometry":{"radius":3},"target":{"0,0":0},"pieces":[{"id":"p1","tiles":[{"q":0,"r":0,"color_slot":0}]}]}',
	'manage-seed', 'hexagon-v2', '{"p1":{"q":0,"r":0}}'
);
select public.edit_puzzle_draft('ec000000-0000-4000-8000-000000000010', ' Renamed ', 'cabo', 'daily');
select pg_temp.assert_true(
	(select name = 'Renamed' and usage = 'daily' from public.puzzles where id = 'ec000000-0000-4000-8000-000000000010'),
	'admin can rename and switch an unassigned draft to daily'
) as test;
select public.edit_puzzle_draft('ec000000-0000-4000-8000-000000000010', 'Renamed again', 'cabo', 'collection');
select pg_temp.assert_true(
	(select usage = 'collection' and definition -> 'target' = '{"0,0":0}'::jsonb
		from public.puzzles where id = 'ec000000-0000-4000-8000-000000000010')
	and (select seed = 'manage-seed' and known_solution = '{"p1":{"q":0,"r":0}}'::jsonb
		from public.puzzle_authoring where puzzle_id = 'ec000000-0000-4000-8000-000000000010'),
	'metadata edits preserve exact public design and private provenance'
) as test;
select pg_temp.expect_error(
	$$select public.edit_puzzle_draft('ec000000-0000-4000-8000-000000000010', ' ', 'cabo', 'daily')$$,
	'23514', 'blank names are rejected'
) as test;
select pg_temp.expect_error(
	$$select public.edit_puzzle_draft('ec000000-0000-4000-8000-000000000010', 'Name', 'missing-palette', 'daily')$$,
	'23503', 'missing palettes reject the metadata update'
) as test;
select pg_temp.assert_true(
	(select name = 'Renamed again' and usage = 'collection' from public.puzzles where id = 'ec000000-0000-4000-8000-000000000010'),
	'failed metadata updates preserve previous values'
) as test;
insert into public.palettes(id, name, colors)
	values ('library-test', 'Library test', array['#111111','#222222','#333333','#444444','#555555']);
select public.edit_puzzle_draft('ec000000-0000-4000-8000-000000000010', 'Renamed again', 'library-test', 'collection');
select pg_temp.assert_true(
	(select palette_id = 'library-test' and definition -> 'target' = '{"0,0":0}'::jsonb
		from public.puzzles where id = 'ec000000-0000-4000-8000-000000000010'),
	'palette reassignment preserves stored target slots'
) as test;
select public.edit_puzzle_draft('ec000000-0000-4000-8000-000000000010', 'Renamed again', 'cabo', 'collection');

insert into public.puzzle_collections(id, name, kind, shape_id)
	values ('ec000000-0000-4000-8000-000000000020', 'Draft set', 'reward', 'hexagon');
insert into public.collection_puzzles(puzzle_id, collection_id, shape_id, position)
	values ('ec000000-0000-4000-8000-000000000010', 'ec000000-0000-4000-8000-000000000020', 'hexagon', 1);
select pg_temp.assert_true(
	public.edit_puzzle_draft('ec000000-0000-4000-8000-000000000010', 'Assigned draft', 'cabo', 'collection')
		= 'ec000000-0000-4000-8000-000000000010'::uuid,
	'assigned unpublished drafts retain name and palette editing'
) as test;
select pg_temp.expect_error(
	$$select public.edit_puzzle_draft('ec000000-0000-4000-8000-000000000010', 'Name', 'cabo', 'daily')$$,
	'23514', 'assigned set puzzles cannot switch intended use'
) as test;
select pg_temp.expect_error(
	$$select public.delete_puzzle_draft('ec000000-0000-4000-8000-000000000010')$$,
	'23514', 'assigned set puzzles cannot be deleted'
) as test;
delete from public.collection_puzzles where puzzle_id = 'ec000000-0000-4000-8000-000000000010';

reset role;
select set_config('request.jwt.claim.sub', 'ec000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select pg_temp.expect_error(
	$$select public.edit_puzzle_draft('ec000000-0000-4000-8000-000000000010', 'Name', 'cabo', 'daily')$$,
	'42501', 'ordinary users cannot edit drafts through RPC'
) as test;
select pg_temp.expect_error(
	$$select public.delete_puzzle_draft('ec000000-0000-4000-8000-000000000010')$$,
	'42501', 'ordinary users cannot delete drafts through RPC'
) as test;
reset role;
set local role anon;
select pg_temp.expect_error(
	$$select public.edit_puzzle_draft('ec000000-0000-4000-8000-000000000010', 'Name', 'cabo', 'daily')$$,
	'42501', 'anonymous callers cannot edit drafts'
) as test;
select pg_temp.expect_error(
	$$select public.delete_puzzle_draft('ec000000-0000-4000-8000-000000000010')$$,
	'42501', 'anonymous callers cannot delete drafts'
) as test;
reset role;
select set_config('request.jwt.claim.sub', 'ec000000-0000-4000-8000-000000000001', true);
set local role authenticated;

update public.palettes set published_at = now(), release_at = now() - interval '1 minute'
	where id = 'library-test';
update public.puzzles set palette_id = 'library-test', published_at = now(), release_at = now() + interval '1 day'
	where id = 'ec000000-0000-4000-8000-000000000010';
select pg_temp.expect_error(
	$$select public.edit_puzzle_draft('ec000000-0000-4000-8000-000000000010', 'Name', 'cabo', 'collection')$$,
	'23514', 'draft editor cannot modify scheduled content'
) as test;
select pg_temp.expect_error(
	$$select public.delete_puzzle_draft('ec000000-0000-4000-8000-000000000010')$$,
	'23514', 'draft deletion cannot remove scheduled content'
) as test;
update public.puzzles set release_at = now() - interval '1 second'
	where id = 'ec000000-0000-4000-8000-000000000010';
select pg_temp.expect_error(
	$$select public.edit_puzzle_draft('ec000000-0000-4000-8000-000000000010', 'Name', 'cabo', 'collection')$$,
	'23514', 'draft editor cannot modify live content'
) as test;
select pg_temp.expect_error(
	$$select public.delete_puzzle_draft('ec000000-0000-4000-8000-000000000010')$$,
	'23514', 'draft deletion cannot remove live content'
) as test;
select public.save_hex_puzzle_draft(
	'ec000000-0000-4000-8000-000000000011', 'Delete me', 'daily', 'cabo', 'sm', false, 'easy',
	'{"version":2,"geometry":{"radius":3},"target":{"0,0":0},"pieces":[{"id":"p1","tiles":[{"q":0,"r":0,"color_slot":0}]}]}',
	'delete-seed', 'hexagon-v2', '{"p1":{"q":0,"r":0}}'
);
select pg_temp.assert_true(
	public.delete_puzzle_draft('ec000000-0000-4000-8000-000000000011') =
		'ec000000-0000-4000-8000-000000000011'::uuid,
	'admin can delete an unused draft'
) as test;
select pg_temp.assert_true(
	not exists(select 1 from public.puzzle_authoring where puzzle_id = 'ec000000-0000-4000-8000-000000000011')
	and not exists(select 1 from public.puzzles where id = 'ec000000-0000-4000-8000-000000000011'),
	'deleting a draft removes its definition and saved seed exclusion'
) as test;
select pg_temp.expect_error(
	$$select public.delete_puzzle_draft('ec000000-0000-4000-8000-000000000011')$$,
	'P0002', 'missing draft deletions report an explicit error'
) as test;
select pg_temp.expect_error(
	$$select public.edit_puzzle_draft('ec000000-0000-4000-8000-000000000011', 'Name', 'cabo', 'daily')$$,
	'P0002', 'missing draft updates report an explicit error'
) as test;
set constraints all immediate;
rollback;
