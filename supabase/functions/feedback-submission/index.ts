import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (req.method !== 'POST') throw httpError('Unsupported method.', 405);

    const payload = normalizePayload(await req.json());
    const db = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'));

    const { data: inserted, error } = await db.from('feedback_surveys').insert(payload).select('id').single();
    if (error) throw error;

    const { data: settings } = await db
      .from('site_settings')
      .select('setting_value')
      .eq('setting_key', 'testimonial_team_email')
      .maybeSingle();

    await queueFeedbackEmail(db, settings?.setting_value || 'info@warmright.uk', inserted.id, payload);
    try {
      await triggerEmailOutbox();
    } catch (triggerErr) {
      console.error('Could not trigger email outbox workflow:', triggerErr);
    }

    return json({ ok: true, id: inserted.id });
  } catch (err) {
    console.error(err);
    return json({ error: err.message || 'Unexpected error.' }, err.status || 500);
  }
});

function normalizePayload(body: Record<string, unknown>) {
  const payload = {
    customer_name: cleanText(body.customer_name, 120),
    customer_email: cleanText(body.customer_email, 180),
    customer_phone: cleanText(body.customer_phone, 60),
    job_number: cleanText(body.job_number, 80),
    customer_address: cleanText(body.customer_address, 300),
    engineer_name: cleanText(body.engineer_name, 120),
    insurer_agent_name: cleanText(body.insurer_agent_name, 160),
    main_body_communication: rating(body.main_body_communication),
    main_body_experience: rating(body.main_body_experience),
    main_body_comments: cleanText(body.main_body_comments, 2000),
    engineer_communication: rating(body.engineer_communication),
    engineer_experience: rating(body.engineer_experience),
    engineer_comments: cleanText(body.engineer_comments, 2000),
    final_remarks: cleanText(body.final_remarks, 2000),
    wants_contact: Boolean(body.wants_contact),
    source: cleanText(body.source, 80) || 'direct',
  };

  if (!payload.customer_name) throw httpError('Name is required.', 400);
  if (!payload.customer_email || !payload.customer_email.includes('@')) throw httpError('A valid email address is required.', 400);
  if (!payload.customer_address) throw httpError('Address is required.', 400);
  if (!payload.engineer_name) throw httpError('Engineer name is required.', 400);
  if (!payload.insurer_agent_name) throw httpError('Insurer, letting agent or landlord name is required.', 400);
  if (!payload.main_body_comments) throw httpError('Main body comments are required.', 400);
  if (!payload.engineer_comments) throw httpError('Engineer comments are required.', 400);
  if (!payload.final_remarks) throw httpError('Final remarks are required.', 400);

  return payload;
}

async function queueFeedbackEmail(db: ReturnType<typeof createClient>, to: string, surveyId: string, payload: ReturnType<typeof normalizePayload>) {
  const fromAddress = emailAddressOnly(Deno.env.get('SMTP_FROM') || 'no-reply@fieldhub.uk');
  const from = `${Deno.env.get('SMTP_FROM_NAME') || 'FieldHub Support'} <${fromAddress}>`;
  const siteBaseUrl = (Deno.env.get('SITE_BASE_URL') || 'https://warmright.fieldhub.uk').replace(/\/$/, '');
  const adminUrl = `${siteBaseUrl}/admin/testimonials-admin.html`;
  const text = [
    'A new Warm Right feedback survey has been submitted.',
    '',
    `Name: ${payload.customer_name}`,
    `Email: ${payload.customer_email}`,
    `Phone: ${payload.customer_phone || 'Not provided'}`,
    `Job number: ${payload.job_number || 'Not provided'}`,
    `Address: ${payload.customer_address}`,
    `Engineer: ${payload.engineer_name}`,
    `Main body: ${payload.insurer_agent_name}`,
    `Main body communication: ${payload.main_body_communication}/5`,
    `Main body experience: ${payload.main_body_experience}/5`,
    `Engineer communication: ${payload.engineer_communication}/5`,
    `Engineer experience: ${payload.engineer_experience}/5`,
    `Wants contact: ${payload.wants_contact ? 'Yes' : 'No'}`,
    '',
    `Main body comments: ${payload.main_body_comments}`,
    '',
    `Engineer comments: ${payload.engineer_comments}`,
    '',
    `Final remarks: ${payload.final_remarks}`,
    '',
    `Admin: ${adminUrl}`,
  ].join('\n');

  const { error } = await db.from('email_outbox').insert({
    related_table: 'feedback_surveys',
    related_id: surveyId,
    from_email: from,
    to_email: to,
    subject: `New feedback survey: ${payload.customer_name}`,
    text_body: text,
    html_body: buildFeedbackHtml(payload, adminUrl),
    status: 'queued',
  });

  if (error) console.error('Could not queue feedback survey email:', error);
}

function buildFeedbackHtml(payload: ReturnType<typeof normalizePayload>, adminUrl: string) {
  const rows = [
    ['Customer', payload.customer_name],
    ['Email', payload.customer_email],
    ['Phone', payload.customer_phone || 'Not provided'],
    ['Job number', payload.job_number || 'Not provided'],
    ['Address', payload.customer_address],
    ['Engineer', payload.engineer_name],
    ['Insurer/Agent/Landlord', payload.insurer_agent_name],
    ['Main body communication', `${payload.main_body_communication}/5`],
    ['Main body experience', `${payload.main_body_experience}/5`],
    ['Engineer communication', `${payload.engineer_communication}/5`],
    ['Engineer experience', `${payload.engineer_experience}/5`],
    ['Customer service contact requested', payload.wants_contact ? 'Yes' : 'No'],
  ];

  return `<!doctype html>
<html><body style="margin:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#10233f;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;background:#fff;border-radius:14px;overflow:hidden;">
        <tr><td style="background:#123b75;color:#fff;padding:24px 28px;"><h1 style="margin:0;font-size:24px;">New feedback survey submitted</h1></td></tr>
        <tr><td style="padding:26px 28px;">
          ${rows.map(([label, value]) => `<p style="margin:0 0 10px;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`).join('')}
          ${commentBlock('Main body comments', payload.main_body_comments)}
          ${commentBlock('Engineer comments', payload.engineer_comments)}
          ${commentBlock('Final remarks', payload.final_remarks)}
          <p style="margin:24px 0 0;"><a href="${escapeAttr(adminUrl)}" style="display:inline-block;background:#123b75;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold;">Open WarmHub</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function commentBlock(label: string, value: string) {
  return `<div style="margin:18px 0;padding:14px;border-left:4px solid #ffb000;background:#f8fbff;"><strong>${escapeHtml(label)}</strong><p style="margin:8px 0 0;line-height:1.6;">${escapeHtml(value)}</p></div>`;
}

async function triggerEmailOutbox() {
  const owner = Deno.env.get('GITHUB_OWNER');
  const repo = Deno.env.get('GITHUB_REPO');
  const token = Deno.env.get('GITHUB_TOKEN');
  if (!owner || !repo || !token) return;

  const workflow = Deno.env.get('GITHUB_EMAIL_WORKFLOW') || 'send-email-outbox.yml';
  const ref = Deno.env.get('GITHUB_BRANCH') || 'master';
  await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref }),
  });
}

function rating(value: unknown) {
  return Math.max(1, Math.min(5, Number(value) || 3));
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function emailAddressOnly(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] || value).trim();
}

function escapeHtml(value: unknown) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] || char));
}

function escapeAttr(value: unknown) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw httpError(`${name} is not configured.`, 500);
  return value;
}

function httpError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
