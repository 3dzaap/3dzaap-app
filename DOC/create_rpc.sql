CREATE OR REPLACE FUNCTION public.increment_module_visit(p_user_id uuid, p_company_id uuid, p_module text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_activity
  SET visit_count = visit_count + 1,
      last_visited_at = now()
  WHERE user_id = p_user_id 
    AND company_id = p_company_id 
    AND module = p_module;
END;
$$;
