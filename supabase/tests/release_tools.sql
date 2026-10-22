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
	select ('ea000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.group(p_id integer, p_name text, p_purpose text, p_shape text, p_track text)
returns uuid language sql as $$
	select public.manage_puzzle_group(pg_temp.id(p_id), 'create', p_name, p_purpose, p_shape, p_track);
$$;
create function pg_temp.slot(p_purpose text, p_track text, p_group integer, p_palettes text[])
returns uuid language sql as $$
	select public.manage_progression_slot('hexagon', p_purpose, p_track, pg_temp.id(p_group), p_palettes);
$$;
-- Saves p_count puzzles and puts them in the group.
create function pg_temp.fill(p_group integer, p_palette text, p_rotation boolean, p_count integer)
returns integer language plpgsql as $$
declare
	ids uuid[];
begin
	for n in 1..p_count loop
		perform public.save_puzzle_draft(
			pg_temp.id(1000 + p_group * 100 + n), 'Puzzle ' || p_group || '-' || n, 'hexagon', p_palette,
			case when p_rotation then 'md' else 'sm' end, p_rotation,
			case when p_rotation then 'hard' else 'easy' end,
			'{"version":2,"geometry":{"size":4},"target":{"-1,2":0},"pieces":[{"id":"p1","tiles":[{"q":-1,"r":2,"color_slot":0}]}]}',
			'release-seed-' || p_group || '-' || n, 'hexagon-v2', '{"p1":{"q":0,"r":0}}'
		);
		ids := ids || pg_temp.id(1000 + p_group * 100 + n);
	end loop;
	perform public.manage_puzzle_group(pg_temp.id(p_group), 'append', null, null, null, null, ids);
	return p_count;
end;
$$;
create function pg_temp.plan(p_action text, p_kind text, p_id uuid, p_at timestamptz default null)
returns jsonb language sql as $$
	select public.preview_release(p_action, p_kind, p_id::text, p_at);
$$;
create function pg_temp.apply(p_action text, p_kind text, p_id uuid, p_at timestamptz default null)
returns jsonb language sql as $$
	select public.apply_release(p_action, p_kind, p_id::text, p_at);
$$;
create function pg_temp.changes(p_plan jsonb, p_kind text, p_change text) returns bigint language sql as $$
	select count(*) from jsonb_array_elements(p_plan -> 'items') i
	where i ->> 'kind' = p_kind and i ->> 'change' = p_change;
$$;
create function pg_temp.has_text(p_list jsonb, p_fragment text) returns boolean language sql as $$
	select exists(select 1 from jsonb_array_elements_text(p_list) t where t like '%' || p_fragment || '%');
$$;
create function pg_temp.state(p_table text, p_id text) returns text language plpgsql as $$
declare
	result text;
begin
	execute format(
		'select case when published_at is null then ''draft'' when release_at > clock_timestamp() then ''scheduled'' else ''live'' end
		 from public.%I where id::text = $1', p_table) into result using p_id;
	return result;
end;
$$;

insert into auth.users(id) values (pg_temp.id(1)), (pg_temp.id(2));
delete from public.admin_account;
insert into public.admin_account(user_id) values (pg_temp.id(1));
-- Set existing slot groups aside for this rolled-back transaction.
delete from public.reward_puzzle_groups;
update public.puzzle_groups set purpose = 'undecided', track = null where purpose in ('core', 'reward');
insert into public.palettes(id, name, colors) select id, id, array['#111111','#222222','#333333','#444444','#555555']
	from unnest(array['puz-a','puz-b','orphan','daily-only','rw-1','rw-2','rw-3','rw-4','rw-5','rw-6']) as id;

select set_config('request.jwt.claim.sub', pg_temp.id(1)::text, true);
set local role authenticated;

select public.manage_palette_group(pg_temp.id(50), 'create', 'Rewards', 'reward');
select public.manage_palette_group(pg_temp.id(50), 'assign', null, null,
	array['rw-1','rw-2','rw-3','rw-4','rw-5','rw-6']);
select public.manage_palette_group(pg_temp.id(51), 'create', 'Pack', 'pack');
select public.manage_palette_group(pg_temp.id(51), 'assign', null, null, array['puz-a','puz-b','daily-only']);
select public.manage_palette_group(pg_temp.id(52), 'create', 'Short rewards', 'reward');
select public.manage_palette_group(pg_temp.id(52), 'assign', null, null, array['orphan']);

select pg_temp.group(10, 'Core basic', 'undecided', 'hexagon', null);
select pg_temp.group(11, 'Bonus basic', 'undecided', 'hexagon', null);
select pg_temp.group(12, 'Core rotation', 'undecided', 'hexagon', null);
select pg_temp.group(13, 'Bonus rotation', 'undecided', 'hexagon', null);
select pg_temp.group(14, 'Daily month', 'daily', null, null);
select pg_temp.group(15, 'Short core', 'undecided', 'hexagon', null);
select pg_temp.fill(10, 'puz-a', false, 24);
select pg_temp.fill(11, 'puz-a', false, 24);
select pg_temp.fill(12, 'puz-b', true, 24);
select pg_temp.fill(13, 'puz-b', true, 24);
select pg_temp.fill(14, 'daily-only', false, 26);
select pg_temp.fill(15, 'puz-a', false, 23);
select pg_temp.slot('core', 'basic', 10, array['rw-1']);

select pg_temp.assert_true(
	to_regprocedure('public.preview_release(text, text, text, timestamptz)') is not null
	and to_regprocedure('public.apply_release(text, text, text, timestamptz)') is not null,
	'release tools exist'
) as test;

-- Blockers on an unfinished slot setup.
select pg_temp.assert_true(
	pg_temp.has_text(pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(11), now() + interval '1 day') -> 'blockers',
		'Choose a purpose for "Bonus basic"'),
	'an undecided group cannot be released'
) as test;
select pg_temp.slot('reward', 'basic', 11, array['rw-2']);
select pg_temp.slot('core', 'rotation', 12, array['rw-3']);
select pg_temp.slot('reward', 'rotation', 13, array['rw-4']);
select pg_temp.assert_true(
	pg_temp.has_text(pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(14), now() + interval '1 day') -> 'blockers',
		'Choose a purpose') is false
	and jsonb_array_length(pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(14), now() + interval '1 day') -> 'blockers') = 0,
	'a daily group with more than 24 puzzles has no count blocker'
) as test;
select pg_temp.assert_true(
	pg_temp.has_text(pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(15), now() + interval '1 day') -> 'blockers',
		'has no puzzles') is false
	and pg_temp.has_text(pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(15), now() + interval '1 day') -> 'blockers',
		'Choose a purpose'),
	'an undecided short group is reported'
) as test;
select pg_temp.slot('core', 'basic', 15, array['rw-5']);
select pg_temp.assert_true(
	pg_temp.has_text(pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(15), now() + interval '1 day') -> 'blockers',
		'has 23 puzzles; core groups need exactly 24'),
	'a core group without 24 puzzles is blocked'
) as test;
select pg_temp.slot('core', 'basic', 10, array['rw-1']);

