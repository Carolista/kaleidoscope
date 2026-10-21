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
	select ('e8000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.group(p_id integer, p_name text, p_purpose text, p_shape text, p_track text)
returns uuid language sql as $$
	select public.manage_puzzle_group(pg_temp.id(p_id), 'create', p_name, p_purpose, p_shape, p_track);
$$;
create function pg_temp.slot(p_shape text, p_purpose text, p_track text, p_group integer,
	p_palettes text[] default '{}')
returns uuid language sql as $$
	select public.manage_progression_slot(
		p_shape, p_purpose, p_track,
		case when p_group is null then null else pg_temp.id(p_group) end, p_palettes
	);
$$;
create function pg_temp.palettes_of(p_group integer) returns text[] language sql as $$
	select coalesce(array_agg(p.palette_id order by p.palette_id), '{}'::text[])
	from public.reward_palettes p join public.reward_rules r on r.id = p.reward_rule_id
	where r.group_id = pg_temp.id(p_group);
$$;
create function pg_temp.bonus_of(p_group integer) returns uuid[] language sql as $$
	select coalesce(array_agg(l.group_id order by l.group_id), '{}'::uuid[])
	from public.reward_puzzle_groups l join public.reward_rules r on r.id = l.reward_rule_id
	where r.group_id = pg_temp.id(p_group);
$$;
create function pg_temp.ids(variadic p_numbers integer[]) returns uuid[] language sql as $$
	select coalesce(array_agg(pg_temp.id(n) order by pg_temp.id(n)), '{}'::uuid[]) from unnest(p_numbers) as n;
$$;

insert into auth.users(id) values (pg_temp.id(1)), (pg_temp.id(2));
delete from public.admin_account;
insert into public.admin_account(user_id) values (pg_temp.id(1));
-- Set existing slot groups aside for this rolled-back transaction.
-- Links go first: a linked bonus group cannot change its purpose.
delete from public.reward_puzzle_groups;
update public.puzzle_groups set purpose = 'undecided', track = null where purpose in ('core', 'reward');
insert into public.palettes(id, name, colors) select 'slot-' || n, 'Slot ' || n,
	array['#111111','#222222','#333333','#444444','#555555'] from generate_series(1, 4) as n;

select pg_temp.assert_true(
	to_regprocedure('public.manage_progression_slot(text, text, text, uuid, text[])') is not null
	and to_regprocedure('public.manage_group_reward(uuid, text[], uuid[])') is null
	and to_regclass('public.puzzle_groups_reward_slot_idx') is not null,
	'slot tools exist and the older reward tool is replaced'
) as test;

select set_config('request.jwt.claim.sub', pg_temp.id(1)::text, true);
set local role authenticated;
select public.manage_palette_group(pg_temp.id(50), 'create', 'Rewards', 'reward');
select public.manage_palette_group(pg_temp.id(50), 'assign', null, null, array['slot-1', 'slot-2', 'slot-3']);
select public.manage_palette_group(pg_temp.id(51), 'create', 'Sold', 'pack');
select public.manage_palette_group(pg_temp.id(51), 'assign', null, null, array['slot-4']);

select pg_temp.group(10, 'Group A', 'undecided', 'hexagon', null);
select pg_temp.group(11, 'Group B', 'pack', 'hexagon', 'basic');
select pg_temp.group(12, 'Group C', 'undecided', 'hexagon', null);
select pg_temp.group(13, 'Group D (daily)', 'daily', null, null);
select pg_temp.group(14, 'Group E', 'undecided', 'hexagon', null);
select pg_temp.group(15, 'Group F', 'undecided', 'hexagon', null);
select pg_temp.group(16, 'Group G', 'undecided', 'hexagon', null);
select pg_temp.group(17, 'Group H', 'undecided', 'hexagon', null);

-- Filling and replacing a core slot.
select pg_temp.slot('hexagon', 'core', 'basic', 10, array['slot-1']);
select pg_temp.assert_true(
	(select purpose = 'core' and shape_id = 'hexagon' and track = 'basic'
		from public.puzzle_groups where id = pg_temp.id(10))
	and pg_temp.palettes_of(10) = array['slot-1'],
	'a group takes the purpose, shape, and track of the slot and its palette'
) as test;
select pg_temp.slot('hexagon', 'core', 'basic', 10, array['slot-2']);
select pg_temp.assert_true(
	pg_temp.palettes_of(10) = array['slot-2'] and (select count(*) = 1 from public.reward_rules where group_id = pg_temp.id(10)),
	'the palette of a filled slot can change without moving the group'
) as test;
select pg_temp.slot('hexagon', 'core', 'basic', 11, array['slot-3']);
select pg_temp.assert_true(
	(select purpose = 'core' and track = 'basic' from public.puzzle_groups where id = pg_temp.id(11))
	and (select purpose = 'undecided' and track is null and shape_id = 'hexagon'
		from public.puzzle_groups where id = pg_temp.id(10))
	and pg_temp.palettes_of(10) = '{}' and pg_temp.palettes_of(11) = array['slot-3'],
	'a replaced group becomes undecided and loses its reward'
) as test;
select pg_temp.slot('hexagon', 'core', 'basic', null);
select pg_temp.assert_true(
	(select purpose = 'undecided' from public.puzzle_groups where id = pg_temp.id(11))
	and pg_temp.palettes_of(11) = '{}',
	'emptying a slot leaves its group undecided'
) as test;
select pg_temp.slot('hexagon', 'core', 'basic', 13, array['slot-1']);
select pg_temp.assert_true(
	(select purpose = 'core' and shape_id = 'hexagon' and track = 'basic'
		from public.puzzle_groups where id = pg_temp.id(13)),
	'a daily group can fill a slot, taking its shape'
) as test;
select pg_temp.slot('hexagon', 'core', 'basic', null);

-- Errors.
select pg_temp.slot('hexagon', 'core', 'basic', 10, array['slot-1']);
select pg_temp.expect_error(
	$$select pg_temp.slot('hexagon', 'core', 'rotation', 10)$$,
	'23514', 'a group in one slot cannot also fill another'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.slot('hexagon', 'core', 'rotation', 12, array['slot-4'])$$,
	'23514', 'a palette outside the reward palette groups is rejected'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.slot('hexagon', 'core', 'rotation', 12, array['missing'])$$,
	'P0002', 'an unknown palette is rejected'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.slot('hexagon', 'core', 'rotation', 12, array['slot-1', 'slot-1'])$$,
	'22023', 'duplicate palettes are rejected'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.slot('hexagon', 'core', 'rotation', null, array['slot-1'])$$,
	'22023', 'an empty slot cannot award a palette'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.slot('hexagon', 'pack', 'basic', 12)$$,
	'22023', 'only core and reward slots exist'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.slot('square', 'core', 'basic', 12)$$,
	'22023', 'an unknown shape is rejected'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.slot('hexagon', 'core', 'rotation', 99)$$,
	'P0002', 'an unknown group is rejected'
) as test;
select pg_temp.assert_true(
	(select purpose = 'undecided' from public.puzzle_groups where id = pg_temp.id(12)),
	'rejected requests change nothing'
) as test;

-- A group's puzzles must fit the slot, and a rejected move changes nothing.
select public.save_puzzle_draft(
	pg_temp.id(70), 'Rotation puzzle', 'hexagon', 'slot-1', 'md', true, 'hard',
	'{"version":2,"geometry":{"size":4},"target":{"-1,2":0},"pieces":[{"id":"p1","tiles":[{"q":-1,"r":2,"color_slot":0}]}]}',
	'slot-seed', 'hexagon-v2', '{"p1":{"q":0,"r":0}}'
);
select public.manage_puzzle_group(pg_temp.id(17), 'append', null, null, null, null, array[pg_temp.id(70)]);
select pg_temp.expect_error(
	$$select pg_temp.slot('hexagon', 'core', 'basic', 17)$$,
	'23514', 'a group whose puzzles do not fit the track is rejected'
) as test;
select pg_temp.assert_true(
	(select purpose = 'core' from public.puzzle_groups where id = pg_temp.id(10))
	and pg_temp.palettes_of(10) = array['slot-1'],
	'a rejected replacement leaves the current group and reward in place'
) as test;

-- Bonus groups follow the slots automatically.
select pg_temp.slot('hexagon', 'reward', 'basic', 14, array['slot-2']);
select pg_temp.assert_true(
	pg_temp.bonus_of(12) = '{}' and (select count(*) = 0 from public.reward_rules r
		join public.puzzle_groups g on g.id = r.group_id where g.purpose = 'core' and g.track = 'rotation'),
	'with no rotation core group yet, nothing is linked'
) as test;
select pg_temp.slot('hexagon', 'core', 'rotation', 12, array['slot-3']);
select pg_temp.assert_true(
	pg_temp.bonus_of(12) = pg_temp.ids(14) and pg_temp.palettes_of(12) = array['slot-3'],
	'filling the rotation core slot links the existing bonus group'
) as test;
select pg_temp.slot('hexagon', 'reward', 'rotation', 15, array['slot-1']);
select pg_temp.assert_true(
	pg_temp.bonus_of(12) = pg_temp.ids(14, 15),
	'adding the second bonus group links it too'
) as test;
select pg_temp.slot('hexagon', 'reward', 'basic', 16, array['slot-2']);
select pg_temp.assert_true(
	pg_temp.bonus_of(12) = pg_temp.ids(15, 16)
	and (select purpose = 'undecided' from public.puzzle_groups where id = pg_temp.id(14))
	and pg_temp.palettes_of(12) = array['slot-3'],
	'replacing a bonus group relinks the rotation core group and keeps its palette'
) as test;
select pg_temp.slot('hexagon', 'reward', 'rotation', null);
select pg_temp.assert_true(
	pg_temp.bonus_of(12) = pg_temp.ids(16),
	'emptying a bonus slot removes its link'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.group(18, 'Second bonus', 'reward', 'hexagon', 'basic')$$,
	'23505', 'a second bonus group for the same shape and track is rejected'
) as test;
select pg_temp.assert_true(
	pg_temp.group(18, 'Rotation bonus', 'reward', 'hexagon', 'rotation') = pg_temp.id(18),
	'a bonus group created directly in a free slot'
) as test;
select pg_temp.assert_true(
	pg_temp.bonus_of(12) = pg_temp.ids(16, 18),
	'a bonus group created outside the slot tool is linked automatically'
) as test;
select pg_temp.assert_true(
	(select count(*) = 1 from public.reward_rules where group_id = pg_temp.id(12)),
	'the rotation core group keeps a single reward rule'
) as test;

-- Groups with automatic links are changed through their slots.
select pg_temp.expect_error(
	$$select public.manage_puzzle_group(pg_temp.id(12), 'delete', null, null, null, null)$$,
	'23514', 'a rotation core group with links cannot be deleted before its slot is emptied'
) as test;
select pg_temp.expect_error(
	$$select public.manage_puzzle_group(pg_temp.id(16), 'update', 'Group G', 'pack', 'hexagon', 'basic')$$,
	'23514', 'a linked bonus group cannot leave the reward purpose directly'
) as test;
select pg_temp.slot('hexagon', 'core', 'rotation', null);
select pg_temp.assert_true(
	not exists(select 1 from public.reward_rules where group_id = pg_temp.id(12))
	and (select purpose = 'undecided' from public.puzzle_groups where id = pg_temp.id(12)),
	'emptying the rotation core slot removes its rule and links'
) as test;
select pg_temp.slot('hexagon', 'reward', 'basic', null);
select pg_temp.assert_true(
	public.manage_puzzle_group(pg_temp.id(16), 'delete', null, null, null, null) = pg_temp.id(16)
	and public.manage_puzzle_group(pg_temp.id(12), 'delete', null, null, null, null) = pg_temp.id(12),
	'emptied slot groups can be deleted'
) as test;

-- Authorization.
reset role;
select set_config('request.jwt.claim.sub', pg_temp.id(2)::text, true);
set local role authenticated;
select pg_temp.expect_error(
	$$select pg_temp.slot('hexagon', 'core', 'basic', 10)$$,
	'42501', 'regular users cannot manage slots'
) as test;
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select pg_temp.expect_error(
	$$select pg_temp.slot('hexagon', 'core', 'basic', 10)$$,
	'42501', 'guests cannot manage slots'
) as test;
reset role;

-- Published groups are fixed.
select set_config('request.jwt.claim.sub', pg_temp.id(1)::text, true);
update public.palettes set published_at = now(), release_at = now() where id = 'slot-1';
select public.save_puzzle_draft(
	pg_temp.id(71), 'Basic puzzle', 'hexagon', 'slot-1', 'sm', false, 'easy',
	'{"version":2,"geometry":{"size":4},"target":{"-1,2":0},"pieces":[{"id":"p1","tiles":[{"q":-1,"r":2,"color_slot":0}]}]}',
	'slot-seed-2', 'hexagon-v2', '{"p1":{"q":0,"r":0}}'
);
select public.manage_puzzle_group(pg_temp.id(10), 'append', null, null, null, null, array[pg_temp.id(71)]);
update public.puzzles set published_at = now(), release_at = now() where id = pg_temp.id(71);
update public.puzzle_groups set published_at = now(), release_at = now() where id = pg_temp.id(10);
set local role authenticated;
select pg_temp.expect_error(
	$$select pg_temp.slot('hexagon', 'core', 'basic', 11)$$,
	'23514', 'a published group cannot be replaced in its slot'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.slot('hexagon', 'core', 'basic', 10, array['slot-2'])$$,
	'23514', 'a published group keeps its reward'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.slot('hexagon', 'core', 'basic', null)$$,
	'23514', 'a published group cannot be removed from its slot'
) as test;
reset role;

rollback;
