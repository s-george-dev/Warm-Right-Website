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
```
