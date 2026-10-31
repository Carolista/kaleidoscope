create role anon nologin;
create role authenticated nologin;

create schema auth;
create table auth.users (
	id uuid primary key default gen_random_uuid(),
	email text,
	raw_user_meta_data jsonb
);
create function auth.uid() returns uuid
language sql stable as $$
	select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create schema storage;
create table storage.buckets (
	id text primary key,
	name text,
	public boolean default false,
	file_size_limit bigint,
	allowed_mime_types text[]
);
create table storage.objects (
	id uuid primary key default gen_random_uuid(),
	bucket_id text,
	name text,
	owner uuid
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[]
language sql immutable as $$
	select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

grant usage on schema auth, storage to anon, authenticated;
grant all on all tables in schema storage to anon, authenticated;
grant select on auth.users to authenticated;
