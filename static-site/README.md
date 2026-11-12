# CoreAML website

Static HTML, CSS and JavaScript based on Bex-Labs/coreaml_home at commit `d18bbbb`.
Open `site/index.html` with VS Code Live Server to preview the frontend.

## Demo requests

The Cloudflare Worker forwards same-origin `POST /api/demo` requests to
Supabase. Supabase stores the request, then sends its details through Resend
to `bexinnovation@outlook.com`. Replies go to the applicant's email address.
The visitor receives a reference after the email provider accepts the message.
If delivery is temporarily unavailable, the browser lets the visitor retry
the same request. The database retains the booking and tracks acceptance by
the email provider separately from inbox delivery.

## Deploy

1. Choose the intended Supabase project. Apply `supabase/setup.sql` once
   through its SQL Editor. This creates the CoreAML request table and a
   server-only RPC. Review the project's Data API settings if the API does
   not expose the public schema to the service role.
2. In Resend, verify a sender domain and create a sending API key. In Supabase
   Edge Function Secrets, add `RESEND_API_KEY`, `COREAML_DEMO_FROM` (for
   example, `CoreAML <demo@your-verified-domain.example>`), and
   `COREAML_DEMO_RELAY_SECRET` (a new high-entropy random value).
3. From the project folder, deploy using an authenticated Supabase CLI:
   `supabase functions deploy coreaml-demo --project-ref YOUR_PROJECT_REF`.
   The function authenticates the Cloudflare relay with the shared secret.
4. From the same folder, configure Cloudflare with
   `npx wrangler@4.92.0 secret put COREAML_DEMO_RELAY_SECRET` using the same
   relay secret. Configure `COREAML_DEMO_FUNCTION_URL` with
   `npx wrangler@4.92.0 secret put COREAML_DEMO_FUNCTION_URL`. Its value is
   `https://YOUR_PROJECT_REF.supabase.co/functions/v1/coreaml-demo`.
   Then run `npx wrangler@4.92.0 deploy`.
5. Submit a clearly labeled test via the deployed homepage, check for the
   booking in Supabase and verify receipt in Outlook. A stored row with an
   empty `email_accepted_at` means the application has yet to record provider
   acceptance.

The original frontend and privacy page are included. The privacy page now
mentions that requests also go to the team's email inbox. If replacing an
existing D1 deployment, its historical enquiries stay in D1.
