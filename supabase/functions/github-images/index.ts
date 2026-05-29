const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

const IMAGE_EXTENSIONS = new Set(['avif', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp']);

type GitHubFile = {
  name: string;
  path: string;
  sha: string;
  size: number;
  download_url: string | null;
  type: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    await requireAuthenticatedUser(req);

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'list';

    if (req.method === 'GET' && action === 'list') {
      return json({ files: await listImages() });
    }

    if (req.method === 'POST' && action === 'upload') {
      const body = await req.json();
      return json(await uploadImage(body));
    }

    if (req.method === 'DELETE' && action === 'delete') {
      const body = await req.json();
      return json(await deleteImage(body));
    }

    return json({ error: 'Unsupported action.' }, 400);
  } catch (err) {
    console.error(err);
    return json({ error: err.message || 'Unexpected error.' }, err.status || 500);
  }
});

async function requireAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw httpError('Missing Authorization header.', 401);

  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const anonKey = requiredEnv('SUPABASE_ANON_KEY');
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: authHeader,
      apikey: anonKey,
    },
  });

  if (!response.ok) throw httpError('Not signed in.', 401);
  return response.json();
}

async function listImages() {
  const files = await githubJson<GitHubFile[]>('GET', repoPath());
  return files
    .filter(file => file.type === 'file' && isImageName(file.name))
    .map(file => ({
      name: file.name,
      path: file.path,
      sha: file.sha,
      size: file.size,
      downloadUrl: file.download_url,
      webPath: file.path,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function uploadImage(body: { name?: string; contentBase64?: string; message?: string }) {
  const safeName = safeFileName(body.name || '');
  if (!safeName || !isImageName(safeName)) throw httpError('Upload must be an image file.', 400);
  if (!body.contentBase64) throw httpError('Missing image content.', 400);

  const path = `${imagesPath()}/${safeName}`;
  const existing = await getExistingFile(path);

  const result = await githubJson('PUT', path, {
    message: body.message || `Upload ${path}`,
    content: body.contentBase64,
    branch: branch(),
    ...(existing?.sha ? { sha: existing.sha } : {}),
  });

  return { ok: true, file: result.content };
}

async function deleteImage(body: { path?: string; sha?: string; message?: string }) {
  const path = cleanRepoPath(body.path || '');
  if (!path.startsWith(`${imagesPath()}/`) || !isImageName(path)) {
    throw httpError('Only assets/images image files can be deleted.', 400);
  }

  const sha = body.sha || (await getExistingFile(path))?.sha;
  if (!sha) throw httpError('Could not find file SHA for delete.', 404);

  await githubJson('DELETE', path, {
    message: body.message || `Delete ${path}`,
    sha,
    branch: branch(),
  });

  return { ok: true };
}

async function getExistingFile(path: string) {
  try {
    return await githubJson<GitHubFile>('GET', path);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

async function githubJson<T>(method: string, path: string, body?: unknown): Promise<T> {
  const owner = requiredEnv('GITHUB_OWNER');
  const repo = requiredEnv('GITHUB_REPO');
  const token = requiredEnv('GITHUB_TOKEN');
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/contents/${cleanRepoPath(path)}`);
  url.searchParams.set('ref', branch());

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw httpError(data.message || `GitHub API error (${response.status}).`, response.status);
  }
  return data;
}

function repoPath() {
  return imagesPath();
}

function imagesPath() {
  return cleanRepoPath(Deno.env.get('GITHUB_IMAGES_PATH') || 'assets/images');
}

function branch() {
  return Deno.env.get('GITHUB_BRANCH') || 'master';
}

function cleanRepoPath(path: string) {
  return path.replace(/^\/+/, '').replace(/\.\./g, '').replace(/\/+/g, '/');
}

function isImageName(name: string) {
  const extension = name.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTENSIONS.has(extension);
}

function safeFileName(name: string) {
  return name
    .split(/[\\/]/)
    .pop()!
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw httpError(`Missing ${name} secret.`, 500);
  return value;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function httpError(message: string, status: number) {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}
