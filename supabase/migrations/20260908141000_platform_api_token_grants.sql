-- Default Postgres grants EXECUTE to PUBLIC. Restrict Platform API token RPCs.

revoke all on function public.create_platform_api_token(uuid, text, integer) from public;
grant execute on function public.create_platform_api_token(uuid, text, integer) to authenticated;

revoke all on function public.revoke_platform_api_token(uuid) from public;
grant execute on function public.revoke_platform_api_token(uuid) to authenticated;

revoke all on function public.verify_platform_api_token(text) from public;
grant execute on function public.verify_platform_api_token(text) to service_role;