-- A rotation core group must award a palette too.
select pg_temp.slot('core', 'rotation', 12, array['rw-3']);
delete from public.reward_palettes where palette_id = 'rw-3';
select pg_temp.assert_true(
	pg_temp.has_text(pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(12), now() + interval '1 day') -> 'blockers',
		'"Core rotation" awards no palette'),
	'a core group that awards no palette is blocked'
) as test;
insert into public.reward_palettes(reward_rule_id, palette_id)
	select id, 'rw-3' from public.reward_rules where group_id = pg_temp.id(12);

-- Preview of the basic core group: bonus group, its puzzles, and their palettes come along.
select pg_temp.assert_true(
	pg_temp.changes(pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(10), now() + interval '1 day'), 'puzzle_group', 'release') = 2
	and pg_temp.changes(pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(10), now() + interval '1 day'), 'puzzle', 'release') = 48
	and pg_temp.changes(pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(10), now() + interval '1 day'), 'palette', 'release') = 3
	and jsonb_array_length(pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(10), now() + interval '1 day') -> 'blockers') = 0,
	'the basic core group brings its bonus group, 48 puzzles, and 3 palettes with no blockers'
) as test;
select pg_temp.assert_true(
	pg_temp.state('puzzle_groups', pg_temp.id(10)::text) = 'draft'
	and pg_temp.state('palettes', 'rw-1') = 'draft',
	'a preview changes nothing'
) as test;
select pg_temp.assert_true(
	pg_temp.has_text(pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(10), now() + interval '1 day') -> 'warnings',
		'Hexagon has no') is false
	and pg_temp.has_text(pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(10), now() + interval '1 day') -> 'warnings',
		'Triangle has no basic bonus group yet')
	and pg_temp.has_text(pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(10), now() + interval '1 day') -> 'warnings',
		'locks the shape order'),
	'warnings cover empty slots in other shapes and the shape order lock'
) as test;
select pg_temp.assert_true(
	pg_temp.has_text(pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(14), now() + interval '1 day') -> 'warnings',
		'"daily-only" is also used') is false
	and pg_temp.has_text(pg_temp.plan('schedule', 'palette_group', pg_temp.id(51), now() + interval '1 day') -> 'warnings',
		'Palette "daily-only" is also used by daily puzzles'),
	'releasing a palette used by daily puzzles through a palette group warns'
) as test;

