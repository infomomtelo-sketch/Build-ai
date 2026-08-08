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
  );

-- Registry additions show up on the wall's event log like any other change.
INSERT INTO events (project_id, kind, severity, message, actor)
SELECT id, 'project_created', 'info', name || ' added to the registry', 'seed'
  FROM projects
 WHERE id IN (
   'c9acce09-9555-4eb5-a1a1-adff692d622a',
   'bb1ee5c8-a25c-4f69-b7f6-2630ac66300f'
 )
   AND NOT EXISTS (
     SELECT 1 FROM events e
      WHERE e.project_id = projects.id AND e.kind = 'project_created'
   );
