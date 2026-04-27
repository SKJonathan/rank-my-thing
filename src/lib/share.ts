import { toast } from "sonner";

export function getDatasetShareUrl(listId: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}new?list=${listId}`;
}

export async function shareDataset(listId: string, title?: string) {
  const url = getDatasetShareUrl(listId);
  const shareData = {
    title: title ? `Rank: ${title}` : "Rank this list",
    text: title ? `Help me rank "${title}" on Ranker` : "Rank this list with me",
    url,
  };
  // Try native share first (great on mobile)
  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch {
      // user cancelled or unsupported — fall back to clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Share link copied", {
      description: "Send it to anyone — they can rank the same list.",
    });
  } catch {
    toast.message(url);
  }
}
