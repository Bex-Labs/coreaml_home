begin;

create table public.coreaml_demo_requests (
  id uuid primary key,
  reference text not null unique,
  email text not null,
  details jsonb not null,
  created_at timestamptz not null default now(),
  email_accepted_at timestamptz
);

create index coreaml_demo_requests_email_created_idx
  on public.coreaml_demo_requests (email, created_at);

alter table public.coreaml_demo_requests enable row level security;
revoke all on public.coreaml_demo_requests from public, anon, authenticated;
grant select, insert, update on public.coreaml_demo_requests to service_role;

create function public.coreaml_record_demo(p_id uuid, p_email text, p_details jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved public.coreaml_demo_requests%rowtype;
  response_status integer := 200;
begin
  -- Serialize bookings for the same email so concurrent requests respect the limit.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('coreaml:' || p_email, 0));

  select * into saved from public.coreaml_demo_requests where id = p_id;
  if not found then
    if (select count(*) from public.coreaml_demo_requests
        where email = p_email and created_at > now() - interval '1 hour') >= 3 then
      return jsonb_build_object('status', 429);
    end if;

    insert into public.coreaml_demo_requests (id, reference, email, details)
    values (p_id, 'CA-' || upper(p_id::text), p_email, p_details)
    on conflict (id) do nothing
    returning * into saved;

    if found then
      response_status := 201;
    else
      select * into strict saved from public.coreaml_demo_requests where id = p_id;
    end if;
  end if;

  if saved.email <> p_email or saved.details <> p_details then
    return jsonb_build_object('status', 409);
  end if;

  return jsonb_build_object(
    'status', response_status,
    'reference', saved.reference,
    'accepted', saved.email_accepted_at is not null
  );
end;
$$;

revoke all on function public.coreaml_record_demo(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.coreaml_record_demo(uuid, text, jsonb)
  to service_role;

commit;
