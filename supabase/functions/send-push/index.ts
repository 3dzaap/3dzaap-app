// supabase/functions/send-push/index.ts
// Motor central de envio de Web Push Notifications (VAPID).
// Recebe: { companyId, title, body, url, tag, badge? }
// Busca todos os dispositivos inscritos da empresa e envia a notificação.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:suporte@3dzaap.com.br';

// ── VAPID helpers ───────────────────────────────────────────────────────────

function base64urlToUint8Array(base64: string): Uint8Array {
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function createVapidJwt(audience: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', typ: 'JWT' };
  const payload = { aud: audience, exp: now + 12 * 3600, sub: VAPID_SUBJECT };

  const toSign = `${uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(header)))}.${uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(payload)))}`;

  const privKeyBytes = base64urlToUint8Array(VAPID_PRIVATE_KEY);

  const privateKey = await crypto.subtle.importKey(
    'raw', privKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );

  const sigBytes = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    new TextEncoder().encode(toSign)
  ));

  return `${toSign}.${uint8ArrayToBase64url(sigBytes)}`;
}

// ── Send a single push subscription ────────────────────────────────────────

async function sendPushToSubscription(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string
): Promise<void> {
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await createVapidJwt(audience);

  const authHeader = `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`;

  // Encrypt the payload using Web Push encryption (RFC 8291 / AES-128-GCM)
  // For simplicity we use the standard Web Push encryption approach
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(payload);

  // Generate salt (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Import receiver's public key
  const receiverPubKey = await crypto.subtle.importKey(
    'raw', base64urlToUint8Array(sub.p256dh),
    { name: 'ECDH', namedCurve: 'P-256' },
    false, []
  );

  // Generate sender key pair
  const senderKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, ['deriveKey']
  );

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: receiverPubKey },
    senderKeyPair.privateKey,
    { name: 'HKDF' },
    false, ['deriveKey']
  );

  // Auth bytes
  const authBytes = base64urlToUint8Array(sub.auth);

  // PRK (Pseudo-Random Key) via HKDF
  const prk = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: authBytes,
      info: encoder.encode('Content-Encoding: auth\0')
    },
    sharedSecret,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    true, ['sign']
  );

  const senderPubKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', senderKeyPair.publicKey)
  );

  // Content encryption key
  const cekInfo = new Uint8Array([
    ...encoder.encode('Content-Encoding: aesgcm\0'),
    ...encoder.encode('P-256\0'),
    0, 65, ...base64urlToUint8Array(sub.p256dh),
    0, 65, ...senderPubKeyRaw,
  ]);

  const cekKeyMaterial = await crypto.subtle.exportKey('raw', prk);
  const cekHkdf = await crypto.subtle.importKey('raw', cekKeyMaterial, 'HKDF', false, ['deriveKey']);
  const cek = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo },
    cekHkdf,
    { name: 'AES-GCM', length: 128 },
    false, ['encrypt']
  );

  // Nonce
  const nonceInfo = new Uint8Array([
    ...encoder.encode('Content-Encoding: nonce\0'),
    ...encoder.encode('P-256\0'),
    0, 65, ...base64urlToUint8Array(sub.p256dh),
    0, 65, ...senderPubKeyRaw,
  ]);
  const nonceKeyMaterial = await crypto.subtle.exportKey('raw', prk);
  const nonceHkdf = await crypto.subtle.importKey('raw', nonceKeyMaterial, 'HKDF', false, ['deriveKey']);
  const nonce = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo },
    nonceHkdf,
    96
  ));

  // Padding + encrypt
  const paddedPayload = new Uint8Array([0, 0, ...payloadBytes]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cek, paddedPayload)
  );

  // Build the body: salt + dh_len + dh + ciphertext
  const body = new Uint8Array([
    ...salt,
    0x00, 0x00, 0x10, 0x00,         // record size = 4096
    senderPubKeyRaw.length,           // dh key length (1 byte)
    ...senderPubKeyRaw,
    ...ciphertext
  ]);

  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aesgcm',
      'Encryption': `salt=${uint8ArrayToBase64url(salt)}`,
      'Crypto-Key': `dh=${uint8ArrayToBase64url(senderPubKeyRaw)};p256ecdsa=${VAPID_PUBLIC_KEY}`,
      'TTL': '86400',
    },
    body
  });

  if (!res.ok && res.status !== 201) {
    const text = await res.text();
    throw new Error(`Push failed [${res.status}]: ${text}`);
  }
}

// ── Main handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  }

  try {
    let payloadData = await req.json();

    // Check if this is a Supabase Webhook payload
    if (payloadData.type === 'UPDATE' && payloadData.record) {
      const order = payloadData.record;
      const oldOrder = payloadData.old_record || {};
      
      const unreadChangedToTrue = (oldOrder.has_unread_client_update !== true && order.has_unread_client_update === true);
      const statusChangedToAprovado = (oldOrder.status !== 'aprovado' && order.status === 'aprovado');
      const statusChangedToRejeitado = (oldOrder.status !== 'rejeitado' && order.status === 'rejeitado');

      // If nothing relevant changed, abort
      if (!unreadChangedToTrue && !statusChangedToAprovado && !statusChangedToRejeitado) {
        return new Response(JSON.stringify({ message: 'No notification needed (condition not met)' }), { status: 200 });
      }

      let actBody = `O pedido ${order.order_numeric ? '#' + order.order_numeric + ' ' : ''}de ${order.client_name || 'um cliente'} foi atualizado.`;
      if (statusChangedToAprovado) actBody = `O cliente ${order.client_name || ''} APROVOU o orçamento ${order.order_numeric ? '#' + order.order_numeric : ''}! 🎉`;
      if (statusChangedToRejeitado) actBody = `O cliente ${order.client_name || ''} REJEITOU o orçamento ${order.order_numeric ? '#' + order.order_numeric : ''}.`;

      payloadData = {
        companyId: order.company_id,
        title: statusChangedToAprovado ? 'Orçamento Aprovado!' : 'Atualização do Cliente',
        body: actBody,
        url: `/orders.html?highlight=${order.id}`,
        tag: `order-${order.id}`
      };
    }

    const { companyId, title, body, url = '/orders.html', tag = 'default', badge = 1 } = payloadData;

    if (!companyId || !title || !body) {
      return new Response(JSON.stringify({ error: 'Missing required fields: companyId, title, body' }), { status: 400 });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch all subscriptions for this company
    const { data: subs, error } = await sb
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('company_id', companyId);

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions found' }), { status: 200 });
    }

    const payload = JSON.stringify({ title, body, url, tag, badge });

    const results = await Promise.allSettled(
      subs.map(sub => sendPushToSubscription(sub, payload))
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`[send-push] Sent: ${sent}, Failed: ${failed} for company ${companyId}`);

    return new Response(JSON.stringify({ sent, failed }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) {
    console.error('[send-push] Error:', e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
