import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create a Supabase client with the admin role to bypass RLS and perform admin actions
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get the Authorization header sent by the client
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header is missing');
    }

    // 2. Extract the JWT
    const token = authHeader.replace('Bearer ', '');

    // 3. Verify the user calling the function
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Invalid token or user not found');
    }

    // 4. Check if the user is a super admin
    const { data: superAdmin, error: superAdminError } = await supabaseAdmin
      .from('super_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .single();

    if (superAdminError || !superAdmin) {
      throw new Error('Unauthorized: User is not a super admin');
    }

    // 5. Parse the request body
    const { companyId, userId, companySlug } = await req.json();

    let targetUserId = userId;

    // Lookup target user based on input params
    if (!targetUserId) {
      if (companyId) {
        const { data: company } = await supabaseAdmin
          .from('companies')
          .select('owner_id')
          .eq('id', companyId)
          .single();
        targetUserId = company?.owner_id;
      } else if (companySlug) {
        const { data: company } = await supabaseAdmin
          .from('companies')
          .select('owner_id')
          .eq('slug', companySlug)
          .single();
        targetUserId = company?.owner_id;
      }
    }

    if (!targetUserId) {
      throw new Error('Target user or company not found');
    }

    // 6. Get the target user's email
    const { data: targetUserObj, error: targetUserErr } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
    if (targetUserErr || !targetUserObj?.user?.email) {
       throw new Error('Could not fetch target user email');
    }

    const targetEmail = targetUserObj.user.email;

    // 7. Generate Magic Link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetEmail
    });

    if (linkError) {
      throw linkError;
    }

    // Return the action link without sending an email
    return new Response(JSON.stringify({
      action_link: linkData.properties.action_link
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