-- Past times and authorization.
select pg_temp.assert_true(
	pg_temp.has_text(pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(10), now() - interval '1 day') -> 'blockers',
		'future release time'),
	'a release time in the past is blocked'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.apply('schedule', 'puzzle_group', pg_temp.id(10), now() - interval '1 day')$$,
	'23514', 'applying a blocked plan is rejected'
) as test;
select pg_temp.expect_error(
	$$select public.preview_release('schedule', 'palette', 'rw-1')$$,
	'22023', 'only groups can be scheduled'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(999))$$,
	'P0002', 'an unknown group is rejected'
) as test;

-- Scheduling the basic core group.
select pg_temp.apply('schedule', 'puzzle_group', pg_temp.id(10), date_trunc('second', now() + interval '3 days'));
select pg_temp.assert_true(
	pg_temp.state('puzzle_groups', pg_temp.id(10)::text) = 'scheduled'
	and pg_temp.state('puzzle_groups', pg_temp.id(11)::text) = 'scheduled'
	and pg_temp.state('puzzle_groups', pg_temp.id(12)::text) = 'draft'
	and pg_temp.state('palettes', 'puz-a') = 'scheduled' and pg_temp.state('palettes', 'rw-2') = 'scheduled'
	and pg_temp.state('palettes', 'puz-b') = 'draft' and pg_temp.state('palette_groups', pg_temp.id(51)::text) = 'draft'
	and (select count(*) = 48 from public.puzzles where published_at is not null)
	and (select count(distinct release_at) = 1 from public.puzzles where published_at is not null),
	'the group, its bonus group, their puzzles, and only the palettes they use are scheduled together'
) as test;

-- Scheduling the rotation core group shares the basic bonus group and pulls an earlier release.
select pg_temp.assert_true(
	pg_temp.changes(pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(12), now() + interval '1 day'), 'puzzle_group', 'earlier') = 1
	and pg_temp.changes(pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(12), now() + interval '1 day'), 'puzzle_group', 'release') = 2
	and pg_temp.changes(pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(12), now() + interval '1 day'), 'palette', 'earlier') = 2,
	'a shared bonus group and its palettes are pulled earlier, never later'
) as test;
select pg_temp.assert_true(
	pg_temp.changes(pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(12), now() + interval '5 days'), 'puzzle_group', 'keep') = 1
	and pg_temp.changes(pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(12), now() + interval '5 days'), 'puzzle_group', 'release') = 2,
	'a shared bonus group scheduled earlier stays where it is'
) as test;
select pg_temp.apply('schedule', 'puzzle_group', pg_temp.id(12), now() + interval '5 days');
select pg_temp.assert_true(
	pg_temp.state('puzzle_groups', pg_temp.id(12)::text) = 'scheduled'
	and pg_temp.state('puzzle_groups', pg_temp.id(13)::text) = 'scheduled'
	and (select release_at from public.puzzle_groups where id = pg_temp.id(11))
		< (select release_at from public.puzzle_groups where id = pg_temp.id(12)),
	'the rotation core group and both bonus groups are scheduled'
) as test;

-- Rescheduling.
select pg_temp.assert_true(
	pg_temp.has_text(pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(11), now() + interval '9 days') -> 'blockers',
		'"Core basic" awards this group and releases earlier'),
	'moving a bonus group later than a core group that awards it is blocked'
) as test;
select pg_temp.apply('schedule', 'puzzle_group', pg_temp.id(11), now() + interval '2 days');
select pg_temp.assert_true(
	(select release_at from public.puzzle_groups where id = pg_temp.id(11)) < now() + interval '2 days 1 minute'
	and (select count(distinct release_at) = 1 from public.puzzles
		where id in (select puzzle_id from public.puzzle_group_members where group_id = pg_temp.id(11))),
	'a bonus group can move earlier, bringing its puzzles with it'
) as test;

