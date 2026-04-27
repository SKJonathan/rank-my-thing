import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, Library as LibraryIcon, Plus, Play, Eye, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";
import RankerApp from "@/components/ranker/RankerApp";

type Item = { id: string; label: string };

interface ListRow {
  id: string;
  title: string;
  description: string | null;
  items: Item[];
  created_at: string;
}

interface ResultRow {
  id: string;
  list_id: string;
  short_code: string;
  ranked_items: string[];
  created_at: string;
}

interface SessionRow {
  list_id: string;
  completed: boolean;
  updated_at: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lists, setLists] = useState<ListRow[]>([]);
  const [latestResult, setLatestResult] = useState<ResultRow | null>(null);
  const [resumable, setResumable] = useState<SessionRow | null>(null);

  useEffect(() => {
    (async () => {
      const sid = getSessionId();
      const [{ data: listData }, { data: resultData }, { data: sessionData }] = await Promise.all([
        supabase
          .from("lists")
          .select("id, title, description, items, created_at")
          .eq("owner_session_id", sid)
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("results")
          .select("id, list_id, short_code, ranked_items, created_at")
          .eq("session_id", sid)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("ranking_sessions")
          .select("list_id, completed, updated_at")
          .eq("session_id", sid)
          .eq("completed", false)
          .order("updated_at", { ascending: false })
          .limit(1),
      ]);
      setLists((listData ?? []) as any);
      setLatestResult(((resultData ?? [])[0] as any) ?? null);
      setResumable(((sessionData ?? [])[0] as any) ?? null);
      setLoading(false);
    })();
  }, []);

  const latestList = latestResult ? lists.find((l) => l.id === latestResult.list_id) : null;
  const resumableList = resumable ? lists.find((l) => l.id === resumable.list_id) : null;

  // Empty state — funnel straight into create
  if (!loading && lists.length === 0 && !latestResult) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-3xl px-6 py-12">
          <RankerApp />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-12">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-12"
          >
            {/* Hero */}
            <section className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Welcome back
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-balance md:text-5xl">
                Sort anything, settle everything.
              </h1>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={() => navigate("/new")}>
                  <Plus className="h-4 w-4" /> New list
                </Button>
                {resumable && resumableList && (
                  <Button variant="secondary" onClick={() => navigate("/new")}>
                    <Play className="h-4 w-4" /> Resume "{resumableList.title}"
                  </Button>
                )}
              </div>
            </section>

            {/* Latest ranking */}
            {latestResult && latestList && (
              <section className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Latest ranking
                  </h2>
                  <Link
                    to="/library"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    View all
                  </Link>
                </div>
                <Link
                  to={`/r/${latestResult.short_code}`}
                  className="block rounded-xl bg-surface p-6 shadow-soft transition-shadow ease-settle hover:shadow-lifted"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xl font-semibold text-balance">{latestList.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                        Ranked {new Date(latestResult.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </div>
                  <ol className="mt-4 space-y-1.5">
                    {latestResult.ranked_items.slice(0, 3).map((id, i) => {
                      const item = latestList.items.find((it) => it.id === id);
                      if (!item) return null;
                      const medals = ["🥇", "🥈", "🥉"];
                      return (
                        <li key={id} className="flex items-center gap-3 text-sm">
                          <span className="w-5 text-center">{medals[i]}</span>
                          <span className="font-medium">{item.label}</span>
                        </li>
                      );
                    })}
                    {latestResult.ranked_items.length > 3 && (
                      <li className="pl-8 text-xs text-muted-foreground">
                        +{latestResult.ranked_items.length - 3} more
                      </li>
                    )}
                  </ol>
                </Link>
              </section>
            )}

            {/* Recent datasets */}
            {lists.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Your datasets
                  </h2>
                  <Link
                    to="/library"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    View all
                  </Link>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {lists.slice(0, 4).map((list) => {
                    const isResumable = resumable?.list_id === list.id;
                    return (
                      <button
                        key={list.id}
                        onClick={() => navigate("/new")}
                        className="group flex flex-col rounded-xl bg-surface p-5 text-left shadow-soft transition-shadow ease-settle hover:shadow-lifted"
                      >
                        <h3 className="font-semibold text-balance line-clamp-2">{list.title}</h3>
                        {list.description && (
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2 text-pretty">
                            {list.description}
                          </p>
                        )}
                        <div className="mt-auto flex items-center justify-between pt-4 text-xs text-muted-foreground tabular-nums">
                          <span>{list.items.length} items</span>
                          {isResumable ? (
                            <span className="inline-flex items-center gap-1 text-primary">
                              <Play className="h-3 w-3" /> In progress
                            </span>
                          ) : (
                            <span>{new Date(list.created_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Got something new to rank?
              </p>
              <Button className="mt-3" onClick={() => navigate("/new")}>
                <Plus className="h-4 w-4" /> Create a new list
              </Button>
            </section>
          </motion.div>
        )}
      </main>
      <Footer />
    </div>
  );
};

function Header() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Trophy className="h-4 w-4" />
          </div>
          <span className="font-semibold tracking-tight">Ranker</span>
        </Link>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/library">
            <LibraryIcon className="h-4 w-4" /> My library
          </Link>
        </Button>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto max-w-3xl px-6 py-6 text-xs text-muted-foreground">
        Sort anything. Pairwise comparisons, settled.
      </div>
    </footer>
  );
}

export default Dashboard;
