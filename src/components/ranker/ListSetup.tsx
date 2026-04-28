import { useState, useRef, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, ListPlus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";

type Item = { id: string; label: string };

interface Props {
  onCreated: (listId: string, items: Item[], title: string, description: string, artists: string[]) => void;
}

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

export default function ListSetup({ onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState("");
  const [bulk, setBulk] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [artists, setArtists] = useState<string[]>([]);
  const [artistInput, setArtistInput] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const addItems = (labels: string[]) => {
    setItems((prev) => {
      const existing = new Set(prev.map((p) => p.label.toLowerCase()));
      const fresh = dedupeAndClean(labels).filter((l) => !existing.has(l.toLowerCase()));
      return [...prev, ...fresh.map((l) => ({ id: crypto.randomUUID(), label: l }))];
    });
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
    const parts = bulk.split(/[\n,]/);
    addItems(parts);
    setBulk("");
    setShowBulk(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    let parsed: string[] = [];
    if (file.name.endsWith(".csv")) {
      // first column only, simple parser (handles plain commas)
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

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  };

  const start = async () => {
    if (!title.trim()) {
      toast.error("Give your list a title.");
      return;
    }
    if (items.length < 2) {
      toast.error("Add at least 2 items.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("lists")
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        items: items as any,
        owner_session_id: getSessionId(),
      })
      .select()
      .single();
    setLoading(false);
    if (error || !data) {
      toast.error("Could not save list.");
      return;
    }
    onCreated(data.id, items, title.trim(), description.trim());
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-8"
    >
      <header className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">What are we ranking today?</h1>
        <p className="text-muted-foreground">
          Add items, then compare them two at a time. Get a final ranked list.
        </p>
      </header>

      <div className="space-y-5 rounded-xl bg-surface p-6 shadow-soft">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="e.g. Best pizzas we tried"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Textarea
            id="desc"
            placeholder="Add context for the ranking…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <div className="space-y-4 rounded-xl bg-surface p-6 shadow-soft">
        <div className="flex items-center justify-between">
          <Label>Items <span className="text-muted-foreground font-normal tabular-nums">({items.length})</span></Label>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowBulk((s) => !s)}>
              <ListPlus className="h-4 w-4" /> Bulk
            </Button>
            <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Import
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.csv"
              className="hidden"
              onChange={handleFile}
            />
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
              <Button size="sm" onClick={handleBulkAdd}>Add to list</Button>
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
            <p className="text-sm text-muted-foreground italic">No items yet — add a few to begin.</p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={start}
          disabled={loading || items.length < 2 || !title.trim()}
          className="min-w-40"
        >
          {loading ? "Starting…" : "Start ranking"}
        </Button>
      </div>
    </motion.div>
  );
}