-- Cancelling.
select pg_temp.assert_true(
	pg_temp.changes(pg_temp.plan('cancel', 'puzzle_group', pg_temp.id(11)), 'puzzle_group', 'cancel') = 3
	and pg_temp.changes(pg_temp.plan('cancel', 'puzzle_group', pg_temp.id(11)), 'puzzle', 'cancel') = 72
	and pg_temp.has_text(pg_temp.plan('cancel', 'puzzle_group', pg_temp.id(11)) -> 'warnings', '"Core basic" awards this group')
	and pg_temp.has_text(pg_temp.plan('cancel', 'puzzle_group', pg_temp.id(11)) -> 'warnings', 'stay scheduled'),
	'cancelling a bonus group also cancels the core groups that award it'
) as test;
select pg_temp.assert_true(
	pg_temp.changes(pg_temp.plan('cancel', 'puzzle_group', pg_temp.id(12)), 'puzzle_group', 'cancel') = 1
	and pg_temp.changes(pg_temp.plan('cancel', 'puzzle_group', pg_temp.id(12)), 'puzzle', 'cancel') = 24,
	'cancelling a core group leaves its bonus groups scheduled'
) as test;
select pg_temp.apply('cancel', 'puzzle_group', pg_temp.id(12));
select pg_temp.assert_true(
	pg_temp.state('puzzle_groups', pg_temp.id(12)::text) = 'draft'
	and pg_temp.state('puzzle_groups', pg_temp.id(13)::text) = 'scheduled'
	and pg_temp.state('palettes', 'puz-b') = 'scheduled'
	and (select count(*) = 0 from public.puzzles where id in (
		select puzzle_id from public.puzzle_group_members where group_id = pg_temp.id(12)) and published_at is not null),
	'cancelling returns the group and its puzzles to draft and keeps palettes scheduled'
) as test;
select pg_temp.expect_error(
	$$select public.preview_release('cancel', 'palette', 'missing')$$,
	'P0002', 'an unknown palette is rejected'
) as test;
select pg_temp.assert_true(
	pg_temp.has_text(public.preview_release('cancel', 'palette', 'puz-a') -> 'blockers', 'Puzzle "Puzzle 10-1" and 47 more use this palette')
	and pg_temp.has_text(public.preview_release('cancel', 'palette', 'rw-1') -> 'blockers', '"Core basic" awards this palette'),
	'a palette used by scheduled puzzles or rewards cannot be cancelled'
) as test;
select pg_temp.assert_true(
	jsonb_array_length(public.preview_release('cancel', 'palette', 'puz-b') -> 'blockers') = 1
	and pg_temp.has_text(public.preview_release('cancel', 'palette', 'puz-b') -> 'blockers', 'Puzzle "Puzzle 13-1" and 23 more use this palette'),
	'a palette still used by the bonus rotation group stays blocked'
) as test;
select pg_temp.apply('cancel', 'puzzle_group', pg_temp.id(13));
select pg_temp.assert_true(
	jsonb_array_length(public.preview_release('cancel', 'palette', 'puz-b') -> 'blockers') = 0
	and jsonb_array_length(public.preview_release('cancel', 'palette', 'rw-3') -> 'blockers') = 0,
	'a palette can be cancelled once nothing scheduled uses it'
) as test;
select public.apply_release('cancel', 'palette', 'puz-b');
select pg_temp.assert_true(
	pg_temp.state('palettes', 'puz-b') = 'draft',
	'cancelling a palette returns it to draft'
) as test;
select pg_temp.expect_error(
	$$select public.apply_release('cancel', 'palette', 'puz-b')$$,
	'23514', 'a palette that is not scheduled cannot be cancelled'
) as test;

-- Palette groups.
select pg_temp.assert_true(
	pg_temp.has_text(pg_temp.plan('schedule', 'palette_group', pg_temp.id(52), now() + interval '1 day') -> 'blockers',
		'has 1 palettes; core and reward palette groups need exactly 6'),
	'a reward palette group needs exactly 6 palettes'
) as test;
select pg_temp.assert_true(
	jsonb_array_length(pg_temp.plan('schedule', 'palette_group', pg_temp.id(50), now() + interval '1 day') -> 'blockers') = 0
	and pg_temp.changes(pg_temp.plan('schedule', 'palette_group', pg_temp.id(50), now() + interval '1 day'), 'palette', 'release') = 2
	and pg_temp.changes(pg_temp.plan('schedule', 'palette_group', pg_temp.id(50), now() + interval '1 day'), 'palette', 'earlier') = 4,
	'a palette group of 6 releases its drafts and pulls scheduled palettes earlier'
) as test;
select pg_temp.apply('schedule', 'palette_group', pg_temp.id(50), now() + interval '1 day');
select pg_temp.assert_true(
	pg_temp.state('palette_groups', pg_temp.id(50)::text) = 'scheduled'
	and (select count(*) = 6 from public.palettes where id like 'rw-%' and published_at is not null),
	'scheduling a palette group schedules its palettes'
) as test;
select pg_temp.assert_true(
	pg_temp.changes(pg_temp.plan('schedule', 'palette_group', pg_temp.id(50), now() + interval '2 days'), 'palette', 'keep') = 6
	and pg_temp.changes(pg_temp.plan('schedule', 'palette_group', pg_temp.id(50), now() + interval '2 days'), 'palette_group', 'reschedule') = 1,
	'moving a palette group later leaves its palettes where they are'
) as test;
select pg_temp.apply('cancel', 'palette_group', pg_temp.id(50));
select pg_temp.assert_true(
	pg_temp.state('palette_groups', pg_temp.id(50)::text) = 'draft'
	and pg_temp.state('palettes', 'rw-5') = 'scheduled',
	'cancelling a palette group leaves its palettes scheduled'
) as test;

