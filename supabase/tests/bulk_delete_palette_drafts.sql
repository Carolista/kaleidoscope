begin;

create function pg_temp.id(value integer) returns uuid language sql immutable as $$
	select ('ec000000-0000-4000-8000-' || lpad(value::text, 12, '0'))::uuid;
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
insert into public.palettes(id, name, colors) values
	('bulk-del-a', 'Bulk del A', array['#111111','#222222','#333333','#444444','#555555']),
	('bulk-del-b', 'Bulk del B', array['#666666','#777777','#888888','#999999','#aaaaaa']),
	('bulk-del-set', 'Bulk del set', array['#111111','#222222','#333333','#444444','#666666']),
	('bulk-del-used', 'Bulk del used', array['#111111','#222222','#333333','#444444','#777777']),
	('bulk-del-live', 'Bulk del live', array['#111111','#222222','#333333','#444444','#888888']);
insert into public.palette_packs(id, name, kind) values (pg_temp.id(20), 'Bulk draft set', 'undecided');
insert into public.palette_pack_palettes(pack_id, palette_id, position)
	values (pg_temp.id(20), 'bulk-del-set', 1);
select public.save_hex_puzzle_draft(
	pg_temp.id(30), 'Bulk del puzzle', 'collection', 'bulk-del-used', 'sm', false, 'easy',
	'{"version":2,"geometry":{"radius":3},"target":{"0,0":0},"pieces":[{"id":"p1","tiles":[{"q":0,"r":0,"color_slot":0}]}]}',
	'bulk-del-seed', 'hexagon-v2', '{"p1":{"q":0,"r":0}}'
);
update public.palettes set published_at = now(), release_at = now() + interval '1 day' where id = 'bulk-del-live';

select pg_temp.expect_error(
	$$select public.bulk_delete_palette_drafts('{}')$$,
	'22023', 'empty selection is rejected'
) as test;
select pg_temp.expect_error(
	$$select public.bulk_delete_palette_drafts(null)$$,
	'22023', 'null selection is rejected'
) as test;
select pg_temp.expect_error(
	$$select public.bulk_delete_palette_drafts(array['bulk-del-a', null])$$,
	'22023', 'null IDs are rejected'
) as test;
select pg_temp.expect_error(
	$$select public.bulk_delete_palette_drafts(array['bulk-del-a', 'bulk-del-a'])$$,
	'22023', 'duplicate IDs are rejected'
) as test;
select pg_temp.expect_error(
	$$select public.bulk_delete_palette_drafts(array['bulk-del-a', 'bulk-del-missing'])$$,
	'P0002', 'missing palette rejects the entire batch'
) as test;
select pg_temp.expect_error(
	$$select public.bulk_delete_palette_drafts(array['bulk-del-a', 'bulk-del-set'])$$,
	'23514', 'a palette in a draft set blocks the whole delete'
) as test;
select pg_temp.expect_error(
	$$select public.bulk_delete_palette_drafts(array['bulk-del-a', 'bulk-del-used'])$$,
	'23514', 'a palette used by a puzzle blocks the whole delete'
) as test;
select pg_temp.expect_error(
	$$select public.bulk_delete_palette_drafts(array['bulk-del-a', 'bulk-del-live'])$$,
	'23514', 'a scheduled palette blocks the whole delete'
) as test;
update public.palettes set release_at = now() - interval '1 second' where id = 'bulk-del-live';
select pg_temp.expect_error(
	$$select public.bulk_delete_palette_drafts(array['bulk-del-a', 'bulk-del-live'])$$,
	'23514', 'a live palette blocks the whole delete'
) as test;
select pg_temp.assert_true(
	(select count(*) = 5 from public.palettes where id like 'bulk-del-%')
	and exists(select 1 from public.palette_pack_palettes where palette_id = 'bulk-del-set'),
	'rejected batches leave every palette and membership intact'
) as test;

reset role;
select set_config('request.jwt.claim.sub', pg_temp.id(2)::text, true);
set local role authenticated;
select pg_temp.expect_error(
	$$select public.bulk_delete_palette_drafts(array['bulk-del-a'])$$,
	'42501', 'regular users cannot delete palettes in bulk'
) as test;
reset role;
set local role anon;
select pg_temp.expect_error(
	$$select public.bulk_delete_palette_drafts(array['bulk-del-a'])$$,
	'42501', 'anonymous callers cannot delete palettes in bulk'
) as test;
reset role;
select set_config('request.jwt.claim.sub', pg_temp.id(1)::text, true);
set local role authenticated;
select pg_temp.assert_true(
	public.bulk_delete_palette_drafts(array['bulk-del-a', 'bulk-del-b']) = array['bulk-del-a', 'bulk-del-b'],
	'admin deletes every eligible selected palette in one operation'
) as test;
select pg_temp.assert_true(
	not exists(select 1 from public.palettes where id in ('bulk-del-a', 'bulk-del-b'))
	and (select count(*) = 3 from public.palettes where id like 'bulk-del-%'),
	'bulk delete removes only the selected palettes'
) as test;
set constraints all immediate;
rollback;
