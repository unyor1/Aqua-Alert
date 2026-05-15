-- Create secure RPC for username-based login
create or replace function public.get_email_by_username(_username text)
returns text as $$
declare
  _email text;
begin
  select email into _email
  from public.user_profiles
  where lower(username) = lower(_username)
  limit 1;
  return _email;
end;
$$ language plpgsql security definer;

grant execute on function public.get_email_by_username(text) to anon;