-- Release now makes everything live and locks it.
select pg_temp.apply('schedule', 'puzzle_group', pg_temp.id(12));
select pg_temp.assert_true(
	pg_temp.state('puzzle_groups', pg_temp.id(12)::text) = 'live'
	and pg_temp.state('puzzle_groups', pg_temp.id(13)::text) = 'live'
	and pg_temp.state('puzzle_groups', pg_temp.id(11)::text) = 'live'
	and pg_temp.state('palettes', 'puz-b') = 'live',
	'releasing now makes the group and everything it pulls in live'
) as test;
select pg_temp.assert_true(
	pg_temp.has_text(pg_temp.plan('cancel', 'puzzle_group', pg_temp.id(12)) -> 'blockers', 'is live')
	and pg_temp.has_text(pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(12), now() + interval '1 day') -> 'blockers', 'is live')
	and pg_temp.changes(pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(10), now() + interval '1 day'), 'puzzle_group', 'live') = 1,
	'live content cannot be rescheduled or cancelled, and is left alone as a dependency'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.apply('cancel', 'puzzle_group', pg_temp.id(12))$$,
	'23514', 'applying a cancel of live content is rejected'
) as test;
select pg_temp.assert_true(
	pg_temp.has_text(pg_temp.plan('cancel', 'puzzle_group', pg_temp.id(11)) -> 'blockers', 'is live')
	and jsonb_array_length(pg_temp.plan('cancel', 'puzzle_group', pg_temp.id(10)) -> 'blockers') = 0
	and pg_temp.changes(pg_temp.plan('cancel', 'puzzle_group', pg_temp.id(10)), 'puzzle_group', 'cancel') = 1
	and pg_temp.state('puzzle_groups', pg_temp.id(10)::text) = 'scheduled',
	'a scheduled core group can be cancelled while its bonus group is live, but not the reverse'
) as test;

-- A daily group with scheduled daily puzzles is protected.
select pg_temp.apply('schedule', 'puzzle_group', pg_temp.id(14), now() + interval '7 days');
select pg_temp.assert_true(
	pg_temp.state('puzzle_groups', pg_temp.id(14)::text) = 'scheduled'
	and (select count(*) = 26 from public.puzzles where palette_id = 'daily-only' and published_at is not null),
	'a daily group of any size can be scheduled'
) as test;
reset role;
delete from public.daily_schedule;
insert into public.daily_schedule(rollover_time_utc) values ('04:00');
insert into public.daily_puzzles(puzzle_id, release_at, expires_at)
	values (
		pg_temp.id(1000 + 14 * 100 + 1),
		date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' + interval '8 days 4 hours',
		date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' + interval '13 days 4 hours'
	);
select set_config('request.jwt.claim.sub', pg_temp.id(1)::text, true);
set local role authenticated;
select pg_temp.assert_true(
	pg_temp.has_text(pg_temp.plan('cancel', 'puzzle_group', pg_temp.id(14)) -> 'blockers', 'Remove "Puzzle 14-1" from the daily schedule first'),
	'a group with a daily-scheduled puzzle cannot be cancelled'
) as test;

-- Authorization.
reset role;
select set_config('request.jwt.claim.sub', pg_temp.id(2)::text, true);
set local role authenticated;
select pg_temp.expect_error(
	$$select pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(10), now() + interval '1 day')$$,
	'42501', 'regular users cannot preview releases'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.apply('cancel', 'puzzle_group', pg_temp.id(10))$$,
	'42501', 'regular users cannot apply releases'
) as test;
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select pg_temp.expect_error(
	$$select pg_temp.plan('schedule', 'puzzle_group', pg_temp.id(10), now() + interval '1 day')$$,
	'42501', 'guests cannot preview releases'
) as test;
reset role;

rollback;
