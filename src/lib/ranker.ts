// Interactive merge-sort. Each step asks a comparison; comparisons can be:
// "a" (a preferred), "b" (b preferred), or "tie" (treated as a == b, slight bias to a)
//
// State is fully serializable so we can persist + resume.

export type Item = { id: string; label: string };
export type Choice = "a" | "b" | "tie";

export type Pair = { a: Item; b: Item };

type Frame = {
  // Items being merged (as id arrays for compactness)
  left: string[];
  right: string[];
  i: number; // index into left
  j: number; // index into right
  out: string[]; // merged so far
};

export type RankerState = {
  items: Record<string, Item>; // id -> item
  // Working set: array of sorted runs (each is an array of ids)
  runs: string[][];
  // Currently-merging frame (if any)
  frame: Frame | null;
  // History for undo (snapshot of {runs, frame, choice})
  history: Array<{ runs: string[][]; frame: Frame | null }>;
  // Total comparisons performed
  comparisons: number;
  // Estimated total comparisons (n * log2(n) rough upper bound)
  estimatedTotal: number;
  done: boolean;
  finalOrder: string[] | null;
};

export function createRanker(items: Item[]): RankerState {
  // Shuffle for fairness so the user doesn't always start with item #1 vs #2
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  const itemMap: Record<string, Item> = {};
  shuffled.forEach((it) => (itemMap[it.id] = it));
  const runs = shuffled.map((it) => [it.id]);
  const n = items.length;
  const estimated = Math.max(1, Math.ceil(n * Math.log2(Math.max(2, n))));
  const state: RankerState = {
    items: itemMap,
    runs,
    frame: null,
    history: [],
    comparisons: 0,
    estimatedTotal: estimated,
    done: n < 2,
    finalOrder: n < 2 ? items.map((i) => i.id) : null,
  };
  advance(state);
  return state;
}

// Make sure state has a frame to work on if more merging is needed.
function advance(state: RankerState) {
  if (state.frame) return;
  // If only one run remains, done.
  if (state.runs.length <= 1) {
    state.done = true;
    state.finalOrder = state.runs[0] ?? Object.keys(state.items);
    return;
  }
  // Take first two runs and start a new merge frame.
  const left = state.runs.shift()!;
  const right = state.runs.shift()!;
  state.frame = { left, right, i: 0, j: 0, out: [] };
  // If either side empty (shouldn't happen but be safe), finish immediately.
  finishFrameIfDone(state);
}

function finishFrameIfDone(state: RankerState) {
  const f = state.frame;
  if (!f) return;
  if (f.i >= f.left.length) {
    f.out.push(...f.right.slice(f.j));
    state.runs.push(f.out);
    state.frame = null;
  } else if (f.j >= f.right.length) {
    f.out.push(...f.left.slice(f.i));
    state.runs.push(f.out);
    state.frame = null;
  }
  // After finishing one frame, advance to the next.
  if (!state.frame) advance(state);
}

export function currentPair(state: RankerState): Pair | null {
  if (state.done) return null;
  const f = state.frame;
  if (!f) return null;
  const aId = f.left[f.i];
  const bId = f.right[f.j];
  return { a: state.items[aId], b: state.items[bId] };
}

export function applyChoice(state: RankerState, choice: Choice): RankerState {
  if (state.done || !state.frame) return state;
  // Snapshot for undo (deep copy minimal pieces)
  state.history.push({
    runs: state.runs.map((r) => [...r]),
    frame: {
      ...state.frame,
      left: [...state.frame.left],
      right: [...state.frame.right],
      out: [...state.frame.out],
    },
  });
  if (state.history.length > 100) state.history.shift();

  const f = state.frame;
  if (choice === "a" || choice === "tie") {
    f.out.push(f.left[f.i]);
    f.i++;
    if (choice === "tie") {
      // also push b right after to keep them adjacent
      f.out.push(f.right[f.j]);
      f.j++;
    }
  } else {
    f.out.push(f.right[f.j]);
    f.j++;
  }
  state.comparisons++;
  finishFrameIfDone(state);
  return state;
}

export function undo(state: RankerState): RankerState {
  const last = state.history.pop();
  if (!last) return state;
  state.runs = last.runs;
  state.frame = last.frame;
  state.comparisons = Math.max(0, state.comparisons - 1);
  state.done = false;
  state.finalOrder = null;
  return state;
}

export function progress(state: RankerState): number {
  if (state.done) return 1;
  return Math.min(0.99, state.comparisons / state.estimatedTotal);
}

export function remainingEstimate(state: RankerState): number {
  return Math.max(0, state.estimatedTotal - state.comparisons);
}
