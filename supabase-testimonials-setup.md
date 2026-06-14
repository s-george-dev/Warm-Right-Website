# Customer Testimonial Submissions

This feature uses the `testimonial-submission` Supabase Edge Function.

## Database

Run the latest `supabase-site-management.sql` in Supabase SQL editor. It adds:

- `testimonial_submissions`
- `site_settings`
- the default `testimonial_team_email` setting set to `info@warmright.uk`

## Storage

The function uploads customer photos to the existing Supabase Storage bucket:

- `testimonial-images`

## Secrets

Set these Supabase secrets before deploying the function:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="..."
supabase secrets set SMTP_HOST="smtp.example.com"
supabase secrets set SMTP_PORT="465"
supabase secrets set SMTP_USER="..."
supabase secrets set SMTP_PASS="..."
supabase secrets set SMTP_FROM="Warm Right Ltd <info@warmright.uk>"
```

The team notification email can be edited in WarmHub:

`Account Settings -> Users and Permissions -> App settings -> Team testimonial email address`

## Deploy

```bash
supabase functions deploy testimonial-submission
supabase functions deploy trigger-email-outbox
```

## GitHub Email Outbox Sender

The workflow `.github/workflows/send-email-outbox.yml` sends queued rows from `email_outbox`.

Set these GitHub repository secrets:

```bash
SUPABASE_URL=https://axampuprcnauxbbijmmt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SMTP_HOST=smtp.livemail.co.uk
SMTP_PORT=465
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=no-reply@fieldhub.uk
SMTP_FROM_NAME=FieldHub Support
```

Set these Supabase secrets so WarmHub can trigger the GitHub Action:

```bash
supabase secrets set GITHUB_OWNER="s-george-dev"
supabase secrets set GITHUB_REPO="Warm-Right-Website"
supabase secrets set GITHUB_TOKEN="..."
supabase secrets set GITHUB_EMAIL_WORKFLOW="send-email-outbox.yml"
supabase secrets set GITHUB_BRANCH="master"
supabase secrets set SMTP_FROM="no-reply@fieldhub.uk"
supabase secrets set SMTP_FROM_NAME="FieldHub Support"
supabase secrets set SITE_BASE_URL="https://warmright.fieldhub.uk"
```

The GitHub token needs permission to run Actions workflows on this repository.

The testimonial submission function queues both:

- the admin approval notification
- a customer thank-you email

It then triggers the GitHub email sender workflow automatically. The admin page also has a manual `Send Queued Emails` button.
