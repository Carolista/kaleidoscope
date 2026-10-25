begin;
set local timezone = 'UTC';

create function pg_temp.assert_true(condition boolean, label text)
returns text language plpgsql as $$
begin
	if condition is distinct from true then raise exception 'FAILED: %', label; end if;
	return 'PASS: ' || label;
end;
$$;
-- Runs a statement as the current role and reports whether it failed with the given SQLSTATE.
create function pg_temp.raises(statement text, expected_state text)
returns boolean language plpgsql as $$
begin
	execute statement;
	return false;
exception when others then
	return sqlstate = expected_state;
end;
$$;
create function pg_temp.id(n integer) returns uuid language sql immutable as $$
	select ('eb000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.puzzle(n integer, p_shape text)
returns uuid language sql as $$
	select public.save_puzzle_draft(
		pg_temp.id(n), 'Puzzle ' || n, p_shape, 'record-test', 'sm', false, 'easy',
		'{"version":2,"geometry":{"size":4},"target":{"-1,2":0},"pieces":[{"id":"p1","tiles":[{"q":-1,"r":2,"color_slot":0}]}]}',
		'record-seed-' || n, p_shape || '-test', '{"p1":{"q":0,"r":0}}'
	);
$$;

insert into auth.users(id) values (pg_temp.id(1)), (pg_temp.id(2)), (pg_temp.id(3));
delete from public.admin_account;
insert into public.admin_account(user_id) values (pg_temp.id(1));
insert into public.palettes(id, name, colors) values
	('record-test', 'Record test', array['#111111','#222222','#333333','#444444','#555555']);

select set_config('request.jwt.claim.sub', pg_temp.id(1)::text, true);
set local role authenticated;
select pg_temp.puzzle(10, 'hexagon');
select pg_temp.puzzle(11, 'hexagon');
select pg_temp.puzzle(12, 'hexagon');
select pg_temp.puzzle(13, 'triangle');
reset role;

update public.palettes set published_at = now(), release_at = now() where id = 'record-test';
update public.puzzles set published_at = now(), release_at = now()
	where id in (pg_temp.id(10), pg_temp.id(11), pg_temp.id(12), pg_temp.id(13));

-- Released content already fills the slots, so these fixtures are inserted directly with the slot
-- indexes and guard triggers set aside. All of it rolls back.
--   20: Hexagon core (puzzles 10, 11), whose reward is bonus group 21 and the palette
--   21: Hexagon bonus (puzzle 12)
--   22: Triangle core (puzzle 13), readable only once Hexagon's core group is done
drop index public.puzzle_groups_core_slot_idx;
drop index public.puzzle_groups_reward_slot_idx;
alter table public.puzzle_groups disable trigger user;
alter table public.puzzle_group_members disable trigger user;
alter table public.reward_rules disable trigger user;
alter table public.reward_palettes disable trigger user;
alter table public.reward_puzzle_groups disable trigger user;
insert into public.puzzle_groups(id, name, purpose, shape_id, track, published_at, release_at) values
	(pg_temp.id(20), 'Record hex core', 'core', 'hexagon', 'basic', now(), now()),
	(pg_temp.id(21), 'Record hex bonus', 'reward', 'hexagon', 'basic', now(), now()),
	(pg_temp.id(22), 'Record triangle core', 'core', 'triangle', 'basic', now(), now());
insert into public.puzzle_group_members(puzzle_id, group_id, position) values
	(pg_temp.id(10), pg_temp.id(20), 1),
	(pg_temp.id(11), pg_temp.id(20), 2),
	(pg_temp.id(12), pg_temp.id(21), 1),
	(pg_temp.id(13), pg_temp.id(22), 1);
insert into public.reward_rules(id, group_id) values (pg_temp.id(30), pg_temp.id(20));
insert into public.reward_puzzle_groups(reward_rule_id, group_id) values (pg_temp.id(30), pg_temp.id(21));
insert into public.reward_palettes(reward_rule_id, palette_id) values (pg_temp.id(30), 'record-test');
alter table public.reward_puzzle_groups enable trigger user;
alter table public.reward_palettes enable trigger user;
alter table public.reward_rules enable trigger user;
alter table public.puzzle_group_members enable trigger user;
alter table public.puzzle_groups enable trigger user;

-- Player 2 solves one puzzle at a time.
select set_config('request.jwt.claim.sub', pg_temp.id(2)::text, true);
set local role authenticated;
select pg_temp.assert_true(
	(select count(*) from public.puzzles where id in (pg_temp.id(12), pg_temp.id(13))) = 0,
	'the bonus group and the next shape are closed before anything is solved'
) as test;
select pg_temp.assert_true(
	public.record_puzzle_completions(
		array[pg_temp.id(10), pg_temp.id(12), pg_temp.id(13)]
	) = array[pg_temp.id(10)],
	'only puzzles the player may play are recorded'
) as test;
select pg_temp.assert_true(
	(select count(*) from public.group_completions where group_id = pg_temp.id(20)) = 0
	and (select count(*) from public.puzzle_group_grants where group_id = pg_temp.id(21)) = 0,
	'an unfinished group completes nothing and grants nothing'
) as test;
select pg_temp.assert_true(
	public.record_puzzle_completions(array[pg_temp.id(11)]) = array[pg_temp.id(11)],
	'the last puzzle of a group is recorded'
) as test;
select pg_temp.assert_true(
	(select count(*) from public.group_completions where group_id = pg_temp.id(20)) = 1
	and (select count(*) from public.puzzle_group_grants
		where group_id = pg_temp.id(21) and source = 'reward' and reward_rule_id = pg_temp.id(30)) = 1
	and (select count(*) from public.palette_grants
		where palette_id = 'record-test' and source = 'reward' and reward_rule_id = pg_temp.id(30)) = 1,
	'finishing a group is recorded and grants its bonus group and palette'
) as test;
select pg_temp.assert_true(
	(select count(*) from public.puzzles where id = pg_temp.id(12)) = 1
	and (select count(*) from public.puzzles where id = pg_temp.id(13)) = 1,
	'the granted bonus group and the next shape now open'
) as test;
select public.record_puzzle_completions(
	array[pg_temp.id(10), pg_temp.id(11), pg_temp.id(12), pg_temp.id(13)]
);
select public.record_puzzle_completions(
	array[pg_temp.id(10), pg_temp.id(11), pg_temp.id(12), pg_temp.id(13)]
);
select pg_temp.assert_true(
	(select count(*) from public.puzzle_completions) = 4
	and (select count(*) from public.group_completions
		where group_id in (pg_temp.id(20), pg_temp.id(21), pg_temp.id(22))) = 3
	and (select count(*) from public.puzzle_group_grants where group_id = pg_temp.id(21)) = 1
	and (select count(*) from public.palette_grants where palette_id = 'record-test') = 1,
	'repeating a call changes nothing'
) as test;
reset role;

-- Player 3 imports everything in one call; the bonus group opens part-way through. The call and the
-- counts are separate statements, since a statement cannot see rows its own function inserted.
select set_config('request.jwt.claim.sub', pg_temp.id(3)::text, true);
set local role authenticated;
select pg_temp.assert_true(
	public.record_puzzle_completions(
		array[pg_temp.id(12), pg_temp.id(13), pg_temp.id(11), pg_temp.id(10)]
	) = array[pg_temp.id(10), pg_temp.id(11), pg_temp.id(12), pg_temp.id(13)],
	'an imported save in any order is recorded in a single call'
) as test;
select pg_temp.assert_true(
	(select count(*) from public.group_completions
		where group_id in (pg_temp.id(20), pg_temp.id(21), pg_temp.id(22))) = 3
	and (select count(*) from public.puzzle_group_grants where group_id = pg_temp.id(21)) = 1,
	'every group in an imported save is completed, including the bonus group granted part-way'
) as test;

-- Access.
select pg_temp.assert_true(
	pg_temp.raises(
		format('insert into public.puzzle_completions(user_id, puzzle_id) values (%L, %L)',
			pg_temp.id(3), pg_temp.id(10)),
		'42501'
	)
	and pg_temp.raises(
		format('insert into public.group_completions(user_id, group_id) values (%L, %L)',
			pg_temp.id(3), pg_temp.id(20)),
		'42501'
	),
	'players cannot write progress directly'
) as test;
reset role;

select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select pg_temp.assert_true(
	pg_temp.raises(
		format('select public.record_puzzle_completions(array[%L]::uuid[])', pg_temp.id(10)),
		'42501'
	),
	'a request with no signed-in player is refused'
) as test;
reset role;
set local role anon;
select pg_temp.assert_true(
	pg_temp.raises(
		format('select public.record_puzzle_completions(array[%L]::uuid[])', pg_temp.id(10)),
		'42501'
	),
	'guests cannot call the function'
) as test;
reset role;

rollback;
