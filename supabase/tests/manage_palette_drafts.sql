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
	select ('fa000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.colors() returns text[] language sql immutable as $$
	select array['#ABCdef', '#112233', '#112233', '#000000', '#ffffff'];
$$;
create function pg_temp.change(p_id text, p_action text, p_name text default null, p_colors text[] default null)
returns text language sql as $$
	select public.manage_palette_draft(
		p_id, p_action, p_name, p_colors,
		p.name, p.colors, p.revision
	) from public.palettes p where p.id = p_id;
$$;
insert into auth.users(id) values(pg_temp.id(1)), (pg_temp.id(2));
delete from public.admin_account;
insert into public.admin_account(user_id) values(pg_temp.id(1));
select set_config('request.jwt.claim.sub', pg_temp.id(1)::text, true);
set local role authenticated;

select pg_temp.assert_true(
	public.manage_palette_draft('test-palette', 'create', ' Test palette ', pg_temp.colors()) = 'test-palette',
	'admin creates a draft palette with a permanent ID'
) as test;
select pg_temp.assert_true(
	exists(select 1 from public.palettes where id = 'test-palette' and name = 'Test palette'
		and colors = pg_temp.colors() and revision = 1 and published_at is null and release_at is null),
	'creation trims name and preserves duplicate colors, case, and slot order'
) as test;
select pg_temp.assert_true(
	public.manage_palette_draft('test-palette', 'create', 'Test palette', pg_temp.colors()) = 'test-palette'
		and (select count(*) = 1 from public.palettes where id = 'test-palette'),
	'identical create retries confirm the existing record'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_draft('test-palette', 'create', 'Different', pg_temp.colors())$$,
	'23505', 'create retry cannot overwrite content'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_draft('unknown', null)$$, '23514', 'null action is rejected'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_draft('unknown', 'publish')$$, '23514', 'unknown action is rejected'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_draft(' bad-id ', 'create', 'Test', pg_temp.colors())$$,
	'23514', 'untrimmed IDs are rejected'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_draft('', 'create', 'Test', pg_temp.colors())$$,
	'23514', 'empty IDs are rejected'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_draft(null, 'create', 'Test', pg_temp.colors())$$,
	'23514', 'null IDs are rejected'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_draft('bad-name', 'create', '   ', pg_temp.colors())$$,
	'23514', 'blank names are rejected'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_draft('bad-name', 'create', null, pg_temp.colors())$$,
	'23502', 'null names are rejected'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_draft('bad-colors', 'create', 'Test', null)$$,
	'23502', 'null color arrays are rejected'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_draft('bad-colors', 'create', 'Test', array[]::text[])$$,
	'23514', 'empty color arrays are rejected'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_draft('bad-colors', 'create', 'Test', array['#112233'])$$,
	'23514', 'incorrect color count is rejected'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_draft('bad-colors', 'create', 'Test', array['#123', '#112233', '#112233', '#000000', '#ffffff'])$$,
	'23514', 'non-six-digit colors are rejected'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_draft('bad-colors', 'create', 'Test', array[null, '#112233', '#112233', '#000000', '#ffffff'])$$,
	'23514', 'null color slots are rejected'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_draft('bad-colors', 'create', 'Test', '[0:4]={#112233,#223344,#334455,#445566,#556677}'::text[])$$,
	'23514', 'nonstandard array bounds are rejected'
) as test;

select pg_temp.change('test-palette', 'update', 'Renamed', pg_temp.colors());
select pg_temp.assert_true(
	(select revision = 1 and name = 'Renamed' from public.palettes where id = 'test-palette'),
	'name-only edits retain the palette ID and color revision'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_draft('test-palette', 'update', 'Stale edit', pg_temp.colors(), 'Test palette', pg_temp.colors(), 1)$$,
	'40001', 'stale name-only changes cannot overwrite a newer name'
) as test;
select pg_temp.assert_true(
	public.manage_palette_draft('test-palette', 'update', 'Renamed', pg_temp.colors(), 'Test palette', pg_temp.colors(), 1) = 'test-palette',
	'name-only lost-response retry is confirmed'
) as test;
select pg_temp.change('test-palette', 'update', 'Renamed', array['#ffffff', '#112233', '#112233', '#000000', '#ABCdef']);
select pg_temp.assert_true(
	(select revision = 2 and colors = array['#ffffff', '#112233', '#112233', '#000000', '#ABCdef']
		from public.palettes where id = 'test-palette'),
	'color edits increment revision once and preserve ordered slots'
) as test;
select pg_temp.assert_true(
	public.manage_palette_draft('test-palette', 'update', 'Renamed',
		array['#ffffff', '#112233', '#112233', '#000000', '#ABCdef'], 'Renamed', pg_temp.colors(), 1) = 'test-palette'
		and (select revision = 2 from public.palettes where id = 'test-palette'),
	'color lost-response retry does not increment revision again'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_draft('test-palette', 'update', 'Stale', pg_temp.colors(), 'Renamed', pg_temp.colors(), 1)$$,
	'40001', 'stale color edits are rejected'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_draft('test-palette', 'delete', p_expected_name => 'Renamed', p_expected_colors => pg_temp.colors(), p_expected_revision => 1)$$,
	'40001', 'stale deletions are rejected'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_draft('test-palette', 'update', 'Unloaded', pg_temp.colors())$$,
	'23514', 'edits require a loaded baseline'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.change('test-palette', 'update', 'Invalid', array['#bad'])$$,
	'23514', 'invalid update fails atomically'
) as test;
select pg_temp.assert_true(
	(select name = 'Renamed' and revision = 2 and colors[1] = '#ffffff'
		from public.palettes where id = 'test-palette'),
	'failed update retains previous name, colors, and revision'
) as test;
select pg_temp.assert_true(
	not exists(select 1 from public.palette_corrections where palette_id = 'test-palette'),
	'draft edits do not create published correction history'
) as test;
select pg_temp.expect_error(
	$$update public.palettes set id = 'changed-id' where id = 'test-palette'$$,
	'23514', 'existing palette IDs remain permanent'
) as test;
select pg_temp.assert_true(
	public.manage_palette_draft('same-name', 'create', 'Renamed', pg_temp.colors()) = 'same-name',
	'display names do not determine identity or impose uniqueness'
) as test;
select pg_temp.assert_true(
	pg_temp.change('test-palette', 'update', 'Renamed', array['#ffffff', '#112233', '#112233', '#000000', '#ABCdef']) = 'test-palette'
		and (select revision = 2 from public.palettes where id = 'test-palette'),
	'unchanged save does not increment revision'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_draft('missing', 'update', 'Missing', pg_temp.colors(), 'Missing', pg_temp.colors(), 1)$$,
	'P0002', 'missing edit fails explicitly'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_draft('missing', 'delete', p_expected_name => 'Missing', p_expected_colors => pg_temp.colors(), p_expected_revision => 1)$$,
	'P0002', 'missing deletion fails explicitly'
) as test;

select public.manage_palette_draft('in-use', 'create', 'In use', pg_temp.colors());
select public.save_hex_puzzle_draft(
	pg_temp.id(10), 'Linked puzzle', 'collection', 'in-use', 'sm', false, 'easy',
	'{"version":2,"geometry":{"radius":3},"target":{"0,0":0},"pieces":[{"id":"p1","tiles":[{"q":0,"r":0,"color_slot":0}]}]}',
	'palette-seed', 'hexagon-v2', '{"p1":{"q":0,"r":0}}'
);
select pg_temp.expect_error(
	$$select pg_temp.change('in-use', 'delete')$$, '23514', 'puzzle references block deletion'
) as test;
select pg_temp.change('in-use', 'update', 'New appearance', array['#ffffff', '#112233', '#112233', '#000000', '#ABCdef']);
select pg_temp.assert_true(
	exists(select 1 from public.puzzles where id = pg_temp.id(10)
			and palette_id = 'in-use' and definition -> 'target' ->> '0,0' = '0')
		and exists(select 1 from public.puzzle_authoring where puzzle_id = pg_temp.id(10) and seed = 'palette-seed'),
	'editing a referenced draft retains puzzle slots, identity, and private authoring'
) as test;
select public.delete_puzzle_draft(pg_temp.id(10));
insert into public.starter_palettes(palette_id) values('in-use');
select pg_temp.expect_error(
	$$select pg_temp.change('in-use', 'delete')$$, '23514', 'starter membership blocks deletion'
) as test;
delete from public.starter_palettes where palette_id = 'in-use';
select public.manage_draft_set(pg_temp.id(20), 'create', 'Reward source', 'core');
insert into public.reward_rules(id, collection_id) values(pg_temp.id(21), pg_temp.id(20));
insert into public.reward_palettes(reward_rule_id, palette_id) values(pg_temp.id(21), 'in-use');
select pg_temp.expect_error(
	$$select pg_temp.change('in-use', 'delete')$$, '23514', 'reward mapping blocks deletion'
) as test;
delete from public.reward_palettes where palette_id = 'in-use';
insert into public.palette_packs(id, name) values(pg_temp.id(22), 'Pack');
insert into public.palette_pack_palettes(pack_id, palette_id, position) values(pg_temp.id(22), 'in-use', 1);
select pg_temp.expect_error(
	$$select pg_temp.change('in-use', 'delete')$$, '23514', 'pack membership blocks deletion'
) as test;
delete from public.palette_pack_palettes where palette_id = 'in-use';
insert into public.palette_grants(user_id, palette_id, source) values(pg_temp.id(2), 'in-use', 'admin');
select pg_temp.expect_error(
	$$select pg_temp.change('in-use', 'delete')$$, '23514', 'ownership grants block deletion'
) as test;
delete from public.palette_grants where palette_id = 'in-use';
reset role;
insert into public.palette_corrections(palette_id, revision, old_colors, new_colors)
	values('in-use', 2, pg_temp.colors(), pg_temp.colors());
set local role authenticated;
select pg_temp.expect_error(
	$$select pg_temp.change('in-use', 'delete')$$, '23514', 'correction history blocks deletion'
) as test;
reset role;
delete from public.palette_corrections where palette_id = 'in-use';
set local role authenticated;
select pg_temp.change('in-use', 'delete');
select pg_temp.assert_true(
	not exists(select 1 from public.palettes where id = 'in-use'),
	'deletion succeeds after all dependencies are removed'
) as test;

reset role;
create function pg_temp.reject_palette_delete() returns trigger language plpgsql as $$
begin
	raise exception 'Test palette write failure.' using errcode = '23514';
end;
$$;
create trigger palette_delete_test before delete on public.palettes
	for each row execute function pg_temp.reject_palette_delete();
set local role authenticated;
select pg_temp.expect_error(
	$$select pg_temp.change('test-palette', 'delete')$$,
	'23514', 'write-time deletion failure is reported'
) as test;
select pg_temp.assert_true(
	exists(select 1 from public.palettes where id = 'test-palette' and revision = 2 and name = 'Renamed'),
	'failed deletion retains the entire palette'
) as test;
reset role;
drop trigger palette_delete_test on public.palettes;
set local role authenticated;

select public.manage_palette_draft('scheduled', 'create', 'Scheduled', pg_temp.colors());
update public.palettes set published_at = now(), release_at = now() + interval '1 day' where id = 'scheduled';
select pg_temp.expect_error(
	$$select pg_temp.change('scheduled', 'update', 'Changed', pg_temp.colors())$$,
	'23514', 'scheduled edits are excluded from this draft-only workflow'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.change('scheduled', 'delete')$$, '23514', 'scheduled deletion is excluded'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_draft('scheduled', 'create', 'Scheduled', pg_temp.colors())$$,
	'23505', 'create retry cannot treat scheduled content as a draft'
) as test;
select public.manage_palette_draft('live', 'create', 'Live', pg_temp.colors());
update public.palettes set published_at = now(), release_at = now() - interval '1 day' where id = 'live';
select pg_temp.expect_error(
	$$select pg_temp.change('live', 'update', 'Changed', pg_temp.colors())$$,
	'23514', 'live corrections are excluded from this draft-only workflow'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.change('live', 'delete')$$, '23514', 'live deletion is excluded'
) as test;

select set_config('request.jwt.claim.sub', pg_temp.id(2)::text, true);
select pg_temp.expect_error(
	$$select public.manage_palette_draft('player', 'create', 'Player', pg_temp.colors())$$,
	'42501', 'non-admin cannot create palettes'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_draft('test-palette', 'update', 'Player', pg_temp.colors(), 'Renamed', pg_temp.colors(), 2)$$,
	'42501', 'non-admin cannot update palettes'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_draft('test-palette', 'delete')$$,
	'42501', 'non-admin cannot delete palettes'
) as test;
reset role;
set local role anon;
select pg_temp.expect_error(
	$$select public.manage_palette_draft('guest', 'create', 'Guest', pg_temp.colors())$$,
	'42501', 'guest cannot execute the draft management RPC'
) as test;
reset role;

select pg_temp.assert_true(
	not has_function_privilege('anon', 'public.manage_palette_draft(text,text,text,text[],text,text[],bigint)', 'EXECUTE')
		and has_function_privilege('authenticated', 'public.manage_palette_draft(text,text,text,text[],text,text[],bigint)', 'EXECUTE'),
	'RPC execution is restricted to authenticated callers with an admin check'
) as test;
select pg_temp.assert_true(
	not (select prosecdef from pg_proc where oid = 'public.manage_palette_draft(text,text,text,text[],text,text[],bigint)'::regprocedure),
	'RPC uses invoker permissions and caller RLS'
) as test;
select 'All palette draft assertions passed; fixtures will be rolled back.' as result;
rollback;
