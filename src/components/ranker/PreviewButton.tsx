import { useEffect, useState } from "react";
import { Play, Pause, Loader2, Music } from "lucide-react";
import {
  ItunesPreview,
  getPlayingUrl,
  playPreview,
  searchItunesPreview,
  stopPreview,
  subscribePlayback,
} from "@/lib/itunes";

interface Props {
  query: string;
  artists?: string[];
}

export default function PreviewButton({ query, artists }: Props) {
  const [preview, setPreview] = useState<ItunesPreview | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [playingUrl, setPlayingUrl] = useState<string | null>(getPlayingUrl());

  useEffect(() => {
    return subscribePlayback(() => setPlayingUrl(getPlayingUrl()));
  }, []);

  const artistsKey = (artists ?? []).join("|");
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPreview(undefined);
    searchItunesPreview(query, artists ?? []).then((p) => {
      if (cancelled) return;
      setPreview(p);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [query, artistsKey]);

  // Stop any playback when the query changes (e.g. new pair shown)
  useEffect(() => {
    return () => stopPreview();
  }, [query]);

  const isPlaying = preview && playingUrl === preview.previewUrl;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!preview) return;
    playPreview(preview.previewUrl);
  };

  if (loading) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Finding preview…
      </div>
    );
  }

  if (preview === null) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
        <Music className="h-3.5 w-3.5" />
        No preview found
      </div>
    );
  }

  if (!preview) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={isPlaying ? "Pause preview" : "Play preview"}
    >
      {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      <span className="truncate max-w-[140px]">
        {preview.trackName} · {preview.artistName}
      </span>
    </button>
  );
}
