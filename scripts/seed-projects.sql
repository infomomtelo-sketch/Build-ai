-- JARVIS — seed the registry with real builds.
--
--   npx wrangler d1 execute jarvis --remote --file scripts/seed-projects.sql
--   npx wrangler d1 execute jarvis --local  --file scripts/seed-projects.sql
--
-- Idempotent: fixed ids + INSERT OR IGNORE, so re-running changes nothing and
-- never overwrites edits made through the UI.
--
-- Every value below was read out of the repository itself — canonical URLs from
-- the <link rel="canonical"> tags, stacks from .env.example, migrations/ and
-- _redirects. Nothing here is invented.
--
-- Two fields are deliberately left for you:
--   * health starts at 'idle', meaning "no health signal yet" rather than
--     asserting these are healthy. Phase 4 computes it; until then set it in
--     the UI.
--   * no metrics rows are seeded. MRR and user counts are yours to enter —
--     guessing them would put fiction on the wall.

INSERT OR IGNORE INTO projects
  (id, name, slug, domain, stack, repo_full_name, health, status, notes)
VALUES
  (
    'c9acce09-9555-4eb5-a1a1-adff692d622a',
    'The Judgy',
    'the-judgy',
    'thejudgy.com',
    'Static HTML · Cloudflare Pages · Stripe',
    'infomomtelo-sketch/thejudgyjudge',
    'idle',
    'active',
    'The advice your friends won''t give you. Blog at blog.thejudgy.com; courtroom experience on judgygpt-courtroom.pages.dev.'
  ),
  (
    'bb1ee5c8-a25c-4f69-b7f6-2630ac66300f',
    'Title22',
    'title22',
    'title22.app',
    'Static HTML · Supabase · Cloudflare Workers · Stripe · Anthropic',
    'infomomtelo-sketch/runp8-care',
    'idle',
    'active',
    'RCFE compliance app. Supabase-backed with SQL migrations, AI extract workers, and Stripe payment tiers. Redirects marketing paths to title-22.com.'
  ),
  (
    '8484ce1a-6d0c-4b26-9726-0794d5afc9bd',
    'Title22 Site',
    'title22-site',
    'title-22.com',
    'Static HTML · Cloudflare Pages Functions · Anthropic',
    'infomomtelo-sketch/title-22-site',
    'idle',
    'active',
    'Marketing site for the Title22 app — audit-ready RCFE compliance software. Pages Functions under functions/api call Anthropic. Separate property from the title22.app product.'
  ),
  (
    'a6cdeb03-da16-4cf5-b1e0-566daec97060',
    'PostPilot',
    'postpilot',
    'postpilot.xyz',
    'Static HTML · Supabase',
    'infomomtelo-sketch/postpilots-xyz',
    'idle',
    'active',
    'AI social media post generator. Domain taken from the owner, not from the repo — the markup carries no canonical tag.'
  ),
  (
    'e8f40d99-7a5c-4a9d-8693-8faa981ca305',
    'Renty',
    'renty',
    'rentyapp.net',
    'React · Vite · Supabase · Stripe · pdf-lib',
    'infomomtelo-sketch/renty',
    'idle',
    'active',
    'Free online lease agreement generator for landlords. Generates PDFs client-side via pdf-lib. Canonical resolves to rentyapp.net, not renty.*'
  ),
  (
    '2b7698aa-6ab2-496a-a27d-89234729070c',
    'RunP8',
    'runp8',
    NULL,
    'Static HTML · Cloudflare Workers · Formspree',
    'infomomtelo-sketch/runp8',
    'idle',
    'active',
    'Rental management flow — apply, showings, owner and chat pages. No canonical tag and no custom domain in the repo; it calls a workers.dev endpoint directly. Domain left blank deliberately.'
  ),
  (
    'a7e55380-ec91-4f50-8e13-def90728ca67',
    'Cali Cert Buddy',
    'cali-cert-buddy',
    NULL,
    'TanStack Start · React · Supabase · Lovable Cloud',
    'infomomtelo-sketch/cali-cert-buddy',
    'idle',
    'active',
    'Private repo. Supabase with migrations under supabase/. No canonical tag and no domain in the repo, so the domain is left blank.'
  );

-- Registry additions show up on the wall's event log like any other change.
INSERT INTO events (project_id, kind, severity, message, actor)
SELECT id, 'project_created', 'info', name || ' added to the registry', 'seed'
  FROM projects
 WHERE id IN (
   'c9acce09-9555-4eb5-a1a1-adff692d622a',
   'bb1ee5c8-a25c-4f69-b7f6-2630ac66300f',
   '8484ce1a-6d0c-4b26-9726-0794d5afc9bd',
   'a6cdeb03-da16-4cf5-b1e0-566daec97060',
   'e8f40d99-7a5c-4a9d-8693-8faa981ca305',
   '2b7698aa-6ab2-496a-a27d-89234729070c',
   'a7e55380-ec91-4f50-8e13-def90728ca67'
 )
   AND NOT EXISTS (
     SELECT 1 FROM events e
      WHERE e.project_id = projects.id AND e.kind = 'project_created'
   );
