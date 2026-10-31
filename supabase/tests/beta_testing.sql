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
	select ('bd000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.as_user(n integer) returns void language sql as $$
	select set_config('request.jwt.claim.sub', pg_temp.id(n)::text, true);
$$;
create function pg_temp.report(
	p_user integer, p_id integer, p_round integer, p_kind text, p_images text[] default '{}'
)
returns text language plpgsql as $$
begin
	return format(
		$f$select public.submit_beta_report(%L, %L, %L, %L, %L, %L, %L, %L, '{"browser":"Test"}', %L)$f$,
		pg_temp.id(p_id), pg_temp.id(p_round), p_kind,
		case when p_kind = 'bug' then 'Solving a puzzle' end,
		case when p_kind = 'bug' then 'The piece vanished' end,
		case when p_kind = 'bug' then 'The piece stays' end,
		case when p_kind = 'suggestion' then 'Zen mode: Palettes' end,
		case when p_kind <> 'bug' then 'Please add more' end,
		p_images
	);
end;
$$;

-- 1 admin, 2 and 4 testers, 3 a player who is not a tester, 5 an invited newcomer.
insert into auth.users(id) values
	(pg_temp.id(1)), (pg_temp.id(2)), (pg_temp.id(3)), (pg_temp.id(4)), (pg_temp.id(5));
delete from public.admin_account;
-- Rounds cannot overlap and the checks below count rows, so whatever beta data the project
-- already has is set aside inside this transaction. All of it rolls back.
delete from public.beta_surveys;
delete from public.beta_report_images;
delete from public.beta_report_admin;
delete from public.beta_reports;
delete from public.beta_tester_devices;
delete from public.beta_testers;
delete from public.beta_invites;
delete from public.beta_announcements;
delete from public.beta_rounds;
insert into public.admin_account(user_id) values (pg_temp.id(1));
-- 10: ended, 11: open now, 12: starts later.
insert into public.beta_rounds(id, name, starts_at, ends_at, survey_version) values
	(pg_temp.id(10), 'Round 1', now() - interval '30 days', now() - interval '20 days', 1),
	(pg_temp.id(11), 'Round 2', now() - interval '1 day', now() + interval '7 days', 2),
	(pg_temp.id(12), 'Round 3', now() + interval '14 days', now() + interval '30 days', 3);
insert into public.beta_announcements(round_id, title, body, pinned, published_at) values
	(pg_temp.id(11), 'Older', 'a', false, now() - interval '2 days'),
	(pg_temp.id(11), 'Newer', 'b', false, now() - interval '1 hour'),
	(pg_temp.id(11), 'Pinned', 'c', true, now() - interval '3 days'),
	(pg_temp.id(11), 'Draft', 'd', false, null),
	(pg_temp.id(11), 'Scheduled', 'e', false, now() + interval '1 day');

-- Rounds.
select pg_temp.assert_true(
	pg_temp.raises(
		format(
			'insert into public.beta_rounds(name, starts_at, ends_at) values (%L, now(), now() + interval %L)',
			'Overlap', '1 day'
		),
		'23P01'
	),
	'rounds cannot overlap'
) as test;

-- Inviting.
select pg_temp.as_user(2);
set local role authenticated;
select pg_temp.assert_true(
	pg_temp.raises(
		format('select public.create_beta_invite(%L, %L, %L)', pg_temp.id(11), 'A', 'a@example.com'),
		'42501'
	)
	and (select count(*) from public.beta_invites) = 0,
	'only the admin can invite'
) as test;
reset role;

select pg_temp.as_user(1);
set local role authenticated;
select set_config(
	'test.token',
	public.create_beta_invite(pg_temp.id(11), 'Sam', 'sam@example.com') ->> 'token',
	true
);
select pg_temp.assert_true(
	(select count(*) from public.beta_invites where round_id = pg_temp.id(11)) = 1
	and (select token_hash from public.beta_invites) <> current_setting('test.token')
	and length(current_setting('test.token')) > 40,
	'an invite is stored with only a hash of its token'
) as test;
select set_config('test.old_token', current_setting('test.token'), true);
select set_config(
	'test.token',
	public.create_beta_invite(pg_temp.id(11), 'Sam', 'SAM@example.com') ->> 'token',
	true
);
select pg_temp.assert_true(
	(select count(*) from public.beta_invites where round_id = pg_temp.id(11)) = 1
	and current_setting('test.token') <> current_setting('test.old_token'),
	'inviting the same address again replaces the token'
) as test;
select pg_temp.assert_true(
	pg_temp.raises(
		format('select public.create_beta_invite(%L, %L, %L)', pg_temp.id(10), 'Old', 'old@example.com'),
		'22023'
	)
	and pg_temp.raises(
		format('select public.create_beta_invite(%L, %L, %L)', pg_temp.id(11), 'Bad', 'not-an-email'),
		'23514'
	),
	'an ended round and a malformed address are refused'
) as test;
reset role;

-- Redeeming.
select pg_temp.as_user(5);
set local role authenticated;
select pg_temp.assert_true(
	pg_temp.raises(
		format('select public.redeem_beta_invite(%L)', current_setting('test.old_token')), '22023'
	)
	and pg_temp.raises('select public.redeem_beta_invite(''nonsense'')', '22023')
	and pg_temp.raises('select public.redeem_beta_invite(null)', '22023'),
	'a replaced, unknown, or empty token is refused'
) as test;
select public.redeem_beta_invite(current_setting('test.token'));
select pg_temp.assert_true(
	public.redeem_beta_invite(current_setting('test.token')) = pg_temp.id(11),
	'redeeming again returns the round'
) as test;
reset role;
select pg_temp.assert_true(
	(select count(*) from public.beta_testers
		where user_id = pg_temp.id(5) and round_id = pg_temp.id(11) and revoked_at is null) = 1
	and (select redeemed_by from public.beta_invites) = pg_temp.id(5),
	'redeeming enrolls the player once and marks the invite used'
) as test;

select pg_temp.as_user(3);
set local role authenticated;
select pg_temp.assert_true(
	pg_temp.raises(
		format('select public.redeem_beta_invite(%L)', current_setting('test.token')), '22023'
	),
	'a used link cannot be redeemed by someone else'
) as test;
reset role;

select pg_temp.as_user(1);
set local role authenticated;
select pg_temp.assert_true(
	pg_temp.raises(
		format('select public.redeem_beta_invite(%L)', current_setting('test.token')), '42501'
	),
	'the admin does not join as a tester'
) as test;
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select pg_temp.assert_true(
	pg_temp.raises(
		format('select public.redeem_beta_invite(%L)', current_setting('test.token')), '42501'
	),
	'a request with no signed-in player is refused'
) as test;
reset role;

-- A link for a round that has since ended no longer works.
insert into public.beta_invites(id, round_id, name, email, token_hash)
values (pg_temp.id(90), pg_temp.id(10), 'Late', 'late@example.com', private.beta_token_hash('late'));
select pg_temp.as_user(3);
set local role authenticated;
select pg_temp.assert_true(
	pg_temp.raises('select public.redeem_beta_invite(''late'')', '22023'),
	'an invite to an ended round is refused'
) as test;
reset role;

-- Testers 2 and 4 are enrolled directly: 2 in the open and the later round, 4 in the open round.
insert into public.beta_testers(round_id, user_id) values
	(pg_temp.id(10), pg_temp.id(2)),
	(pg_temp.id(11), pg_temp.id(2)),
	(pg_temp.id(12), pg_temp.id(2)),
	(pg_temp.id(11), pg_temp.id(4));

-- Dashboard.
select pg_temp.as_user(2);
set local role authenticated;
select pg_temp.assert_true(
	(select jsonb_array_length(public.beta_dashboard() -> 'rounds')) = 3
	and (public.beta_dashboard() -> 'rounds' -> 0 ->> 'state') = 'upcoming'
	and (public.beta_dashboard() -> 'rounds' -> 1 ->> 'state') = 'open'
	and (public.beta_dashboard() -> 'rounds' -> 2 ->> 'state') = 'closed'
	and (public.beta_dashboard() ->> 'preview') = 'false',
	'a tester sees their rounds, newest first, with their state'
) as test;
select pg_temp.assert_true(
	(select array_agg(a ->> 'title')
		from jsonb_array_elements(public.beta_dashboard() -> 'rounds' -> 1 -> 'announcements') a)
		= array['Pinned', 'Newer', 'Older'],
	'announcements are published only, pinned first, then newest'
) as test;
reset role;
select pg_temp.as_user(3);
set local role authenticated;
select pg_temp.assert_true(
	jsonb_array_length(public.beta_dashboard() -> 'rounds') = 0,
	'a player who is not a tester sees no rounds'
) as test;
reset role;
select pg_temp.as_user(1);
set local role authenticated;
select pg_temp.assert_true(
	jsonb_array_length(public.beta_dashboard() -> 'rounds') = 3
	and (public.beta_dashboard() ->> 'preview') = 'true',
	'the admin previews every round'
) as test;
reset role;

-- Reports.
select pg_temp.as_user(2);
set local role authenticated;
select public.submit_beta_report(
	pg_temp.id(20), pg_temp.id(11), 'bug', ' Solving a puzzle ', 'It froze', 'It moves',
	null, null, '{"browser":"Safari"}', '{}'
);
select public.submit_beta_report(
	pg_temp.id(21), pg_temp.id(11), 'suggestion', null, null, null,
	'Zen mode: Palettes', 'More colors', '{}', null
);
select public.submit_beta_report(
	p_id => pg_temp.id(22), p_round => pg_temp.id(11), p_kind => 'other', p_details => 'Love it'
);
select pg_temp.assert_true(
	(select count(*) from public.beta_reports where user_id = pg_temp.id(2)) = 3
	and (select steps from public.beta_reports where id = pg_temp.id(20)) = 'Solving a puzzle'
	and (select status from public.beta_reports where id = pg_temp.id(20)) = 'new',
	'a bug, a suggestion, and other feedback can be sent, trimmed, starting as new'
) as test;
select pg_temp.assert_true(
	pg_temp.raises(
		format(
			'select public.submit_beta_report(%L, %L, ''bug'', ''x'', null, ''y'', null, null, ''{}'', ''{}'')',
			pg_temp.id(23), pg_temp.id(11)
		),
		'23514'
	)
	and pg_temp.raises(
		format(
			'select public.submit_beta_report(%L, %L, ''suggestion'', null, null, null, null, ''x'', ''{}'', ''{}'')',
			pg_temp.id(23), pg_temp.id(11)
		),
		'23514'
	)
	and pg_temp.raises(
		format(
			'select public.submit_beta_report(%L, %L, ''praise'', null, null, null, null, ''x'', ''{}'', ''{}'')',
			pg_temp.id(23), pg_temp.id(11)
		),
		'23514'
	),
	'each kind needs its own fields, and no other kind exists'
) as test;
select pg_temp.assert_true(
	public.submit_beta_report(
		pg_temp.id(20), pg_temp.id(11), 'bug', 'Changed', 'Changed', 'Changed', null, null, '{}', '{}'
	) = pg_temp.id(20)
	and (select steps from public.beta_reports where id = pg_temp.id(20)) = 'Solving a puzzle'
	and (select count(*) from public.beta_reports where user_id = pg_temp.id(2)) = 3,
	'sending the same report id again changes nothing'
) as test;
select pg_temp.assert_true(
	pg_temp.raises(pg_temp.report(2, 24, 10, 'bug'), '22023'),
	'an ended round takes no reports'
) as test;
select pg_temp.assert_true(
	pg_temp.raises(pg_temp.report(2, 25, 12, 'bug'), '22023'),
	'a round that has not started takes no reports'
) as test;
reset role;

select pg_temp.as_user(3);
set local role authenticated;
select pg_temp.assert_true(
	pg_temp.raises(pg_temp.report(3, 26, 11, 'bug'), '42501'),
	'a player who is not a tester cannot send a report'
) as test;
reset role;
select pg_temp.as_user(4);
set local role authenticated;
select pg_temp.assert_true(
	pg_temp.raises(pg_temp.report(4, 20, 11, 'bug'), '23505'),
	'a report id belonging to someone else is refused'
) as test;
reset role;

-- Screenshots.
select pg_temp.as_user(2);
set local role authenticated;
insert into storage.objects(bucket_id, name)
values ('beta-screenshots', pg_temp.id(2)::text || '/' || pg_temp.id(30)::text || '/a.png');
select pg_temp.assert_true(
	pg_temp.raises(
		format(
			'insert into storage.objects(bucket_id, name) values (''beta-screenshots'', %L)',
			pg_temp.id(3)::text || '/' || pg_temp.id(30)::text || '/a.png'
		),
		'42501'
	),
	'a tester cannot upload into another user''s folder'
) as test;
select pg_temp.assert_true(
	(select count(*) from storage.objects where bucket_id = 'beta-screenshots') = 1,
	'a tester sees their own screenshot'
) as test;
select pg_temp.assert_true(
	pg_temp.raises(
		pg_temp.report(2, 30, 11, 'bug', array[pg_temp.id(2)::text || '/' || pg_temp.id(30)::text || '/missing.png']),
		'22023'
	)
	and pg_temp.raises(
		pg_temp.report(2, 30, 11, 'bug', array[pg_temp.id(2)::text || '/' || pg_temp.id(31)::text || '/a.png']),
		'22023'
	),
	'a screenshot that is missing or under another report is refused'
) as test;
select public.submit_beta_report(
	pg_temp.id(30), pg_temp.id(11), 'bug', 'a', 'b', 'c', null, null, '{}',
	array[pg_temp.id(2)::text || '/' || pg_temp.id(30)::text || '/a.png']
);
select pg_temp.assert_true(
	(select count(*) from public.beta_report_images where report_id = pg_temp.id(30)) = 1,
	'an uploaded screenshot is attached to its report'
) as test;
select pg_temp.assert_true(
	pg_temp.raises(
		pg_temp.report(
			2, 32, 11, 'bug',
			array[
				pg_temp.id(2)::text || '/' || pg_temp.id(32)::text || '/1.png',
				pg_temp.id(2)::text || '/' || pg_temp.id(32)::text || '/2.png',
				pg_temp.id(2)::text || '/' || pg_temp.id(32)::text || '/3.png',
				pg_temp.id(2)::text || '/' || pg_temp.id(32)::text || '/4.png'
			]
		),
		'22023'
	),
	'more than three screenshots are refused'
) as test;
reset role;

select pg_temp.as_user(4);
set local role authenticated;
select pg_temp.assert_true(
	(select count(*) from storage.objects where bucket_id = 'beta-screenshots') = 0
	and (select count(*) from public.beta_reports) = 0
	and (select count(*) from public.beta_report_images) = 0,
	'another tester sees none of those reports or screenshots'
) as test;
reset role;

-- No direct writes, and nothing beyond a tester's own rows.
select pg_temp.as_user(2);
set local role authenticated;
select pg_temp.assert_true(
	pg_temp.raises(
		format(
			'insert into public.beta_reports(id, round_id, user_id, kind, details) values (%L, %L, %L, ''other'', ''x'')',
			pg_temp.id(40), pg_temp.id(11), pg_temp.id(2)
		),
		'42501'
	)
	and pg_temp.raises(
		format(
			'insert into public.beta_testers(round_id, user_id) values (%L, %L)',
			pg_temp.id(11), pg_temp.id(3)
		),
		'42501'
	)
	and pg_temp.raises(
		format(
			'insert into public.beta_surveys(round_id, user_id, survey_version, answers) values (%L, %L, 2, ''{}'')',
			pg_temp.id(11), pg_temp.id(2)
		),
		'42501'
	),
	'testers cannot write the tables directly'
) as test;
update public.beta_reports set status = 'resolved', admin_note = 'Hacked' where id = pg_temp.id(20);
select pg_temp.assert_true(
	(select status from public.beta_reports where id = pg_temp.id(20)) = 'new'
	and (select admin_note from public.beta_reports where id = pg_temp.id(20)) is null,
	'a tester cannot change a report''s status or note'
) as test;
select pg_temp.assert_true(
	(select count(*) from public.beta_rounds) = 0
	and (select count(*) from public.beta_invites) = 0
	and (select count(*) from public.beta_testers) = 0
	and (select count(*) from public.beta_announcements) = 0
	and (select count(*) from public.beta_settings) = 0,
	'a tester cannot read rounds, invites, enrollments, or settings directly'
) as test;
reset role;

-- Admin triage is visible to the tester only through the report's status and note.
select pg_temp.as_user(1);
set local role authenticated;
update public.beta_reports set status = 'investigating', admin_note = 'Looking into it'
	where id = pg_temp.id(20);
insert into public.beta_report_admin(report_id, internal_note, github_url)
	values (pg_temp.id(20), 'Seems related to rotation', 'https://github.com/Carolista/kaleidoscope/issues/1');
select pg_temp.assert_true(
	pg_temp.raises(
		format(
			'insert into public.beta_report_admin(report_id, github_url) values (%L, ''http://example.com'')',
			pg_temp.id(21)
		),
		'23514'
	),
	'only a GitHub link can be attached to a report'
) as test;
select pg_temp.assert_true(
	(select count(*) from public.beta_reports) >= 4
	-- The bucket may hold real screenshots too, so only this test's own folder is counted.
	and (select count(*) from storage.objects
		where bucket_id = 'beta-screenshots' and name like pg_temp.id(2)::text || '/%') = 1
	and (select count(*) from storage.objects where bucket_id = 'beta-screenshots') >= 1,
	'the admin sees every report and screenshot'
) as test;
reset role;
select pg_temp.as_user(2);
set local role authenticated;
select pg_temp.assert_true(
	(select status from public.beta_reports where id = pg_temp.id(20)) = 'investigating'
	and (select admin_note from public.beta_reports where id = pg_temp.id(20)) = 'Looking into it'
	and (select count(*) from public.beta_report_admin) = 0,
	'a tester sees status and the public note, never the internal notes'
) as test;
reset role;

-- A daily limit on reports.
insert into public.beta_reports(id, round_id, user_id, kind, details)
select pg_temp.id(100 + n), pg_temp.id(11), pg_temp.id(4), 'other', 'x' from generate_series(1, 20) n;
select pg_temp.as_user(4);
set local role authenticated;
select pg_temp.assert_true(
	pg_temp.raises(pg_temp.report(4, 41, 11, 'other'), '54000'),
	'twenty reports in a day is the limit'
) as test;
reset role;

-- Survey.
select pg_temp.as_user(2);
set local role authenticated;
select public.submit_beta_survey(pg_temp.id(11), '{"sean_ellis":"very_disappointed"}');
select pg_temp.assert_true(
	(select survey_version from public.beta_surveys where user_id = pg_temp.id(2)) = 2
	and (select answers ->> 'sean_ellis' from public.beta_surveys where user_id = pg_temp.id(2))
		= 'very_disappointed'
	and (public.beta_dashboard() -> 'rounds' -> 1 ->> 'survey_submitted') = 'true'
	and (public.beta_dashboard() -> 'rounds' -> 0 ->> 'survey_submitted') = 'false',
	'the survey is stored with the round''s question version'
) as test;
select pg_temp.assert_true(
	pg_temp.raises(
		format('select public.submit_beta_survey(%L, ''{}'')', pg_temp.id(11)), '23505'
	),
	'the survey is final once sent'
) as test;
select pg_temp.assert_true(
	pg_temp.raises(
		format('select public.submit_beta_survey(%L, ''{}'')', pg_temp.id(10)), '22023'
	)
	and pg_temp.raises(
		format('select public.submit_beta_survey(%L, ''{}'')', pg_temp.id(12)), '22023'
	),
	'the survey is closed outside an open round'
) as test;
reset role;
select pg_temp.as_user(4);
set local role authenticated;
select pg_temp.assert_true(
	pg_temp.raises(
		format('select public.submit_beta_survey(%L, ''[1]'')', pg_temp.id(11)), '22023'
	)
	and (select count(*) from public.beta_surveys) = 0,
	'survey answers must be an object, and a tester reads only their own'
) as test;
reset role;
select pg_temp.as_user(3);
set local role authenticated;
select pg_temp.assert_true(
	pg_temp.raises(
		format('select public.submit_beta_survey(%L, ''{}'')', pg_temp.id(11)), '42501'
	),
	'a player who is not a tester cannot send the survey'
) as test;
reset role;

-- Revoking returns the tester to a regular player.
update public.beta_testers set revoked_at = now()
	where user_id = pg_temp.id(2) and round_id = pg_temp.id(11);
select pg_temp.as_user(2);
set local role authenticated;
select pg_temp.assert_true(
	pg_temp.raises(pg_temp.report(2, 50, 11, 'bug'), '42501')
	and jsonb_array_length(public.beta_dashboard() -> 'rounds') = 2
	and not exists (
		select 1 from jsonb_array_elements(public.beta_dashboard() -> 'rounds') r
		where r ->> 'id' = pg_temp.id(11)::text
	),
	'a revoked tester loses the round'
) as test;
select pg_temp.assert_true(
	pg_temp.raises(
		format(
			'insert into storage.objects(bucket_id, name) values (''beta-screenshots'', %L)',
			pg_temp.id(2)::text || '/' || pg_temp.id(51)::text || '/b.png'
		),
		'42501'
	),
	'a revoked tester cannot upload'
) as test;
reset role;

-- Devices.
select pg_temp.as_user(4);
set local role authenticated;
select public.record_beta_device(
	pg_temp.id(11),
	'{"os":"macOS","browser":"Chrome 126","touch":false,"viewport":"1280x720"}'
);
select public.record_beta_device(
	pg_temp.id(11),
	'{"os":"macOS","browser":"Chrome 127","touch":false,"viewport":"1000x700"}'
);
select public.record_beta_device(
	pg_temp.id(11),
	'{"os":"iOS 17.4","browser":"Safari 17","touch":true,"viewport":"390x664"}'
);
select pg_temp.assert_true(
	pg_temp.raises(
		format('select public.record_beta_device(%L, ''{"os":"macOS"}'')', pg_temp.id(11)), '22023'
	)
	and pg_temp.raises(
		format('select public.record_beta_device(%L, ''[1]'')', pg_temp.id(11)), '22023'
	)
	and pg_temp.raises(
		format('select public.record_beta_device(%L, ''{"os":"macOS","browser":"Chrome 1"}'')', pg_temp.id(12)),
		'42501'
	),
	'malformed details, and a round the tester is not in, are refused'
) as test;
select pg_temp.assert_true(
	(select count(*) from public.beta_tester_devices) = 0,
	'a tester cannot read the recorded devices'
) as test;
reset role;
select pg_temp.assert_true(
	(select count(*) from public.beta_tester_devices where user_id = pg_temp.id(4)) = 2
	and (select count(*) from public.beta_tester_devices
		where user_id = pg_temp.id(4) and device_key = 'macOS|Chrome|no touch') = 1
	and (select count(*) from public.beta_tester_devices
		where user_id = pg_temp.id(4) and device_key = 'iOS 17.4|Safari|touch') = 1,
	'a device is recorded once per system, browser family, and kind of input'
) as test;
select pg_temp.assert_true(
	(select device ->> 'browser' from public.beta_tester_devices
		where user_id = pg_temp.id(4) and device_key = 'macOS|Chrome|no touch') = 'Chrome 126',
	'opening the page again within the hour leaves the record as it was'
) as test;
update public.beta_tester_devices set last_seen_at = now() - interval '2 hours';
select pg_temp.as_user(4);
set local role authenticated;
select public.record_beta_device(
	pg_temp.id(11),
	'{"os":"macOS","browser":"Chrome 127","touch":false,"viewport":"1000x700"}'
);
reset role;
select pg_temp.assert_true(
	(select device ->> 'browser' from public.beta_tester_devices
		where user_id = pg_temp.id(4) and device_key = 'macOS|Chrome|no touch') = 'Chrome 127'
	and (select count(*) from public.beta_tester_devices where user_id = pg_temp.id(4)) = 2,
	'a later visit refreshes the record without adding another'
) as test;
select pg_temp.as_user(1);
set local role authenticated;
select pg_temp.assert_true(
	(select count(*) from public.beta_tester_devices) = 2,
	'the admin sees every recorded device'
) as test;
reset role;
select pg_temp.as_user(3);
set local role authenticated;
select pg_temp.assert_true(
	pg_temp.raises(
		format('select public.record_beta_device(%L, ''{"os":"macOS","browser":"Chrome 1"}'')', pg_temp.id(11)),
		'42501'
	),
	'a player who is not a tester cannot record a device'
) as test;
reset role;
-- A round that has ended takes no more.
update public.beta_testers set revoked_at = null where user_id = pg_temp.id(2);
insert into public.beta_testers(round_id, user_id) values (pg_temp.id(10), pg_temp.id(4));
select pg_temp.as_user(4);
set local role authenticated;
select pg_temp.assert_true(
	pg_temp.raises(
		format('select public.record_beta_device(%L, ''{"os":"macOS","browser":"Chrome 1"}'')', pg_temp.id(10)),
		'22023'
	),
	'an ended round takes no more devices'
) as test;
reset role;

-- Guests have no access to any of it.
set local role anon;
select pg_temp.assert_true(
	pg_temp.raises('select public.beta_dashboard()', '42501')
	and pg_temp.raises('select public.redeem_beta_invite(''x'')', '42501')
	and pg_temp.raises('select count(*) from public.beta_rounds', '42501'),
	'guests cannot reach the beta'
) as test;
reset role;

rollback;
