import RankerApp from "@/components/ranker/RankerApp";
import { Trophy, Library as LibraryIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-6 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Trophy className="h-4 w-4" />
            </div>
            <span className="font-semibold tracking-tight">Ranker</span>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/library">
              <LibraryIcon className="h-4 w-4" /> My library
            </Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <RankerApp />
      </main>
      <footer className="border-t border-border mt-24">
        <div className="mx-auto max-w-3xl px-6 py-6 text-xs text-muted-foreground">
          Sort anything. Pairwise comparisons, settled.
        </div>
      </footer>
    </div>
  );
};

export default Index;
