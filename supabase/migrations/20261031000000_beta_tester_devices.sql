begin;

-- The devices testers open the beta page on, so the admin can see which systems and browsers
-- have been covered and where the gaps are, whether or not anyone reported a bug there.
-- One row per tester and round for each system, browser, and kind of input; opening the page
-- again on the same device only refreshes it. Nothing here is readable by testers.
create table public.beta_tester_devices (
	round_id uuid not null references public.beta_rounds(id) on delete restrict,
	user_id uuid not null references auth.users(id) on delete cascade,
	-- "system|browser family|touch", as worked out by the database from the details sent.
	device_key text not null check (length(device_key) <= 200),
	-- The details as of the latest visit (see the app's DeviceInfo).
	device jsonb not null check (jsonb_typeof(device) = 'object' and length(device::text) <= 4000),
	first_seen_at timestamptz not null default now(),
	last_seen_at timestamptz not null default now(),
	primary key (round_id, user_id, device_key)
);
create index beta_tester_devices_user_idx on public.beta_tester_devices(user_id);

alter table public.beta_tester_devices enable row level security;
create policy admin_crud on public.beta_tester_devices for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
revoke all on public.beta_tester_devices from anon, authenticated;
grant select, insert, update, delete on public.beta_tester_devices to authenticated;

-- A tester's device, recorded when they open the beta page while a round is open.
create function public.record_beta_device(p_round uuid, p_device jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
	player uuid := (select auth.uid());
	system text;
	browser text;
	combo text;
begin
	if player is null then
		raise exception 'Sign in to open the beta.' using errcode = '42501';
	end if;
	if not (select private.is_beta_tester(p_round)) then
		raise exception 'You are not part of this beta round.' using errcode = '42501';
	end if;
	if not exists (
		select 1 from public.beta_rounds where id = p_round and starts_at <= now() and now() < ends_at
	) then
		raise exception 'This beta round is not open.' using errcode = '22023';
	end if;
	if jsonb_typeof(p_device) is distinct from 'object' or length(p_device::text) > 4000 then
		raise exception 'The device details are not valid.' using errcode = '22023';
	end if;
	system := nullif(btrim(p_device ->> 'os'), '');
	browser := nullif(btrim(split_part(coalesce(p_device ->> 'browser', ''), ' ', 1)), '');
	if system is null or browser is null then
		raise exception 'The device details are not valid.' using errcode = '22023';
	end if;
	-- The kind of input is part of the key because a laptop and a tablet can run one browser.
	combo := system || '|' || browser || '|'
		|| case when p_device ->> 'touch' = 'true' then 'touch' else 'no touch' end;

	insert into public.beta_tester_devices (round_id, user_id, device_key, device)
	values (p_round, player, combo, p_device)
	on conflict (round_id, user_id, device_key) do update
		set device = excluded.device, last_seen_at = now()
		where public.beta_tester_devices.last_seen_at < now() - interval '1 hour';
end;
$$;

revoke all on function public.record_beta_device(uuid, jsonb) from public, anon;
grant execute on function public.record_beta_device(uuid, jsonb) to authenticated;

commit;
