import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type SubmittedImage = {
  name: string;
  type: string;
  base64: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') throw httpError('Unsupported method.', 405);

    const body = await req.json();
    const payload = normalizePayload(body);
    const db = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'));
    const imageUrls = await uploadImages(db, payload.images);

    const { data: settings } = await db
      .from('site_settings')
      .select('setting_value')
      .eq('setting_key', 'testimonial_team_email')
      .maybeSingle();

    const teamEmail = settings?.setting_value || 'info@warmright.uk';
    const { data: submission, error } = await db.from('testimonial_submissions').insert({
      customer_name: payload.customer_name,
      customer_email: payload.customer_email,
      customer_phone: payload.customer_phone,
      job_number: payload.job_number,
      customer_address: payload.customer_address,
      rating: payload.rating,
      subject: payload.subject,
      content: payload.content,
      image_urls: imageUrls,
      status: 'pending',
    }).select('id').single();

    if (error) throw error;

    await queueTeamEmail(db, teamEmail, submission.id, payload, imageUrls);
    await queueCustomerThankYouEmail(db, submission.id, payload);
    try {
      await triggerEmailOutbox();
    } catch (triggerErr) {
      console.error('Could not trigger email outbox workflow:', triggerErr);
    }

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: err.message || 'Unexpected error.' }, err.status || 500);
  }
});

function normalizePayload(body: Record<string, unknown>) {
  const customer_name = cleanText(body.customer_name, 120);
  const customer_email = cleanText(body.customer_email, 180);
  const customer_phone = cleanText(body.customer_phone, 60);
  const job_number = cleanText(body.job_number, 80);
  const customer_address = cleanText(body.customer_address, 300);
  const subject = cleanText(body.subject, 120);
  const content = cleanText(body.content, 1800);
  const rating = Math.max(1, Math.min(5, Number(body.rating) || 5));
  const images = Array.isArray(body.images) ? body.images.slice(0, 6) as SubmittedImage[] : [];

  if (!customer_name) throw httpError('Customer name is required.', 400);
  if (!customer_email || !customer_email.includes('@')) throw httpError('A valid email is required.', 400);
  if (!subject) throw httpError('Short title is required.', 400);
  if (!content) throw httpError('Testimonial content is required.', 400);

  return { customer_name, customer_email, customer_phone, job_number, customer_address, subject, content, rating, images };
}

