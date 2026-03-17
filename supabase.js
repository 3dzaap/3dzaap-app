// ============================================================
// supabase.js — Camada de dados 3DZAAP
// Substitui localStorage + IndexedDB em todas as páginas
//
// INSTRUÇÕES DE USO:
// 1. Adicionar no <head> de cada página HTML:
//    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//    <script src="/supabase.js"></script>
// 2. Substituir chamadas localStorage pelas funções DB.*
// ============================================================

// ── CONFIGURAÇÃO ─────────────────────────────────────────────
// Obter em: https://supabase.com → Project Settings → API
const SUPABASE_URL  = 'https://yjggsndxatezgqljlhxb.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZ2dzbmR4YXRlemdxbGpsaHhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MjE0MTgsImV4cCI6MjA4OTA5NzQxOH0.zVzA2siKsix8tOK44H5U-cZK1Wdd_4u_sY1g2JgGYUA';

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ── ESTADO GLOBAL ─────────────────────────────────────────────
// company_id do utilizador autenticado — carregado no init
let _companyId = null;

// ============================================================
// AUTH — Autenticação
// ============================================================
const Auth = {

  // Registar nova empresa + utilizador
  async register({ fname, lname, email, pass, companyName, slug, plan, config, signature }) {
    // 1. Criar utilizador no Supabase Auth
    const { data: authData, error: authErr } = await _sb.auth.signUp({
      email,
      password: pass,
      options: {
        data: { fname, lname }  // guardado em auth.users.raw_user_meta_data
      }
    });
    if (authErr) throw authErr;

    // 2. Criar empresa (company) associada
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

    // 3. Criar membership owner — as RLS policies usam a tabela memberships
    const { error: memErr } = await _sb
      .from('memberships')
      .insert({ user_id: authData.user.id, company_id: company.id, role: 'owner' });
    if (memErr) console.warn('membership insert:', memErr.message);

    _companyId = company.id;
    return { user: authData.user, company };
  },

  // Login
  async login(email, pass) {
    const { data, error } = await _sb.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    await Auth._loadCompany();
    return data;
  },

  // Logout
  async logout() {
    await _sb.auth.signOut();
    _companyId = null;
    window.location.href = 'auth-onboarding.html';
  },

  // Carregar company_id do utilizador autenticado
  // Tenta via memberships (alinhado com RLS), fallback para owner_id
  async _loadCompany() {
    const { data: { user } } = await _sb.auth.getUser();
    if (!user) return null;

    // 1. Tentar via memberships (o que as RLS policies usam)
    const { data: mem } = await _sb
      .from('memberships')
      .select('company_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    let companyId = mem?.company_id || null;

    // 2. Fallback: owner_id directo (utilizadores criados antes da tabela memberships)
    if (!companyId) {
      const { data: owned } = await _sb
        .from('companies')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)
        .single();
      companyId = owned?.id || null;

      // Se encontrou via owner_id mas não tem membership, criar agora
      if (companyId) {
        await _sb.from('memberships')
          .insert({ user_id: user.id, company_id: companyId, role: 'owner' })
          .then(r => r.error && console.warn('membership auto-create:', r.error.message));
      }
    }

    if (!companyId) return null;
    _companyId = companyId;

    const { data: company } = await _sb
      .from('companies')
      .select('id, name, slug, plan, config, signature, trial_ends_at')
      .eq('id', companyId)
      .single();
    if (company) _companyId = company.id;
    return company;
  },

  // Obter sessão actual + dados empresa
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

  // Verificar se está autenticado — redirigir se não
  async requireAuth() {
    const { data: { session } } = await _sb.auth.getSession();
    if (!session) {
      window.location.href = 'auth-onboarding.html';
      return false;
    }
    if (!_companyId) await Auth._loadCompany();
    return true;
  },

  // Atualizar dados da empresa (config, assinatura, etc.)
  async updateCompany(fields) {
    if (!_companyId) return;
    const { error } = await _sb
      .from('companies')
      .update(fields)
      .eq('id', _companyId);
    if (error) throw error;
  },
};

