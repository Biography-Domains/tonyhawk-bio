```sql
-- Neon / Postgres schema (serverless-friendly)
-- Notes for Drizzle ORM:
--  - Use uuid columns (Drizzle: uuid('id').defaultRandom().primaryKey())
--  - Use timestamptz for timestamps (Drizzle: timestamp('created_at', { withTimezone: true }))
--  - Keep indexes explicit (Drizzle: index/uniqueIndex helpers)

-- Enable UUID generation (pgcrypto is commonly available on Neon)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- TABLE: visitors
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS visitors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  name          text NOT NULL,
  subscribed_at timestamptz,

  -- standard timestamps
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Commonly queried fields
CREATE INDEX IF NOT EXISTS visitors_email_idx ON visitors (email);
CREATE INDEX IF NOT EXISTS visitors_subscribed_at_idx ON visitors (subscribed_at);

COMMENT ON TABLE visitors IS 'Drizzle: visitors table';
COMMENT ON COLUMN visitors.id IS 'Drizzle: uuid primary key, defaultRandom()';
COMMENT ON COLUMN visitors.email IS 'Drizzle: unique email';

-- ------------------------------------------------------------
-- TABLE: achievements
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS achievements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  year        integer NOT NULL,
  description text,
  category    text NOT NULL,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Common filters: year/category (and sometimes category+year)
CREATE INDEX IF NOT EXISTS achievements_year_idx ON achievements (year);
CREATE INDEX IF NOT EXISTS achievements_category_idx ON achievements (category);
CREATE INDEX IF NOT EXISTS achievements_category_year_idx ON achievements (category, year);

COMMENT ON TABLE achievements IS 'Drizzle: achievements table';

-- ------------------------------------------------------------
-- TABLE: gallery
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gallery (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url  text NOT NULL,
  caption    text,
  year       integer,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gallery_year_idx ON gallery (year);

COMMENT ON TABLE gallery IS 'Drizzle: gallery table';

-- ------------------------------------------------------------
-- TABLE: messages
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id uuid NOT NULL,
  subject    text NOT NULL,
  content    text NOT NULL,

  -- per requirements: created_at and updated_at; created_at also serves as message timestamp
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT messages_visitor_id_fkey
    FOREIGN KEY (visitor_id)
    REFERENCES visitors(id)
    ON DELETE CASCADE
);

-- Index foreign key for joins + common sorting by recency
CREATE INDEX IF NOT EXISTS messages_visitor_id_idx ON messages (visitor_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages (created_at);

COMMENT ON TABLE messages IS 'Drizzle: messages table; belongs_to visitors';

-- ------------------------------------------------------------
-- OPTIONAL: updated_at trigger (keeps updated_at current on UPDATE)
-- Neon-friendly, small and common.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_visitors_updated_at ON visitors;
CREATE TRIGGER trg_visitors_updated_at
BEFORE UPDATE ON visitors
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_achievements_updated_at ON achievements;
CREATE TRIGGER trg_achievements_updated_at
BEFORE UPDATE ON achievements
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_gallery_updated_at ON gallery;
CREATE TRIGGER trg_gallery_updated_at
BEFORE UPDATE ON gallery
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_messages_updated_at ON messages;
CREATE TRIGGER trg_messages_updated_at
BEFORE UPDATE ON messages
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- SEED DATA (sample)
-- Uses fixed UUIDs for deterministic inserts.
-- ------------------------------------------------------------

-- Visitors
INSERT INTO visitors (id, email, name, subscribed_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', 'Alice Johnson', now() - interval '30 days'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com',   'Bob Smith',     now() - interval '10 days'),
  ('33333333-3333-3333-3333-333333333333', 'cara@example.com',  'Cara Lee',      now() - interval '3 days')
ON CONFLICT (email) DO NOTHING;

-- Achievements
INSERT INTO achievements (id, title, year, description, category)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Launched Portfolio v1', 2023, 'First public release of the portfolio site.', 'Milestone'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Open Source Contributor', 2024, 'Contributed patches to multiple OSS projects.', 'Community'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Best Project Award', 2022, 'Received an award for an academic capstone project.', 'Award')
ON CONFLICT (id) DO NOTHING;

-- Gallery
INSERT INTO gallery (id, image_url, caption, year)
VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'https://example.com/images/gallery-1.jpg', 'Conference talk snapshot', 2024),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'https://example.com/images/gallery-2.jpg', 'Project demo day', 2023),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'https://example.com/images/gallery-3.jpg', 'Team hackathon photo', 2022)
ON CONFLICT (id) DO NOTHING;

-- Messages (belongs_to visitors)
INSERT INTO messages (id, visitor_id, subject, content, created_at)
VALUES
  ('99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', 'Hello', 'Loved your work—can we connect?', now() - interval '7 days'),
  ('88888888-8888-8888-8888-888888888888', '22222222-2222-2222-2222-222222222222', 'Question', 'What stack did you use for the gallery?', now() - interval '2 days'),
  ('77777777-7777-7777-7777-777777777777', '33333333-3333-3333-3333-333333333333', 'Opportunity', 'We have a role that might be a fit. Interested?', now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;
```