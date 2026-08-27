-- Allow publishers (and superusers) to remove marketplace listings with audit.

create or replace function public.delete_marketplace_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.marketplace_listings;
  v_super boolean;
begin
  select * into v_row from public.marketplace_listings where id = p_listing_id;
  if v_row.id is null then
    raise exception 'Listing not found';
  end if;

  select is_superuser into v_super from public.profiles where id = auth.uid();

  if not coalesce(v_super, false)
     and not public.has_instance_role(
       v_row.publisher_instance_id,
       array['owner', 'admin', 'editor']::public.instance_role[]
     ) then
    raise exception 'Not allowed';
  end if;

  perform public.write_audit_event(
    v_row.publisher_instance_id,
    'marketplace.deleted',
    'marketplace_listing',
    p_listing_id::text,
    jsonb_build_object(
      'title', v_row.title,
      'slug', v_row.slug,
      'status', v_row.status,
      'visibility', v_row.visibility
    )
  );

  delete from public.marketplace_listings where id = p_listing_id;
end;
$$;

grant execute on function public.delete_marketplace_listing(uuid) to authenticated;
