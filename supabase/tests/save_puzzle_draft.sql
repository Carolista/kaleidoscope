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
	begin
		execute statement;
	exception when others then
		if sqlstate = expected_state then return 'PASS: ' || label; end if;
		raise exception 'FAILED: % (expected %, got %: %)', label, expected_state, sqlstate, sqlerrm;
	end;
	raise exception 'FAILED: % (statement unexpectedly succeeded)', label;
end;
$$;
create function pg_temp.save_draft(
	draft_id uuid, intended_use text default 'collection', seed_value text default 'saved-seed'
)
returns uuid language sql as $$
	select public.save_hex_puzzle_draft(
		draft_id, '  Draft test  ', intended_use, 'cabo', 'sm', false, 'easy',
		'{"version":2,"geometry":{"radius":3},"target":{"0,0":0},"pieces":[
			{"id":"p1","tiles":[{"q":0,"r":0,"color_slot":0}]}]}'::jsonb,
		seed_value, 'hexagon-v2', '{"p1":{"q":0,"r":0,"rotation":0}}'::jsonb
	);
$$;

insert into auth.users(id) values
	('ed000000-0000-4000-8000-000000000001'),
	('ed000000-0000-4000-8000-000000000002');
delete from public.admin_account;
insert into public.admin_account(user_id) values ('ed000000-0000-4000-8000-000000000001');

set local role anon;
select pg_temp.expect_error(
	$$select pg_temp.save_draft('ed000000-0000-4000-8000-000000000010')$$,
	'42501', 'anonymous callers cannot save drafts'
) as test;
reset role;
select set_config('request.jwt.claim.sub', 'ed000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select pg_temp.expect_error(
	$$select pg_temp.save_draft('ed000000-0000-4000-8000-000000000010')$$,
	'42501', 'regular users cannot save drafts'
) as test;
reset role;
select set_config('request.jwt.claim.sub', 'ed000000-0000-4000-8000-000000000001', true);
set local role authenticated;

select pg_temp.assert_true(
	pg_temp.save_draft('ed000000-0000-4000-8000-000000000010') =
		'ed000000-0000-4000-8000-000000000010'::uuid,
	'admin saves a set/pack draft and receives its ID'
) as test;
select pg_temp.assert_true(
	exists (
		select 1 from public.puzzles p join public.puzzle_authoring a on a.puzzle_id = p.id
		where p.id = 'ed000000-0000-4000-8000-000000000010'
			and p.name = 'Draft test' and p.usage = 'collection'
			and p.published_at is null and p.release_at is null
			and p.definition -> 'version' = '2'::jsonb
			and a.seed = 'saved-seed' and a.generator_version = 'hexagon-v2'
			and a.known_solution = '{"p1":{"q":0,"r":0,"rotation":0}}'::jsonb
	), 'draft preserves public definition and separate private solution without release'
) as test;
select pg_temp.assert_true(
	pg_temp.save_draft('ed000000-0000-4000-8000-000000000010') =
		'ed000000-0000-4000-8000-000000000010'::uuid,
	'retrying the same save is idempotent'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.save_draft('ed000000-0000-4000-8000-000000000010', 'daily')$$,
	'23505', 'retry cannot overwrite a different draft payload'
) as test;
select pg_temp.assert_true(
	pg_temp.save_draft('ed000000-0000-4000-8000-000000000011', 'daily') =
		'ed000000-0000-4000-8000-000000000011'::uuid,
	'admin can save a daily draft'
) as test;
update public.puzzles set usage = 'collection' where id = 'ed000000-0000-4000-8000-000000000011';
update public.puzzles set usage = 'daily' where id = 'ed000000-0000-4000-8000-000000000011';
select pg_temp.assert_true(
	(select usage = 'daily' from public.puzzles where id = 'ed000000-0000-4000-8000-000000000011'),
	'unassigned unpublished drafts can switch intended use in either direction'
) as test;
select pg_temp.expect_error(
	$$select pg_temp.save_draft('ed000000-0000-4000-8000-000000000012', 'collection', '')$$,
	'23514', 'invalid private provenance rejects the entire save'
) as test;
select pg_temp.assert_true(
	not exists(select 1 from public.puzzles where id = 'ed000000-0000-4000-8000-000000000012'),
	'failed private-row insert leaves no orphan public puzzle'
) as test;
delete from public.puzzles where id = 'ed000000-0000-4000-8000-000000000010';
select pg_temp.assert_true(
	(select count(*) = 1 from public.puzzle_authoring where seed = 'saved-seed'),
	'deleting one draft preserves the exclusion if another saved puzzle uses the seed'
) as test;
delete from public.puzzles where id = 'ed000000-0000-4000-8000-000000000011';
select pg_temp.assert_true(
	not exists(select 1 from public.puzzle_authoring where seed = 'saved-seed'),
	'deleting the last unused draft frees its saved-seed exclusion'
) as test;
set constraints all immediate;
rollback;
