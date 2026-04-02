// ============================================================
// supabase.js — Camada de dados 3DZAAP  v2.2.1-fix-onboarding
// Correcções: Suporte a Impressoras, Filamentos (packId/kg),
// Mappers alinhados e Activity Log completo.
// ============================================================
console.info('[3DZAAP] supabase.js v2.2.1-fix-onboarding inicializado.');

const SUPABASE_URL  = 'https://yjggsndxatezgqljlhxb.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZ2dzbmR4YXRlemdxbGpsaHhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MjE0MTgsImV4cCI6MjA4OTA5NzQxOH0.zVzA2siKsix8tOK44H5U-cZK1Wdd_4u_sY1g2JgGYUA';

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

let _companyId    = null;   // UUID da empresa
let _companyCache = null;   // objecto completo — evita queries repetidas

// ============================================================
// AUTH
// ============================================================
const Auth = {

  async register({ fname, lname, email, pass, companyName, slug, plan, config, signature, initFilament, initPrinter }) {
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

    if (authData.session) {
      await _sb.auth.setSession(authData.session);
    }

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

    // ── INITIAL DATA (OPCIONAL) ───────────────────────────────
    if (initFilament && initFilament.name) {
      try {
        await _sb.from('filaments').insert({
          company_id: _companyId,
          name:       initFilament.name,
          price:      parseFloat(initFilament.price || 25),
          total:      parseFloat(initFilament.stock || 1),
          inUse:      0,
          alerta:     0.5,
          color:      '#3B8FD4'
        });
      } catch(e) { console.warn('[3DZAAP] initFilament err:', e); }
    }

    if (initPrinter && initPrinter.name) {
      try {
        await _sb.from('printers').insert({
          company_id: _companyId,
          name:       initPrinter.name,
          status:     'disponivel',
          custo_hora: 0.5,
          created_at: new Date().toISOString()
        });
      } catch(e) { console.warn('[3DZAAP] initPrinter err:', e); }
    }

    const needsEmailConfirm = !authData.session;
    return { user: authData.user, company, needsEmailConfirm };
  },

  async login(email, pass) {
    const { data, error } = await _sb.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    _companyId    = null;
    _companyCache = null;
    await Auth._loadCompany();
    return data;
  },

  async loginWithGoogle() {
    const { data, error } = await _sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth-onboarding.html'
      }
    });
    if (error) throw error;
    return data;
  },

  async logout() {
    await _sb.auth.signOut();
    _companyId    = null;
    _companyCache = null;
    window.location.href = 'auth-onboarding.html';
  },

  async _loadCompany(forceRefresh = false) {
    if (!forceRefresh && _companyCache) return _companyCache;

    const { data: { user }, error: userErr } = await _sb.auth.getUser();
    if (userErr || !user) return null;

    let company = null;
    let role    = 'owner';

    try {
      const { data: mem, error: memErr } = await _sb
        .from('memberships')
        .select('role, companies(id, name, slug, plan, config, signature, logo_url, trial_ends_at)')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (!memErr && mem?.companies) {
        company = Array.isArray(mem.companies) ? mem.companies[0] : mem.companies;
        role    = mem.role || 'member';
      }
    } catch (_) {}

    if (!company) {
      const { data: owned, error: ownedErr } = await _sb
        .from('companies')
        .select('id, name, slug, plan, config, signature, logo_url, trial_ends_at')
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

    // ── SUPER ADMIN CHECK ────────────────────────────────────
    // Purely database-driven check via super_admins table.
    let isSuperAdmin = false;
    try {
      const { data: saRow, error } = await _sb
        .from('super_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!error) isSuperAdmin = !!saRow;
    } catch(_) {}

    return {
      email:       user.email,
      fname:       user.user_metadata?.fname || '',
      lname:       user.user_metadata?.lname || '',
      companyName: company?.name  || '',
      plan:        company?.plan  || 'trial',
      config:      company?.config || {},
      signature:   company?.signature || null,
      logo_url:    company?.logo_url  || null,
      companyId:   company?.id,
      role:        company?.role || 'owner',
      trialEndsAt: company?.trial_ends_at || null,
      isSuperAdmin,
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

  // ── SUPER ADMIN MANAGEMENT ───────────────────────────────
  async setSuperAdmin(userId, email, grantedByEmail) {
    const { error } = await _sb.from('super_admins').upsert(
      { user_id: userId, email, granted_by: grantedByEmail, granted_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
    if (error) throw error;
  },

  async revokeSuperAdmin(userId) {
    const { error } = await _sb.from('super_admins').delete().eq('user_id', userId);
    if (error) throw error;
  },

  async getSuperAdmins() {
    const { data, error } = await _sb.from('super_admins').select('*').order('granted_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
};

// ============================================================
// DB — Helpers e Operações
// ============================================================
async function _ensureCompany() {
  if (!_companyId) await Auth._loadCompany();
  if (!_companyId) throw new Error('Empresa não encontrada. Faz login novamente.');
}

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
        .from('filaments').update(row)
        .eq('id', filament.id).eq('company_id', _companyId)
        .select().single();
      if (error) throw error;
      return _mapFilamentFromDB(data);
    } else {
      const { data, error } = await _sb
        .from('filaments').insert({ ...row, company_id: _companyId })
        .select().single();
      if (error) throw error;
      return _mapFilamentFromDB(data);
    }
  },

  async deleteFilament(id) {
    await _ensureCompany();
    const { error } = await _sb.from('filaments').delete().eq('id', id).eq('company_id', _companyId);
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
    
    // Check if it's a new order without a number (e.g. from Calculator)
    const isNew = !order.id || _isLocalId(order.id);

    const row   = _mapOrderToDB(order);
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
    const { error } = await _sb.from('orders').delete().eq('id', id).eq('company_id', _companyId);
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

  // ── CUSTOMER PORTAL & TRACKING (Public) ─────────────────────
  
  async getTrackingInfo(shareToken) {
    if (!shareToken) throw new Error('Token de partilha não fornecido.');
    
    // Fetch order + company info for the receipt view
    const { data: row, error } = await _sb
      .from('orders')
      .select(`
        *,
        companies (
          name, 
          config, 
          signature
        )
      `)
      .eq('share_token', shareToken)
      .single();

    if (error || !row) throw new Error('Pedido ou Orçamento não encontrado.');
    
    const order = _mapOrderFromDB(row);
    const company = row.companies || {};
    const config = company.config || {};
    
    return { 
      order, 
      companyName: company.name || '3DZAAP',
      companyConfig: config,
      logoUrl: config.logoUrl || '', // Fallback to config
      signature: company.signature || null
    };
  },

  async respondToQuote(shareToken, action, passphrase) {
    if (!shareToken) throw new Error('Token de partilha necessário.');
    
    // First verify passphrase if provided in the data
    const { data: check, error: checkErr } = await _sb
      .from('orders')
      .select('id, passphrase, expires_at, status, is_quote')
      .eq('share_token', shareToken)
      .single();
      
    if (checkErr || !check) throw new Error('Documento não encontrado.');
    
    // Check expiration for quotes
    if (check.is_quote && check.expires_at) {
      if (new Date(check.expires_at) < new Date()) {
        throw new Error('Este orçamento já expirou.');
      }
    }

    if (passphrase && check.passphrase && check.passphrase !== passphrase) {
      throw new Error('Palavra-passe incorrecta.');
    }

    let newStatus = 'aprovado';
    if (action === 'decline') {
      newStatus = 'declined';
    } else if (action === 'approve') {
      // Logic for two-step approval
      if (check.status === 'orcamento') newStatus = 'modelagem';
      else newStatus = 'aprovado';
    }

    const updateFields = { 
      status: newStatus,
      updated_at: new Date().toISOString()
    };
    
    // If approved at final stage or initial budget, it might no longer be just a "quote"
    if (action === 'approve' && newStatus === 'aprovado') updateFields.is_quote = false;

    const { error } = await _sb
      .from('orders')
      .update(updateFields)
      .eq('share_token', shareToken);

    if (error) throw error;
    return { status: newStatus };
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
    const { error } = await _sb.from('expenses').delete().eq('id', id).eq('company_id', _companyId);
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

  // ── PRINTERS ────────────────────────────────────────────────

  async getPrinters() {
    await _ensureCompany();
    const { data, error } = await _sb
      .from('printers').select('*')
      .eq('company_id', _companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(_mapPrinterFromDB);
  },

  async savePrinter(printer) {
    await _ensureCompany();
    const row   = _mapPrinterToDB(printer);
    const isNew = !printer.id || _isLocalId(printer.id);

    if (!isNew) {
      const { data, error } = await _sb
        .from('printers').update(row)
        .eq('id', printer.id).eq('company_id', _companyId)
        .select().single();
      if (error) throw error;
      return _mapPrinterFromDB(data);
    } else {
      const { data, error } = await _sb
        .from('printers').insert({ ...row, company_id: _companyId })
        .select().single();
      if (error) throw error;
      return _mapPrinterFromDB(data);
    }
  },

  async deletePrinter(id) {
    await _ensureCompany();
    const { error } = await _sb.from('printers').delete().eq('id', id).eq('company_id', _companyId);
    if (error) throw error;
  },

  async saveAllPrinters(printersList) {
    await _ensureCompany();
    const { error: delErr } = await _sb.from('printers').delete().eq('company_id', _companyId);
    if (delErr) throw delErr;
    if (!printersList.length) return [];
    const rows = printersList.map(p => ({ ..._mapPrinterToDB(p), company_id: _companyId }));
    const { data, error } = await _sb.from('printers').insert(rows).select();
    if (error) throw error;
    return data.map(_mapPrinterFromDB);
  },

  // ── PRINTER MODELS (CATALOG) ────────────────────────────────
  async getPrinterModels() {
    // MÉTODO GLOBAL — NÃO CHAMA _ensureCompany
    const { data, error } = await _sb
      .from('printer_models').select('*')
      .order('brand', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
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
      .from('memberships').update({ role })
      .eq('id', membershipId).eq('company_id', _companyId);
    if (error) throw error;
  },

  async removeMember(membershipId) {
    await _ensureCompany();
    const { error } = await _sb
      .from('memberships').delete()
      .eq('id', membershipId).eq('company_id', _companyId);
    if (error) throw error;
  },

  async getInvites() {
    await _ensureCompany();
    const { data, error } = await _sb
      .from('invites').select('id, email, role, expires_at, accepted_at, created_at')
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
    const { error } = await _sb.from('invites').delete().eq('id', inviteId).eq('company_id', _companyId);
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
// MAPPERS
// ============================================================

function _parseBrand(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  const sep = val.includes('||') ? '||' : ',';
  return val.split(sep).map(s => s.trim()).filter(Boolean);
}

function _mapFilamentFromDB(row) {
  return {
    id:             row.id,
    materialClass:  row.material_class || 'fdm',
    material_class: row.material_class || 'fdm',
    colorHex:       row.color_hex  || '',
    colorName:      row.color_name || '',
    color:          row.color_name || '',
    type:           row.type,
    variation:      row.variation  || '',
    brand:          _parseBrand(row.brand),
    rollSize:       row.roll_size  || '1kg',
    total:          parseInt(row.total || 0),
    inUse:          parseInt(row.in_use || 0),
    newRolls:       Math.max(0, parseInt(row.total || 0) - parseInt(row.in_use || 0)),
    price:          parseFloat(row.price || 0),
    alerta:         parseInt(row.alerta || 0),
    notes:          row.notes || '',
    packId:         row.pack_id || null,
    kgRemaining:    row.kg_remaining  ?? null,
    emptyConfirmed: row.empty_confirmed || false,
    emptyByOrder:   row.empty_by_order || null,
    emptyAt:        row.empty_at       || null,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  };
}

function _mapFilamentToDB(f) {
  const brandStr = Array.isArray(f.brand)
    ? f.brand.filter(Boolean).join('||')
    : (typeof f.brand === 'string' ? f.brand.replace(/,\s*/g, '||') : '');

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
    pack_id:         f.packId || f.pack_id || null,
    kg_remaining:    f.kgRemaining ?? f.kg_remaining ?? null,
    empty_confirmed: f.emptyConfirmed ?? f.empty_confirmed ?? false,
    empty_by_order:  f.emptyByOrder  ?? f.empty_by_order  ?? null,
    empty_at:        f.emptyAt       ?? f.empty_at        ?? null,
  };
}

function _mapOrderFromDB(row) {
  const status = row.status || row.order_status;
  const pay    = row.payment_status || row.paymentStatus;
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
    status:        (status === 'null' || !status) ? 'orcamento' : status,
    paymentStatus: (pay === 'null' || !pay) ? 'pendente' : pay,
    createdAt:     row.created_at,
    dueDate:       row.due_date      || '',
    paymentDate:   row.payment_date  || '',
    notes:         row.notes         || '',
    printerId:     row.printer_id    || null,
    estPrintHours: row.est_print_hours ? parseFloat(row.est_print_hours) : null,
    shareToken:    row.share_token,
    passphrase:    row.passphrase,
    expiresAt:     row.expires_at,
    isQuote:       row.is_quote || false,
    updatedAt:     row.updated_at,
  };
}

function _mapOrderToDB(o) {
  const row = {
    client_name:     o.clientName,
    client_email:    o.clientEmail  || null,
    client_phone:    o.clientPhone  || null,
    items:           o.items        || [],
    description:     o.description  || '',
    total:           parseFloat(o.total) || 0,
    status:          (o.status === 'null' || !o.status) ? 'orcamento' : o.status,
    payment_status:  (o.paymentStatus === 'null' || !o.paymentStatus) ? 'pendente' : o.paymentStatus,
    due_date:        o.dueDate      || null,
    payment_date:    o.paymentDate  || null,
    notes:           o.notes        || null,
    printer_id:      o.printerId    || null,
    est_print_hours: o.estPrintHours || null,
    share_token:     o.shareToken   || null,
    passphrase:      o.passphrase   || null,
    expires_at:      o.expiresAt    || null,
    is_quote:        o.isQuote      || false,
  };
  
  // Optional columns (Let DB triggers/defaults handle these if new)
  if (o.orderNumber)  row.order_number  = o.orderNumber;
  if (o.orderNumeric) row.order_numeric = parseInt(o.orderNumeric || 0);
  if (o.shareToken)   row.share_token   = o.shareToken;
  if (o.passphrase)   row.passphrase    = o.passphrase;
  if (o.createdAt)    row.created_at    = o.createdAt;
  
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

function _mapPrinterFromDB(row) {
  return {
    id:                 row.id,
    brand:              row.brand || '',
    model:              row.model || '',
    customName:         row.custom_name || null,
    printerType:        row.printer_type || 'fdm',
    status:             row.status || 'operacional',
    price:              parseFloat(row.price || 0) || null,
    lifeHours:          parseInt(row.life_hours || 5000),
    hoursUsed:          parseInt(row.hours_used || 0),
    purchaseDate:       row.purchase_date  || null,
    warrantyUntil:      row.warranty_until || null,
    maintIntervalHours: parseInt(row.maint_interval_hours || 0) || null,
    lastMaintHours:     parseInt(row.last_maint_hours || 0),
    maintenances:       Array.isArray(row.maintenances) ? row.maintenances : [],
    mmsSystem:          row.mms_system || null,
    mmsQty:             parseInt(row.mms_qty || 1),
    notes:              row.notes || null,
    imageUrl:           row.image_url || null,
    powerPrint:         parseInt(row.power_print) || null,
    powerStandby:       parseInt(row.power_standby) || null,
    powerMax:           parseInt(row.power_max) || null,
    catalogId:          row.catalog_id || null,
    createdAt:          row.created_at,
    updatedAt:          row.updated_at,
  };
}

function _mapPrinterToDB(p) {
  return {
    brand:                p.brand,
    model:                p.model,
    custom_name:          p.customName          || null,
    printer_type:         p.printerType         || 'fdm',
    status:               p.status              || 'operacional',
    price:                p.price               || null,
    life_hours:           parseInt(p.lifeHours) || 5000,
    hours_used:           parseInt(p.hoursUsed) || 0,
    purchase_date:        p.purchaseDate        || null,
    warranty_until:       p.warrantyUntil       || null,
    maint_interval_hours: p.maintIntervalHours  || null,
    last_maint_hours:     parseInt(p.lastMaintHours) || 0,
    maintenances:         Array.isArray(p.maintenances) ? p.maintenances : [],
    mms_system:           p.mmsSystem           || null,
    mms_qty:              p.mmsQty              || null,
    notes:                p.notes               || null,
    image_url:            p.imageUrl            || null,
    power_print:          p.powerPrint          || null,
    power_standby:        p.powerStandby        || null,
    power_max:            p.powerMax            || null,
    catalog_id:           p.catalogId           || null,
  };
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