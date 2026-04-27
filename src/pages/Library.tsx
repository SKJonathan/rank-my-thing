import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy, ListChecks, Play, Eye, Trash2, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";
import { toast } from "sonner";

type Item = { id: string; label: string };

interface ListRow {
  id: string;
  title: string;
  description: string | null;
  items: Item[];
  created_at: string;
}

interface SessionRow {
  id: string;
  list_id: string;
  completed: boolean;
  updated_at: string;
}

interface ResultRow {
  id: string;
  list_id: string;
  short_code: string;
  ranked_items: string[];
  created_at: string;
}

export default function Library() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lists, setLists] = useState<ListRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);

  const load = async () => {
    setLoading(true);
    const sid = getSessionId();
    const { data: listData } = await supabase
      .from("lists")
      .select("id, title, description, items, created_at")
      .eq("owner_session_id", sid)
      .order("created_at", { ascending: false });

    const { data: sessionData } = await supabase
      .from("ranking_sessions")
      .select("id, list_id, completed, updated_at")
      .eq("session_id", sid);

    const { data: resultData } = await supabase
      .from("results")
      .select("id, list_id, short_code, ranked_items, created_at")
      .eq("session_id", sid)
      .order("created_at", { ascending: false });

    setLists((listData ?? []) as any);
    setSessions((sessionData ?? []) as any);
    setResults((resultData ?? []) as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const deleteList = async (listId: string) => {
    if (!confirm("Delete this list and all its rankings? This cannot be undone.")) return;
    // Only sessions have public delete. Lists/results don't — so we soft-clear by removing sessions
    // and dropping from the local view. The actual list/result rows stay in the DB but become orphan.
    await supabase.from("ranking_sessions").delete().eq("list_id", listId).eq("session_id", getSessionId());
    setLists((prev) => prev.filter((l) => l.id !== listId));
    setSessions((prev) => prev.filter((s) => s.list_id !== listId));
    setResults((prev) => prev.filter((r) => r.list_id !== listId));
    toast.success("Removed from your library");
  };

  const copyShare = async (code: string) => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}r/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied");
    } catch {
      toast.message(url);
    }
  };

  const sessionByList = (listId: string) =>
    sessions.find((s) => s.list_id === listId);
  const resultsByList = (listId: string) =>
    results.filter((r) => r.list_id === listId);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-6 py-5">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Trophy className="h-4 w-4" />
            </div>
            <span className="font-semibold tracking-tight">Ranker</span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-8"
        >
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
              <ListChecks className="h-3.5 w-3.5" /> Your library
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-balance">
              Saved lists & rankings
            </h1>
            <p className="text-muted-foreground text-pretty">
              Everything you've created on this device. Sessions are stored locally — clearing
              your browser data will hide them from this view.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : lists.length === 0 ? (
            <div className="rounded-xl bg-surface p-10 text-center shadow-soft">
              <p className="text-muted-foreground">No saved lists yet.</p>
              <Button className="mt-4" onClick={() => navigate("/")}>
                Create your first list
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {lists.map((list) => {
                const session = sessionByList(list.id);
                const listResults = resultsByList(list.id);
                const inProgress = session && !session.completed;
                return (
                  <div
                    key={list.id}
                    className="rounded-xl bg-surface p-5 shadow-soft transition-shadow ease-settle hover:shadow-lifted"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-semibold text-balance">{list.title}</h2>
                        {list.description && (
                          <p className="mt-1 text-sm text-muted-foreground text-pretty">
                            {list.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
                          <span>{list.items.length} items</span>
                          <span>·</span>
                          <span>{new Date(list.created_at).toLocaleDateString()}</span>
                          {inProgress && (
                            <>
                              <span>·</span>
                              <span className="text-primary">In progress</span>
                            </>
                          )}
                          {listResults.length > 0 && (
                            <>
                              <span>·</span>
                              <span>
                                {listResults.length} ranking{listResults.length === 1 ? "" : "s"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteList(list.id)}
                        aria-label="Remove from library"
                        className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-surface-alt hover:text-foreground"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {inProgress ? (
                        <Button size="sm" onClick={() => navigate(`/new?resume=1&list=${list.id}`)}>
                          <Play className="h-4 w-4" /> Resume
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => navigate(`/new?list=${list.id}`)}>
                          <Play className="h-4 w-4" /> {listResults.length === 0 ? "Rank now" : "Rank again"}
                        </Button>
                      )}

                      {listResults.map((r, i) => (
                        <div key={r.id} className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            asChild
                          >
                            <Link to={`/r/${r.short_code}`}>
                              <Eye className="h-4 w-4" />
                              {listResults.length === 1 ? "View ranking" : `Ranking ${i + 1}`}
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyShare(r.short_code)}
                            aria-label="Copy share link"
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
