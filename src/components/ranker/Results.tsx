import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Share2, RotateCcw, Copy, Trophy, GitCompareArrows } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId, shortCode } from "@/lib/session";

type Item = { id: string; label: string };

interface Props {
  listId: string;
  title: string;
  description: string;
  items: Item[];
  initialOrder: string[];
  readOnly?: boolean;
  existingShortCode?: string | null;
  onStartOver: () => void;
  onCompare?: () => void;
  hasOtherResults?: boolean;
}

const medals = ["🥇", "🥈", "🥉"];

function SortableRow({ item, index, readOnly }: { item: Item; index: number; readOnly: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: readOnly,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
  };
  const medal = index < 3 ? medals[index] : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-xl bg-surface p-4 transition-shadow ease-settle ${
        isDragging ? "shadow-lifted" : "shadow-soft"
      }`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-alt text-sm font-semibold tabular-nums">
        {medal ?? index + 1}
      </div>
      <div className="flex-1 font-medium">{item.label}</div>
      {!readOnly && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default function Results({
  listId,
  title,
  description,
  items,
  initialOrder,
  readOnly = false,
  existingShortCode = null,
  onStartOver,
  onCompare,
  hasOtherResults = false,
}: Props) {
  const itemMap = Object.fromEntries(items.map((i) => [i.id, i]));
  const [order, setOrder] = useState<string[]>(initialOrder);
  const [shareCode, setShareCode] = useState<string | null>(existingShortCode);
  const [sharing, setSharing] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Auto-save result on first mount (if not read-only and no shareCode yet)
  useEffect(() => {
    if (readOnly || shareCode) return;
    (async () => {
      const code = shortCode(6);
      const { data, error } = await supabase
        .from("results")
        .insert({
          list_id: listId,
          session_id: getSessionId(),
          short_code: code,
          ranked_items: order as any,
        })
        .select()
        .single();
      if (data && !error) setShareCode(data.short_code);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const oldIdx = order.indexOf(e.active.id as string);
    const newIdx = order.indexOf(e.over.id as string);
    const next = arrayMove(order, oldIdx, newIdx);
    setOrder(next);
    if (shareCode) {
      await supabase
        .from("results")
        .update({ ranked_items: next as any })
        .eq("short_code", shareCode);
    }
  };

  const share = async () => {
    if (!shareCode) {
      toast.error("Still saving — try again in a moment.");
      return;
    }
    setSharing(true);
    const url = `${window.location.origin}/r/${shareCode}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.message(url);
    }
    setSharing(false);
  };

  const copyText = async () => {
    const txt = `${title}\n${description ? description + "\n" : ""}\n` +
      order.map((id, i) => `${i + 1}. ${itemMap[id]?.label ?? ""}`).join("\n");
    try {
      await navigator.clipboard.writeText(txt);
      toast.success("Ranking copied as text");
    } catch {
      toast.error("Could not copy");
    }
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
        <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
          <Trophy className="h-3.5 w-3.5" /> {readOnly ? "Shared ranking" : "Final ranking"}
        </div>
        <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground text-pretty">{description}</p>}
      </header>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {order.map((id, idx) => {
              const item = itemMap[id];
              if (!item) return null;
              return <SortableRow key={id} item={item} index={idx} readOnly={readOnly} />;
            })}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex flex-wrap gap-2">
        {!readOnly && (
          <Button onClick={share} disabled={sharing || !shareCode}>
            <Share2 className="h-4 w-4" /> Share
          </Button>
        )}
        <Button variant="secondary" onClick={copyText}>
          <Copy className="h-4 w-4" /> Copy as text
        </Button>
        {hasOtherResults && onCompare && (
          <Button variant="secondary" onClick={onCompare}>
            <GitCompareArrows className="h-4 w-4" /> Compare rankings
          </Button>
        )}
        <Button variant="ghost" onClick={onStartOver}>
          <RotateCcw className="h-4 w-4" /> {readOnly ? "Rank this yourself" : "Start over"}
        </Button>
      </div>
    </motion.div>
  );
}
