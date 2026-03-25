// ============================================================
// supabase.js — Camada de dados 3DZAAP  v2.1
// Correcções: _loadCompany resiliente, mappers alinhados com
// o formato local do 3DZAAP.html (color, brand[], etc.)
// ============================================================

const SUPABASE_URL  = 'https://yjggsndxatezgqljlhxb.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZ2dzbmR4YXRlemdxbGpsaHhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MjE0MTgsImV4cCI6MjA4OTA5NzQxOH0.zVzA2siKsix8tOK44H5U-cZK1Wdd_4u_sY1g2JgGYUA';

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

let _companyId    = null;   // UUID da empresa
let _companyCache = null;   // objecto completo — evita queries repetidas

// ============================================================
// AUTH
// ============================================================
const Auth = {

  async register({ fname, lname, email, pass, companyName, slug, plan, config, signature }) {
    // 1. Criar utilizador no Supabase Auth
    const { data: authData, error: authErr } = await _sb.auth.signUp({
      email, password: pass,
      options: { data: { fname, lname } }
    });
    if (authErr) throw authErr;

    const userId = authData.user?.id;
    if (!userId) throw new Error('Utilizador não foi criado correctamente.');

    const cleanSlug = (slug || companyName).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // 2. Activar sessão se disponível (email confirm OFF)
    if (authData.session) {
      await _sb.auth.setSession(authData.session);
    }

    // 3. Criar empresa via RPC SECURITY DEFINER
    let company = null;
    const { data: rpcData, error: rpcErr } = await _sb
      .rpc('create_company_for_user', {
        p_user_id:   userId,
        p_name:      companyName,
        p_slug:      cleanSlug,
        p_plan:      plan || 'trial',
        p_config:    config || {},
        p_signature: signature || null,
      });

    if (!rpcErr && rpcData?.length) {
      company = rpcData[0];
    } else {
      // Fallback: inserção directa (funciona se email confirm estiver OFF)
      if (rpcErr) console.warn('[3DZAAP] rpc create_company_for_user:', rpcErr.message);
      const { data: ins, error: insErr } = await _sb
        .from('companies')
        .insert({
          owner_id:  userId,
          name:      companyName,
          slug:      cleanSlug,
          plan:      plan || 'trial',
          config:    config || {},
          signature: signature || null,
        })
        .select()
        .single();
      if (insErr) throw new Error('Erro ao criar empresa: ' + insErr.message);
      company = ins;
    }

    _companyId    = company.id;
    _companyCache = company;

    // Indicar se precisa confirmar email
    const needsEmailConfirm = !authData.session;
    return { user: authData.user, company, needsEmailConfirm };
  },

  async login(email, pass) {
    const { data, error } = await _sb.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    // Limpar cache para forçar reload com a sessão nova
    _companyId    = null;
    _companyCache = null;
    await Auth._loadCompany();
    return data;
  },

  async logout() {
    await _sb.auth.signOut();
    _companyId    = null;
    _companyCache = null;
    window.location.href = 'auth-onboarding.html';
  },

  // ── Carregar _companyId — resiliente a memberships inexistente ──────────
  async _loadCompany(forceRefresh = false) {
    if (!forceRefresh && _companyCache) return _companyCache;

    const { data: { user }, error: userErr } = await _sb.auth.getUser();
    if (userErr || !user) return null;

    let company = null;
    let role    = 'owner';

    // 1. Tentativa via memberships (suporta convidados)
    //    Envolvido em try/catch — se a tabela não existir (42P01) ignora
    try {
      const { data: mem, error: memErr } = await _sb
        .from('memberships')
        .select('role, companies(id, name, slug, plan, config, signature, trial_ends_at)')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      // PGRST116 = 0 rows, 42P01 = tabela não existe — ambos são OK para ignorar
      if (!memErr && mem?.companies) {
        company = Array.isArray(mem.companies) ? mem.companies[0] : mem.companies;
        role    = mem.role || 'member';
      }
    } catch (_) {
      // Silenciar — fallback abaixo
    }

    // 2. Fallback: owner_id directo
    if (!company) {
      const { data: owned, error: ownedErr } = await _sb
        .from('companies')
        .select('id, name, slug, plan, config, signature, trial_ends_at')
        .eq('owner_id', user.id)
        .limit(1)
        .single();

      if (!ownedErr && owned) {
        company = owned;
        role    = 'owner';
      }
    }

    if (!company) {
      console.warn('[3DZAAP] Company not found for user', user.id);
      return null;
    }

    _companyId    = company.id;
    _companyCache = { ...company, role };
    return _companyCache;
  },

  async getSession() {
    const { data: { session } } = await _sb.auth.getSession();
    if (!session) return null;
    const company = _companyCache || await Auth._loadCompany();
    const user    = session.user;
    return {
      email:       user.email,
      fname:       user.user_metadata?.fname || '',
      lname:       user.user_metadata?.lname || '',
      companyName: company?.name  || '',
      plan:        company?.plan  || 'trial',
      config:      company?.config || {},
      signature:   company?.signature || null,
      companyId:   company?.id,
      role:        company?.role || 'owner',
      trialEndsAt: company?.trial_ends_at || null,
    };
  },

  async requireAuth() {
    const { data: { session } } = await _sb.auth.getSession();
    if (!session) {
      window.location.href = 'auth-onboarding.html';
      return false;
    }
    if (!_companyId) await Auth._loadCompany();
    return true;
  },

  async updateCompany(fields) {
    if (!_companyId) await Auth._loadCompany();
    if (!_companyId) throw new Error('Company not loaded');
    const { error } = await _sb
      .from('companies')
      .update(fields)
      .eq('id', _companyId);
    if (error) throw error;
    _companyCache = null;
    await Auth._loadCompany();
  },
};

