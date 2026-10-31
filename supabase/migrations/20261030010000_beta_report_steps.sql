begin;

-- A bug report's first question became "What steps would we take to reproduce the issue?",
-- so the column that held what the tester had been doing now holds those steps.
alter table public.beta_reports rename column attempted to steps;
alter table public.beta_reports
	rename constraint beta_reports_attempted_check to beta_reports_steps_check;

-- Same function, with the steps renamed and every field after the kind optional, so a bug
-- report sends no suggestion fields and the other way round. A function's parameter names
-- cannot change in place, so it is replaced.
drop function public.submit_beta_report(uuid, uuid, text, text, text, text, text, text, jsonb, text[]);
create function public.submit_beta_report(
	p_id uuid,
	p_round uuid,
	p_kind text,
	p_steps text default null,
	p_happened text default null,
	p_expected text default null,
	p_feature text default null,
	p_details text default null,
	p_device jsonb default '{}',
	p_images text[] default '{}'
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
		id, round_id, user_id, kind, steps, happened, expected, feature, details, device
	)
	values (
		p_id, p_round, player, p_kind,
		nullif(btrim(p_steps), ''), nullif(btrim(p_happened), ''), nullif(btrim(p_expected), ''),
		nullif(btrim(p_feature), ''), nullif(btrim(p_details), ''), coalesce(p_device, '{}')
	);
	insert into public.beta_report_images (report_id, path)
	select p_id, unnest(p_images);
	return p_id;
end;
$$;

revoke all on function
	public.submit_beta_report(uuid, uuid, text, text, text, text, text, text, jsonb, text[])
	from public, anon;
grant execute on function
	public.submit_beta_report(uuid, uuid, text, text, text, text, text, text, jsonb, text[])
	to authenticated;

commit;
