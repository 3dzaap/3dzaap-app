// ============================================================
// supabase.js — Camada de dados 3DZAAP  v2
// ============================================================

const SUPABASE_URL  = 'https://yjggsndxatezgqljlhxb.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZ2dzbmR4YXRlemdxbGpsaHhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MjE0MTgsImV4cCI6MjA4OTA5NzQxOH0.zVzA2siKsix8tOK44H5U-cZK1Wdd_4u_sY1g2JgGYUA';

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

let _companyId = null;

// ============================================================
// AUTH
// ============================================================
const Auth = {

  async register({ fname, lname, email, pass, companyName, slug, plan, config, signature }) {
    const { data: authData, error: authErr } = await _sb.auth.signUp({
      email, password: pass,
      options: { data: { fname, lname } }
    });
    if (authErr) throw authErr;

    // Inserir empresa — RLS em companies permite INSERT sem restrição de tenant
    const { data: company, error: compErr } = await _sb
      .from('companies')
      .insert({
        owner_id:  authData.user.id,
        name:      companyName,
        slug:      slug || companyName.toLowerCase().replace(/\s+/g,'-'),
        plan:      plan || 'trial',
        config:    config || {},
        signature: signature || null,
      })
      .select()
      .single();
    if (compErr) throw compErr;

    _companyId = company.id;

    // Tentar criar membership — se a tabela existir, ótimo; se não, ignora
    await _sb.from('memberships')
      .insert({ user_id: authData.user.id, company_id: company.id, role: 'owner' })
      .then(r => r.error && console.info('memberships table not available:', r.error.message));

    return { user: authData.user, company };
  },

  async login(email, pass) {
    const { data, error } = await _sb.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    await Auth._loadCompany();
    return data;
  },

  async logout() {
    await _sb.auth.signOut();
    _companyId = null;
    window.location.href = 'auth-onboarding.html';
  },

  // ── Carregar _companyId ────────────────────────────────────
  // Estratégia robusta, sem depender de memberships:
  //   1. Query companies SEM filtro explícito — a RLS filtra por owner_id automaticamente
  //   2. Se RLS não estiver activa ou policy usa owner_id, retorna a company do user
  async _loadCompany() {
    const { data: { user } } = await _sb.auth.getUser();
    if (!user) return null;

    // Sem .eq() explícito — deixar a RLS policy da tabela companies filtrar
    // A policy "company_read" faz: USING (owner_id = auth.uid())  ← padrão mais comum
    // Se a policy usa memberships, o fallback abaixo resolve
    let company = null;

    // Tentativa A: query sem filtro (RLS aplica automaticamente por owner_id)
    const { data: companies, error: errA } = await _sb
      .from('companies')
      .select('id, name, slug, plan, config, signature, trial_ends_at')
      .limit(1);

    if (!errA && companies?.length) {
      company = companies[0];
    }

    // Tentativa B: filtro explícito por owner_id (se a RLS usar owner_id directo)
    if (!company) {
      const { data: owned } = await _sb
        .from('companies')
        .select('id, name, slug, plan, config, signature, trial_ends_at')
        .eq('owner_id', user.id)
        .limit(1)
        .single();
      if (owned) company = owned;
    }

    // Tentativa C: via memberships (se a tabela existir e a RLS usar memberships)
    if (!company) {
      const { data: mem } = await _sb
        .from('memberships')
        .select('companies(id, name, slug, plan, config, signature, trial_ends_at)')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      if (mem?.companies) company = mem.companies;
    }

    if (!company) {
      console.warn('3DZAAP: company not found for user', user.id);
      return null;
    }

    _companyId = company.id;
    return company;
  },

  async getSession() {
    const { data: { session } } = await _sb.auth.getSession();
    if (!session) return null;
    const company = await Auth._loadCompany();
    const user = session.user;
    return {
      email:       user.email,
      fname:       user.user_metadata?.fname || '',
      lname:       user.user_metadata?.lname || '',
      companyName: company?.name || '',
      plan:        company?.plan || 'trial',
      config:      company?.config || {},
      signature:   company?.signature || null,
      companyId:   company?.id,
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
  },
};

// ============================================================
// DB — helper interno para garantir _companyId antes de cada op
// ============================================================
async function _ensureCompany() {
  if (!_companyId) await Auth._loadCompany();
  if (!_companyId) throw new Error('Não foi possível determinar a empresa. Faz login novamente.');
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
    if (filament.id && !_isLocalId(filament.id)) {
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
    const row = _mapOrderToDB(order);
    if (order.id && !_isLocalId(order.id)) {
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
    const row = _mapExpenseToDB(expense);
    if (expense.id && !_isLocalId(expense.id)) {
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
  // Tabela opcional — falha silenciosa se não existir

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
    if (!_companyId) return; // log é opcional
    await _sb.from('activity_log')
      .insert({ company_id: _companyId, message, type })
      .then(r => r.error && console.info('activity_log:', r.error.message));
  },

  async clearLog() {
    if (!_companyId) return;
    await _sb.from('activity_log').delete().eq('company_id', _companyId);
  },
};

// ============================================================
// MAPPERS
// ============================================================

function _mapFilamentFromDB(row) {
  return {
    id:             row.id,
    colorHex:       row.color_hex,
    colorName:      row.color_name,
    type:           row.type,
    variation:      row.variation,
    brand:          row.brand,
    rollSize:       row.roll_size,
    total:          row.total,
    inUse:          row.in_use,
    newRolls:       row.new_rolls,
    price:          parseFloat(row.price || 0),
    alerta:         row.alerta || 0,
    notes:          row.notes || '',
    kgRemaining:    row.kg_remaining,
    emptyConfirmed: row.empty_confirmed || false,
    emptyByOrder:   row.empty_by_order,
    emptyAt:        row.empty_at,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  };
}

function _mapFilamentToDB(f) {
  return {
    color_hex:       f.colorHex,
    color_name:      f.colorName,
    type:            f.type,
    variation:       f.variation || null,
    brand:           f.brand || null,
    roll_size:       f.rollSize,
    total:           parseInt(f.total) || 0,
    in_use:          parseInt(f.inUse) || 0,
    price:           parseFloat(f.price) || 0,
    alerta:          parseInt(f.alerta) || 0,
    notes:           f.notes || null,
    kg_remaining:    f.kgRemaining ?? null,
    empty_confirmed: f.emptyConfirmed || false,
    empty_by_order:  f.emptyByOrder || null,
    empty_at:        f.emptyAt || null,
  };
}

function _mapOrderFromDB(row) {
  return {
    id:            row.id,
    orderNumber:   row.order_number,
    orderNumeric:  row.order_numeric,
    clientName:    row.client_name,
    clientEmail:   row.client_email || '',
    clientPhone:   row.client_phone || '',
    items:         row.items || [],
    description:   row.description || '',
    total:         parseFloat(row.total || 0),
    status:        row.status,
    paymentStatus: row.payment_status,
    createdAt:     row.created_at,
    dueDate:       row.due_date || '',
    paymentDate:   row.payment_date || '',
    notes:         row.notes || '',
    updatedAt:     row.updated_at,
  };
}

function _mapOrderToDB(o) {
  return {
    order_number:   o.orderNumber,
    order_numeric:  o.orderNumeric,
    client_name:    o.clientName,
    client_email:   o.clientEmail || null,
    client_phone:   o.clientPhone || null,
    items:          o.items || [],
    description:    o.description || '',
    total:          parseFloat(o.total) || 0,
    status:         o.status,
    payment_status: o.paymentStatus,
    created_at:     o.createdAt,
    due_date:       o.dueDate || null,
    payment_date:   o.paymentDate || null,
    notes:          o.notes || null,
  };
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

function _isLocalId(id) {
  return typeof id === 'number' || /^\d{10,}$/.test(String(id));
}

// ============================================================
// MIGRAÇÃO
// ============================================================
const Migration = {
  async importFromLocalStorage() {
    const results = { filaments: 0, orders: 0, expenses: 0 };
    try {
      const fils = JSON.parse(localStorage.getItem('filaments') || '[]');
      if (fils.length) { await DB.saveAllFilaments(fils); results.filaments = fils.length; }
    } catch(e) { console.warn('Filaments migration error:', e); }
    try {
      const ords = JSON.parse(localStorage.getItem('orders') || '[]');
      if (ords.length) { await DB.saveAllOrders(ords); results.orders = ords.length; }
    } catch(e) { console.warn('Orders migration error:', e); }
    try {
      const exps = JSON.parse(localStorage.getItem('expenses') || '[]');
      if (exps.length) { await DB.saveAllExpenses(exps); results.expenses = exps.length; }
    } catch(e) { console.warn('Expenses migration error:', e); }
    localStorage.setItem('3dzaap_migrated', '1');
    return results;
  },
  isMigrated() { return localStorage.getItem('3dzaap_migrated') === '1'; },
};