import { Link, useSearchParams } from "react-router-dom";
import { Trophy, Library as LibraryIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import RankerApp from "@/components/ranker/RankerApp";

const NewList = () => {
  const [params] = useSearchParams();
  const allowResume = params.get("resume") === "1";
  const loadListId = params.get("list");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-6 py-5">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Trophy className="h-4 w-4" />
            </div>
            <span className="font-semibold tracking-tight">Ranker</span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/library">
              <LibraryIcon className="h-4 w-4" /> My library
            </Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <RankerApp allowResume={allowResume} loadListId={loadListId} />
      </main>
      <footer className="mt-24 border-t border-border">
        <div className="mx-auto max-w-3xl px-6 py-6 text-xs text-muted-foreground">
          Sort anything. Pairwise comparisons, settled.
        </div>
      </footer>
    </div>
  );
};

export default NewList;
