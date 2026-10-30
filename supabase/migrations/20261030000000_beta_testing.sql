begin;

-- Closed beta testing, in rounds. A round has its own dates, copy, announcements, invites,
-- testers, reports, and survey answers, so a second round is a new row, not a code change.
-- Testers are ordinary players enrolled in a round; nothing about their account changes, and
-- access simply stops when the round ends or an admin revokes the enrollment.
--
-- Players never write these tables directly. Everything a tester does goes through a function
-- that checks enrollment and that the round is open. The admin reads and manages every table
-- through `admin_crud`, which also means an admin signed in to the player app sees every
-- tester's rows: player-side reads must filter by `user_id`.

create table public.beta_settings (
	singleton boolean primary key default true check (singleton),
	-- Where invite links point; changes with the domain, so it is data and not code.
	site_url text not null check (site_url ~ '^https?://[^/\s]+$')
);
insert into public.beta_settings (site_url) values ('https://www.kaleidoscopepuzzle.com');

create table public.beta_rounds (
	id uuid primary key default gen_random_uuid(),
	name text not null check (btrim(name) <> '' and length(name) <= 80),
	starts_at timestamptz not null,
	ends_at timestamptz not null,
	welcome text not null default '' check (length(welcome) <= 4000),
	instructions text not null default '' check (length(instructions) <= 8000),
	-- Which question set in the app the final survey uses.
	survey_version integer not null default 1 check (survey_version > 0),
	created_at timestamptz not null default now(),
	check (ends_at > starts_at),
	-- One round at a time, so "the current round" is never ambiguous.
	exclude using gist (tstzrange(starts_at, ends_at) with &&)
);

create table public.beta_announcements (
	id uuid primary key default gen_random_uuid(),
	round_id uuid not null references public.beta_rounds(id) on delete cascade,
	title text not null check (btrim(title) <> '' and length(title) <= 120),
	body text not null default '' check (length(body) <= 2000),
	pinned boolean not null default false,
	-- Null is a draft; testers see it from this moment on.
	published_at timestamptz,
	created_at timestamptz not null default now()
);
create index beta_announcements_round_idx on public.beta_announcements(round_id);

