# GitHub Image Manager Setup

The WarmHub Website File Explorer uses a Supabase Edge Function so the GitHub token stays server-side.

## 1. Create a GitHub token

Create a fine-grained GitHub personal access token with access only to:

- Repository: `s-george-dev/Warm-Right-Website`
- Permission: `Contents: Read and write`

Do not put this token in any HTML or JavaScript file.

## 2. Add Supabase secrets

In the Supabase project, add these Edge Function secrets:

```bash
supabase link --project-ref axampuprcnauxbbijmmt
supabase secrets set GITHUB_TOKEN="github_pat_..."
supabase secrets set GITHUB_OWNER="s-george-dev"
supabase secrets set GITHUB_REPO="Warm-Right-Website"
supabase secrets set GITHUB_BRANCH="master"
supabase secrets set GITHUB_IMAGES_PATH="assets/images"
```

## 3. Deploy the function

```bash
supabase functions deploy github-images
```

After deployment, WarmHub can list, upload, and delete files in `assets/images`. Each upload/delete creates a GitHub commit, so GitHub Pages may take a short while to show the change.

If `supabase link` says the account does not have the necessary privileges, run these commands from a Supabase owner/admin account for the `axampuprcnauxbbijmmt` project.
