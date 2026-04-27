import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

type Item = { id: string; label: string };

interface Props {
  listId: string;
  title: string;
  items: Item[];
  myOrder: string[];
  myShortCode?: string | null;
  onBack: () => void;
}

type Result = {
  id: string;
  short_code: string;
  ranked_items: string[];
  created_at: string;
};

export default function CompareRankings({ listId, title, items, myOrder, myShortCode, onBack }: Props) {
  const itemMap = Object.fromEntries(items.map((i) => [i.id, i]));
  const [others, setOthers] = useState<Result[]>([]);
  const [pickedCode, setPickedCode] = useState<string | null>(null);
  const picked = others.find((o) => o.short_code === pickedCode);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("results")
        .select("id, short_code, ranked_items, created_at")
        .eq("list_id", listId)
        .order("created_at", { ascending: false });
      const filtered = (data ?? []).filter((r) => r.short_code !== myShortCode) as Result[];
      setOthers(filtered);
      if (filtered[0]) setPickedCode(filtered[0].short_code);
    })();
  }, [listId, myShortCode]);

  if (others.length === 0) {
    return (
      <div className="space-y-6 text-center py-12">
        <p className="text-muted-foreground">No other rankings to compare against yet.</p>
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Back</Button>
      </div>
    );
  }

  const otherOrder = picked?.ranked_items ?? [];
  const myPosOf = (id: string) => myOrder.indexOf(id);
  const otherPosOf = (id: string) => otherOrder.indexOf(id);

  // Agreement scoring
  const allIds = items.map((i) => i.id);
  let same = 0;
  let biggestDiff = { id: "", diff: -1 };
  for (const id of allIds) {
    const m = myPosOf(id);
    const o = otherPosOf(id);
    if (m === -1 || o === -1) continue;
    const d = Math.abs(m - o);
    if (d === 0) same++;
    if (d > biggestDiff.diff) biggestDiff = { id, diff: d };
  }
  const biggestItem = itemMap[biggestDiff.id];

  const colorFor = (diff: number) => {
    if (diff === 0) return "bg-success/10 text-success border-success/20";
    if (diff <= 2) return "bg-warning/10 text-warning border-warning/30";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-8"
    >
      <div className="space-y-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
          <ArrowLeft className="h-4 w-4" /> Back to ranking
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Compare: {title}</h1>
      </div>

      {others.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Compare against:</span>
          <Select value={pickedCode ?? undefined} onValueChange={setPickedCode}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {others.map((o, i) => (
                <SelectItem key={o.short_code} value={o.short_code}>
                  Ranking #{others.length - i} · {new Date(o.created_at).toLocaleDateString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="rounded-xl bg-primary-soft p-4 text-sm">
        You agreed on <strong className="tabular-nums">{same}/{allIds.length}</strong> positions.
        {biggestItem && biggestDiff.diff > 0 && (
          <> Biggest disagreement: <strong>{biggestItem.label}</strong> (you: #{myPosOf(biggestDiff.id) + 1} · them: #{otherPosOf(biggestDiff.id) + 1}).</>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground px-2">You</h3>
          {myOrder.map((id, idx) => {
            const item = itemMap[id];
            const otherIdx = otherPosOf(id);
            const diff = otherIdx === -1 ? 99 : Math.abs(idx - otherIdx);
            return (
              <div
                key={id}
                className={`flex items-center gap-2 rounded-lg border p-2.5 text-sm ${colorFor(diff)}`}
              >
                <span className="tabular-nums font-semibold w-5">{idx + 1}</span>
                <span className="truncate">{item?.label}</span>
              </div>
            );
          })}
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground px-2">Them</h3>
          {otherOrder.map((id, idx) => {
            const item = itemMap[id];
            const myIdx = myPosOf(id);
            const diff = myIdx === -1 ? 99 : Math.abs(idx - myIdx);
            return (
              <div
                key={id}
                className={`flex items-center gap-2 rounded-lg border p-2.5 text-sm ${colorFor(diff)}`}
              >
                <span className="tabular-nums font-semibold w-5">{idx + 1}</span>
                <span className="truncate">{item?.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
