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
	select ('e6000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.puzzle(n integer, p_shape text, p_rotation boolean)
returns uuid language sql as $$
	select public.save_puzzle_draft(
		pg_temp.id(n), 'Puzzle ' || n, p_shape, 'group-test',
		case when p_rotation then 'md' else 'sm' end, p_rotation,
		case when p_rotation then 'hard' else 'easy' end,
		'{"version":2,"geometry":{"size":4},"target":{"-1,2":0},"pieces":[{"id":"p1","tiles":[{"q":-1,"r":2,"color_slot":0}]}]}',
		'group-seed-' || n, p_shape || '-test', '{"p1":{"q":0,"r":0}}'
	);
$$;
create function pg_temp.group(p_id integer, p_action text, p_name text, p_purpose text,
	p_shape text, p_track text, p_puzzles integer[] default '{}')
returns uuid language sql as $$
	select public.manage_puzzle_group(
		pg_temp.id(p_id), p_action, p_name, p_purpose, p_shape, p_track,
		coalesce((select array_agg(pg_temp.id(n)) from unnest(p_puzzles) as n), '{}')
	);
$$;
create function pg_temp.members(p_id integer, p_action text, p_puzzles integer[])
returns uuid language sql as $$
	select public.manage_puzzle_group(
		pg_temp.id(p_id), p_action, null, null, null, null,
		(select array_agg(pg_temp.id(ids.n) order by ids.ord) from unnest(p_puzzles) with ordinality as ids(n, ord))
	);
$$;
create function pg_temp.palette_group(p_id integer, p_action text, p_name text, p_purpose text,
	p_palettes text[] default '{}')
returns uuid language sql as $$
	select public.manage_palette_group(pg_temp.id(p_id), p_action, p_name, p_purpose, p_palettes);
$$;

insert into auth.users(id) values (pg_temp.id(1)), (pg_temp.id(2));
delete from public.admin_account;
insert into public.admin_account(user_id) values (pg_temp.id(1));
insert into public.palettes(id, name, colors) values
	('group-test', 'Group test', array['#111111','#222222','#333333','#444444','#555555']),
	('group-test-2', 'Group test 2', array['#111111','#222222','#333333','#444444','#555555']),
	('group-test-3', 'Group test 3', array['#111111','#222222','#333333','#444444','#555555']);

select pg_temp.assert_true(
	to_regclass('public.puzzle_collections') is null and to_regclass('public.collection_puzzles') is null
	and to_regclass('public.palette_packs') is null and to_regclass('public.palette_pack_palettes') is null
	and to_regclass('public.completion_routes') is null and to_regclass('public.route_puzzles') is null
	and to_regclass('public.set_qualifications') is null and to_regclass('public.core_progression') is null
	and to_regclass('public.core_steps') is null and to_regclass('public.reward_shapes') is null
	and to_regclass('public.starter_palettes') is null and to_regclass('public.starter_shapes') is null
	and to_regclass('public.reward_sets') is null and to_regclass('public.collection_grants') is null,
	'old set, route, core-chain, and starter tables are gone'
) as test;
select pg_temp.assert_true(
	to_regclass('public.puzzle_groups') is not null and to_regclass('public.puzzle_group_members') is not null
	and to_regclass('public.palette_groups') is not null and to_regclass('public.palette_group_members') is not null
	and to_regclass('public.reward_puzzle_groups') is not null and to_regclass('public.puzzle_group_grants') is not null
	and to_regclass('public.group_completions') is not null and to_regclass('public.shape_progression') is not null,
	'group, completion, and progression tables exist'
) as test;
select pg_temp.assert_true(
	not exists(select 1 from information_schema.columns
		where table_schema = 'public' and table_name = 'puzzles' and column_name = 'usage')
	and exists(select 1 from information_schema.columns
		where table_schema = 'public' and table_name = 'puzzles' and column_name = 'palette_id'
			and is_nullable = 'NO'),
	'puzzles drop usage but keep a required palette_id'
) as test;
select pg_temp.assert_true(
	to_regprocedure('public.manage_draft_set(uuid, text, text, text, uuid[], text)') is null
	and to_regprocedure('public.delete_draft_set(uuid)') is null
	and to_regprocedure('public.manage_palette_set(uuid, text, text, text, text[])') is null
	and to_regprocedure('public.manage_puzzle_group(uuid, text, text, text, text, text, uuid[])') is not null
	and to_regprocedure('public.manage_palette_group(uuid, text, text, text, text[])') is not null,
	'set RPCs are replaced by group RPCs'
) as test;
select pg_temp.assert_true(
	(select array_agg(shape_id order by position) from public.shape_progression)
		= array['hexagon', 'triangle', 'diamondStar', 'hexagram', 'circleRings', 'pinwheel'],
	'shape progression is seeded in the default order'
) as test;

-- Authorization.
set local role anon;
select pg_temp.expect_error(
	$$select pg_temp.group(10, 'create', 'Blocked', 'core', 'hexagon', 'basic')$$,
	'42501', 'anonymous callers cannot create puzzle groups'
) as test;
select pg_temp.assert_true(
	(select count(*) from public.shape_progression) = 6,
	'guests can read the shape progression'
) as test;
reset role;
select set_config('request.jwt.claim.sub', pg_temp.id(2)::text, true);
set local role authenticated;
select pg_temp.expect_error(
	$$select pg_temp.group(10, 'create', 'Blocked', 'core', 'hexagon', 'basic')$$,
	'42501', 'regular users cannot create puzzle groups'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.palette_group(10, 'create', 'Blocked', 'core')$$,
	'42501', 'regular users cannot create palette groups'
) as test;
with changed as (update public.shape_progression set position = position + 10 returning 1)
select pg_temp.assert_true(
	(select count(*) = 0 from changed),
	'regular users cannot reorder the shape progression'
) as test;
reset role;
select set_config('request.jwt.claim.sub', pg_temp.id(1)::text, true);
set local role authenticated;

-- Puzzle group validation.
select pg_temp.assert_true(
	pg_temp.group(10, 'create', ' Hex basic core ', 'core', 'hexagon', 'basic') = pg_temp.id(10)
	and pg_temp.group(11, 'create', 'Hex rotation core', 'core', 'hexagon', 'rotation') = pg_temp.id(11)
	and pg_temp.group(12, 'create', 'Hex bonus', 'reward', 'hexagon', 'basic') = pg_temp.id(12)
	and pg_temp.group(13, 'create', 'Hex mixed pack', 'pack', 'hexagon', 'mixed') = pg_temp.id(13)
	and pg_temp.group(14, 'create', 'October', 'daily', null, null) = pg_temp.id(14)
	and pg_temp.group(15, 'create', 'Maybe', 'undecided', 'triangle', null) = pg_temp.id(15),
	'admin creates a group for every puzzle purpose'
) as test;
select pg_temp.assert_true(
	(select name = 'Hex basic core' and purpose = 'core' and shape_id = 'hexagon' and track = 'basic'
		and published_at is null from public.puzzle_groups where id = pg_temp.id(10))
	and (select shape_id is null and track is null from public.puzzle_groups where id = pg_temp.id(14)),
	'groups keep purpose, shape, and track; daily groups have no shape'
) as test;
select pg_temp.assert_true(
	pg_temp.group(10, 'create', 'Hex basic core', 'core', 'hexagon', 'basic') = pg_temp.id(10),
	'identical create retries return the same group'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.group(10, 'create', 'Hex basic core', 'pack', 'hexagon', 'basic')$$,
	'23505', 'a retry with different details cannot overwrite the group'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.group(20, 'create', 'X', 'paid', 'hexagon', 'basic')$$,
	'22023', 'the old paid purpose is rejected'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.group(20, 'create', 'X', 'daily', 'hexagon', null)$$,
	'22023', 'daily groups cannot have a shape'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.group(20, 'create', 'X', 'core', null, 'basic')$$,
	'22023', 'non-daily groups require a shape'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.group(20, 'create', 'X', 'core', 'square', 'basic')$$,
	'22023', 'unknown shapes are rejected'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.group(20, 'create', 'X', 'core', 'hexagon', 'mixed')$$,
	'22023', 'core groups cannot be mixed'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.group(20, 'create', 'X', 'reward', 'hexagon', null)$$,
	'22023', 'reward groups require a track'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.group(20, 'create', 'X', 'undecided', 'hexagon', 'basic')$$,
	'22023', 'undecided groups have no track'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.group(20, 'create', ' ', 'core', 'hexagon', 'basic')$$,
	'22023', 'a group name is required'
) as test;
select pg_temp.expect_error(
	$$insert into public.puzzle_groups(name, purpose, shape_id, track) values ('Direct', 'core', 'hexagon', 'mixed')$$,
	'23514', 'the table rejects an invalid purpose and track combination'
) as test;
select pg_temp.expect_error(
	$$insert into public.puzzle_groups(name, purpose, shape_id, track) values ('Direct', 'daily', 'hexagon', null)$$,
	'23514', 'the table rejects a shaped daily group'
) as test;

-- Membership follows shape and track.
select pg_temp.assert_true(
	pg_temp.puzzle(30, 'hexagon', false) is not null and pg_temp.puzzle(31, 'hexagon', false) is not null
	and pg_temp.puzzle(32, 'hexagon', true) is not null and pg_temp.puzzle(33, 'hexagon', true) is not null
	and pg_temp.puzzle(34, 'triangle', false) is not null and pg_temp.puzzle(35, 'pinwheel', true) is not null
	and pg_temp.puzzle(36, 'hexagon', false) is not null and pg_temp.puzzle(37, 'hexagon', true) is not null
	and pg_temp.puzzle(38, 'hexagon', false) is not null and pg_temp.puzzle(39, 'hexagon', false) is not null,
	'admin saves puzzles with their palette and no intended use'
) as test;
select pg_temp.assert_true(
	(select palette_id = 'group-test' from public.puzzles where id = pg_temp.id(30)),
	'a puzzle stores its palette'
) as test;
select pg_temp.members(10, 'append', array[30, 31]);
select pg_temp.assert_true(
	(select array_agg(puzzle_id order by position) from public.puzzle_group_members
		where group_id = pg_temp.id(10)) = array[pg_temp.id(30), pg_temp.id(31)],
	'a basic group accepts basic puzzles of its shape in order'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.members(10, 'append', array[32])$$,
	'23514', 'a basic group rejects a rotation puzzle'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.members(11, 'append', array[36])$$,
	'23514', 'a rotation group rejects a basic puzzle'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.members(11, 'append', array[34])$$,
	'23514', 'a group rejects another shape''s puzzle'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.members(11, 'append', array[30])$$,
	'23514', 'a puzzle cannot join two groups'
) as test;
select pg_temp.assert_true(
	pg_temp.members(11, 'append', array[32, 33]) = pg_temp.id(11),
	'a rotation group accepts rotation puzzles'
) as test;
select pg_temp.assert_true(
	pg_temp.members(13, 'append', array[36, 37]) = pg_temp.id(13),
	'a mixed pack accepts basic and rotation puzzles'
) as test;
select pg_temp.assert_true(
	pg_temp.members(14, 'append', array[34, 35]) = pg_temp.id(14),
	'a daily group mixes shapes'
) as test;
select pg_temp.members(10, 'reorder', array[31, 30]);
select pg_temp.assert_true(
	(select array_agg(puzzle_id order by position) from public.puzzle_group_members
		where group_id = pg_temp.id(10)) = array[pg_temp.id(31), pg_temp.id(30)],
	'members reorder'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.members(10, 'reorder', array[30])$$,
	'23514', 'a stale reorder is rejected'
) as test;
select pg_temp.members(10, 'remove', array[31]);
select pg_temp.assert_true(
	(select array_agg(puzzle_id order by position) from public.puzzle_group_members
		where group_id = pg_temp.id(10)) = array[pg_temp.id(30)]
	and (select position = 1 from public.puzzle_group_members where puzzle_id = pg_temp.id(30)),
	'removing a member keeps positions contiguous'
) as test;

-- Updating purpose, shape, and track is checked against members.
select pg_temp.group(15, 'update', 'Decided pack', 'pack', 'triangle', 'basic');
select pg_temp.assert_true(
	(select purpose = 'pack' and track = 'basic' and name = 'Decided pack'
		from public.puzzle_groups where id = pg_temp.id(15)),
	'an undecided group can be given a purpose and track'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.group(10, 'update', 'Hex basic core', 'core', 'hexagon', 'rotation')$$,
	'23514', 'a track cannot change to one the members violate'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.group(10, 'update', 'Hex basic core', 'core', 'triangle', 'basic')$$,
	'23514', 'a shape cannot change to one the members violate'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.group(13, 'update', 'Hex mixed pack', 'core', 'hexagon', 'basic')$$,
	'23514', 'a mixed pack cannot become a basic core group'
) as test;

-- Puzzle edits keep the palette on the puzzle and respect group tracks.
select public.edit_puzzle_draft(pg_temp.id(30), 'Renamed', 'group-test-2');
select pg_temp.assert_true(
	(select name = 'Renamed' and palette_id = 'group-test-2' from public.puzzles where id = pg_temp.id(30)),
	'editing a puzzle changes its stored palette'
) as test;
select public.bulk_puzzle_drafts(array[pg_temp.id(38), pg_temp.id(39)], 'palette', 'group-test-3');
select pg_temp.assert_true(
	(select count(*) = 2 from public.puzzles
		where id in (pg_temp.id(38), pg_temp.id(39)) and palette_id = 'group-test-3'),
	'bulk palette changes are stored on the puzzles'
) as test;
select pg_temp.expect_error(
	$$select public.replace_puzzle_draft(pg_temp.id(30), 'Replaced', 'hexagon', 'group-test', 'md', true, 'hard',
		'{"version":2,"geometry":{"size":7},"target":{"-1,2":1},"pieces":[{"id":"p2","tiles":[{"q":-1,"r":2,"color_slot":1}]}]}',
		'replacement-seed', 'hexagon-test', '{"p2":{"q":0,"r":0,"rotation":1}}')$$,
	'23514', 'replacing an assigned puzzle with a rotation recipe violates a basic track'
) as test;
select public.replace_puzzle_draft(pg_temp.id(30), 'Replaced', 'hexagon', 'group-test', 'md', false, 'moderate',
	'{"version":2,"geometry":{"size":7},"target":{"-1,2":1},"pieces":[{"id":"p2","tiles":[{"q":-1,"r":2,"color_slot":1}]}]}',
	'replacement-seed', 'hexagon-test', '{"p2":{"q":0,"r":0,"rotation":1}}');
select pg_temp.assert_true(
	(select palette_id = 'group-test' and board_size = 'md' from public.puzzles where id = pg_temp.id(30))
	and exists(select 1 from public.puzzle_group_members
		where puzzle_id = pg_temp.id(30) and group_id = pg_temp.id(10)),
	'a same-track replacement keeps the group membership'
) as test;
select pg_temp.expect_error(
	$$select public.delete_puzzle_draft(pg_temp.id(30))$$,
	'23514', 'assigned puzzles cannot be deleted'
) as test;
select public.delete_puzzle_draft(pg_temp.id(39));
select pg_temp.assert_true(
	not exists(select 1 from public.puzzles where id = pg_temp.id(39)),
	'unassigned puzzles can be deleted'
) as test;
select pg_temp.expect_error(
	$$select public.bulk_delete_palette_drafts(array['group-test-3'])$$,
	'23514', 'a palette used by a puzzle cannot be deleted'
) as test;

-- Group deletion and dependencies.
select pg_temp.group(16, 'create', 'Temp', 'pack', 'hexagon', 'basic');
select pg_temp.members(16, 'append', array[38]);
select pg_temp.assert_true(
	(select count(*) = 1 from public.puzzle_group_members where group_id = pg_temp.id(16)),
	'a group holds its appended puzzles'
) as test;
select pg_temp.group(16, 'delete', null, null, null, null);
select pg_temp.assert_true(
	not exists(select 1 from public.puzzle_groups where id = pg_temp.id(16))
	and exists(select 1 from public.puzzles where id = pg_temp.id(38))
	and not exists(select 1 from public.puzzle_group_members where puzzle_id = pg_temp.id(38)),
	'deleting a group unassigns its puzzles without deleting them'
) as test;
insert into public.reward_rules(id, group_id) values (pg_temp.id(300), pg_temp.id(11));
select pg_temp.expect_error(
	$$insert into public.reward_puzzle_groups(reward_rule_id, group_id) values (pg_temp.id(300), pg_temp.id(13))$$,
	'23514', 'bonus rewards must be reward groups'
) as test;
insert into public.reward_puzzle_groups(reward_rule_id, group_id) values (pg_temp.id(300), pg_temp.id(12));
select pg_temp.expect_error(
	$$select pg_temp.group(12, 'update', 'Hex bonus', 'pack', 'hexagon', 'basic')$$,
	'23514', 'a group used as a bonus reward keeps its purpose'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.group(11, 'delete', null, null, null, null)$$,
	'23514', 'a group with reward rules cannot be deleted'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.group(11, 'update', 'Hex rotation core', 'pack', 'hexagon', 'rotation')$$,
	'23514', 'a group with reward rules cannot change purpose'
) as test;

-- Palette groups.
select pg_temp.assert_true(
	pg_temp.palette_group(50, 'create', ' Core palettes ', 'core') = pg_temp.id(50)
	and pg_temp.palette_group(51, 'create', 'Reward palettes', 'reward') = pg_temp.id(51)
	and pg_temp.palette_group(52, 'create', 'Palette pack', 'pack') = pg_temp.id(52)
	and pg_temp.palette_group(53, 'create', 'Maybe palettes', 'undecided') = pg_temp.id(53),
	'admin creates a group for every palette purpose'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.palette_group(54, 'create', 'Daily palettes', 'daily')$$,
	'22023', 'palette groups cannot be daily'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.palette_group(54, 'create', 'Old', 'paid')$$,
	'22023', 'the old paid purpose is rejected for palette groups'
) as test;
select pg_temp.expect_error(
	$$insert into public.palette_groups(name, purpose) values ('Direct', 'daily')$$,
	'23514', 'the table rejects a daily palette group'
) as test;
select pg_temp.palette_group(52, 'assign', null, null, array['group-test', 'group-test-2']);
select pg_temp.assert_true(
	(select array_agg(palette_id order by position) from public.palette_group_members
		where group_id = pg_temp.id(52)) = array['group-test', 'group-test-2'],
	'palettes join a palette group in order'
) as test;
select pg_temp.palette_group(50, 'assign', null, null, array['group-test']);
select pg_temp.assert_true(
	(select group_id = pg_temp.id(50) from public.palette_group_members where palette_id = 'group-test')
	and (select count(*) = 1 from public.palette_group_members where group_id = pg_temp.id(52)),
	'palette membership is exclusive; assigning moves the palette'
) as test;
select pg_temp.palette_group(52, 'assign', null, null, array['group-test-3']);
select pg_temp.palette_group(52, 'reorder', null, null, array['group-test-3', 'group-test-2']);
select pg_temp.assert_true(
	(select array_agg(palette_id order by position) from public.palette_group_members
		where group_id = pg_temp.id(52)) = array['group-test-3', 'group-test-2'],
	'palette groups reorder'
) as test;
select pg_temp.palette_group(52, 'remove', null, null, array['group-test-2']);
select pg_temp.palette_group(53, 'update', 'Decided palettes', 'pack');
select pg_temp.assert_true(
	(select purpose = 'pack' from public.palette_groups where id = pg_temp.id(53))
	and (select array_agg(palette_id) from public.palette_group_members
		where group_id = pg_temp.id(52)) = array['group-test-3'],
	'palette groups remove members and change purpose'
) as test;
select pg_temp.palette_group(53, 'delete', null, null);
select pg_temp.assert_true(
	not exists(select 1 from public.palette_groups where id = pg_temp.id(53)),
	'palette groups delete'
) as test;

-- Daily assignments and publication (prepared as the database owner).
reset role;
update public.palettes set published_at = now(), release_at = now()
	where id in ('group-test', 'group-test-2', 'group-test-3');
select pg_temp.assert_true(
	pg_temp.group(17, 'create', 'Undecided hex', 'undecided', 'hexagon', null) = pg_temp.id(17),
	'owner can still create groups'
) as test;
select pg_temp.expect_error(
	$$update public.puzzle_groups set published_at = now(), release_at = now() where id = pg_temp.id(17)$$,
	'23514', 'an undecided group cannot be published'
) as test;
select pg_temp.expect_error(
	$$update public.puzzle_groups set published_at = now(), release_at = now() where id = pg_temp.id(10)$$,
	'23514', 'a group cannot be published before its puzzles'
) as test;
update public.puzzles set published_at = now(), release_at = now()
	where id in (pg_temp.id(34), pg_temp.id(35), pg_temp.id(36), pg_temp.id(37));
insert into public.daily_schedule(rollover_time_utc) values ('00:00');
select pg_temp.expect_error(
	$$insert into public.daily_puzzles(puzzle_id, release_at, expires_at)
		values (pg_temp.id(36), '2099-01-01 00:00+00', '2099-01-06 00:00+00')$$,
	'23514', 'a daily assignment requires a puzzle from a daily group'
) as test;
with scheduled as (
	insert into public.daily_puzzles(puzzle_id, release_at, expires_at) values
		(pg_temp.id(34), '2099-01-01 00:00+00', '2099-01-06 00:00+00'),
		(pg_temp.id(35), '2099-01-02 00:00+00', '2099-01-07 00:00+00')
	returning 1
)
select pg_temp.assert_true(
	(select count(*) = 2 from scheduled),
	'daily groups supply puzzles of different shapes for scheduling'
) as test;
select set_config('request.jwt.claim.sub', pg_temp.id(1)::text, true);
set local role authenticated;
select pg_temp.expect_error(
	$$select pg_temp.members(14, 'remove', array[34])$$,
	'23514', 'scheduled daily puzzles cannot be unassigned'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.group(14, 'update', 'October', 'pack', 'hexagon', 'mixed')$$,
	'23514', 'a group with scheduled puzzles cannot change'
) as test;
reset role;

-- Access: the first shape is open; later shapes unlock by completing a core group of the previous shape.
select pg_temp.assert_true(
	pg_temp.puzzle(40, 'hexagon', false) is not null and pg_temp.puzzle(41, 'triangle', false) is not null
	and pg_temp.group(18, 'create', 'Hex core', 'core', 'hexagon', 'basic') is not null
	and pg_temp.group(19, 'create', 'Triangle core', 'core', 'triangle', 'basic') is not null
	and pg_temp.members(18, 'append', array[40]) is not null
	and pg_temp.members(19, 'append', array[41]) is not null,
	'core groups and puzzles are prepared for two shapes'
) as test;
update public.puzzles set published_at = now(), release_at = now()
	where id in (pg_temp.id(40), pg_temp.id(41));
update public.puzzle_groups set published_at = now(), release_at = now()
	where id in (pg_temp.id(13), pg_temp.id(18), pg_temp.id(19));

select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select pg_temp.assert_true(
	(select count(*) from public.puzzle_groups where id in (pg_temp.id(13), pg_temp.id(18), pg_temp.id(19))) = 3
	and (select count(*) from public.puzzles where id = pg_temp.id(40)) = 1
	and (select count(*) from public.puzzles where id = pg_temp.id(41)) = 0
	and (select count(*) from public.puzzles where id = pg_temp.id(36)) = 0,
	'guests play the first shape''s core group but not later shapes or packs'
) as test;
reset role;
select set_config('request.jwt.claim.sub', pg_temp.id(2)::text, true);
set local role authenticated;
select pg_temp.assert_true(
	(select count(*) from public.puzzles where id = pg_temp.id(40)) = 1
	and (select count(*) from public.puzzles where id = pg_temp.id(41)) = 0
	and (select count(*) from public.puzzles where id = pg_temp.id(36)) = 0,
	'players cannot play a later shape or an unowned pack before earning it'
) as test;
reset role;
insert into public.group_completions(user_id, group_id) values (pg_temp.id(2), pg_temp.id(18));
set local role authenticated;
select pg_temp.assert_true(
	(select count(*) from public.puzzles where id = pg_temp.id(41)) = 1
	and (select count(*) from public.group_completions) = 1,
	'completing a core group unlocks the next shape''s core puzzles and is visible to its player'
) as test;
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select pg_temp.assert_true(
	(select count(*) from public.puzzles where id = pg_temp.id(41)) = 0,
	'another player''s completion does not unlock the shape for guests'
) as test;
reset role;
insert into public.puzzle_group_grants(user_id, group_id, source)
	values (pg_temp.id(2), pg_temp.id(13), 'admin');
select set_config('request.jwt.claim.sub', pg_temp.id(2)::text, true);
set local role authenticated;
select pg_temp.assert_true(
	(select count(*) from public.puzzles where id in (pg_temp.id(36), pg_temp.id(37))) = 2,
	'a granted pack plays once its shape is unlocked'
) as test;
reset role;

rollback;
