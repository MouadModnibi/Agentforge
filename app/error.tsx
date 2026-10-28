"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    document.title = "Unable to open page · m8m";
  }, []);
  return (
    <main className="forge-dashboard">
      <div className="forge-page-heading">
        <div>
          <h1>Unable to open this page</h1>
          <p>Try again, or return to your workflows.</p>
        </div>
      </div>
      <div className="flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/workflows">Back to workflows</Link>
        </Button>
      </div>
    </main>
  );
}