// ============================================================
// DB — Operações CRUD
// Cada função substitui um par localStorage.getItem/setItem
// ============================================================
const DB = {

  // ── FILAMENTS ───────────────────────────────────────────────

  async getFilaments() {
    const { data, error } = await _sb
      .from('filaments')
      .select('*')
      .eq('company_id', _companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(_mapFilamentFromDB);
  },

  async saveFilament(filament) {
    const row = _mapFilamentToDB(filament);
    if (filament.id && !_isLocalId(filament.id)) {
      // UPDATE
      const { data, error } = await _sb
        .from('filaments')
        .update(row)
        .eq('id', filament.id)
        .eq('company_id', _companyId)
        .select()
        .single();
      if (error) throw error;
      return _mapFilamentFromDB(data);
    } else {
      // INSERT
      const { data, error } = await _sb
        .from('filaments')
        .insert({ ...row, company_id: _companyId })
        .select()
        .single();
      if (error) throw error;
      return _mapFilamentFromDB(data);
    }
  },

  async deleteFilament(id) {
    const { error } = await _sb
      .from('filaments')
      .delete()
      .eq('id', id)
      .eq('company_id', _companyId);
    if (error) throw error;
  },

  // Guardar array completo de filamentos (usado pelo backoffice restore)
  async saveAllFilaments(filaments) {
    // Apagar todos e reinserir
    await _sb.from('filaments').delete().eq('company_id', _companyId);
    if (!filaments.length) return;
    const rows = filaments.map(f => ({ ..._mapFilamentToDB(f), company_id: _companyId }));
    const { error } = await _sb.from('filaments').insert(rows);
    if (error) throw error;
  },

  // ── ORDERS ──────────────────────────────────────────────────

  async getOrders() {
    const { data, error } = await _sb
      .from('orders')
      .select('*')
      .eq('company_id', _companyId)
      .order('order_numeric', { ascending: false });
    if (error) throw error;
    return data.map(_mapOrderFromDB);
  },

  async getLastOrderNumber() {
    const { data } = await _sb
      .from('orders')
      .select('order_numeric')
      .eq('company_id', _companyId)
      .order('order_numeric', { ascending: false })
      .limit(1)
      .single();
    return data?.order_numeric || 0;
  },

  async saveOrder(order) {
    const row = _mapOrderToDB(order);
    if (order.id && !_isLocalId(order.id)) {
      const { data, error } = await _sb
        .from('orders')
        .update(row)
        .eq('id', order.id)
        .eq('company_id', _companyId)
        .select()
        .single();
      if (error) throw error;
      return _mapOrderFromDB(data);
    } else {
      const { data, error } = await _sb
        .from('orders')
        .insert({ ...row, company_id: _companyId })
        .select()
        .single();
      if (error) throw error;
      return _mapOrderFromDB(data);
    }
  },

  async deleteOrder(id) {
    const { error } = await _sb
      .from('orders')
      .delete()
      .eq('id', id)
      .eq('company_id', _companyId);
    if (error) throw error;
  },

  async saveAllOrders(orders) {
    await _sb.from('orders').delete().eq('company_id', _companyId);
    if (!orders.length) return;
    const rows = orders.map(o => ({ ..._mapOrderToDB(o), company_id: _companyId }));
    const { error } = await _sb.from('orders').insert(rows);
    if (error) throw error;
  },

  // ── EXPENSES ────────────────────────────────────────────────

  async getExpenses() {
    const { data, error } = await _sb
      .from('expenses')
      .select('*')
      .eq('company_id', _companyId)
      .order('date', { ascending: false });
    if (error) throw error;
    return data.map(_mapExpenseFromDB);
  },

  async saveExpense(expense) {
    const row = _mapExpenseToDB(expense);
    if (expense.id && !_isLocalId(expense.id)) {
      const { data, error } = await _sb
        .from('expenses')
        .update(row)
        .eq('id', expense.id)
        .eq('company_id', _companyId)
        .select()
        .single();
      if (error) throw error;
      return _mapExpenseFromDB(data);
    } else {
      const { data, error } = await _sb
        .from('expenses')
        .insert({ ...row, company_id: _companyId })
        .select()
        .single();
      if (error) throw error;
      return _mapExpenseFromDB(data);
    }
  },

  async deleteExpense(id) {
    const { error } = await _sb
      .from('expenses')
      .delete()
      .eq('id', id)
      .eq('company_id', _companyId);
    if (error) throw error;
  },

  async saveAllExpenses(expenses) {
    await _sb.from('expenses').delete().eq('company_id', _companyId);
    if (!expenses.length) return;
    const rows = expenses.map(e => ({ ..._mapExpenseToDB(e), company_id: _companyId }));
    const { error } = await _sb.from('expenses').insert(rows);
    if (error) throw error;
  },

  // ── ACTIVITY LOG ────────────────────────────────────────────

  async getLog() {
    const { data } = await _sb
      .from('activity_log')
      .select('*')
      .eq('company_id', _companyId)
      .order('created_at', { ascending: false })
      .limit(100);
    return data || [];
  },

  async addLog(message, type = 'inf') {
    await _sb.from('activity_log').insert({
      company_id: _companyId,
      message,
      type,
    });
  },

  async clearLog() {
    await _sb.from('activity_log').delete().eq('company_id', _companyId);
  },
};

// ============================================================
// MAPPERS — Converter entre formato JS (camelCase) e DB (snake_case)
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
    order_number:  o.orderNumber,
    order_numeric: o.orderNumeric,
    client_name:   o.clientName,
    client_email:  o.clientEmail || null,
    client_phone:  o.clientPhone || null,
    items:         o.items || [],
    description:   o.description || '',
    total:         parseFloat(o.total) || 0,
    status:        o.status,
    payment_status: o.paymentStatus,
    created_at:    o.createdAt,
    due_date:      o.dueDate || null,
    payment_date:  o.paymentDate || null,
    notes:         o.notes || null,
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

// IDs locais (Date.now()) vs UUIDs do Supabase
function _isLocalId(id) {
  return typeof id === 'number' || /^\d{10,}$/.test(String(id));
}

// ============================================================
// MIGRAÇÃO — Importar dados locais para o Supabase
// Executar uma vez após o primeiro login
// ============================================================
const Migration = {

  async importFromLocalStorage() {
    const results = { filaments: 0, orders: 0, expenses: 0 };

    try {
      const fils = JSON.parse(localStorage.getItem('filaments') || '[]');
      if (fils.length) {
        await DB.saveAllFilaments(fils);
        results.filaments = fils.length;
      }
    } catch(e) { console.warn('Filaments migration error:', e); }

    try {
      const ords = JSON.parse(localStorage.getItem('orders') || '[]');
      if (ords.length) {
        await DB.saveAllOrders(ords);
        results.orders = ords.length;
      }
    } catch(e) { console.warn('Orders migration error:', e); }

    try {
      const exps = JSON.parse(localStorage.getItem('expenses') || '[]');
      if (exps.length) {
        await DB.saveAllExpenses(exps);
        results.expenses = exps.length;
      }
    } catch(e) { console.warn('Expenses migration error:', e); }

    // Marcar como migrado
    localStorage.setItem('3dzaap_migrated', '1');

    return results;
  },

  isMigrated() {
    return localStorage.getItem('3dzaap_migrated') === '1';
  },
};
