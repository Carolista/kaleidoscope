begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;
revoke create on schema public from public, anon, authenticated;

create table public.admin_account (
	singleton boolean primary key default true check (singleton),
	user_id uuid not null unique references auth.users(id) on delete restrict
);

create table public.profiles (
	user_id uuid primary key references auth.users(id) on delete cascade,
	username text check (username is null or (username = btrim(username) and username <> '')),
	created_at timestamptz not null default now()
);
create unique index profiles_username_unique on public.profiles (lower(username));

create table public.palettes (
	id text primary key check (id <> '' and id = btrim(id)),
	name text not null check (btrim(name) <> ''),
	colors text[] not null,
	revision bigint not null default 1 check (revision > 0),
	published_at timestamptz,
	release_at timestamptz,
	check ((published_at is null) = (release_at is null)),
	check (
		array_ndims(colors) = 1 and array_lower(colors, 1) = 1
		and cardinality(colors) = 5 and array_position(colors, null) is null
		and colors[1] ~ '^#[0-9A-Fa-f]{6}$'
		and colors[2] ~ '^#[0-9A-Fa-f]{6}$'
		and colors[3] ~ '^#[0-9A-Fa-f]{6}$'
		and colors[4] ~ '^#[0-9A-Fa-f]{6}$'
		and colors[5] ~ '^#[0-9A-Fa-f]{6}$'
	)
);

create table public.palette_corrections (
	id bigint generated always as identity primary key,
	palette_id text not null references public.palettes(id) on delete restrict,
	revision bigint not null,
	old_colors text[] not null,
	new_colors text[] not null,
	changed_by uuid references auth.users(id) on delete set null,
	changed_at timestamptz not null default now(),
	unique (palette_id, revision)
);

create table public.shapes (
	id text primary key check (id in (
		'hexagon', 'triangle', 'diamondStar', 'hexagram', 'circleRings', 'pinwheel'
	)),
	name text not null check (btrim(name) <> ''),
	published_at timestamptz,
	release_at timestamptz,
	check ((published_at is null) = (release_at is null))
);

create table public.puzzle_collections (
	id uuid primary key default gen_random_uuid(),
	name text not null check (btrim(name) <> ''),
	kind text not null check (kind in ('core', 'reward', 'paid')),
	shape_id text not null references public.shapes(id) on delete restrict,
	selection_mode text not null default 'any' check (selection_mode in ('fixed', 'any')),
	published_at timestamptz,
	release_at timestamptz,
	unique (id, shape_id),
	check ((published_at is null) = (release_at is null))
);

create function private.valid_puzzle_definition(definition jsonb)
returns boolean
language plpgsql immutable set search_path = ''
as $$
declare
	piece jsonb;
	tile jsonb;
	slot jsonb;
	piece_ids text[] := '{}';
begin
	if definition is null
		or jsonb_typeof(definition) <> 'object'
		or definition - array['version', 'geometry', 'target', 'pieces'] <> '{}'::jsonb
		or definition -> 'version' is distinct from '2'::jsonb
		or jsonb_typeof(definition -> 'geometry') is distinct from 'object'
		or jsonb_typeof(definition -> 'target') is distinct from 'object'
		or definition -> 'target' = '{}'::jsonb
		or jsonb_typeof(definition -> 'pieces') is distinct from 'array'
		or definition -> 'pieces' = '[]'::jsonb then
		return false;
	end if;
	for slot in select value from jsonb_each(definition -> 'target') loop
		if slot not in ('0'::jsonb, '1'::jsonb, '2'::jsonb, '3'::jsonb, '4'::jsonb) then
			return false;
		end if;
	end loop;
	for piece in select value from jsonb_array_elements(definition -> 'pieces') loop
		if jsonb_typeof(piece) <> 'object'
			or jsonb_typeof(piece -> 'id') is distinct from 'string'
			or btrim(piece ->> 'id') = ''
			or piece ->> 'id' = any(piece_ids)
			or jsonb_typeof(piece -> 'tiles') is distinct from 'array'
			or piece -> 'tiles' = '[]'::jsonb then
			return false;
		end if;
		piece_ids := array_append(piece_ids, piece ->> 'id');
		for tile in select value from jsonb_array_elements(piece -> 'tiles') loop
			if jsonb_typeof(tile) <> 'object'
				or jsonb_typeof(tile -> 'q') is distinct from 'number'
				or jsonb_typeof(tile -> 'r') is distinct from 'number'
				or (tile ->> 'q') !~ '^-?[0-9]+$'
				or (tile ->> 'r') !~ '^-?[0-9]+$'
				or not (tile ? 'color_slot')
				or tile -> 'color_slot' not in (
					'0'::jsonb, '1'::jsonb, '2'::jsonb, '3'::jsonb, '4'::jsonb
				) then
				return false;
			end if;
		end loop;
	end loop;
	return true;
