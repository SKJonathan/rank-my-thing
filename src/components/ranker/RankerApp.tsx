import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import ListSetup from "@/components/ranker/ListSetup";
import Compare from "@/components/ranker/Compare";
import Results from "@/components/ranker/Results";
import CompareRankings from "@/components/ranker/CompareRankings";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";
import { RankerState } from "@/lib/ranker";
import { Loader2 } from "lucide-react";
import { shareDataset } from "@/lib/share";

type Item = { id: string; label: string };
type Step = "setup" | "compare" | "results" | "compareRankings";

interface InitialState {
  listId: string;
  items: Item[];
  title: string;
  description: string;
  artists?: string[];
  step: Step;
  initialOrder?: string[];
  resumeState?: RankerState | null;
  resumeSessionRowId?: string | null;
  readOnly?: boolean;
  shortCode?: string | null;
}

interface Props {
  initial?: InitialState;
  allowResume?: boolean;
  loadListId?: string | null;
}

export default function RankerApp({ initial, allowResume = false, loadListId = null }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(initial?.step ?? "setup");
  const [listId, setListId] = useState<string | null>(initial?.listId ?? null);
  const [items, setItems] = useState<Item[]>(initial?.items ?? []);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [artists, setArtists] = useState<string[]>(initial?.artists ?? []);
  const [order, setOrder] = useState<string[]>(initial?.initialOrder ?? []);
  const [resumeState, setResumeState] = useState<RankerState | null>(initial?.resumeState ?? null);
  const [resumeRowId, setResumeRowId] = useState<string | null>(initial?.resumeSessionRowId ?? null);
  const [readOnly, setReadOnly] = useState(initial?.readOnly ?? false);
  const [shortCodeVal, setShortCodeVal] = useState<string | null>(initial?.shortCode ?? null);
  const [hasOthers, setHasOthers] = useState(false);
  const [resuming, setResuming] = useState(true);

  // On fresh mount (no initial): optionally load a specific list, or resume the latest in-progress session.
  useEffect(() => {
    if (initial) {
      setResuming(false);
      return;
    }
    if (!allowResume && !loadListId) {
      setResuming(false);
      return;
    }
    (async () => {
      const sid = getSessionId();

      if (loadListId) {
        // Load this specific list, and any in-progress session for it (so we resume mid-rank if possible)
        const [{ data: list, error: listErr }, { data: session }] = await Promise.all([
          supabase
            .from("lists")
            .select("id, title, description, items, artists")
            .eq("id", loadListId)
            .maybeSingle(),
          supabase
            .from("ranking_sessions")
            .select("id, state, completed, updated_at")
            .eq("session_id", sid)
            .eq("list_id", loadListId)
            .eq("completed", false)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        if (list) {
          setListId(list.id);
          setItems(list.items as Item[]);
          setTitle(list.title);
          setDescription(list.description ?? "");
          setArtists(((list as any).artists as string[]) ?? []);
          if (session && session.state) {
            setResumeState(session.state as unknown as RankerState);
            setResumeRowId(session.id);
          }
          setStep("compare");
        } else {
          // List not found — surface it instead of dumping the user on the setup form
          console.warn("[Ranker] list not found", { loadListId, listErr });
          toast.error("Couldn't load that list — it may have been removed.");
          navigate("/", { replace: true });
        }
        setResuming(false);
        return;
      }

      // allowResume path — pick up the most recent unfinished session across any list
      const { data } = await supabase
        .from("ranking_sessions")
        .select("id, list_id, state, completed, lists(title, description, items)")
        .eq("session_id", sid)
        .eq("completed", false)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data && data.lists) {
        const list: any = data.lists;
        setListId(data.list_id);
        setItems(list.items as Item[]);
        setTitle(list.title);
        setDescription(list.description ?? "");
        setResumeState(data.state as unknown as RankerState);
        setResumeRowId(data.id);
        setStep("compare");
      }
      setResuming(false);
    })();
  }, [initial, allowResume, loadListId]);

  // Check for other results on results step
  useEffect(() => {
    if (step !== "results" || !listId) return;
    (async () => {
      const { data } = await supabase
        .from("results")
        .select("short_code")
        .eq("list_id", listId);
      const others = (data ?? []).filter((r) => r.short_code !== shortCodeVal);
      setHasOthers(others.length > 0);
    })();
  }, [step, listId, shortCodeVal, order]);

  const handleCreated = (id: string, its: Item[], t: string, d: string) => {
    setListId(id);
    setItems(its);
    setTitle(t);
    setDescription(d);
    setResumeState(null);
    setResumeRowId(null);
    setStep("compare");
    // Offer to share the dataset right after creation so they can rank with someone.
    setTimeout(() => {
      toast("Want to rank this with someone?", {
        description: "Share the dataset and you can both rank it at the same time.",
        action: {
          label: "Share link",
          onClick: () => shareDataset(id, t),
        },
        duration: 8000,
      });
    }, 400);
  };

  const handleComplete = (orderedIds: string[]) => {
    setOrder(orderedIds);
    setShortCodeVal(null);
    setStep("results");
  };

  const handleStartOver = async () => {
    if (readOnly && listId) {
      // Clone: create a new list pointing to the parent
      const { data } = await supabase
        .from("lists")
        .insert({
          parent_list_id: listId,
          title,
          description: description || null,
          items: items as any,
          owner_session_id: getSessionId(),
        })
        .select()
        .single();
      if (data) {
        setListId(data.id);
        setReadOnly(false);
        setResumeState(null);
        setResumeRowId(null);
        setShortCodeVal(null);
        setStep("compare");
        window.history.replaceState(null, "", "/");
      }
      return;
    }
    setStep("setup");
    setListId(null);
    setItems([]);
    setTitle("");
    setDescription("");
    setOrder([]);
    setResumeState(null);
    setResumeRowId(null);
    setShortCodeVal(null);
    window.history.replaceState(null, "", "/");
  };

  if (resuming) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {step === "setup" && (
        <div key="setup">
          <ListSetup onCreated={handleCreated} />
        </div>
      )}
      {step === "compare" && listId && (
        <div key="compare">
          <Compare
            listId={listId}
            items={items}
            resumeState={resumeState}
            resumeSessionRowId={resumeRowId}
            onComplete={handleComplete}
          />
        </div>
      )}
      {step === "results" && listId && (
        <div key="results">
          <Results
            listId={listId}
            title={title}
            description={description}
            items={items}
            initialOrder={order}
            readOnly={readOnly}
            existingShortCode={shortCodeVal}
            hasOtherResults={hasOthers}
            onStartOver={handleStartOver}
            onCompare={() => setStep("compareRankings")}
          />
        </div>
      )}
      {step === "compareRankings" && listId && (
        <div key="compareRankings">
          <CompareRankings
            listId={listId}
            title={title}
            items={items}
            myOrder={order}
            myShortCode={shortCodeVal}
            onBack={() => setStep("results")}
          />
        </div>
      )}
    </AnimatePresence>
  );
}
