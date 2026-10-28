import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
export function CollectionPagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  if (pages < 2) return null;
  return (
    <nav className="m4m-pagination" aria-label="Collection pages">
      <span aria-live="polite">
        Page {page} of {pages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft size={16} /> Previous
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Next <ChevronRight size={16} />
      </Button>
    </nav>
  );
}