end;
$$;

create table public.puzzles (
	id uuid primary key default gen_random_uuid(),
	name text not null check (btrim(name) <> ''),
	usage text not null check (usage in ('collection', 'daily')),
	shape_id text not null references public.shapes(id) on delete restrict,
	palette_id text not null references public.palettes(id) on delete restrict,
	board_size text not null check (board_size in ('sm', 'md', 'lg')),
	rotation_allowed boolean not null,
	difficulty text not null check (difficulty in ('easy', 'moderate', 'hard', 'super_hard')),
	definition jsonb not null check (private.valid_puzzle_definition(definition)),
	published_at timestamptz,
	release_at timestamptz,
	unique (id, shape_id, usage),
	unique (id, usage),
	check ((published_at is null) = (release_at is null)),
	check (
		(difficulty = 'easy' and board_size = 'sm' and not rotation_allowed)
		or (difficulty = 'moderate' and (
			(board_size = 'md' and not rotation_allowed)
			or (board_size = 'sm' and rotation_allowed)
		))
		or (difficulty = 'hard' and (
			(board_size = 'lg' and not rotation_allowed)
			or (board_size = 'md' and rotation_allowed)
		))
		or (difficulty = 'super_hard' and board_size = 'lg' and rotation_allowed)
	)
);
create index puzzles_palette_idx on public.puzzles(palette_id);
create index puzzles_shape_idx on public.puzzles(shape_id);

create table public.puzzle_authoring (
	puzzle_id uuid primary key references public.puzzles(id) on delete cascade,
	seed text not null check (btrim(seed) <> ''),
	generator_version text not null check (btrim(generator_version) <> ''),
	known_solution jsonb not null check (jsonb_typeof(known_solution) = 'object')
);

create table public.collection_puzzles (
	puzzle_id uuid primary key,
	collection_id uuid not null,
	shape_id text not null,
	puzzle_usage text not null default 'collection' check (puzzle_usage = 'collection'),
	position integer not null check (position > 0),
	unique (collection_id, position),
	unique (collection_id, puzzle_id),
	foreign key (collection_id, shape_id)
		references public.puzzle_collections(id, shape_id) on delete cascade,
	foreign key (puzzle_id, shape_id, puzzle_usage)
		references public.puzzles(id, shape_id, usage) on delete restrict
);

create table public.completion_routes (
	id uuid primary key default gen_random_uuid(),
	collection_id uuid not null references public.puzzle_collections(id) on delete cascade,
	name text not null check (btrim(name) <> ''),
	position integer not null check (position > 0),
	unique (id, collection_id),
	unique (collection_id, position)
);

create table public.route_puzzles (
	route_id uuid not null,
	collection_id uuid not null,
	puzzle_id uuid not null,
	primary key (route_id, puzzle_id),
	foreign key (route_id, collection_id)
		references public.completion_routes(id, collection_id) on delete cascade,
	foreign key (collection_id, puzzle_id)
		references public.collection_puzzles(collection_id, puzzle_id) on delete restrict
);
create index route_puzzles_membership_idx on public.route_puzzles(collection_id, puzzle_id);

create table public.core_progression (
	singleton boolean primary key default true check (singleton),
	name text not null check (btrim(name) <> ''),
	published_at timestamptz,
	release_at timestamptz,
	check ((published_at is null) = (release_at is null))
);

create table public.core_steps (
	collection_id uuid primary key references public.puzzle_collections(id) on delete restrict,
	position integer not null unique check (position > 0)
);

create table public.reward_rules (
	id uuid primary key default gen_random_uuid(),
	collection_id uuid not null references public.puzzle_collections(id) on delete cascade,
	route_id uuid,
	foreign key (route_id, collection_id)
		references public.completion_routes(id, collection_id) on delete restrict
);
create index reward_rules_collection_idx on public.reward_rules(collection_id);
create index reward_rules_route_idx on public.reward_rules(route_id, collection_id);

create table public.reward_palettes (
	reward_rule_id uuid not null references public.reward_rules(id) on delete cascade,
	palette_id text not null references public.palettes(id) on delete restrict,
	primary key (reward_rule_id, palette_id)
);
create table public.reward_sets (
	reward_rule_id uuid not null references public.reward_rules(id) on delete cascade,
	collection_id uuid not null references public.puzzle_collections(id) on delete restrict,
	primary key (reward_rule_id, collection_id)
);
create table public.reward_shapes (
	reward_rule_id uuid not null references public.reward_rules(id) on delete cascade,
	shape_id text not null references public.shapes(id) on delete restrict,
	primary key (reward_rule_id, shape_id)
);

create table public.starter_palettes (
	palette_id text primary key references public.palettes(id) on delete restrict
);
create table public.starter_shapes (
	shape_id text primary key references public.shapes(id) on delete restrict
);

