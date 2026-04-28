// Lightweight iTunes Search API helper for fetching 30s song previews.
// Free, no API key required.

export type ItunesPreview = {
  previewUrl: string;
  trackName: string;
  artistName: string;
  artworkUrl: string;
};

const cache = new Map<string, ItunesPreview | null>();
const inflight = new Map<string, Promise<ItunesPreview | null>>();

// Try to split a user label like "Song - Artist", "Artist - Song",
// "Song by Artist", "Song – Artist" into parts.
function parseLabel(raw: string): { song?: string; artist?: string; full: string } {
  const full = raw.trim();
  // Normalize various dashes
  const normalized = full.replace(/[–—]/g, "-");

  const byMatch = normalized.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) {
    return { song: byMatch[1].trim(), artist: byMatch[2].trim(), full };
  }

  const dashMatch = normalized.match(/^(.+?)\s+-\s+(.+)$/);
  if (dashMatch) {
    // Could be "Artist - Song" or "Song - Artist"; we'll try both during scoring.
    return { song: dashMatch[2].trim(), artist: dashMatch[1].trim(), full };
  }

  return { full };
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/\(.*?\)|\[.*?\]/g, " ") // drop bracketed extras like (Remastered)
    .replace(/\bfeat\.?\b.*$/i, " ")
    .replace(/\bft\.?\b.*$/i, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): Set<string> {
  return new Set(normalize(s).split(" ").filter(Boolean));
}

function tokenOverlap(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  ta.forEach((t) => {
    if (tb.has(t)) inter++;
  });
  return inter / Math.max(ta.size, tb.size);
}

function scoreResult(
  result: any,
  parsed: { song?: string; artist?: string; full: string },
): number {
  if (!result?.previewUrl) return -1;
  const track: string = result.trackName ?? "";
  const artist: string = result.artistName ?? "";

  if (parsed.song && parsed.artist) {
    // Try both interpretations of "X - Y"
    const s1 = tokenOverlap(parsed.song, track) + tokenOverlap(parsed.artist, artist);
    const s2 = tokenOverlap(parsed.artist, track) + tokenOverlap(parsed.song, artist);
    return Math.max(s1, s2);
  }
  // No structured hint — score against the full label combined with track + artist
  const combined = `${track} ${artist}`;
  return tokenOverlap(parsed.full, combined);
}

async function fetchItunes(term: string, limit = 10): Promise<any[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data?.results) ? data.results : [];
  } catch {
    return [];
  }
}

export function searchItunesPreview(query: string): Promise<ItunesPreview | null> {
  const key = query.trim().toLowerCase();
  if (!key) return Promise.resolve(null);
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);
  if (inflight.has(key)) return inflight.get(key)!;

  const parsed = parseLabel(query);

  const p = (async () => {
    // Build search terms: prefer the most specific first.
    const terms: string[] = [];
    if (parsed.song && parsed.artist) {
      terms.push(`${parsed.song} ${parsed.artist}`);
      terms.push(`${parsed.artist} ${parsed.song}`);
    }
    terms.push(parsed.full);

    const seen = new Set<string>();
    const candidates: any[] = [];
    for (const t of terms) {
      const results = await fetchItunes(t, 10);
      for (const r of results) {
        if (!r?.previewUrl) continue;
        const id = r.trackId ?? `${r.trackName}::${r.artistName}`;
        if (seen.has(String(id))) continue;
        seen.add(String(id));
        candidates.push(r);
      }
      // Early exit if we already have a strongly-matching candidate
      if (candidates.length >= 5) break;
    }

    if (!candidates.length) {
      cache.set(key, null);
      return null;
    }

    // Pick the best-scoring candidate
    let best: any = null;
    let bestScore = -Infinity;
    for (const c of candidates) {
      const s = scoreResult(c, parsed);
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }

    if (!best?.previewUrl) {
      cache.set(key, null);
      return null;
    }

    const preview: ItunesPreview = {
      previewUrl: best.previewUrl,
      trackName: best.trackName,
      artistName: best.artistName,
      artworkUrl: best.artworkUrl100 ?? "",
    };
    cache.set(key, preview);
    return preview;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, p);
  return p;
}

// Single shared <audio> so only one preview plays at a time.
let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
const listeners = new Set<() => void>();

export function subscribePlayback(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notify() {
  listeners.forEach((cb) => cb());
}

export function getPlayingUrl(): string | null {
  return currentUrl;
}

export function playPreview(url: string) {
  if (currentAudio && currentUrl === url) {
    currentAudio.pause();
    currentAudio = null;
    currentUrl = null;
    notify();
    return;
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  const audio = new Audio(url);
  audio.volume = 0.8;
  audio.addEventListener("ended", () => {
    if (currentAudio === audio) {
      currentAudio = null;
      currentUrl = null;
      notify();
    }
  });
  audio.play().catch(() => {
    currentAudio = null;
    currentUrl = null;
    notify();
  });
  currentAudio = audio;
  currentUrl = url;
  notify();
}

export function stopPreview() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
    currentUrl = null;
    notify();
  }
}
