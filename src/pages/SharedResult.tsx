import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Trophy, Loader2 } from "lucide-react";
import RankerApp from "@/components/ranker/RankerApp";
import { supabase } from "@/integrations/supabase/client";

export default function SharedResult() {
  const { code } = useParams<{ code: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    (async () => {
      const { data: result, error } = await supabase
        .from("results")
        .select("id, short_code, ranked_items, list_id, lists(id, title, description, items, artists)")
        .eq("short_code", code)
        .maybeSingle();
      if (error || !result || !result.lists) {
        setErr("Ranking not found.");
        setLoading(false);
        return;
      }
      setData(result);
      setLoading(false);
    })();
  }, [code]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-6 py-5">
          <a href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Trophy className="h-4 w-4" />
            </div>
            <span className="font-semibold tracking-tight">Ranker</span>
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        {loading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        {err && <p className="text-center text-muted-foreground">{err}</p>}
        {data && (
          <RankerApp
            initial={{
              listId: data.list_id,
              items: data.lists.items,
              title: data.lists.title,
              description: data.lists.description ?? "",
              artists: data.lists.artists ?? [],
              step: "results",
              initialOrder: data.ranked_items,
              readOnly: true,
              shortCode: data.short_code,
            }}
          />
        )}
      </main>
    </div>
  );
}