create table public.beta_invites (
	id uuid primary key default gen_random_uuid(),
	round_id uuid not null references public.beta_rounds(id) on delete cascade,
	name text not null check (btrim(name) <> '' and length(name) <= 80),
	email text not null check (length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
	-- Only a hash of the link's token is kept; sending again makes a new token.
	token_hash text not null unique,
	created_at timestamptz not null default now(),
	redeemed_by uuid references auth.users(id) on delete set null,
	redeemed_at timestamptz
);
create unique index beta_invites_round_email_idx on public.beta_invites(round_id, lower(email));

create table public.beta_testers (
	round_id uuid not null references public.beta_rounds(id) on delete restrict,
	user_id uuid not null references auth.users(id) on delete cascade,
	invite_id uuid references public.beta_invites(id) on delete set null,
	granted_at timestamptz not null default now(),
	revoked_at timestamptz,
	primary key (round_id, user_id)
);
create index beta_testers_user_idx on public.beta_testers(user_id);

create table public.beta_reports (
	id uuid primary key,
	round_id uuid not null references public.beta_rounds(id) on delete restrict,
	user_id uuid not null references auth.users(id) on delete cascade,
	kind text not null check (kind in ('bug', 'suggestion', 'other')),
	attempted text check (attempted is null or (btrim(attempted) <> '' and length(attempted) <= 2000)),
	happened text check (happened is null or (btrim(happened) <> '' and length(happened) <= 2000)),
	expected text check (expected is null or (btrim(expected) <> '' and length(expected) <= 2000)),
	-- A suggestion's "feature: subfeature" choice.
	feature text check (feature is null or (btrim(feature) <> '' and length(feature) <= 100)),
	details text check (details is null or (btrim(details) <> '' and length(details) <= 4000)),
	device jsonb not null default '{}' check (
		jsonb_typeof(device) = 'object' and length(device::text) <= 4000
	),
	status text not null default 'new' check (status in ('new', 'investigating', 'resolved')),
	-- A short reply from the admin that the tester can read.
	admin_note text check (admin_note is null or length(admin_note) <= 1000),
	created_at timestamptz not null default now(),
	check (
		(kind = 'bug' and attempted is not null and happened is not null and expected is not null)
		or (kind = 'suggestion' and feature is not null and details is not null)
		or (kind = 'other' and details is not null)
	)
);
create index beta_reports_round_idx on public.beta_reports(round_id, created_at desc);
create index beta_reports_user_idx on public.beta_reports(user_id, created_at desc);

-- What only the admin sees about a report, kept apart because a tester can read their own.
create table public.beta_report_admin (
	report_id uuid primary key references public.beta_reports(id) on delete cascade,
	internal_note text check (internal_note is null or length(internal_note) <= 4000),
	github_url text check (github_url is null or github_url ~ '^https://github\.com/[^\s]+$')
);

create table public.beta_report_images (
	report_id uuid not null references public.beta_reports(id) on delete cascade,
	-- Object name in the private `beta-screenshots` bucket: <user id>/<report id>/<file>.
	path text not null check (length(path) <= 200),
	primary key (report_id, path)
);

create table public.beta_surveys (
	round_id uuid not null references public.beta_rounds(id) on delete restrict,
	user_id uuid not null references auth.users(id) on delete cascade,
	survey_version integer not null,
	answers jsonb not null check (jsonb_typeof(answers) = 'object' and length(answers::text) <= 20000),
	submitted_at timestamptz not null default now(),
	primary key (round_id, user_id)
);

-- Helpers.
create function private.beta_token_hash(p_token text)
returns text
language sql immutable set search_path = ''
as $$
	select encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

create function private.is_beta_tester(p_round uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
	select exists (
		select 1 from public.beta_testers
		where round_id = p_round and user_id = (select auth.uid()) and revoked_at is null
	);
$$;

-- Whether the signed-in player may send reports in some round right now.
create function private.beta_can_report()
returns boolean
language sql stable security definer set search_path = ''
as $$
	select exists (
		select 1
		from public.beta_testers t
		join public.beta_rounds r on r.id = t.round_id
		where t.user_id = (select auth.uid()) and t.revoked_at is null
			and r.starts_at <= now() and now() < r.ends_at
	);
$$;

-- Row security.
alter table public.beta_settings enable row level security;
alter table public.beta_rounds enable row level security;
alter table public.beta_announcements enable row level security;
alter table public.beta_invites enable row level security;
alter table public.beta_testers enable row level security;
alter table public.beta_reports enable row level security;
alter table public.beta_report_admin enable row level security;
alter table public.beta_report_images enable row level security;
alter table public.beta_surveys enable row level security;

create policy admin_crud on public.beta_settings for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.beta_rounds for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.beta_announcements for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.beta_invites for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.beta_testers for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.beta_reports for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.beta_report_admin for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.beta_report_images for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.beta_surveys for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));

create policy own_read on public.beta_reports for select to authenticated
	using (user_id = (select auth.uid()));
create policy own_read on public.beta_report_images for select to authenticated
	using (exists (
		select 1 from public.beta_reports r
		where r.id = report_id and r.user_id = (select auth.uid())
	));
create policy own_read on public.beta_surveys for select to authenticated
	using (user_id = (select auth.uid()));

revoke all on
	public.beta_settings, public.beta_rounds, public.beta_announcements, public.beta_invites,
	public.beta_testers, public.beta_reports, public.beta_report_admin,
	public.beta_report_images, public.beta_surveys
	from anon, authenticated;
grant select, insert, update, delete on
	public.beta_settings, public.beta_rounds, public.beta_announcements, public.beta_invites,
	public.beta_testers, public.beta_reports, public.beta_report_admin,
	public.beta_report_images, public.beta_surveys
	to authenticated;

-- Screenshots: a private bucket with its limits enforced by Storage itself. A tester may add
-- and see files only under their own user id, and only while a round is open for them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'beta-screenshots', 'beta-screenshots', false, 5242880,
	array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
	public = false,
	file_size_limit = excluded.file_size_limit,
	allowed_mime_types = excluded.allowed_mime_types;

create policy beta_screenshots_admin on storage.objects for all to authenticated
	using (bucket_id = 'beta-screenshots' and (select private.is_admin()))
	with check (bucket_id = 'beta-screenshots' and (select private.is_admin()));
create policy beta_screenshots_upload on storage.objects for insert to authenticated
	with check (
		bucket_id = 'beta-screenshots'
		and (storage.foldername(name))[1] = (select auth.uid())::text
		and (select private.beta_can_report())
	);
create policy beta_screenshots_read on storage.objects for select to authenticated
	using (
		bucket_id = 'beta-screenshots'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);
-- Lets a tester clear away uploads when a report could not be sent.
create policy beta_screenshots_delete on storage.objects for delete to authenticated
	using (
		bucket_id = 'beta-screenshots'
		and (storage.foldername(name))[1] = (select auth.uid())::text
		and (select private.beta_can_report())
	);

