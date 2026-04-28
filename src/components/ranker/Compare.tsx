import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Undo2, Equal, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  RankerState,
  applyChoice,
  createRanker,
  currentPair,
  progress,
  remainingEstimate,
  undo,
} from "@/lib/ranker";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";
import PreviewButton from "./PreviewButton";
import { stopPreview } from "@/lib/itunes";

type Item = { id: string; label: string };

interface Props {
  listId: string;
  items: Item[];
  artists?: string[];
  enablePreview?: boolean;
  resumeState?: RankerState | null;
  resumeSessionRowId?: string | null;
  onComplete: (orderedIds: string[]) => void;
}

export default function Compare({ listId, items, artists, enablePreview = false, resumeState, resumeSessionRowId, onComplete }: Props) {
  const [state, setState] = useState<RankerState>(() => resumeState ?? createRanker(items));
  const [sessionRowId, setSessionRowId] = useState<string | null>(resumeSessionRowId ?? null);
  const [animating, setAnimating] = useState<null | "a" | "b" | "tie">(null);
  const saveTimer = useRef<number | null>(null);
  const completedRef = useRef(false);

  const pair = useMemo(() => currentPair(state), [state]);
  const pct = Math.round(progress(state) * 100);
  const remaining = remainingEstimate(state);

  // Auto-save state
  useEffect(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const sid = getSessionId();
      if (sessionRowId) {
        await supabase
          .from("ranking_sessions")
          .update({ state: state as any, completed: state.done, updated_at: new Date().toISOString() })
          .eq("id", sessionRowId);
      } else {
        const { data } = await supabase
          .from("ranking_sessions")
          .insert({ list_id: listId, session_id: sid, state: state as any, completed: state.done })
          .select()
          .single();
        if (data) setSessionRowId(data.id);
      }
    }, 400);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [state, listId, sessionRowId]);

  // On completion
  useEffect(() => {
    if (state.done && state.finalOrder && !completedRef.current) {
      completedRef.current = true;
      onComplete(state.finalOrder);
    }
  }, [state.done, state.finalOrder, onComplete]);

  const choose = (c: "a" | "b" | "tie") => {
    if (animating || !pair) return;
    stopPreview();
    setAnimating(c);
    window.setTimeout(() => {
      setState((prev) => {
        const next = { ...prev, items: prev.items, runs: prev.runs.map((r) => [...r]), history: [...prev.history], frame: prev.frame ? { ...prev.frame, left: [...prev.frame.left], right: [...prev.frame.right], out: [...prev.frame.out] } : null };
        return applyChoice(next, c);
      });
      setAnimating(null);
    }, 320);
  };

  const handleUndo = () => {
    if (animating) return;
    setState((prev) => {
      const next = { ...prev, items: prev.items, runs: prev.runs.map((r) => [...r]), history: [...prev.history], frame: prev.frame ? { ...prev.frame, left: [...prev.frame.left], right: [...prev.frame.right], out: [...prev.frame.out] } : null };
      return undo(next);
    });
  };

  if (!pair) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="mt-3 text-sm">Tallying results…</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-8"
    >
      <div className="space-y-2">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-semibold">Which do you prefer?</h2>
          <div className="text-sm text-muted-foreground tabular-nums">
            {pct}% · ~{remaining} left
          </div>
        </div>
        <Progress value={pct} className="h-2" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <CardChoice
          item={pair.a}
          side="a"
          state={animating}
          artists={artists}
          enablePreview={enablePreview}
          onClick={() => choose("a")}
          disabled={!!animating}
        />
        <CardChoice
          item={pair.b}
          side="b"
          state={animating}
          artists={artists}
          enablePreview={enablePreview}
          onClick={() => choose("b")}
          disabled={!!animating}
        />
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button variant="ghost" size="sm" onClick={handleUndo} disabled={state.history.length === 0 || !!animating}>
          <Undo2 className="h-4 w-4" /> Undo
        </Button>
        <Button variant="ghost" size="sm" onClick={() => choose("tie")} disabled={!!animating}>
          <Equal className="h-4 w-4" /> It's a tie
        </Button>
      </div>
    </motion.div>
  );
}

function CardChoice({
  item,
  side,
  state,
  artists,
  enablePreview,
  onClick,
  disabled,
}: {
  item: Item;
  side: "a" | "b";
  state: null | "a" | "b" | "tie";
  artists?: string[];
  enablePreview?: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  const isWinner = state === side || state === "tie";
  const isLoser = state && state !== side && state !== "tie";

  return (
    <AnimatePresence mode="wait">
      <motion.button
        key={item.id}
        layout
        type="button"
        onClick={onClick}
        disabled={disabled}
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={
          isWinner
            ? { opacity: 1, scale: 1.04, y: -4, transition: { duration: 0.32, ease: [0.4, 0, 0.2, 1] } }
            : isLoser
            ? { opacity: 0.3, scale: 0.96, x: side === "a" ? -40 : 40, transition: { duration: 0.32, ease: [0.4, 0, 0.2, 1] } }
            : { opacity: 1, scale: 1, y: 0, x: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } }
        }
        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
        whileHover={!disabled ? { scale: 1.02, y: -2 } : undefined}
        whileTap={!disabled ? { scale: 0.98 } : undefined}
        className={`group relative min-h-44 md:min-h-64 rounded-xl bg-surface p-8 text-left shadow-soft transition-shadow ease-settle hover:shadow-lifted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
          isWinner ? "ring-2 ring-primary" : ""
        }`}
      >
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
          Option {side.toUpperCase()}
        </div>
        <div className="text-2xl md:text-3xl font-semibold text-balance leading-tight">
          {item.label}
        </div>
        {enablePreview && (
          <div className="mt-4" onClick={(e) => e.stopPropagation()}>
            <PreviewButton query={item.label} artists={artists} />
          </div>
        )}
      </motion.button>
    </AnimatePresence>
  );
}
