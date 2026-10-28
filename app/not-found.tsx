import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
export const metadata = { title: "Page not found" };
export default function NotFound() {
  return (
    <main className="forge-dashboard">
      <div className="forge-page-heading">
        <div>
          <h1>Page not found</h1>
          <p>This page may have moved or is no longer available.</p>
        </div>
      </div>
      <Button asChild variant="outline">
        <Link href="/workflows">
          <ArrowLeft size={16} />
          Back to workflows
        </Link>
      </Button>
    </main>
  );
}