-- Admin: invite someone to a round. Returns the link's token, which is shown only now.
-- Inviting an address again replaces its unused token; someone who has joined cannot be invited again.
create function public.create_beta_invite(p_round uuid, p_name text, p_email text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
	token text := 'b' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
	invite_id uuid;
	joined timestamptz;
begin
	if not (select private.is_admin()) then
		raise exception 'Only the admin can invite testers.' using errcode = '42501';
	end if;
	p_name := btrim(coalesce(p_name, ''));
	p_email := btrim(coalesce(p_email, ''));
	if not exists (select 1 from public.beta_rounds where id = p_round and now() < ends_at) then
		raise exception 'Choose a beta round that has not ended.' using errcode = '22023';
	end if;

	select id, redeemed_at into invite_id, joined
	from public.beta_invites
	where round_id = p_round and lower(email) = lower(p_email)
	for update;
	if joined is not null then
		raise exception 'That person has already joined this round.' using errcode = '23505';
	end if;

	if invite_id is null then
		insert into public.beta_invites (round_id, name, email, token_hash)
		values (p_round, p_name, p_email, private.beta_token_hash(token))
		returning id into invite_id;
	else
		update public.beta_invites
		set name = p_name, token_hash = private.beta_token_hash(token), created_at = now()
		where id = invite_id;
	end if;
	return jsonb_build_object('invite_id', invite_id, 'token', token);
end;
$$;

-- A signed-in player uses an invite link's token to join its round. Safe to repeat.
create function public.redeem_beta_invite(p_token text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
	player uuid := (select auth.uid());
	invite public.beta_invites;
	enrolled public.beta_testers;
begin
	if player is null then
		raise exception 'Sign in to join the beta.' using errcode = '42501';
	end if;
	if (select private.is_admin()) then
		raise exception 'The admin does not join as a tester.' using errcode = '42501';
	end if;

	select * into invite from public.beta_invites
	where token_hash = private.beta_token_hash(coalesce(p_token, ''))
	for update;
	if not found then
		raise exception 'This invite link is not valid.' using errcode = '22023';
	end if;
	if invite.redeemed_by is not null and invite.redeemed_by <> player then
		raise exception 'This invite link has already been used.' using errcode = '22023';
	end if;
	if not exists (select 1 from public.beta_rounds where id = invite.round_id and now() < ends_at) then
		raise exception 'This beta round has ended.' using errcode = '22023';
	end if;

	select * into enrolled from public.beta_testers
	where round_id = invite.round_id and user_id = player;
	if found and enrolled.revoked_at is not null then
		raise exception 'Your access to this beta round has ended.' using errcode = '42501';
	end if;

	insert into public.beta_testers (round_id, user_id, invite_id)
	values (invite.round_id, player, invite.id)
	on conflict do nothing;
	update public.beta_invites
	set redeemed_by = player, redeemed_at = coalesce(redeemed_at, now())
	where id = invite.id;
	return invite.round_id;
end;
$$;

-- Everything the /beta page needs in one call: the rounds the player is enrolled in (all of them
-- for the admin, who previews without enrolling), with their announcements and survey status.
-- `now` is the server's clock, so the countdown does not depend on the device's.
create function public.beta_dashboard()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
	player uuid := (select auth.uid());
	admin boolean := (select private.is_admin());
begin
	if player is null then
		raise exception 'Sign in to open the beta.' using errcode = '42501';
	end if;
	return jsonb_build_object(
		'now', now(),
		'preview', admin,
		'rounds', coalesce((
			select jsonb_agg(
				jsonb_build_object(
					'id', r.id,
					'name', r.name,
					'starts_at', r.starts_at,
					'ends_at', r.ends_at,
					'welcome', r.welcome,
					'instructions', r.instructions,
					'survey_version', r.survey_version,
					'state', case
						when now() < r.starts_at then 'upcoming'
						when now() < r.ends_at then 'open'
						else 'closed'
					end,
					'survey_submitted', exists (
						select 1 from public.beta_surveys s
						where s.round_id = r.id and s.user_id = player
					),
					'announcements', coalesce((
						select jsonb_agg(
							jsonb_build_object(
								'id', a.id, 'title', a.title, 'body', a.body,
								'pinned', a.pinned, 'published_at', a.published_at
							)
							order by a.pinned desc, a.published_at desc
						)
						from public.beta_announcements a
						where a.round_id = r.id and a.published_at <= now()
					), '[]')
				)
				order by r.starts_at desc
			)
			from public.beta_rounds r
			where admin or exists (
				select 1 from public.beta_testers t
				where t.round_id = r.id and t.user_id = player and t.revoked_at is null
			)
		), '[]')
	);
end;
$$;

-- A tester sends a bug report, a suggestion, or other feedback. The app picks the id first so
-- screenshots can be uploaded under it; sending the same id again returns the report unchanged.
-- Images are the object names of files already uploaded under <user id>/<report id>/.
create function public.submit_beta_report(
	p_id uuid,
	p_round uuid,
	p_kind text,
	p_attempted text,
	p_happened text,
	p_expected text,
	p_feature text,
	p_details text,
	p_device jsonb,
	p_images text[]
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
	player uuid := (select auth.uid());
	existing uuid;
	image text;
begin
	if player is null then
		raise exception 'Sign in to send a report.' using errcode = '42501';
	end if;
	if not (select private.is_beta_tester(p_round)) then
		raise exception 'You are not part of this beta round.' using errcode = '42501';
	end if;

	select user_id into existing from public.beta_reports where id = p_id;
	if existing = player then
		return p_id;
	elsif existing is not null then
		raise exception 'That report id is taken.' using errcode = '23505';
	end if;

	if not exists (
		select 1 from public.beta_rounds where id = p_round and starts_at <= now() and now() < ends_at
	) then
		raise exception 'This beta round is not open for reports.' using errcode = '22023';
	end if;
	if (
		select count(*) from public.beta_reports
		where user_id = player and created_at > now() - interval '24 hours'
	) >= 20 then
		raise exception 'That is a lot of reports for one day. Please try again tomorrow.'
			using errcode = '54000';
	end if;

	p_images := coalesce(p_images, '{}');
	if cardinality(p_images) > 3 then
		raise exception 'Attach up to three screenshots.' using errcode = '22023';
	end if;
	foreach image in array p_images loop
		if image not like player::text || '/' || p_id::text || '/%'
			or image like '%..%'
			or not exists (
				select 1 from storage.objects where bucket_id = 'beta-screenshots' and name = image
			)
		then
			raise exception 'A screenshot was not uploaded correctly.' using errcode = '22023';
		end if;
	end loop;

	insert into public.beta_reports (
		id, round_id, user_id, kind, attempted, happened, expected, feature, details, device
	)
	values (
		p_id, p_round, player, p_kind,
		nullif(btrim(p_attempted), ''), nullif(btrim(p_happened), ''), nullif(btrim(p_expected), ''),
		nullif(btrim(p_feature), ''), nullif(btrim(p_details), ''), coalesce(p_device, '{}')
	);
	insert into public.beta_report_images (report_id, path)
	select p_id, unnest(p_images);
	return p_id;
end;
$$;

-- A tester's final survey: one per round, and final once sent. The questions live in the app,
-- versioned by the round's `survey_version`, so the answers are stored as they were asked.
create function public.submit_beta_survey(p_round uuid, p_answers jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
	player uuid := (select auth.uid());
	version integer;
begin
	if player is null then
		raise exception 'Sign in to send the survey.' using errcode = '42501';
	end if;
	if not (select private.is_beta_tester(p_round)) then
		raise exception 'You are not part of this beta round.' using errcode = '42501';
	end if;
	select survey_version into version from public.beta_rounds
	where id = p_round and starts_at <= now() and now() < ends_at;
	if not found then
		raise exception 'This beta round is not open for the survey.' using errcode = '22023';
	end if;
	if exists (select 1 from public.beta_surveys where round_id = p_round and user_id = player) then
		raise exception 'You have already sent the survey.' using errcode = '23505';
	end if;
	if jsonb_typeof(p_answers) is distinct from 'object' or length(p_answers::text) > 20000 then
		raise exception 'The survey answers are not valid.' using errcode = '22023';
	end if;
	insert into public.beta_surveys (round_id, user_id, survey_version, answers)
	values (p_round, player, version, p_answers);
end;
$$;

revoke all on function
	public.create_beta_invite(uuid, text, text), public.redeem_beta_invite(text),
	public.beta_dashboard(), public.submit_beta_survey(uuid, jsonb),
	public.submit_beta_report(uuid, uuid, text, text, text, text, text, text, jsonb, text[])
	from public, anon;
grant execute on function
	public.create_beta_invite(uuid, text, text), public.redeem_beta_invite(text),
	public.beta_dashboard(), public.submit_beta_survey(uuid, jsonb),
	public.submit_beta_report(uuid, uuid, text, text, text, text, text, text, jsonb, text[])
	to authenticated;

commit;