// ============================================================
// DB — helper interno para garantir _companyId antes de cada op
// ============================================================
async function _ensureCompany() {
  if (!_companyId) await Auth._loadCompany();
  if (!_companyId) throw new Error('Empresa não encontrada. Faz login novamente.');
}

// Detecta ID local (timestamp numérico) vs UUID do Supabase
function _isLocalId(id) {
  if (!id) return true;
  return typeof id === 'number' || /^\d{10,}$/.test(String(id));
}

const DB = {

  // ── FILAMENTS ───────────────────────────────────────────────

  async getFilaments() {
    await _ensureCompany();
    const { data, error } = await _sb
      .from('filaments')
      .select('*')
      .eq('company_id', _companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(_mapFilamentFromDB);
  },

  async saveFilament(filament) {
    await _ensureCompany();
    const row = _mapFilamentToDB(filament);
    const isNew = !filament.id || _isLocalId(filament.id);

    if (!isNew) {
      const { data, error } = await _sb
        .from('filaments')
        .update(row)
        .eq('id', filament.id)
        .eq('company_id', _companyId)
        .select().single();
      if (error) throw error;
      return _mapFilamentFromDB(data);
    } else {
      const { data, error } = await _sb
        .from('filaments')
        .insert({ ...row, company_id: _companyId })
        .select().single();
      if (error) throw error;
      return _mapFilamentFromDB(data);
    }
  },

  async deleteFilament(id) {
    await _ensureCompany();
    const { error } = await _sb
      .from('filaments').delete()
      .eq('id', id).eq('company_id', _companyId);
    if (error) throw error;
  },

  async saveAllFilaments(filaments) {
    await _ensureCompany();
    await _sb.from('filaments').delete().eq('company_id', _companyId);
    if (!filaments.length) return;
    const rows = filaments.map(f => ({ ..._mapFilamentToDB(f), company_id: _companyId }));
    const { error } = await _sb.from('filaments').insert(rows);
    if (error) throw error;
  },

  // ── ORDERS ──────────────────────────────────────────────────

  async getOrders() {
    await _ensureCompany();
    const { data, error } = await _sb
      .from('orders').select('*')
      .eq('company_id', _companyId)
      .order('order_numeric', { ascending: false });
    if (error) throw error;
    return data.map(_mapOrderFromDB);
  },

  async getLastOrderNumber() {
    await _ensureCompany();
    const { data } = await _sb
      .from('orders').select('order_numeric')
      .eq('company_id', _companyId)
      .order('order_numeric', { ascending: false })
      .limit(1).single();
    return data?.order_numeric || 0;
  },

  async saveOrder(order) {
    await _ensureCompany();
    const row   = _mapOrderToDB(order);
    const isNew = !order.id || _isLocalId(order.id);

    if (!isNew) {
      const { data, error } = await _sb
        .from('orders').update(row)
        .eq('id', order.id).eq('company_id', _companyId)
        .select().single();
      if (error) throw error;
      return _mapOrderFromDB(data);
    } else {
      const { data, error } = await _sb
        .from('orders').insert({ ...row, company_id: _companyId })
        .select().single();
      if (error) throw error;
      return _mapOrderFromDB(data);
    }
  },

  async deleteOrder(id) {
    await _ensureCompany();
    const { error } = await _sb
      .from('orders').delete()
      .eq('id', id).eq('company_id', _companyId);
    if (error) throw error;
  },

  async saveAllOrders(orders) {
    await _ensureCompany();
    await _sb.from('orders').delete().eq('company_id', _companyId);
    if (!orders.length) return;
    const rows = orders.map(o => ({ ..._mapOrderToDB(o), company_id: _companyId }));
    const { error } = await _sb.from('orders').insert(rows);
    if (error) throw error;
  },

  // ── EXPENSES ────────────────────────────────────────────────

  async getExpenses() {
    await _ensureCompany();
    const { data, error } = await _sb
      .from('expenses').select('*')
      .eq('company_id', _companyId)
      .order('date', { ascending: false });
    if (error) throw error;
    return data.map(_mapExpenseFromDB);
  },

  async saveExpense(expense) {
    await _ensureCompany();
    const row   = _mapExpenseToDB(expense);
    const isNew = !expense.id || _isLocalId(expense.id);

    if (!isNew) {
      const { data, error } = await _sb
        .from('expenses').update(row)
        .eq('id', expense.id).eq('company_id', _companyId)
        .select().single();
      if (error) throw error;
      return _mapExpenseFromDB(data);
    } else {
      const { data, error } = await _sb
        .from('expenses').insert({ ...row, company_id: _companyId })
        .select().single();
      if (error) throw error;
      return _mapExpenseFromDB(data);
    }
  },

  async deleteExpense(id) {
    await _ensureCompany();
    const { error } = await _sb
      .from('expenses').delete()
      .eq('id', id).eq('company_id', _companyId);
    if (error) throw error;
  },

  async saveAllExpenses(expenses) {
    await _ensureCompany();
    await _sb.from('expenses').delete().eq('company_id', _companyId);
    if (!expenses.length) return;
    const rows = expenses.map(e => ({ ..._mapExpenseToDB(e), company_id: _companyId }));
    const { error } = await _sb.from('expenses').insert(rows);
    if (error) throw error;
  },

  // ── ACTIVITY LOG ────────────────────────────────────────────

  async getLog() {
    if (!_companyId) await Auth._loadCompany();
    if (!_companyId) return [];
    const { data } = await _sb
      .from('activity_log').select('*')
      .eq('company_id', _companyId)
      .order('created_at', { ascending: false })
      .limit(100);
    return data || [];
  },

  async addLog(message, type = 'inf') {
    if (!_companyId) return;
    await _sb.from('activity_log')
      .insert({ company_id: _companyId, message, type })
      .then(r => r.error && console.info('[3DZAAP] activity_log:', r.error.message));
  },

  async clearLog() {
    if (!_companyId) return;
    await _sb.from('activity_log').delete().eq('company_id', _companyId);
  },

  // ── TEAM ────────────────────────────────────────────────────

  async getMembers() {
    await _ensureCompany();
    const { data, error } = await _sb
      .from('memberships')
      .select('id, role, joined_at, user_id')
      .eq('company_id', _companyId)
      .order('joined_at');
    if (error) throw error;
    return data || [];
  },

  async updateMemberRole(membershipId, role) {
    await _ensureCompany();
    const { error } = await _sb
      .from('memberships')
      .update({ role })
      .eq('id', membershipId)
      .eq('company_id', _companyId);
    if (error) throw error;
  },

  async removeMember(membershipId) {
    await _ensureCompany();
    const { error } = await _sb
      .from('memberships')
      .delete()
      .eq('id', membershipId)
      .eq('company_id', _companyId);
    if (error) throw error;
  },

  async getInvites() {
    await _ensureCompany();
    const { data, error } = await _sb
      .from('invites')
      .select('id, email, role, expires_at, accepted_at, created_at')
      .eq('company_id', _companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createInvite(email, role = 'member') {
    await _ensureCompany();
    const { data: { user } } = await _sb.auth.getUser();
    const { data, error } = await _sb
      .from('invites')
      .insert({ company_id: _companyId, email, role, invited_by: user.id })
      .select('id, email, role, token, expires_at')
      .single();
    if (error) throw error;
    return data;
  },

  async cancelInvite(inviteId) {
    await _ensureCompany();
    const { error } = await _sb
      .from('invites')
      .delete()
      .eq('id', inviteId)
      .eq('company_id', _companyId);
    if (error) throw error;
  },

  async acceptInvite(token) {
    const { data, error } = await _sb.rpc('accept_invite', { p_token: token });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    _companyId    = null;
    _companyCache = null;
    await Auth._loadCompany();
    return data;
  },
};

// ============================================================
// MAPPERS — alinhados com o formato do 3DZAAP.html
// ============================================================

function _mapFilamentFromDB(row) {
  return {
    id:             row.id,
    // Classe de material: 'fdm' | 'resin'
    materialClass:  row.material_class || 'fdm',
    material_class: row.material_class || 'fdm',
    // Campos no formato que o 3DZAAP.html usa internamente
    colorHex:       row.color_hex  || '',
    colorName:      row.color_name || '',
    color:          row.color_name || '',   // alias para compatibilidade
    type:           row.type,
    variation:      row.variation  || '',
    // brand: guardado como string, exposto como string (módulos usam string)
    brand:          row.brand || '',
    rollSize:       row.roll_size  || '1kg',
    total:          parseInt(row.total || 0),
    inUse:          parseInt(row.in_use || 0),
    newRolls:       Math.max(0, parseInt(row.total || 0) - parseInt(row.in_use || 0)),
    price:          parseFloat(row.price || 0),
    alerta:         parseInt(row.alerta || 0),
    notes:          row.notes || '',
    kgRemaining:    row.kg_remaining  ?? null,
    emptyConfirmed: row.empty_confirmed || false,
    emptyByOrder:   row.empty_by_order || null,
    emptyAt:        row.empty_at       || null,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  };
}

function _mapFilamentToDB(f) {
  // brand: aceita array ou string — normaliza para string
  const brandStr = Array.isArray(f.brand)
    ? f.brand.filter(Boolean).join(', ')
    : (f.brand || '');

  return {
    material_class:  f.materialClass || f.material_class || 'fdm',
    color_hex:       f.colorHex || f.color_hex || '',
    color_name:      f.colorName || f.color_name || f.color || '',
    type:            f.type,
    variation:       f.variation  || null,
    brand:           brandStr     || null,
    roll_size:       f.rollSize   || f.roll_size || '1kg',
    total:           parseInt(f.total) || 0,
    in_use:          parseInt(f.inUse ?? f.in_use) || 0,
    price:           parseFloat(f.price) || 0,
    alerta:          parseInt(f.alerta)  || 0,
    notes:           f.notes || null,
    kg_remaining:    f.kgRemaining ?? f.kg_remaining ?? null,
    empty_confirmed: f.emptyConfirmed ?? f.empty_confirmed ?? false,
    empty_by_order:  f.emptyByOrder  ?? f.empty_by_order  ?? null,
    empty_at:        f.emptyAt       ?? f.empty_at        ?? null,
  };
}

function _mapOrderFromDB(row) {
  return {
    id:            row.id,
    orderNumber:   row.order_number,
    orderNumeric:  row.order_numeric,
    clientName:    row.client_name,
    clientEmail:   row.client_email  || '',
    clientPhone:   row.client_phone  || '',
    items:         row.items         || [],
    description:   row.description   || '',
    total:         parseFloat(row.total || 0),
    status:        row.status,
    paymentStatus: row.payment_status,
    createdAt:     row.created_at,
    dueDate:       row.due_date      || '',
    paymentDate:   row.payment_date  || '',
    notes:         row.notes         || '',
    updatedAt:     row.updated_at,
  };
}

function _mapOrderToDB(o) {
  const row = {
    order_number:   o.orderNumber || `IMP-${String(o.orderNumeric || 0).padStart(4,'0')}`,
    order_numeric:  o.orderNumeric || 0,
    client_name:    o.clientName,
    client_email:   o.clientEmail  || null,
    client_phone:   o.clientPhone  || null,
    items:          o.items        || [],
    description:    o.description  || '',
    total:          parseFloat(o.total) || 0,
    status:         o.status,
    payment_status: o.paymentStatus,
    due_date:       o.dueDate      || null,
    payment_date:   o.paymentDate  || null,
    notes:          o.notes        || null,
  };
  if (o.createdAt) row.created_at = o.createdAt;
  return row;
}

function _mapExpenseFromDB(row) {
  return {
    id:          row.id,
    date:        row.date,
    value:       parseFloat(row.value || 0),
    category:    row.category,
    description: row.description,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

function _mapExpenseToDB(e) {
  return {
    date:        e.date,
    value:       parseFloat(e.value) || 0,
    category:    e.category,
    description: e.description,
  };
}

// ============================================================
// MIGRAÇÃO — importar dados locais do 3DZAAP.html para Supabase
// ============================================================
const Migration = {

  async importFromLocalStorage() {
    const results = { filaments: 0, orders: 0, expenses: 0 };
    try {
      const fils = JSON.parse(localStorage.getItem('filaments') || '[]');
      if (fils.length) { await DB.saveAllFilaments(fils); results.filaments = fils.length; }
    } catch(e) { console.warn('[3DZAAP] Filaments migration error:', e); }
    try {
      const ords = JSON.parse(localStorage.getItem('orders') || '[]');
      if (ords.length) { await DB.saveAllOrders(ords); results.orders = ords.length; }
    } catch(e) { console.warn('[3DZAAP] Orders migration error:', e); }
    try {
      const exps = JSON.parse(localStorage.getItem('expenses') || '[]');
      if (exps.length) { await DB.saveAllExpenses(exps); results.expenses = exps.length; }
    } catch(e) { console.warn('[3DZAAP] Expenses migration error:', e); }
    localStorage.setItem('3dzaap_migrated', '1');
    return results;
  },

  isMigrated() {
    return localStorage.getItem('3dzaap_migrated') === '1';
  },
};
