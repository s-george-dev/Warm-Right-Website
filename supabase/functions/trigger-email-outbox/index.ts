const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') throw httpError('Unsupported method.', 405);
    await requireAuthenticatedUser(req);

    const owner = requiredEnv('GITHUB_OWNER');
    const repo = requiredEnv('GITHUB_REPO');
    const token = requiredEnv('GITHUB_TOKEN');
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
      throw httpError(`GitHub workflow dispatch failed (${response.status}): ${detail}`, response.status);
    }

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: err.message || 'Unexpected error.' }, err.status || 500);
  }
});

async function requireAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw httpError('Missing Authorization header.', 401);

  const response = await fetch(`${requiredEnv('SUPABASE_URL')}/auth/v1/user`, {
    headers: {
      Authorization: authHeader,
      apikey: requiredEnv('SUPABASE_ANON_KEY'),
    },
  });

  if (!response.ok) throw httpError('Not signed in.', 401);
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