create table public.palette_packs (
	id uuid primary key default gen_random_uuid(),
	name text not null check (btrim(name) <> ''),
	published_at timestamptz,
	release_at timestamptz,
	check ((published_at is null) = (release_at is null))
);
create table public.palette_pack_palettes (
	pack_id uuid not null references public.palette_packs(id) on delete cascade,
	palette_id text not null references public.palettes(id) on delete restrict,
	position integer not null check (position > 0),
	primary key (pack_id, palette_id),
	unique (pack_id, position)
);

create table public.daily_schedule (
	singleton boolean primary key default true check (singleton),
	rollover_time_utc time not null
);

create table public.daily_puzzles (
	id uuid primary key default gen_random_uuid(),
	puzzle_id uuid not null unique,
	puzzle_usage text not null default 'daily' check (puzzle_usage = 'daily'),
	release_at timestamptz not null unique,
	expires_at timestamptz not null,
	foreign key (puzzle_id, puzzle_usage)
		references public.puzzles(id, usage) on delete restrict,
	check (expires_at - release_at = interval '120 hours')
);

create table public.puzzle_completions (
	user_id uuid not null references auth.users(id) on delete cascade,
	puzzle_id uuid not null references public.puzzles(id) on delete restrict,
	completed_at timestamptz not null default now(),
	primary key (user_id, puzzle_id)
);
create table public.set_qualifications (
	user_id uuid not null references auth.users(id) on delete cascade,
	collection_id uuid not null references public.puzzle_collections(id) on delete restrict,
	route_id uuid not null,
	qualified_at timestamptz not null default now(),
	primary key (user_id, collection_id),
	foreign key (route_id, collection_id)
		references public.completion_routes(id, collection_id) on delete restrict
);

create table public.palette_grants (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users(id) on delete cascade,
	palette_id text not null references public.palettes(id) on delete restrict,
	source text not null check (source in ('reward', 'admin')),
	reward_rule_id uuid references public.reward_rules(id) on delete restrict,
	granted_at timestamptz not null default now(),
	check ((source = 'reward') = (reward_rule_id is not null)),
	unique nulls not distinct (user_id, palette_id, source, reward_rule_id)
);
create table public.shape_grants (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users(id) on delete cascade,
	shape_id text not null references public.shapes(id) on delete restrict,
	source text not null check (source in ('reward', 'admin')),
	reward_rule_id uuid references public.reward_rules(id) on delete restrict,
	granted_at timestamptz not null default now(),
	check ((source = 'reward') = (reward_rule_id is not null)),
	unique nulls not distinct (user_id, shape_id, source, reward_rule_id)
);
create table public.collection_grants (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users(id) on delete cascade,
	collection_id uuid not null references public.puzzle_collections(id) on delete restrict,
	source text not null check (source in ('reward', 'admin')),
	reward_rule_id uuid references public.reward_rules(id) on delete restrict,
	granted_at timestamptz not null default now(),
	check ((source = 'reward') = (reward_rule_id is not null)),
	unique nulls not distinct (user_id, collection_id, source, reward_rule_id)
);
create table public.feature_grants (
	user_id uuid not null references auth.users(id) on delete cascade,
	feature text not null check (feature = 'zen_randomizer'),
	source text not null check (source in ('core_progression', 'admin')),
	granted_at timestamptz not null default now(),
	primary key (user_id, feature)
);

create table public.puzzle_attempts (
	user_id uuid not null references auth.users(id) on delete cascade,
	puzzle_id uuid not null references public.puzzles(id) on delete restrict,
	placements jsonb not null default '{}'::jsonb check (jsonb_typeof(placements) = 'object'),
	revision bigint not null default 1 check (revision > 0),
	updated_at timestamptz not null default now(),
	primary key (user_id, puzzle_id)
);
create table public.daily_play_sessions (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users(id) on delete cascade,
	daily_id uuid not null references public.daily_puzzles(id) on delete restrict,
	opened_at timestamptz not null default now(),
	closed_at timestamptz,
	check (closed_at is null or closed_at >= opened_at)
);
create index daily_play_sessions_access_idx
	on public.daily_play_sessions(user_id, daily_id) where closed_at is null;

create function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
	select exists (
		select 1 from public.admin_account where user_id = (select auth.uid())
	);
$$;

create function private.is_released(published_at timestamptz, release_at timestamptz)
returns boolean
language sql stable set search_path = ''
as $$
	select published_at is not null and release_at <= now();
$$;

