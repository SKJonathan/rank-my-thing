export type CategoryId =
  | "music"
  | "movies"
  | "tv"
  | "food"
  | "games"
  | "books"
  | "sports"
  | "other";

export interface Category {
  id: CategoryId;
  label: string;
  description: string;
}

export const CATEGORIES: Category[] = [
  { id: "music", label: "Music", description: "Songs, albums — uses iTunes 30s previews." },
  { id: "movies", label: "Movies", description: "Films of any era or genre." },
  { id: "tv", label: "TV Shows", description: "Series, seasons, episodes." },
  { id: "food", label: "Food & Drink", description: "Restaurants, dishes, recipes." },
  { id: "games", label: "Games", description: "Video games, board games." },
  { id: "books", label: "Books", description: "Novels, comics, anything you read." },
  { id: "sports", label: "Sports", description: "Teams, players, moments." },
  { id: "other", label: "Other", description: "Anything else." },
];

export const DEFAULT_CATEGORY: CategoryId = "other";

export function isMusicCategory(c?: string | null): boolean {
  return c === "music";
}
