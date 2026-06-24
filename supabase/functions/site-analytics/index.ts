import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

const serviceDb = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || (req.method === 'POST' ? 'collect' : 'summary');

    if (req.method === 'POST' && action === 'collect') {
      return json(await collectEvent(req));
    }

    const user = await requireAdminUser(req);

    if (req.method === 'GET' && action === 'summary') {
      const days = clampNumber(url.searchParams.get('days'), 7, 365, 30);
      return json(await buildSummary(days));
    }
    if (req.method === 'GET' && action === 'exclusions') {
      return json({ currentIp: requestIp(req), exclusions: await listExclusions() });
    }
    if (req.method === 'POST' && action === 'exclude-current') {
      const body = await readJson(req);
      return json(await addExclusion(requestIp(req), cleanText(body.label, 120) || 'My IP address', user.id));
    }
    if (req.method === 'POST' && action === 'exclude-ip') {
      const body = await readJson(req);
      return json(await addExclusion(cleanIp(body.ip_address), cleanText(body.label, 120), user.id));
    }
    if (req.method === 'DELETE' && action === 'exclusion') {
      const id = cleanText(url.searchParams.get('id'), 80);
      if (!id) throw httpError('Exclusion ID is required.', 400);
      const { error } = await serviceDb.from('site_analytics_ip_exclusions').delete().eq('id', id);
      if (error) throw error;
      return json({ ok: true });
    }

    throw httpError('Unsupported analytics action.', 400);
  } catch (err) {
    console.error(err);
    return json({ error: err.message || 'Unexpected analytics error.' }, err.status || 500);
  }
});

async function collectEvent(req: Request) {
  const ip = requestIp(req);
  if (ip && await isExcludedIp(ip)) return { ok: true, ignored: true };

  const userAgent = req.headers.get('user-agent') || '';
  if (isLikelyBot(userAgent)) return { ok: true, ignored: true };

  const body = await readJson(req);
  const event = {
    session_id: cleanSessionId(body.session_id),
    event_name: allowedEventName(body.event_name),
    page_path: cleanPath(body.page_path),
    page_title: cleanText(body.page_title, 180),
    referrer: cleanUrl(body.referrer, 500),
    utm_source: cleanText(body.utm_source, 120),
    utm_medium: cleanText(body.utm_medium, 120),
    utm_campaign: cleanText(body.utm_campaign, 160),
    device_type: allowedDevice(body.device_type),
  };

  if (!event.session_id || !event.page_path) throw httpError('Invalid analytics event.', 400);
  const { error } = await serviceDb.from('site_analytics_events').insert(event);
  if (error) throw error;
  return { ok: true };
}

async function buildSummary(days: number) {
  const now = new Date();
  const currentStart = new Date(now.getTime() - days * 86400000);
  const previousStart = new Date(now.getTime() - days * 2 * 86400000);
  const { data, error } = await serviceDb
    .from('site_analytics_events')
    .select('session_id,event_name,page_path,page_title,referrer,utm_source,utm_medium,utm_campaign,device_type,created_at')
    .gte('created_at', previousStart.toISOString())
    .order('created_at', { ascending: false })
    .limit(20000);
  if (error) throw error;

  const rows = data || [];
  const current = rows.filter(row => new Date(row.created_at) >= currentStart);
  const previous = rows.filter(row => new Date(row.created_at) < currentStart);
  const pageViews = current.filter(row => row.event_name === 'page_view');
  const previousViews = previous.filter(row => row.event_name === 'page_view');

  return {
    days,
    generatedAt: now.toISOString(),
    totals: {
      visitors: uniqueCount(pageViews, 'session_id'),
      views: pageViews.length,
      conversions: current.filter(row => row.event_name !== 'page_view').length,
      previousVisitors: uniqueCount(previousViews, 'session_id'),
      previousViews: previousViews.length,
    },
    daily: dailySeries(pageViews, days),
    topPages: groupedRows(pageViews, row => row.page_path, 10),
    referrers: groupedRows(pageViews, row => referrerLabel(row.referrer), 8),
    devices: groupedRows(pageViews, row => row.device_type || 'unknown', 5),
    campaigns: groupedRows(pageViews.filter(row => row.utm_campaign || row.utm_source), row => row.utm_campaign || row.utm_source, 8),
    conversions: groupedRows(current.filter(row => row.event_name !== 'page_view'), row => row.event_name, 8),
  };
}

