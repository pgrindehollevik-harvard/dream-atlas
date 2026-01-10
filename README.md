## Dream Atlas – Midjourney-powered dream journal

Dream Atlas lets people log their dreams as Midjourney images + text over time, keep entries private or public, and get AI-assisted summaries of single dreams and whole periods.

### Stack
- **Frontend**: Next.js App Router (TypeScript, Tailwind)
- **Auth & DB**: Supabase (Postgres, RLS, Auth, Storage)
- **AI**: OpenAI-compatible API (configured via `OPENAI_API_KEY` / `OPENAI_BASE_URL`)

### Local setup
1. Create a Supabase project.
2. In Supabase SQL editor, run `supabase/migrations/0001_init.sql`.
3. Create a public storage bucket named `dream-images` and enable public access.
4. Copy env values into `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
OPENAI_API_KEY="sk-..."
OPENAI_BASE_URL="https://api.openai.com/v1"
```

5. Install and run:

```bash
npm install
npm run dev
```

Then visit `http://localhost:3000`.


