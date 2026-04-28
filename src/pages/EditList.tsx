import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Trophy, X, Upload, ListPlus, AlertCircle, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";

type Item = { id: string; label: string };

function dedupeAndClean(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const t = r.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export default function EditList() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [originalItemIds, setOriginalItemIds] = useState<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [bulk, setBulk] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [artists, setArtists] = useState<string[]>([]);
  const [artistInput, setArtistInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const sid = getSessionId();
      const { data } = await supabase
        .from("lists")
        .select("id, title, description, items, artists, owner_session_id")
        .eq("id", id)
        .maybeSingle();
      if (!data) {
        toast.error("List not found.");
        navigate("/library", { replace: true });
        return;
      }
      if (data.owner_session_id !== sid) {
        toast.error("You can only edit lists you created on this device.");
        navigate("/library", { replace: true });
        return;
      }
      setTitle(data.title);
      setDescription(data.description ?? "");
      setArtists(((data as any).artists as string[]) ?? []);
      const its = (data.items as Item[]) ?? [];
      setItems(its);
      setOriginalItemIds(new Set(its.map((i) => i.id)));
      setLoading(false);
    })();
  }, [id, navigate]);

  const addItems = (labels: string[]) => {
    setItems((prev) => {
      const existing = new Set(prev.map((p) => p.label.toLowerCase()));
      const fresh = dedupeAndClean(labels).filter((l) => !existing.has(l.toLowerCase()));
      return [...prev, ...fresh.map((l) => ({ id: crypto.randomUUID(), label: l }))];
    });
  };

  const addArtists = (labels: string[]) => {
    setArtists((prev) => {
      const existing = new Set(prev.map((p) => p.toLowerCase()));
      const fresh = dedupeAndClean(labels).filter((l) => !existing.has(l.toLowerCase()));
      return [...prev, ...fresh];
    });
  };

  const handleArtistKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (artistInput.trim()) {
        addArtists([artistInput]);
        setArtistInput("");
      }
    }
  };

  const removeArtist = (name: string) => {
    setArtists((prev) => prev.filter((a) => a !== name));
  };

  const handleInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (input.trim()) {
        addItems([input]);
        setInput("");
      }
    }
  };

  const handleBulkAdd = () => {
    addItems(bulk.split(/[\n,]/));
    setBulk("");
    setShowBulk(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    let parsed: string[] = [];
    if (file.name.endsWith(".csv")) {
      parsed = text.split(/\r?\n/).map((line) => {
        const m = line.match(/^"([^"]*)"|^([^,]*)/);
        return m ? (m[1] ?? m[2] ?? "") : "";
      });
    } else {
      parsed = text.split(/\r?\n/);
    }
    addItems(parsed);
    toast.success(`Imported ${parsed.filter(Boolean).length} items`);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeItem = (itemId: string) => setItems((prev) => prev.filter((p) => p.id !== itemId));

  const save = async () => {
    if (!id) return;
    if (!title.trim()) return toast.error("Give your list a title.");
    if (items.length < 2) return toast.error("Keep at least 2 items.");

    // Detect changes that would invalidate in-progress sessions / existing rankings
    const newIds = new Set(items.map((i) => i.id));
    const itemsChanged =
      newIds.size !== originalItemIds.size ||
      [...newIds].some((x) => !originalItemIds.has(x)) ||
      [...originalItemIds].some((x) => !newIds.has(x));

    setSaving(true);
    const { error } = await supabase
      .from("lists")
      .update({
        title: title.trim(),
        description: description.trim() || null,
        items: items as any,
        artists: artists,
      })
      .eq("id", id);

    if (error) {
      setSaving(false);
      toast.error("Could not save changes.");
      return;
    }

    if (itemsChanged) {
      // In-progress sessions for this list reference the old item set — clear them
      // so the user starts fresh next time. Existing finished rankings stay as-is.
      await supabase
        .from("ranking_sessions")
        .delete()
        .eq("list_id", id)
        .eq("session_id", getSessionId())
        .eq("completed", false);
    }

    setSaving(false);
    toast.success("Dataset saved");
    navigate("/library");
  };

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
            <Link to="/library">
              <ArrowLeft className="h-4 w-4" /> Back to library
            </Link>
          </Button>
        </div>
      </header>

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
            className="space-y-8"
          >
            <header className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight">Edit dataset</h1>
              <p className="text-muted-foreground">
                Change the title, description, or items. Changing items will reset any
                in-progress ranking for this list.
              </p>
            </header>

            <div className="space-y-5 rounded-xl bg-surface p-6 shadow-soft">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">
                  Description <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
            </div>

            <div className="space-y-3 rounded-xl bg-surface p-6 shadow-soft">
              <div className="space-y-1">
                <Label htmlFor="artists">
                  Artists in this dataset{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  For song lists — restrict the 30s previews so only these artists are searched.
                </p>
              </div>
              <Input
                id="artists"
                placeholder="Type an artist, press Enter…"
                value={artistInput}
                onChange={(e) => setArtistInput(e.target.value)}
                onKeyDown={handleArtistKey}
                className="h-11"
              />
              <div className="flex flex-wrap gap-2">
                <AnimatePresence mode="popLayout">
                  {artists.map((a) => (
                    <motion.button
                      key={a}
                      layout
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                      onClick={() => removeArtist(a)}
                      className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-alt px-3 py-1.5 text-sm font-medium hover:bg-primary-soft hover:border-primary/30 transition-colors"
                    >
                      <span>{a}</span>
                      <X className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                    </motion.button>
                  ))}
                </AnimatePresence>
                {artists.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">
                    No artist filter — previews can match any artist.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4 rounded-xl bg-surface p-6 shadow-soft">
              <div className="flex items-center justify-between">
                <Label>
                  Items <span className="text-muted-foreground font-normal tabular-nums">({items.length})</span>
                </Label>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowBulk((s) => !s)}>
                    <ListPlus className="h-4 w-4" /> Bulk
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                    <Upload className="h-4 w-4" /> Import
                  </Button>
                  <input ref={fileRef} type="file" accept=".txt,.csv" className="hidden" onChange={handleFile} />
                </div>
              </div>

              <Input
                placeholder="Type an item, press Enter…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleInputKey}
                className="h-11"
              />

              <AnimatePresence>
                {showBulk && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <Textarea
                      placeholder="Paste items, one per line or separated by commas…"
                      value={bulk}
                      onChange={(e) => setBulk(e.target.value)}
                      rows={4}
                    />
                    <Button size="sm" onClick={handleBulkAdd}>
                      Add to list
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

              {items.length > 30 && (
                <div className="flex items-center gap-2 rounded-lg bg-warning/10 p-3 text-sm text-warning">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>That's a lot — ranking will take a while with {items.length} items.</span>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <AnimatePresence mode="popLayout">
                  {items.map((it) => (
                    <motion.button
                      key={it.id}
                      layout
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                      onClick={() => removeItem(it.id)}
                      className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-alt px-3 py-1.5 text-sm font-medium hover:bg-primary-soft hover:border-primary/30 transition-colors"
                    >
                      <span>{it.label}</span>
                      <X className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                    </motion.button>
                  ))}
                </AnimatePresence>
                {items.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">No items yet — add a few.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => navigate("/library")}>
                Cancel
              </Button>
              <Button size="lg" onClick={save} disabled={saving || items.length < 2 || !title.trim()} className="min-w-40">
                <Save className="h-4 w-4" />
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