create function private.collection_released(collection_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
	select exists (
		select 1 from public.puzzle_collections c
		where c.id = collection_id and private.is_released(c.published_at, c.release_at)
	);
$$;

create function private.has_shape(shape_id text)
returns boolean
language sql stable security definer set search_path = ''
as $$
	select exists (select 1 from public.starter_shapes s where s.shape_id = has_shape.shape_id)
		or exists (
			select 1 from public.shape_grants g
			where g.shape_id = has_shape.shape_id and g.user_id = (select auth.uid())
		);
$$;

create function private.can_play_collection(collection_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
	select exists (
		select 1 from public.puzzle_collections c
		where c.id = collection_id
			and private.is_released(c.published_at, c.release_at)
			and private.has_shape(c.shape_id)
			and (
				(c.kind = 'core' and exists (
					select 1 from public.core_steps step
					where step.collection_id = c.id
						and exists (
							select 1 from public.core_progression p
							where private.is_released(p.published_at, p.release_at)
						)
						and (
							step.position = 1
							or ((select auth.uid()) is not null and not exists (
								select 1 from public.core_steps previous
								where previous.position < step.position
									and not exists (
										select 1 from public.set_qualifications q
										where q.user_id = (select auth.uid())
											and q.collection_id = previous.collection_id
									)
							))
						)
				))
				or (c.kind in ('reward', 'paid') and (select auth.uid()) is not null
					and exists (
						select 1 from public.collection_grants g
						where g.collection_id = c.id and g.user_id = (select auth.uid())
					))
			)
	);
$$;

create function private.can_play_puzzle(puzzle_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
	select exists (
		select 1 from public.puzzles p
		where p.id = puzzle_id and private.is_released(p.published_at, p.release_at)
			and (
				exists (
					select 1 from public.collection_puzzles member
					join public.puzzle_collections c on c.id = member.collection_id
					where member.puzzle_id = p.id
						and private.can_play_collection(c.id)
						and (
							c.selection_mode = 'any'
							or (select auth.uid()) is null
							or not exists (
								select 1 from public.collection_puzzles previous
								where previous.collection_id = c.id
									and previous.position < member.position
									and not exists (
										select 1 from public.puzzle_completions completed
										where completed.user_id = (select auth.uid())
											and completed.puzzle_id = previous.puzzle_id
									)
							)
						)
				)
				or exists (
					select 1 from public.daily_puzzles d
					where d.puzzle_id = p.id and (
						(d.release_at <= now() and now() < d.expires_at)
						or exists (
							select 1 from public.daily_play_sessions session
							where session.daily_id = d.id
								and session.user_id = (select auth.uid())
								and session.opened_at >= d.release_at
								and session.opened_at < d.expires_at
								and session.closed_at is null
						)
					)
				)
			)
	);
$$;

create function private.reward_rule_released(reward_rule_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
	select exists (
		select 1 from public.reward_rules rule
		where rule.id = reward_rule_id and private.collection_released(rule.collection_id)
	);
$$;

create function private.guard_published_content()
returns trigger
language plpgsql set search_path = ''
as $$
begin
	if old.published_at is not null then
		raise exception 'Published % cannot be updated or deleted.', tg_table_name
			using errcode = '23514';
	end if;
	if tg_op = 'DELETE' then return old; end if;
	return new;
end;
$$;
create trigger puzzles_immutable before update or delete on public.puzzles
	for each row execute function private.guard_published_content();
create trigger collections_immutable before update or delete on public.puzzle_collections
	for each row execute function private.guard_published_content();
create trigger core_immutable before update or delete on public.core_progression
	for each row execute function private.guard_published_content();

create function private.guard_collection_configuration()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
	old_row jsonb;
	new_row jsonb;
	row_data jsonb;
	parent_id uuid;
begin
	if tg_op <> 'INSERT' then old_row := to_jsonb(old); end if;
	if tg_op <> 'DELETE' then new_row := to_jsonb(new); end if;
	foreach row_data in array array[old_row, new_row] loop
		if row_data is null then continue; end if;
		if tg_table_name = 'core_steps' then
			perform 1 from public.core_progression for update;
			if exists (select 1 from public.core_progression where published_at is not null) then
				raise exception 'Published core progression cannot be changed.' using errcode = '23514';
			end if;
			if not exists (
				select 1 from public.puzzle_collections
				where id = (row_data ->> 'collection_id')::uuid and kind = 'core'
			) then
				raise exception 'Core steps require a core collection.' using errcode = '23514';
			end if;
		elsif tg_table_name = 'puzzle_authoring' then
			perform 1 from public.puzzles
				where id = (row_data ->> 'puzzle_id')::uuid for update;
			if exists (
				select 1 from public.puzzles
				where id = (row_data ->> 'puzzle_id')::uuid and published_at is not null
			) then
				raise exception 'Published puzzle authoring cannot be changed.' using errcode = '23514';
			end if;
		else
			if tg_table_name in ('reward_palettes', 'reward_sets', 'reward_shapes') then
				select collection_id into parent_id from public.reward_rules
					where id = (row_data ->> 'reward_rule_id')::uuid;
			else
				parent_id := (row_data ->> 'collection_id')::uuid;
			end if;
			perform 1 from public.puzzle_collections where id = parent_id for update;
			if exists (
				select 1 from public.puzzle_collections where id = parent_id and published_at is not null
			) then
				raise exception 'Published collection configuration cannot be changed.' using errcode = '23514';
			end if;
			if tg_table_name = 'reward_sets' and not exists (
				select 1 from public.puzzle_collections
				where id = (row_data ->> 'collection_id')::uuid and kind = 'reward'
			) then
				raise exception 'Puzzle rewards must reference optional reward sets.' using errcode = '23514';
			end if;
		end if;
	end loop;
	if tg_op = 'DELETE' then return old; end if;
	return new;
end;
$$;

create trigger members_guard before insert or update or delete on public.collection_puzzles
	for each row execute function private.guard_collection_configuration();
create trigger routes_guard before insert or update or delete on public.completion_routes
	for each row execute function private.guard_collection_configuration();
create trigger route_members_guard before insert or update or delete on public.route_puzzles
	for each row execute function private.guard_collection_configuration();
create trigger steps_guard before insert or update or delete on public.core_steps
	for each row execute function private.guard_collection_configuration();
create trigger authoring_guard before insert or update or delete on public.puzzle_authoring
	for each row execute function private.guard_collection_configuration();
create trigger rewards_guard before insert or update or delete on public.reward_rules
	for each row execute function private.guard_collection_configuration();
create trigger reward_palettes_guard before insert or update or delete on public.reward_palettes
	for each row execute function private.guard_collection_configuration();
create trigger reward_sets_guard before insert or update or delete on public.reward_sets
	for each row execute function private.guard_collection_configuration();
create trigger reward_shapes_guard before insert or update or delete on public.reward_shapes
	for each row execute function private.guard_collection_configuration();

create function private.validate_publication()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
	if new.published_at is null then return new; end if;
	if tg_table_name in ('puzzles', 'puzzle_collections') then
		if not exists (
			select 1 from public.shapes s where s.id = new.shape_id
				and s.published_at is not null and s.release_at <= new.release_at
		) then
			raise exception 'Publish the shape before this release.' using errcode = '23514';
		end if;
	end if;
	if tg_table_name = 'puzzles' then
		if not exists (
			select 1 from public.palettes p where p.id = new.palette_id
				and p.published_at is not null and p.release_at <= new.release_at
		) then
			raise exception 'Publish the palette before this release.' using errcode = '23514';
		end if;
		if not exists (select 1 from public.puzzle_authoring where puzzle_id = new.id) then
			raise exception 'Save generator provenance and a known solution before publishing.'
				using errcode = '23514';
		end if;
	elsif tg_table_name = 'puzzle_collections' then
		if not exists (select 1 from public.collection_puzzles where collection_id = new.id)
			or exists (
				select 1 from public.collection_puzzles m join public.puzzles p on p.id = m.puzzle_id
				where m.collection_id = new.id
					and (p.published_at is null or p.release_at > new.release_at)
			) then
			raise exception 'A published collection requires published puzzles ready by its release.'
				using errcode = '23514';
		end if;
		if new.kind = 'core' and not exists (
			select 1 from public.completion_routes where collection_id = new.id
		) then
			raise exception 'A core set requires at least one qualifying route.' using errcode = '23514';
		end if;
		if exists (
			select 1 from public.completion_routes r
			where r.collection_id = new.id
				and not exists (select 1 from public.route_puzzles where route_id = r.id)
		) then
			raise exception 'Every qualifying route requires puzzles.' using errcode = '23514';
		end if;
		if exists (
			select 1 from public.reward_rules r where r.collection_id = new.id
				and not exists (select 1 from public.reward_palettes where reward_rule_id = r.id)
				and not exists (select 1 from public.reward_shapes where reward_rule_id = r.id)
				and not exists (select 1 from public.reward_sets where reward_rule_id = r.id)
		) then
			raise exception 'Every reward rule requires at least one reward.' using errcode = '23514';
		end if;
	elsif tg_table_name = 'core_progression' then
		if not exists (select 1 from public.core_steps)
			or (select max(position) from public.core_steps) <> (select count(*) from public.core_steps)
			or exists (
				select 1 from public.core_steps s join public.puzzle_collections c on c.id = s.collection_id
				where c.kind <> 'core' or c.published_at is null or c.release_at > new.release_at
			) then
			raise exception 'Core progression requires contiguous steps, all published by launch.'
				using errcode = '23514';
		end if;
	end if;
	return new;
end;
$$;
create trigger puzzles_publication before insert or update on public.puzzles
	for each row execute function private.validate_publication();
create trigger collections_publication before insert or update on public.puzzle_collections
	for each row execute function private.validate_publication();
create trigger core_publication before insert or update on public.core_progression
	for each row execute function private.validate_publication();

create function private.track_palette_correction()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
	if new.id is distinct from old.id then
		raise exception 'Palette IDs are permanent.' using errcode = '23514';
	end if;
	if old.published_at is not null and (
		new.published_at is distinct from old.published_at
		or new.release_at is distinct from old.release_at
	) then
		raise exception 'Published palette release metadata cannot change.' using errcode = '23514';
	end if;
	new.revision := old.revision;
	if new.colors is distinct from old.colors then
		new.revision := old.revision + 1;
		if old.published_at is not null then
			insert into public.palette_corrections (
				palette_id, revision, old_colors, new_colors, changed_by
			) values (old.id, new.revision, old.colors, new.colors, auth.uid());
		end if;
	end if;
	return new;
end;
$$;
create trigger palettes_correction before update on public.palettes
	for each row execute function private.track_palette_correction();

create function private.validate_daily_assignment()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
	if tg_op <> 'INSERT' and old.release_at <= now() then
		raise exception 'Released daily assignments cannot be changed.' using errcode = '23514';
	end if;
	if tg_op = 'DELETE' then return old; end if;
	perform 1 from public.daily_schedule
		where rollover_time_utc = (new.release_at at time zone 'UTC')::time for share;
	if not found then
		raise exception 'Daily releases must use the configured global UTC rollover time.'
			using errcode = '23514';
	end if;
	if not exists (
		select 1 from public.puzzles p where p.id = new.puzzle_id
			and p.usage = 'daily' and p.published_at is not null
			and p.release_at <= new.release_at
	) then
		raise exception 'Daily assignments require a published daily puzzle ready by release.'
			using errcode = '23514';
	end if;
	return new;
end;
$$;
create trigger daily_assignment_guard before insert or update or delete on public.daily_puzzles
	for each row execute function private.validate_daily_assignment();

create function private.guard_daily_schedule()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
	if exists (select 1 from public.daily_puzzles) then
		raise exception 'The global rollover time cannot change while daily assignments exist.'
			using errcode = '23514';
	end if;
	if tg_op = 'DELETE' then return old; end if;
	return new;
end;
$$;
create trigger daily_schedule_guard before update or delete on public.daily_schedule
	for each row execute function private.guard_daily_schedule();

create index palette_corrections_actor_idx on public.palette_corrections(changed_by);
create index collections_shape_idx on public.puzzle_collections(shape_id);
create index reward_palettes_target_idx on public.reward_palettes(palette_id);
create index reward_sets_target_idx on public.reward_sets(collection_id);
create index reward_shapes_target_idx on public.reward_shapes(shape_id);
create index palette_pack_palettes_target_idx on public.palette_pack_palettes(palette_id);
create index puzzle_completions_puzzle_idx on public.puzzle_completions(puzzle_id);
create index qualifications_collection_idx on public.set_qualifications(collection_id);
create index qualifications_route_idx on public.set_qualifications(route_id, collection_id);
create index palette_grants_target_idx on public.palette_grants(palette_id);
create index palette_grants_reward_idx on public.palette_grants(reward_rule_id);
create index shape_grants_target_idx on public.shape_grants(shape_id);
create index shape_grants_reward_idx on public.shape_grants(reward_rule_id);
create index collection_grants_target_idx on public.collection_grants(collection_id);
create index collection_grants_reward_idx on public.collection_grants(reward_rule_id);
create index puzzle_attempts_puzzle_idx on public.puzzle_attempts(puzzle_id);
create index daily_play_sessions_daily_idx on public.daily_play_sessions(daily_id);

alter table public.admin_account enable row level security;
alter table public.profiles enable row level security;
alter table public.palettes enable row level security;
alter table public.palette_corrections enable row level security;
alter table public.shapes enable row level security;
alter table public.puzzle_collections enable row level security;
alter table public.puzzles enable row level security;
alter table public.puzzle_authoring enable row level security;
alter table public.collection_puzzles enable row level security;
alter table public.completion_routes enable row level security;
alter table public.route_puzzles enable row level security;
alter table public.core_progression enable row level security;
alter table public.core_steps enable row level security;
alter table public.reward_rules enable row level security;
alter table public.reward_palettes enable row level security;
alter table public.reward_sets enable row level security;
alter table public.reward_shapes enable row level security;
alter table public.starter_palettes enable row level security;
alter table public.starter_shapes enable row level security;
alter table public.palette_packs enable row level security;
alter table public.palette_pack_palettes enable row level security;
alter table public.daily_schedule enable row level security;
alter table public.daily_puzzles enable row level security;
alter table public.puzzle_completions enable row level security;
alter table public.set_qualifications enable row level security;
alter table public.palette_grants enable row level security;
alter table public.shape_grants enable row level security;
alter table public.collection_grants enable row level security;
alter table public.feature_grants enable row level security;
alter table public.puzzle_attempts enable row level security;
alter table public.daily_play_sessions enable row level security;

create policy admin_crud on public.admin_account for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.profiles for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.palettes for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.palette_corrections for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.shapes for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.puzzle_collections for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.puzzles for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.puzzle_authoring for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.collection_puzzles for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.completion_routes for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.route_puzzles for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.core_progression for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.core_steps for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.reward_rules for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.reward_palettes for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.reward_sets for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.reward_shapes for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.starter_palettes for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.starter_shapes for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.palette_packs for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.palette_pack_palettes for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.daily_schedule for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.daily_puzzles for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.puzzle_completions for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.set_qualifications for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.palette_grants for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.shape_grants for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.collection_grants for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.feature_grants for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.puzzle_attempts for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_crud on public.daily_play_sessions for all to authenticated
	using ((select private.is_admin())) with check ((select private.is_admin()));

create policy profile_read on public.profiles for select to authenticated
	using (user_id = (select auth.uid()));
create policy profile_create on public.profiles for insert to authenticated
	with check (user_id = (select auth.uid()));
create policy profile_update on public.profiles for update to authenticated
	using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy catalog_read on public.palettes for select to anon, authenticated
	using (private.is_released(published_at, release_at));
create policy catalog_read on public.shapes for select to anon, authenticated
	using (private.is_released(published_at, release_at));
create policy catalog_read on public.puzzle_collections for select to anon, authenticated
	using (private.is_released(published_at, release_at));
create policy playable_read on public.puzzles for select to anon, authenticated
	using (private.can_play_puzzle(id));
create policy catalog_read on public.collection_puzzles for select to anon, authenticated
	using (private.collection_released(collection_id));
create policy catalog_read on public.completion_routes for select to anon, authenticated
	using (private.collection_released(collection_id));
create policy catalog_read on public.route_puzzles for select to anon, authenticated
	using (private.collection_released(collection_id));
create policy catalog_read on public.core_progression for select to anon, authenticated
	using (private.is_released(published_at, release_at));
create policy catalog_read on public.core_steps for select to anon, authenticated
	using (
		private.collection_released(collection_id) and exists (
			select 1 from public.core_progression p
			where private.is_released(p.published_at, p.release_at)
		)
	);
create policy catalog_read on public.reward_rules for select to anon, authenticated
	using (private.collection_released(collection_id));
create policy catalog_read on public.reward_palettes for select to anon, authenticated
	using (
		private.reward_rule_released(reward_rule_id) and exists (
			select 1 from public.palettes p where p.id = palette_id
		)
	);
create policy catalog_read on public.reward_sets for select to anon, authenticated
	using (private.reward_rule_released(reward_rule_id) and private.collection_released(collection_id));
create policy catalog_read on public.reward_shapes for select to anon, authenticated
	using (
		private.reward_rule_released(reward_rule_id) and exists (
			select 1 from public.shapes s where s.id = shape_id
		)
	);
create policy catalog_read on public.starter_palettes for select to anon, authenticated
	using (exists (select 1 from public.palettes p where p.id = palette_id));
create policy catalog_read on public.starter_shapes for select to anon, authenticated
	using (exists (select 1 from public.shapes s where s.id = shape_id));
create policy catalog_read on public.palette_packs for select to anon, authenticated
	using (private.is_released(published_at, release_at));
create policy catalog_read on public.palette_pack_palettes for select to anon, authenticated
	using (
		exists (select 1 from public.palette_packs p where p.id = pack_id)
		and exists (select 1 from public.palettes p where p.id = palette_id)
	);
create policy current_daily_read on public.daily_puzzles for select to anon, authenticated
	using (release_at <= now() and now() < expires_at);
create policy schedule_read on public.daily_schedule for select to anon, authenticated
	using (true);

create policy own_read on public.puzzle_completions for select to authenticated
	using (user_id = (select auth.uid()));
create policy own_read on public.set_qualifications for select to authenticated
	using (user_id = (select auth.uid()));
create policy own_read on public.palette_grants for select to authenticated
	using (user_id = (select auth.uid()));
create policy own_read on public.shape_grants for select to authenticated
	using (user_id = (select auth.uid()));
create policy own_read on public.collection_grants for select to authenticated
	using (user_id = (select auth.uid()));
create policy own_read on public.feature_grants for select to authenticated
	using (user_id = (select auth.uid()));
create policy own_read on public.puzzle_attempts for select to authenticated
	using (user_id = (select auth.uid()));
create policy own_read on public.daily_play_sessions for select to authenticated
	using (user_id = (select auth.uid()));

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select, insert, update, delete on
	public.admin_account, public.profiles, public.palettes, public.palette_corrections,
	public.shapes, public.puzzle_collections, public.puzzles, public.puzzle_authoring,
	public.collection_puzzles, public.completion_routes, public.route_puzzles,
	public.core_progression, public.core_steps, public.reward_rules, public.reward_palettes,
	public.reward_sets, public.reward_shapes, public.starter_palettes, public.starter_shapes,
	public.palette_packs, public.palette_pack_palettes, public.daily_schedule, public.daily_puzzles,
	public.puzzle_completions, public.set_qualifications, public.palette_grants,
	public.shape_grants, public.collection_grants, public.feature_grants,
	public.puzzle_attempts, public.daily_play_sessions
	to authenticated;
grant usage on sequence public.palette_corrections_id_seq to authenticated;
grant select on
	public.palettes, public.shapes, public.puzzle_collections, public.puzzles,
	public.collection_puzzles, public.completion_routes, public.route_puzzles,
	public.core_progression, public.core_steps, public.reward_rules, public.reward_palettes,
	public.reward_sets, public.reward_shapes, public.starter_palettes, public.starter_shapes,
	public.palette_packs, public.palette_pack_palettes, public.daily_schedule, public.daily_puzzles
	to anon;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_released(timestamptz, timestamptz) to anon, authenticated;
grant execute on function private.collection_released(uuid) to anon, authenticated;
grant execute on function private.can_play_puzzle(uuid) to anon, authenticated;
grant execute on function private.reward_rule_released(uuid) to anon, authenticated;
grant execute on function private.valid_puzzle_definition(jsonb) to authenticated;

insert into public.shapes (id, name, published_at, release_at) values
	('hexagon', 'Hexagon', now(), now()),
	('triangle', 'Triangle', now(), now()),
	('diamondStar', 'Diamond Star', now(), now()),
	('hexagram', 'Hexagram', now(), now()),
	('circleRings', 'Circle Rings', now(), now()),
	('pinwheel', 'Pinwheel', now(), now());
insert into public.starter_shapes (shape_id) values ('hexagon');

insert into public.palettes (id, name, colors) values
	('tahiti', 'Tahiti', array['#ff9f1c', '#ffbf69', '#ffecb6', '#cbf3f0', '#2ec4b6']),
	('cabo', 'Cabo', array['#a53f2b', '#f09f92', '#ffdccc', '#0f7173', '#124e5f']),
	('club-neon', 'Club Neon', array['#3599a7', '#75dddd', '#9297c4', '#9775b3', '#aa3e98']),
	('regatta', 'Regatta', array['#791818', '#ae1f29', '#c9c2b3', '#2788a3', '#0a465c']),
	('boho', 'Boho', array['#d1ab9b', '#eedcb8', '#acac7b', '#799277', '#4b7478']),
	('lake-house', 'Lake House', array['#8d201e', '#dbb80d', '#f3e5bf', '#239cb7', '#156783']),
	('tahoe', 'Tahoe', array['#bc4749', '#c17c74', '#ddc9b4', '#bcac9b', '#7a6c5d']),
	('wisteria', 'Wisteria', array['#6ab47e', '#96d3be', '#7785ac', '#683991', '#472469']),
	('autumn', 'Autumn', array['#bc6c25', '#dda15e', '#f1c780', '#6d7b42', '#3f5428']),
	('watermelon', 'Watermelon', array['#e34a6f', '#f7b2bd', '#d6e8d5', '#60a561', '#09482c']),
	('sedona', 'Sedona', array['#96431f', '#ae6451', '#cd905f', '#e2cfa1', '#3fa59a']),
	('ocean', 'Ocean', array['#5fa8d3', '#9ad5f2', '#bee9e8', '#62b6cb', '#24597a']),
	('rose-gold', 'Rose Gold', array['#744253', '#c78283', '#ebc9cd', '#e4b8b5', '#aa6e6b']),
	('salmon', 'Salmon', array['#bc4749', '#f2e8cf', '#a7c957', '#6a994e', '#386641']),
	('lilac-mist', 'Lilac Mist', array['#735d78', '#b392ac', '#d1b3c4', '#e8c2ca', '#f7d1cd']),
	('daytona', 'Daytona', array['#e29578', '#ffddd2', '#e6d5d0', '#83c5be', '#006d77']),
	('dianthus', 'Dianthus', array['#cb607b', '#e07d96', '#e8a4b5', '#e9b0bf', '#e9d2d8']),
	('sitka', 'Sitka', array['#b84743', '#d45b49', '#b2ae9b', '#42947b', '#3a625e']),
	('grey-morning', 'Grey Morning', array['#9e9898', '#c3baba', '#e9e3e6', '#b2b2b2', '#736f72']);

commit;
