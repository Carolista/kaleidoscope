begin;
set local timezone = 'UTC';

create function pg_temp.assert_true(condition boolean, label text)
returns text language plpgsql as $$
begin
	if condition is distinct from true then raise exception 'FAILED: %', label; end if;
	return 'PASS: ' || label;
end;
$$;
create function pg_temp.id(n integer) returns uuid language sql immutable as $$
	select ('e9000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
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

insert into auth.users(id) values (pg_temp.id(1));
delete from public.admin_account;
insert into public.admin_account(user_id) values (pg_temp.id(1));
-- Set existing slot groups aside for this rolled-back transaction.
-- Links go first: a linked bonus group cannot change its purpose.
delete from public.reward_puzzle_groups;
update public.puzzle_groups set purpose = 'undecided', track = null where purpose in ('core', 'reward');
insert into public.palettes(id, name, colors) select 'unlock-' || n, 'Unlock ' || n,
	array['#111111','#222222','#333333','#444444','#555555'] from generate_series(1, 4) as n;

select set_config('request.jwt.claim.sub', pg_temp.id(1)::text, true);
set local role authenticated;
select public.manage_palette_group(pg_temp.id(50), 'create', 'Unlock rewards', 'reward');
select public.manage_palette_group(pg_temp.id(50), 'assign', null, null,
	array['unlock-1', 'unlock-2', 'unlock-3', 'unlock-4']);

select pg_temp.group(10, 'Core basic', 'undecided', 'hexagon', null);
select pg_temp.group(11, 'Core rotation', 'undecided', 'hexagon', null);
select pg_temp.group(12, 'Bonus basic', 'undecided', 'hexagon', null);
select pg_temp.group(13, 'Bonus rotation', 'undecided', 'hexagon', null);
select pg_temp.group(14, 'Another bonus basic', 'undecided', 'hexagon', null);

-- The basic core group awards the basic bonus group.
select pg_temp.slot('hexagon', 'core', 'basic', 10, array['unlock-1']);
select pg_temp.slot('hexagon', 'reward', 'basic', 12, array['unlock-2']);
select pg_temp.assert_true(
	pg_temp.bonus_of(10) = pg_temp.ids(12) and pg_temp.palettes_of(10) = array['unlock-1'],
	'filling the basic bonus slot links it to the basic core group'
) as test;
select pg_temp.slot('hexagon', 'reward', 'rotation', 13, array['unlock-3']);
select pg_temp.assert_true(
	pg_temp.bonus_of(10) = pg_temp.ids(12),
	'the basic core group does not award the rotation bonus group'
) as test;

-- The rotation core group still awards both bonus groups.
select pg_temp.slot('hexagon', 'core', 'rotation', 11, array['unlock-4']);
select pg_temp.assert_true(
	pg_temp.bonus_of(11) = pg_temp.ids(12, 13) and pg_temp.bonus_of(10) = pg_temp.ids(12),
	'the rotation core group awards both bonus groups, sharing the basic one'
) as test;

-- Links follow slot changes for both core groups.
select pg_temp.slot('hexagon', 'reward', 'basic', 14, array['unlock-2']);
select pg_temp.assert_true(
	pg_temp.bonus_of(10) = pg_temp.ids(14) and pg_temp.bonus_of(11) = pg_temp.ids(13, 14)
	and (select purpose = 'undecided' from public.puzzle_groups where id = pg_temp.id(12)),
	'replacing the basic bonus group relinks both core groups'
) as test;
select pg_temp.slot('hexagon', 'reward', 'basic', null);
select pg_temp.assert_true(
	pg_temp.bonus_of(10) = '{}' and pg_temp.palettes_of(10) = array['unlock-1']
	and pg_temp.bonus_of(11) = pg_temp.ids(13),
	'emptying the basic bonus slot removes its links and keeps the core palettes'
) as test;
select pg_temp.slot('hexagon', 'reward', 'basic', 12, array['unlock-2']);
select pg_temp.slot('hexagon', 'core', 'basic', null);
select pg_temp.assert_true(
	not exists(select 1 from public.reward_rules where group_id = pg_temp.id(10))
	and pg_temp.bonus_of(11) = pg_temp.ids(12, 13),
	'emptying the basic core slot removes only its own rule and links'
) as test;
select pg_temp.slot('hexagon', 'core', 'basic', 10);
select pg_temp.assert_true(
	pg_temp.bonus_of(10) = pg_temp.ids(12) and pg_temp.palettes_of(10) = '{}'
	and (select count(*) = 1 from public.reward_rules where group_id = pg_temp.id(10)),
	'a basic core group with no palette keeps a single rule for its bonus link'
) as test;
select public.save_puzzle_draft(
	pg_temp.id(70), 'Unlock puzzle', 'hexagon', 'unlock-1', 'sm', false, 'easy',
	'{"version":2,"geometry":{"size":4},"target":{"-1,2":0},"pieces":[{"id":"p1","tiles":[{"q":-1,"r":2,"color_slot":0}]}]}',
	'unlock-seed', 'hexagon-v2', '{"p1":{"q":0,"r":0}}'
);
select public.manage_puzzle_group(pg_temp.id(10), 'append', null, null, null, null, array[pg_temp.id(70)]);
reset role;

-- A prepared core group keeps its links.
update public.palettes set published_at = now(), release_at = now() where id = 'unlock-1';
update public.puzzles set published_at = now(), release_at = now() where id = pg_temp.id(70);
update public.puzzle_groups set published_at = now(), release_at = now() + interval '1 day'
	where id = pg_temp.id(10);
select private.sync_bonus_groups('hexagon');
delete from public.reward_puzzle_groups where group_id = pg_temp.id(13);
update public.puzzle_groups set purpose = 'undecided', track = null where id = pg_temp.id(13);
select pg_temp.assert_true(
	pg_temp.bonus_of(10) = pg_temp.ids(12) and pg_temp.bonus_of(11) = pg_temp.ids(12),
	'a prepared core group keeps its links while unprepared ones follow the slots'
) as test;

rollback;
