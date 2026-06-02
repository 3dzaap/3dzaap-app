import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the JWT from the Authorization header to identify the inviter
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')

    // Verify inviter
    const { data: { user: inviter }, error: inviterError } = await supabaseClient.auth.getUser(token)
    if (inviterError || !inviter) {
      throw new Error('Unauthorized: Inviter not found.')
    }

    const { email, role, companyId, redirectTo } = await req.json()

    if (!email || !companyId || !role) {
      throw new Error('Missing required fields.')
    }

    // Insert into invites table on behalf of the user
    // We use the service_role here, so we must manually check if the inviter is admin/owner
    const { data: inviterMembership } = await supabaseClient
      .from('memberships')
      .select('role')
      .eq('user_id', inviter.id)
      .eq('company_id', companyId)
      .single()

    if (!inviterMembership || (inviterMembership.role !== 'owner' && inviterMembership.role !== 'admin')) {
      throw new Error('Forbidden: Only admins and owners can invite.')
    }

    // 1. Send the invite email via Supabase Auth
    // This will create a user in auth.users and send the invite link.
    const { data: authData, error: authError } = await supabaseClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectTo || `${Deno.env.get('SUPABASE_URL')}/auth.html`
    })

    if (authError) {
      // If user already exists, inviteUserByEmail might return an error, but we still want to create the invite
      if (authError.message.includes('User already registered')) {
         // User exists, we can still proceed to just link them later or send a normal email.
         // But Supabase doesn't send an invite to existing users. We should handle it later.
         console.log('User already exists, continuing to create invite record.')
      } else {
        throw authError
      }
    }

    // 2. Insert the invite into our 'invites' table
    const { error: dbError } = await supabaseClient
      .from('invites')
      .insert({
        company_id: companyId,
        email: email,
        role: role,
        invited_by: inviter.id
      })

    if (dbError) throw dbError

    return new Response(
      JSON.stringify({ success: true, message: 'Invite sent' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
