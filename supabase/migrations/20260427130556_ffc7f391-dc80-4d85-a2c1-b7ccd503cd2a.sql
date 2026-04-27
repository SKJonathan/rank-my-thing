
-- Lists store the items to be ranked (originals + clones share via parent_list_id)
CREATE TABLE public.lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_list_id UUID REFERENCES public.lists(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  items JSONB NOT NULL,
  owner_session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lists_parent ON public.lists(parent_list_id);

-- Sessions track in-progress comparisons
CREATE TABLE public.ranking_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  state JSONB NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_list ON public.ranking_sessions(list_id);

-- Results store completed rankings, sharable via short_code
CREATE TABLE public.results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  ranked_items JSONB NOT NULL,
  ranker_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_results_list ON public.results(list_id);
CREATE INDEX idx_results_short ON public.results(short_code);

-- Enable RLS
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

-- Public app, no auth — anyone can read/write. Sessions are identified client-side via random IDs.
CREATE POLICY "lists_public_read" ON public.lists FOR SELECT USING (true);
CREATE POLICY "lists_public_insert" ON public.lists FOR INSERT WITH CHECK (true);
CREATE POLICY "lists_public_update" ON public.lists FOR UPDATE USING (true);

CREATE POLICY "sessions_public_read" ON public.ranking_sessions FOR SELECT USING (true);
CREATE POLICY "sessions_public_insert" ON public.ranking_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "sessions_public_update" ON public.ranking_sessions FOR UPDATE USING (true);
CREATE POLICY "sessions_public_delete" ON public.ranking_sessions FOR DELETE USING (true);

CREATE POLICY "results_public_read" ON public.results FOR SELECT USING (true);
CREATE POLICY "results_public_insert" ON public.results FOR INSERT WITH CHECK (true);
CREATE POLICY "results_public_update" ON public.results FOR UPDATE USING (true);
