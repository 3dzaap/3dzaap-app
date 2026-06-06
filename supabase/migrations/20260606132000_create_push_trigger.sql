-- Migration: create_push_trigger.sql
-- Creates a DB trigger to automatically call the send-push Edge Function
-- whenever an order's has_unread_client_update becomes true.

CREATE OR REPLACE FUNCTION public.trigger_send_push_for_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payload json;
  v_title text;
  v_body text;
  v_project_url text;
  v_service_key text;
  v_company_id text;
BEGIN
  -- Only fire if has_unread_client_update changed from false to true
  IF NEW.has_unread_client_update = true AND (TG_OP = 'INSERT' OR OLD.has_unread_client_update = false) THEN
    
    -- Extract values
    v_company_id := NEW.company_id::text;
    v_title := 'Atualização do Cliente';
    
    IF NEW.order_numeric IS NOT NULL THEN
      v_body := 'O pedido #' || NEW.order_numeric || ' de ' || COALESCE(NEW.client_name, 'um cliente') || ' foi atualizado.';
    ELSE
      v_body := 'O pedido de ' || COALESCE(NEW.client_name, 'um cliente') || ' foi atualizado.';
    END IF;

    -- Note: Edge Function URL needs to be constructed using the current project URL.
    -- To keep it generic, we will use the net.http_post extension if pg_net is enabled.
    -- However, it is safer to use a standard webhook trigger or just make sure pg_net is available.
    -- We assume pg_net extension is enabled in Supabase projects by default.

    -- Attempt to get the URL and Key from vault/secrets or hardcode if necessary.
    -- For simplicity in this demo, we assume the edge function is called via standard HTTP.
    -- Please replace `<PROJECT_REF>` and `<SERVICE_ROLE_KEY>` with your actual values if needed,
    -- or use Supabase's native webhook feature instead.
    
    v_payload := json_build_object(
      'companyId', v_company_id,
      'title', v_title,
      'body', v_body,
      'url', '/orders.html?highlight=' || NEW.id,
      'tag', 'order-' || NEW.id
    );

    -- USING pg_net to make the async HTTP request
    -- SELECT net.http_post(
    --   url:='https://yjggsndxatezgqljlhxb.supabase.co/functions/v1/send-push',
    --   headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_KEY"}',
    --   body:=v_payload::jsonb
    -- );

    -- Note: We are commenting out the direct pg_net call here because it requires hardcoding
    -- the URL and Service Key in the SQL, which is not best practice. 
    -- The best practice is to configure a Supabase Webhook via the Dashboard UI:
    -- Dashboard -> Database -> Webhooks -> Create Webhook on 'orders' table -> UPDATE -> 
    -- Condition: `old_record.has_unread_client_update = false and record.has_unread_client_update = true`
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- CREATE TRIGGER trg_order_client_update
-- AFTER UPDATE ON public.orders
-- FOR EACH ROW
-- EXECUTE FUNCTION public.trigger_send_push_for_order();
