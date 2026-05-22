import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Gem } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Gem className="w-12 h-12 text-primary mx-auto opacity-50" />
        <h1 className="text-4xl font-bold text-muted-foreground">404</h1>
        <p className="text-muted-foreground">Page not found</p>
        <Link href="/">
          <a><Button>Go Home</Button></a>
        </Link>
      </div>
    </div>
  );
}
