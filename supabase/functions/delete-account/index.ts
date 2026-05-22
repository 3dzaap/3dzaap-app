import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    // Inicializa o cliente Supabase com a chave de ADMIN para operações destrutivas
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Valida o JWT do utilizador que fez o pedido
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) throw new Error('User not found or invalid token');

    const body = await req.json();
    const { companyId } = body;

    if (!companyId) throw new Error('companyId is required');

    // Verifica se a empresa pertence mesmo a este user
    const { data: company, error: compErr } = await supabaseAdmin
      .from('companies')
      .select('id, owner_id')
      .eq('id', companyId)
      .eq('owner_id', user.id)
      .single();

    if (compErr || !company) {
       throw new Error('Empresa não encontrada ou não tens permissão (apenas o dono pode apagar a conta).');
    }

    // 1. Limpa os dados da empresa usando o RPC (que limpa tudo associado: orders, printers, filaments, memberships)
    const { error: deleteCompErr } = await supabaseAdmin.rpc('delete_company_full', { target_company_id: companyId });
    if (deleteCompErr) {
      console.error('Erro ao limpar dados da empresa (RPC):', deleteCompErr);
      throw new Error('Falha ao apagar dados da empresa. ' + deleteCompErr.message);
    }

    // 2. Apagar o próprio utilizador do sistema Supabase Auth
    const { error: deleteUserErr } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteUserErr) {
      console.error('Erro ao apagar auth do utilizador:', deleteUserErr);
      throw new Error('Dados apagados, mas falha ao remover identidade de login.');
    }

    return new Response(JSON.stringify({ success: true, message: 'Conta e dados apagados com sucesso.' }), {
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
