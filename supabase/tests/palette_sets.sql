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
	select ('fb000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.colors() returns text[] language sql immutable as $$
	select array['#112233', '#223344', '#334455', '#445566', '#556677'];
$$;
create function pg_temp.remove_palette(p_id text) returns text language sql as $$
	select public.delete_palette_draft(p.id, p.name, p.colors, p.revision) from public.palettes p where p.id = p_id;
$$;
insert into auth.users(id) values(pg_temp.id(1)), (pg_temp.id(2));
delete from public.admin_account;
insert into public.admin_account(user_id) values(pg_temp.id(1));
select set_config('request.jwt.claim.sub', pg_temp.id(1)::text, true);
set local role authenticated;
create temporary table palette_distribution_baseline on commit drop as
	select
		(select count(*) from public.reward_palettes) as rewards,
		(select count(*) from public.starter_palettes) as starters,
		(select count(*) from public.palette_grants) as grants;

select pg_temp.assert_true(
	public.manage_palette_set(pg_temp.id(10), 'create', ' First ', 'undecided') = pg_temp.id(10),
	'admin receives a confirmed create ID'
) as test;
select pg_temp.assert_true(
	(select name = 'First' and kind = 'undecided' and published_at is null and release_at is null
			from public.palette_packs where id = pg_temp.id(10)),
	'admin creates a named undecided draft without granting access'
) as test;
select pg_temp.assert_true(
	public.manage_palette_set(pg_temp.id(10), 'create', 'First', 'undecided') = pg_temp.id(10),
	'identical create retry returns the same set'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_set(pg_temp.id(10), 'create', 'Different', 'core')$$,
	'23505', 'create retry does not overwrite existing content'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_set(pg_temp.id(11), 'create', ' ', 'core')$$,
	'22023', 'blank names fail'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_set(pg_temp.id(11), 'create', 'Unknown', 'free')$$,
	'22023', 'unknown labels fail'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_set(pg_temp.id(11), null)$$,
	'22023', 'null actions fail'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_set(null, 'delete')$$, '22023', 'null IDs fail'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_set(pg_temp.id(11), 'update', 'Missing', 'core')$$,
	'P0002', 'missing sets fail explicitly'
) as test;
select public.manage_palette_set(pg_temp.id(10), 'update', ' Renamed ', 'core');
select pg_temp.assert_true(
	(select name = 'Renamed' and kind = 'core' from public.palette_packs where id = pg_temp.id(10)),
	'draft sets can be renamed and relabeled Core'
) as test;
select public.manage_palette_set(pg_temp.id(10), 'update', 'Renamed', 'reward');
select pg_temp.assert_true(
	(select kind = 'reward' from public.palette_packs where id = pg_temp.id(10))
		and (select
			rewards = (select count(*) from public.reward_palettes)
			and starters = (select count(*) from public.starter_palettes)
			and grants = (select count(*) from public.palette_grants)
			from palette_distribution_baseline),
	'Reward label alone does not create grants, starter offerings, or reward mappings'
) as test;
select public.manage_palette_set(pg_temp.id(11), 'create', 'Pack', 'paid');
insert into public.palette_packs(id, name) values(pg_temp.id(12), 'Legacy pack');
select pg_temp.assert_true(
	(select kind = 'paid' from public.palette_packs where id = pg_temp.id(12)),
	'existing pack inserts retain the paid default'
) as test;
select public.manage_palette_draft('set-a', 'create', 'A', pg_temp.colors());
select public.manage_palette_draft('set-b', 'create', 'B', pg_temp.colors());
select public.manage_palette_draft('set-c', 'create', 'C', pg_temp.colors());
select pg_temp.assert_true(
	public.manage_palette_set(pg_temp.id(10), 'assign', p_palette_ids => array['set-a', 'set-b']) = pg_temp.id(10),
	'admin receives a confirmed assignment ID'
) as test;
select pg_temp.assert_true(
	(select array_agg(palette_id order by position) = array['set-a', 'set-b']
			from public.palette_pack_palettes where pack_id = pg_temp.id(10)),
	'selection order becomes initial member order'
) as test;
select pg_temp.expect_error(
	$$insert into public.palette_pack_palettes(pack_id, palette_id, position) values(pg_temp.id(11), 'set-a', 1)$$,
	'23505', 'exclusive membership is enforced for direct writes'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_set(pg_temp.id(11), 'assign', p_palette_ids => array['set-a', 'set-a'])$$,
	'22023', 'duplicate selection fails'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_set(pg_temp.id(11), 'assign', p_palette_ids => array['set-a', null])$$,
	'22023', 'null palette IDs fail'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_set(pg_temp.id(11), 'assign')$$,
	'22023', 'empty assignment fails'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_set(pg_temp.id(11), 'assign', p_palette_ids => array['set-a', 'missing'])$$,
	'P0002', 'missing palette rejects the entire move'
) as test;
select pg_temp.assert_true(
	exists(select 1 from public.palette_pack_palettes where pack_id = pg_temp.id(10) and palette_id = 'set-a'),
	'failed assignment preserves source membership'
) as test;
select public.manage_palette_set(pg_temp.id(11), 'assign', p_palette_ids => array['set-b', 'set-c']);
select public.manage_palette_set(pg_temp.id(11), 'assign', p_palette_ids => array['set-b', 'set-a']);
select pg_temp.assert_true(
	(select array_agg(palette_id order by position) = array['set-b', 'set-c', 'set-a']
		from public.palette_pack_palettes where pack_id = pg_temp.id(11))
		and not exists(select 1 from public.palette_pack_palettes where pack_id = pg_temp.id(10)),
	'moving preserves destination order and appends new members only'
) as test;
select public.manage_palette_set(pg_temp.id(11), 'reorder', p_palette_ids => array['set-a', 'set-c', 'set-b']);
select pg_temp.assert_true(
	(select array_agg(palette_id order by position) = array['set-a', 'set-c', 'set-b']
		from public.palette_pack_palettes where pack_id = pg_temp.id(11)),
	'reorder replaces positions atomically'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_set(pg_temp.id(11), 'reorder', p_palette_ids => array['set-a', 'set-b'])$$,
	'40001', 'stale reorder cannot drop a newly added member'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_set(pg_temp.id(10), 'remove', p_palette_ids => array['set-a'])$$,
	'40001', 'removing a nonmember fails explicitly'
) as test;
select public.manage_palette_set(pg_temp.id(11), 'remove', p_palette_ids => array['set-c']);
select public.manage_palette_set(pg_temp.id(11), 'assign', p_palette_ids => array['set-c']);
select pg_temp.assert_true(
	(select array_agg(palette_id order by position) = array['set-a', 'set-b', 'set-c']
		from public.palette_pack_palettes where pack_id = pg_temp.id(11)),
	'removal keeps palettes and subsequent assignment appends after remaining positions'
) as test;
select public.manage_palette_draft('set-a', 'update', 'Edited grouped palette', pg_temp.colors(), 'A', pg_temp.colors(), 1);
select pg_temp.assert_true(
	(select name = 'Edited grouped palette' from public.palettes where id = 'set-a'),
	'grouping does not prevent ordinary palette editing'
) as test;
select public.save_hex_puzzle_draft(
	pg_temp.id(20), 'Free puzzle with pack colors', 'collection', 'set-a', 'sm', false, 'easy',
	'{"version":2,"geometry":{"radius":3},"target":{"0,0":0},"pieces":[{"id":"p1","tiles":[{"q":0,"r":0,"color_slot":0}]}]}',
	'palette-set-test', 'hexagon-v2', '{"p1":{"q":0,"r":0}}'
);
select pg_temp.assert_true(
	exists(select 1 from public.puzzles where id = pg_temp.id(20) and palette_id = 'set-a'),
	'pack organization does not restrict puzzle palette use'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.remove_palette('set-a')$$,
	'23514', 'puzzle references still block grouped palette deletion'
) as test;
select pg_temp.assert_true(
	exists(select 1 from public.palette_pack_palettes where palette_id = 'set-a'),
	'failed referenced-palette deletion restores membership'
) as test;
select public.delete_puzzle_draft(pg_temp.id(20));
select pg_temp.expect_error(
	$$select public.delete_palette_draft('set-a', 'Stale', pg_temp.colors(), 1)$$,
	'40001', 'stale grouped deletion fails'
) as test;
select pg_temp.assert_true(
	exists(select 1 from public.palette_pack_palettes where palette_id = 'set-a'),
	'stale deletion restores membership'
) as test;
select pg_temp.assert_true(
	pg_temp.remove_palette('set-a') = 'set-a', 'admin receives a confirmed deletion ID'
) as test;
select pg_temp.assert_true(
	not exists(select 1 from public.palettes where id = 'set-a')
		and not exists(select 1 from public.palette_pack_palettes where palette_id = 'set-a'),
	'confirmed draft palette deletion removes draft membership atomically'
) as test;
select public.manage_palette_set(pg_temp.id(11), 'delete');
select pg_temp.assert_true(
	not exists(select 1 from public.palette_packs where id = pg_temp.id(11))
		and not exists(select 1 from public.palette_pack_palettes where pack_id = pg_temp.id(11))
		and (select count(*) = 2 from public.palettes where id in ('set-b', 'set-c')),
	'set deletion unassigns members but preserves every palette'
) as test;
select public.manage_palette_set(pg_temp.id(10), 'assign', p_palette_ids => array['set-b']);
update public.palettes set published_at = now(), release_at = now() + interval '1 day' where id = 'set-b';
select pg_temp.expect_error(
	$$select pg_temp.remove_palette('set-b')$$, '23514', 'published palette in a draft set cannot be deleted'
) as test;
select pg_temp.assert_true(
	exists(select 1 from public.palette_pack_palettes where palette_id = 'set-b'),
	'published palette failure restores draft membership'
) as test;
select public.manage_palette_set(pg_temp.id(10), 'assign', p_palette_ids => array['set-c']);
update public.palette_packs set published_at = now(), release_at = now() + interval '1 day' where id = pg_temp.id(10);
select pg_temp.expect_error(
	$$select public.manage_palette_set(pg_temp.id(10), 'update', 'Changed', 'core')$$,
	'23514', 'prepared set metadata is read-only'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_set(pg_temp.id(10), 'delete')$$, '23514', 'prepared sets cannot be deleted'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_set(pg_temp.id(10), 'remove', p_palette_ids => array['set-c'])$$,
	'23514', 'prepared set membership is read-only'
) as test;
select pg_temp.expect_error(
	$$select public.manage_palette_set(pg_temp.id(12), 'assign', p_palette_ids => array['set-c'])$$,
	'23514', 'moving out of a prepared set is forbidden'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.remove_palette('set-c')$$, '23514', 'prepared membership protects an unpublished palette'
) as test;
select set_config('request.jwt.claim.sub', pg_temp.id(2)::text, true);
select pg_temp.expect_error(
	$$select public.manage_palette_set(pg_temp.id(13), 'create', 'Player', 'core')$$,
	'42501', 'nonadmin cannot manage sets'
) as test;
select pg_temp.expect_error(
	$$select public.delete_palette_draft('set-c', 'C', pg_temp.colors(), 1)$$,
	'42501', 'nonadmin cannot delete palette drafts'
) as test;
reset role;
set local role anon;
select pg_temp.expect_error(
	$$select public.manage_palette_set(pg_temp.id(13), 'create', 'Guest', 'core')$$,
	'42501', 'guest cannot execute set RPC'
) as test;
select pg_temp.expect_error(
	$$select public.delete_palette_draft('set-c', 'C', pg_temp.colors(), 1)$$,
	'42501', 'guest cannot execute deletion RPC'
) as test;
reset role;

rollback;
