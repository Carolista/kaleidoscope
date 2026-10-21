begin;
set local timezone = 'UTC';

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
	select ('e7000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.group(p_id integer, p_name text, p_purpose text, p_shape text, p_track text)
returns uuid language sql as $$
	select public.manage_puzzle_group(pg_temp.id(p_id), 'create', p_name, p_purpose, p_shape, p_track);
$$;
create function pg_temp.reward(p_id integer, p_palettes text[], p_bonus integer[] default '{}')
returns uuid language sql as $$
	select public.manage_group_reward(
		pg_temp.id(p_id), p_palettes,
		coalesce((select array_agg(pg_temp.id(n)) from unnest(p_bonus) as n), '{}')
	);
$$;
create function pg_temp.order_ids() returns text[] language sql as $$
	select array_agg(shape_id order by position) from public.shape_progression;
$$;

insert into auth.users(id) values (pg_temp.id(1)), (pg_temp.id(2));
delete from public.admin_account;
insert into public.admin_account(user_id) values (pg_temp.id(1));
-- Real core groups would collide with the fixtures below; set them aside for this
-- transaction, which is rolled back at the end.
update public.puzzle_groups set purpose = 'undecided', track = null where purpose = 'core';
insert into public.palettes(id, name, colors) select 'prog-' || n, 'Prog ' || n,
	array['#111111','#222222','#333333','#444444','#555555'] from generate_series(1, 4) as n;

select pg_temp.assert_true(
	to_regprocedure('public.manage_shape_progression(text[])') is not null
	and to_regprocedure('public.manage_group_reward(uuid, text[], uuid[])') is not null
	and to_regclass('public.puzzle_groups_core_slot_idx') is not null,
	'progression tools exist'
) as test;

-- Palette groups: prog-1 and prog-2 are reward palettes; prog-3 is sold in a pack.
select set_config('request.jwt.claim.sub', pg_temp.id(1)::text, true);
set local role authenticated;
select public.manage_palette_group(pg_temp.id(50), 'create', 'Rewards', 'reward');
select public.manage_palette_group(pg_temp.id(50), 'assign', null, null, array['prog-1', 'prog-2']);
select public.manage_palette_group(pg_temp.id(51), 'create', 'Sold', 'pack');
select public.manage_palette_group(pg_temp.id(51), 'assign', null, null, array['prog-3']);

-- One core group per shape and track.
select pg_temp.assert_true(
	pg_temp.group(10, 'Hex basic', 'core', 'hexagon', 'basic') = pg_temp.id(10)
	and pg_temp.group(11, 'Hex rotation', 'core', 'hexagon', 'rotation') = pg_temp.id(11)
	and pg_temp.group(12, 'Tri basic', 'core', 'triangle', 'basic') = pg_temp.id(12),
	'a basic and a rotation core group exist for a shape'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.group(13, 'Another hex basic', 'core', 'hexagon', 'basic')$$,
	'23505', 'a second core group for the same shape and track is rejected'
) as test;
select pg_temp.assert_true(
	pg_temp.group(14, 'Hex basic bonus', 'reward', 'hexagon', 'basic') = pg_temp.id(14)
	and pg_temp.group(15, 'Hex rotation bonus', 'reward', 'hexagon', 'rotation') = pg_temp.id(15)
	and pg_temp.group(16, 'Hex basic pack', 'pack', 'hexagon', 'basic') = pg_temp.id(16)
	and pg_temp.group(17, 'Second hex basic bonus', 'reward', 'hexagon', 'basic') = pg_temp.id(17)
	and pg_temp.group(18, 'Undecided', 'undecided', 'hexagon', null) = pg_temp.id(18),
	'only core groups are limited to one per shape and track'
) as test;
select pg_temp.expect_error(
	$$select public.manage_puzzle_group(pg_temp.id(16), 'update', 'Hex basic pack', 'core', 'hexagon', 'basic')$$,
	'23505', 'turning a group into a duplicate core group is rejected'
) as test;
select pg_temp.expect_error(
	$$select public.manage_puzzle_group(pg_temp.id(10), 'update', 'Hex basic', 'core', 'hexagon', 'rotation')$$,
	'23505', 'moving a core group onto a taken track is rejected'
) as test;
select pg_temp.assert_true(
	public.manage_puzzle_group(pg_temp.id(10), 'update', 'Hex basic renamed', 'core', 'hexagon', 'basic') = pg_temp.id(10),
	'a core group can still be renamed'
) as test;

-- Rewards.
select pg_temp.assert_true(
	pg_temp.reward(10, array['prog-1']) = pg_temp.id(10), 'a core group is given a palette reward'
) as test;
select pg_temp.assert_true(
	(select array_agg(palette_id) from public.reward_palettes p
		join public.reward_rules r on r.id = p.reward_rule_id where r.group_id = pg_temp.id(10)) = array['prog-1']
	and (select count(*) = 1 from public.reward_rules where group_id = pg_temp.id(10)),
	'the reward is stored as one rule with its palette'
) as test;
select pg_temp.reward(10, array['prog-1']);
select pg_temp.assert_true(
	(select count(*) = 1 from public.reward_rules where group_id = pg_temp.id(10)),
	'repeating a reward request keeps a single rule'
) as test;
select pg_temp.reward(10, array['prog-2']);
select pg_temp.assert_true(
	(select array_agg(palette_id) from public.reward_palettes p
		join public.reward_rules r on r.id = p.reward_rule_id where r.group_id = pg_temp.id(10)) = array['prog-2'],
	'changing a reward replaces its palette'
) as test;
select pg_temp.reward(11, array['prog-1'], array[14, 15]);
select pg_temp.assert_true(
	(select count(*) = 2 from public.reward_puzzle_groups p
		join public.reward_rules r on r.id = p.reward_rule_id where r.group_id = pg_temp.id(11)),
	'a rotation core group awards a palette and two bonus groups'
) as test;
select pg_temp.assert_true(
	pg_temp.reward(14, array['prog-2']) = pg_temp.id(14)
	and pg_temp.reward(15, array['prog-1']) = pg_temp.id(15),
	'bonus groups award palettes'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.reward(10, array['prog-3'])$$,
	'23514', 'a palette outside the reward palette groups is rejected'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.reward(10, array['prog-4'])$$,
	'23514', 'a palette in no group is rejected'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.reward(10, array['missing'])$$,
	'P0002', 'an unknown palette is rejected'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.reward(11, array['prog-1'], array[16])$$,
	'23514', 'a pack cannot be a bonus reward'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.reward(14, array['prog-1'], array[14])$$,
	'23514', 'a group cannot reward itself'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.reward(16, array['prog-1'])$$,
	'23514', 'only core and reward groups award rewards'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.reward(10, array['prog-1', 'prog-1'])$$,
	'22023', 'duplicate palettes are rejected'
) as test;
select pg_temp.expect_error(
	$$select public.manage_group_reward(pg_temp.id(10), null, '{}')$$,
	'22023', 'null lists are rejected'
) as test;
select pg_temp.expect_error(
	$$select public.manage_group_reward(pg_temp.id(99), array['prog-1'], '{}')$$,
	'P0002', 'an unknown group is rejected'
) as test;
select pg_temp.reward(15, '{}');
select pg_temp.assert_true(
	not exists(select 1 from public.reward_rules where group_id = pg_temp.id(15)),
	'empty lists remove the reward rule'
) as test;
select pg_temp.assert_true(
	pg_temp.reward(15, '{}') = pg_temp.id(15),
	'clearing an empty reward is harmless'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.group(14, 'Hex basic bonus', 'core', 'hexagon', 'basic')$$,
	'23505', 'a rewarded bonus group cannot be recreated differently'
) as test;
select pg_temp.expect_error(
	$$select public.manage_puzzle_group(pg_temp.id(14), 'update', 'Hex basic bonus', 'pack', 'hexagon', 'basic')$$,
	'23514', 'a group that is a bonus reward keeps the reward purpose'
) as test;

-- Authorization.
reset role;
select set_config('request.jwt.claim.sub', pg_temp.id(2)::text, true);
set local role authenticated;
select pg_temp.expect_error(
	$$select pg_temp.reward(10, array['prog-1'])$$,
	'42501', 'regular users cannot change rewards'
) as test;
select pg_temp.expect_error(
	$$select public.manage_shape_progression(array['hexagon','triangle','diamondStar','hexagram','circleRings','pinwheel'])$$,
	'42501', 'regular users cannot order the shapes'
) as test;
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select pg_temp.expect_error(
	$$select pg_temp.reward(10, array['prog-1'])$$,
	'42501', 'guests cannot change rewards'
) as test;
reset role;

-- Shape order.
select set_config('request.jwt.claim.sub', pg_temp.id(1)::text, true);
set local role authenticated;
select pg_temp.assert_true(
	public.manage_shape_progression(pg_temp.order_ids()) = pg_temp.order_ids(),
	'repeating the current order is accepted'
) as test;
select public.manage_shape_progression(
	array['triangle', 'hexagon', 'diamondStar', 'hexagram', 'circleRings', 'pinwheel']
);
select pg_temp.assert_true(
	pg_temp.order_ids() = array['triangle', 'hexagon', 'diamondStar', 'hexagram', 'circleRings', 'pinwheel'],
	'the shapes can be reordered'
) as test;
select pg_temp.expect_error(
	$$select public.manage_shape_progression(array['hexagon', 'triangle'])$$,
	'40001', 'an order that omits a shape is rejected'
) as test;
select pg_temp.expect_error(
	$$select public.manage_shape_progression(array['hexagon','hexagon','diamondStar','hexagram','circleRings','pinwheel'])$$,
	'22023', 'an order that repeats a shape is rejected'
) as test;
select pg_temp.expect_error(
	$$select public.manage_shape_progression(null)$$,
	'22023', 'a null order is rejected'
) as test;
select pg_temp.expect_error(
	$$select public.manage_shape_progression(array['hexagon','triangle','diamondStar','hexagram','circleRings','square'])$$,
	'40001', 'an unknown shape is rejected'
) as test;
reset role;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_true(
	private.has_shape('triangle') and not private.has_shape('hexagon'),
	'the first shape in the order is the one open to everyone'
) as test;
select set_config('request.jwt.claim.sub', pg_temp.id(2)::text, true);
select pg_temp.assert_true(
	not private.has_shape('hexagon'), 'a later shape is closed until the previous one is completed'
) as test;
insert into public.group_completions(user_id, group_id) values (pg_temp.id(2), pg_temp.id(12));
select pg_temp.assert_true(
	private.has_shape('hexagon'), 'completing a core group of the first shape opens the next in the order'
) as test;
select pg_temp.assert_true(
	not private.has_shape('diamondStar'), 'the shape after that stays closed'
) as test;

-- Publishing a core group locks the order and its rewards.
update public.palettes set published_at = now(), release_at = now() where id in ('prog-1', 'prog-2');
select set_config('request.jwt.claim.sub', pg_temp.id(1)::text, true);
select public.save_puzzle_draft(
	pg_temp.id(70), 'Core puzzle', 'hexagon', 'prog-1', 'sm', false, 'easy',
	'{"version":2,"geometry":{"size":4},"target":{"-1,2":0},"pieces":[{"id":"p1","tiles":[{"q":-1,"r":2,"color_slot":0}]}]}',
	'prog-seed', 'hexagon-v2', '{"p1":{"q":0,"r":0}}'
);
select public.manage_puzzle_group(pg_temp.id(10), 'append', null, null, null, null, array[pg_temp.id(70)]);
update public.puzzles set published_at = now(), release_at = now() where id = pg_temp.id(70);
update public.puzzle_groups set published_at = now(), release_at = now() where id = pg_temp.id(10);
set local role authenticated;
select pg_temp.expect_error(
	$$select public.manage_shape_progression(array['hexagon','triangle','diamondStar','hexagram','circleRings','pinwheel'])$$,
	'23514', 'the shape order is locked once a core group is published'
) as test;
select pg_temp.assert_true(
	public.manage_shape_progression(pg_temp.order_ids()) = pg_temp.order_ids(),
	'an unchanged order is still accepted after the lock'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.reward(10, array['prog-2'])$$,
	'23514', 'a published group keeps its reward'
) as test;
select pg_temp.assert_true(
	pg_temp.reward(11, array['prog-2'], array[14, 15]) = pg_temp.id(11),
	'an unpublished group can still change its reward'
) as test;
reset role;

rollback;
