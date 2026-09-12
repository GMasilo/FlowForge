-- Decrement store catalog stock after a verified payment (idempotent).

create or replace function public.decrement_store_stock_for_payment(
  p_payment_intent_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_intent public.payment_intents;
  v_session public.conversation_sessions;
  v_vars jsonb;
  v_cart jsonb;
  v_items jsonb;
  v_item jsonb;
  v_product_id text;
  v_qty integer;
  v_tmpl public.chatbot_templates;
  v_content jsonb;
  v_products jsonb;
  v_idx integer;
  v_prod jsonb;
  v_stock numeric;
  v_new_stock integer;
  v_updated integer := 0;
  v_meta jsonb;
begin
  if p_payment_intent_id is null then
    raise exception 'Payment intent required';
  end if;

  select * into v_intent from public.payment_intents where id = p_payment_intent_id;
  if v_intent.id is null then
    raise exception 'Payment intent not found';
  end if;

  if v_intent.status is distinct from 'verified' then
    return jsonb_build_object('ok', false, 'reason', 'not_verified');
  end if;

  v_meta := coalesce(v_intent.payload, '{}'::jsonb);
  if coalesce((v_meta->>'_stock_decremented')::boolean, false)
     or coalesce((v_meta->'flowforge'->>'_stock_decremented')::boolean, false) then
    return jsonb_build_object('ok', true, 'already', true, 'updated', 0);
  end if;

  if v_intent.session_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_session');
  end if;

  select * into v_session from public.conversation_sessions where id = v_intent.session_id;
  if v_session.id is null then
    return jsonb_build_object('ok', false, 'reason', 'session_missing');
  end if;

  v_vars := coalesce(v_session.variables, '{}'::jsonb);
  v_cart := v_vars->'cart';
  if v_cart is null or jsonb_typeof(v_cart) <> 'object' then
    -- Scan for a cart-shaped value
    select value into v_cart
    from jsonb_each(v_vars) as t(key, value)
    where jsonb_typeof(value) = 'object'
      and (value ? 'items')
      and jsonb_typeof(value->'items') = 'array'
    limit 1;
  end if;

  if v_cart is null then
    update public.payment_intents
    set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('_stock_decremented', true, '_stock_note', 'no_cart')
    where id = v_intent.id;
    return jsonb_build_object('ok', true, 'updated', 0, 'note', 'no_cart');
  end if;

  v_items := v_cart->'items';
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    update public.payment_intents
    set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('_stock_decremented', true, '_stock_note', 'empty_cart')
    where id = v_intent.id;
    return jsonb_build_object('ok', true, 'updated', 0, 'note', 'empty_cart');
  end if;

  for v_tmpl in
    select *
    from public.chatbot_templates
    where chatbot_id = v_intent.chatbot_id
      and kind = 'cart'
      and deleted_at is null
  loop
    v_content := coalesce(v_tmpl.content, '{}'::jsonb);
    v_products := v_content->'products';
    if jsonb_typeof(v_products) <> 'array' then
      continue;
    end if;

    for v_item in select * from jsonb_array_elements(v_items)
    loop
      v_product_id := nullif(trim(coalesce(v_item->>'id', v_item->>'productId', '')), '');
      if v_product_id is null then
        continue;
      end if;
      begin
        v_qty := greatest(0, coalesce((v_item->>'qty')::integer, (v_item->>'quantity')::integer, 1));
      exception when others then
        v_qty := 1;
      end;
      if v_qty <= 0 then
        continue;
      end if;

      for v_idx in 0 .. jsonb_array_length(v_products) - 1
      loop
        v_prod := v_products->v_idx;
        if coalesce(v_prod->>'id', '') <> v_product_id then
          continue;
        end if;
        if v_prod->'stock' is null or jsonb_typeof(v_prod->'stock') = 'null' then
          -- unlimited
          exit;
        end if;
        begin
          v_stock := (v_prod->>'stock')::numeric;
        exception when others then
          exit;
        end;
        v_new_stock := greatest(0, floor(v_stock)::integer - v_qty);
        v_products := jsonb_set(v_products, array[v_idx::text, 'stock'], to_jsonb(v_new_stock), true);
        v_updated := v_updated + 1;
        exit;
      end loop;
    end loop;

    v_content := jsonb_set(v_content, '{products}', v_products, true);
    update public.chatbot_templates
    set content = v_content, updated_at = now()
    where id = v_tmpl.id;
  end loop;

  update public.payment_intents
  set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object(
    '_stock_decremented', true,
    '_stock_updated', v_updated
  )
  where id = v_intent.id;

  return jsonb_build_object('ok', true, 'updated', v_updated);
end;
$$;

grant execute on function public.decrement_store_stock_for_payment(uuid)
  to anon, authenticated, service_role;

-- Convenience: decrement by payment reference (for PHP notify)
create or replace function public.decrement_store_stock_for_payment_reference(
  p_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.payment_intents where reference = p_reference limit 1;
  if v_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  return public.decrement_store_stock_for_payment(v_id);
end;
$$;

grant execute on function public.decrement_store_stock_for_payment_reference(text)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