function dailySeries(rows: Record<string, unknown>[], days: number) {
  const counts = new Map<string, { views: number; sessions: Set<string> }>();
  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
    counts.set(date, { views: 0, sessions: new Set() });
  }
  rows.forEach(row => {
    const date = String(row.created_at).slice(0, 10);
    const item = counts.get(date);
    if (!item) return;
    item.views += 1;
    item.sessions.add(String(row.session_id));
  });
  return Array.from(counts, ([date, item]) => ({ date, views: item.views, visitors: item.sessions.size }));
}

function groupedRows(rows: Record<string, unknown>[], keyFn: (row: Record<string, unknown>) => string, limit: number) {
  const counts = new Map<string, number>();
  rows.forEach(row => {
    const key = keyFn(row) || 'Unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Array.from(counts, ([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

async function listExclusions() {
  const { data, error } = await serviceDb
    .from('site_analytics_ip_exclusions')
    .select('id,ip_address,label,created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function addExclusion(ip: string, label: string, userId: string) {
  if (!ip) throw httpError('Could not determine a valid IP address.', 400);
  const { data, error } = await serviceDb
    .from('site_analytics_ip_exclusions')
    .upsert({ ip_address: ip, label: label || 'Excluded IP', created_by: userId }, { onConflict: 'ip_address' })
    .select('id,ip_address,label,created_at')
    .single();
  if (error) throw error;
  return { ok: true, exclusion: data };
}

async function isExcludedIp(ip: string) {
  const { data, error } = await serviceDb
    .from('site_analytics_ip_exclusions')
    .select('id')
    .eq('ip_address', ip)
    .limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

async function requireAdminUser(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) throw httpError('Not signed in.', 401);
  const authDb = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await authDb.auth.getUser();
  if (error || !user) throw httpError('Admin session is invalid.', 401);
  return user;
}

function requestIp(req: Request) {
  const raw = req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || '';
  return cleanIp(raw);
}

function cleanIp(value: unknown) {
  let ip = cleanText(value, 80).replace(/^\[|\]$/g, '');
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    return ip.split('.').every(part => Number(part) <= 255) ? ip : '';
  }
  return /^[0-9a-f:]+$/i.test(ip) && ip.includes(':') ? ip.toLowerCase() : '';
}

function cleanSessionId(value: unknown) {
  const id = cleanText(value, 80);
  return /^[a-zA-Z0-9_-]{12,80}$/.test(id) ? id : '';
}

function cleanPath(value: unknown) {
  const path = cleanText(value, 300);
  return path.startsWith('/') && !path.includes('..') ? path.split('?')[0].split('#')[0] : '';
}

function cleanUrl(value: unknown, max: number) {
  const text = cleanText(value, max);
  if (!text) return '';
  try {
    const url = new URL(text);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString().slice(0, max) : '';
  } catch {
    return '';
  }
}

function allowedEventName(value: unknown) {
  const event = cleanText(value, 60).toLowerCase();
  return ['page_view', 'book_visit_click', 'contact_click', 'testimonial_click', 'offer_click'].includes(event) ? event : 'page_view';
}

function allowedDevice(value: unknown) {
  const device = cleanText(value, 20).toLowerCase();
  return ['mobile', 'tablet', 'desktop'].includes(device) ? device : 'unknown';
}

function referrerLabel(value: unknown) {
  if (!value) return 'Direct';
  try {
    const host = new URL(String(value)).hostname.replace(/^www\./, '');
    return host || 'Direct';
  } catch {
    return 'Direct';
  }
}

function isLikelyBot(userAgent: string) {
  return /bot|crawl|spider|slurp|preview|lighthouse|headless|monitor/i.test(userAgent);
}

function uniqueCount(rows: Record<string, unknown>[], key: string) {
  return new Set(rows.map(row => String(row[key] || '')).filter(Boolean)).size;
}

function cleanText(value: unknown, max: number) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

function clampNumber(value: string | null, min: number, max: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}

async function readJson(req: Request) {
  try { return await req.json(); } catch { return {}; }
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name} secret.`);
  return value;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function httpError(message: string, status: number) {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}
