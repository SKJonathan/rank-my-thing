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

export function searchItunesPreview(query: string): Promise<ItunesPreview | null> {
  const key = query.trim().toLowerCase();
  if (!key) return Promise.resolve(null);
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);
  if (inflight.has(key)) return inflight.get(key)!;

  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(key)}&media=music&entity=song&limit=1`;
  const p = fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .then((data: any) => {
      const result = data?.results?.[0];
      if (!result?.previewUrl) {
        cache.set(key, null);
        return null;
      }
      const preview: ItunesPreview = {
        previewUrl: result.previewUrl,
        trackName: result.trackName,
        artistName: result.artistName,
        artworkUrl: result.artworkUrl100 ?? "",
      };
      cache.set(key, preview);
      return preview;
    })
    .catch(() => {
      cache.set(key, null);
      return null;
    })
    .finally(() => {
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