async function uploadImages(db: ReturnType<typeof createClient>, images: SubmittedImage[]) {
  const urls: string[] = [];

  for (const image of images) {
    if (!image.base64 || !image.type?.startsWith('image/')) continue;
    if (image.base64.length > 1_800_000) {
      throw httpError('One of the uploaded photos is too large. Please choose a smaller image.', 413);
    }
    const extension = extensionFromName(image.name, image.type);
    const fileName = `pending/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const bytes = Uint8Array.from(atob(image.base64), (char) => char.charCodeAt(0));

    const { error } = await db.storage
      .from('testimonial-images')
      .upload(fileName, bytes, { contentType: image.type, upsert: false });

    if (error) throw error;
    const { data } = db.storage.from('testimonial-images').getPublicUrl(fileName);
    urls.push(data.publicUrl);
  }

  return urls;
}

async function queueTeamEmail(
  db: ReturnType<typeof createClient>,
  to: string,
  submissionId: string,
  payload: ReturnType<typeof normalizePayload>,
  imageUrls: string[],
) {
  const fromAddress = emailAddressOnly(Deno.env.get('SMTP_FROM') || 'no-reply@fieldhub.uk');
  const from = `${Deno.env.get('SMTP_FROM_NAME') || 'FieldHub Support'} <${fromAddress}>`;
  const imageList = imageUrls.length ? imageUrls.map((url) => `- ${url}`).join('\n') : 'No photos uploaded.';
  const siteBaseUrl = (Deno.env.get('SITE_BASE_URL') || 'https://warmright.fieldhub.uk').replace(/\/$/, '');
  const adminUrl = `${siteBaseUrl}/admin/testimonials-admin.html`;
  const logoUrl = `${siteBaseUrl}/assets/images/logo.png`;
  const plainText = [
    `A new customer testimonial is waiting for admin approval.`,
    ``,
    `This testimonial is not live on the website yet.`,
    ``,
    `Name: ${payload.customer_name}`,
    `Email: ${payload.customer_email}`,
    `Phone: ${payload.customer_phone || 'Not provided'}`,
    `Job number: ${payload.job_number || 'Not provided'}`,
    `Address: ${payload.customer_address || 'Not provided'}`,
    `Rating: ${payload.rating}/5`,
    `Subject: ${payload.subject || 'Not provided'}`,
    ``,
    payload.content,
    ``,
    `Photos:`,
    imageList,
    ``,
    `Review and approve it here: ${adminUrl}`,
  ].join('\n');

  const { error } = await db.from('email_outbox').insert({
    related_table: 'testimonial_submissions',
    related_id: submissionId,
    from_email: from,
    to_email: to,
    subject: `New testimonial pending: ${payload.customer_name}`,
    text_body: plainText,
    html_body: buildTestimonialEmailHtml({ payload, imageUrls, adminUrl, logoUrl }),
    status: 'queued',
  });

  if (error) console.error('Could not queue testimonial email:', error);
}

async function queueCustomerThankYouEmail(
  db: ReturnType<typeof createClient>,
  submissionId: string,
  payload: ReturnType<typeof normalizePayload>,
) {
  const fromAddress = emailAddressOnly(Deno.env.get('SMTP_FROM') || 'no-reply@fieldhub.uk');
  const from = `${Deno.env.get('SMTP_FROM_NAME') || 'FieldHub Support'} <${fromAddress}>`;
  const siteBaseUrl = (Deno.env.get('SITE_BASE_URL') || 'https://warmright.fieldhub.uk').replace(/\/$/, '');
  const logoUrl = `${siteBaseUrl}/assets/images/logo.png`;
  const text = [
    `Thank you for your feedback.`,
    ``,
    `If you want to talk to us call 0800 756 6758 or email info@warmright.uk`,
  ].join('\n');

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#10233f;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:#123b75;padding:22px 26px;">
                <img src="${escapeAttr(logoUrl)}" alt="Warm Right Ltd" style="max-width:170px;height:auto;display:block;background:#ffffff;border-radius:8px;padding:8px;">
              </td>
            </tr>
            <tr>
              <td style="padding:30px;">
                <h1 style="margin:0 0 12px;color:#062940;font-size:26px;line-height:1.2;">Thank you for your feedback</h1>
                <p style="margin:0;color:#475569;font-size:16px;line-height:1.7;">
                  If you want to talk to us call <strong>0800 756 6758</strong> or email
                  <a href="mailto:info@warmright.uk" style="color:#123b75;font-weight:700;">info@warmright.uk</a>.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const { error } = await db.from('email_outbox').insert({
    related_table: 'testimonial_submissions',
    related_id: submissionId,
    from_email: from,
    to_email: payload.customer_email,
    subject: 'Thank you for your feedback',
    text_body: text,
    html_body: html,
    status: 'queued',
  });

  if (error) console.error('Could not queue customer thank you email:', error);
}

async function triggerEmailOutbox() {
  const owner = Deno.env.get('GITHUB_OWNER');
  const repo = Deno.env.get('GITHUB_REPO');
  const token = Deno.env.get('GITHUB_TOKEN');
  if (!owner || !repo || !token) {
    console.warn('GitHub workflow secrets are not configured; email remains queued.');
    return;
  }

  const workflow = Deno.env.get('GITHUB_EMAIL_WORKFLOW') || 'send-email-outbox.yml';
  const ref = Deno.env.get('GITHUB_BRANCH') || 'master';
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    console.error(`GitHub workflow dispatch failed (${response.status}): ${detail}`);
  }
}

function emailAddressOnly(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] || value).trim();
}

function buildTestimonialEmailHtml(options: {
  payload: ReturnType<typeof normalizePayload>;
  imageUrls: string[];
  adminUrl: string;
  logoUrl: string;
}) {
  const { payload, imageUrls, adminUrl, logoUrl } = options;
  const photosHtml = imageUrls.length
    ? imageUrls.map((url) => `
      <a href="${escapeAttr(url)}" style="display:inline-block;margin:0 10px 10px 0;text-decoration:none;">
        <img src="${escapeAttr(url)}" alt="Customer uploaded photo" style="width:130px;height:100px;object-fit:cover;border-radius:8px;border:1px solid #dbe4ef;">
      </a>
    `).join('')
    : '<p style="margin:0;color:#64748b;">No photos were uploaded with this testimonial.</p>';

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#10233f;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:#123b75;padding:22px 26px;">
                <img src="${escapeAttr(logoUrl)}" alt="Warm Right Ltd" style="max-width:170px;height:auto;display:block;background:#ffffff;border-radius:8px;padding:8px;">
              </td>
            </tr>
            <tr>
              <td style="padding:28px 30px 12px;">
                <p style="display:inline-block;margin:0 0 14px;padding:7px 12px;border-radius:999px;background:#fff7ed;color:#c2410c;font-weight:700;font-size:13px;">
                  Awaiting admin approval
                </p>
                <h1 style="margin:0 0 10px;color:#062940;font-size:26px;line-height:1.2;">New testimonial submitted</h1>
                <p style="margin:0;color:#475569;font-size:16px;line-height:1.6;">
                  A customer has sent a testimonial. It has been saved in WarmHub under Pending Authorisation and is <strong>not live on the website yet</strong>.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 30px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
                  ${detailRow('Customer', payload.customer_name)}
                  ${detailRow('Email', payload.customer_email)}
                  ${detailRow('Phone', payload.customer_phone || 'Not provided')}
                  ${detailRow('Job number', payload.job_number || 'Not provided')}
                  ${detailRow('Address', payload.customer_address || 'Not provided')}
                  ${detailRow('Rating', `${payload.rating}/5`)}
                  ${detailRow('Subject', payload.subject || 'Not provided')}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 30px 0;">
                <h2 style="margin:0 0 10px;color:#062940;font-size:18px;">Testimonial</h2>
                <div style="background:#ffffff;border-left:4px solid #2a7886;padding:14px 16px;color:#10233f;font-size:16px;line-height:1.7;">
                  ${escapeHtml(payload.content).replace(/\n/g, '<br>')}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 30px 0;">
                <h2 style="margin:0 0 12px;color:#062940;font-size:18px;">Photos</h2>
                ${photosHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:26px 30px 32px;">
                <a href="${escapeAttr(adminUrl)}" style="display:inline-block;background:#123b75;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;padding:13px 18px;">
                  Review in WarmHub
                </a>
                <p style="margin:16px 0 0;color:#64748b;font-size:13px;">Approve it from Manage Testimonials before it appears publicly.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function detailRow(label: string, value: string) {
  return `<tr>
    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;width:130px;">${escapeHtml(label)}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#10233f;font-size:14px;font-weight:700;">${escapeHtml(value)}</td>
  </tr>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value: string) {
  return escapeHtml(value);
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || '').trim().slice(0, maxLength);
}

function extensionFromName(name: string, type: string) {
  const existing = name.split('.').pop()?.toLowerCase();
  if (existing && /^[a-z0-9]+$/.test(existing)) return existing;
  return type.split('/').pop()?.replace('jpeg', 'jpg') || 'jpg';
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw httpError(`Missing ${name} secret.`, 500);
  return value;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function httpError(message: string, status: number) {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}
