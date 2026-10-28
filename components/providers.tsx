"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Toaster } from "sonner";
import { CommandPalette } from "@/components/CommandPalette";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { usePathname } from "next/navigation";
import { ConfirmActionProvider } from "@/components/ui/confirm-action";

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const authChanged = (e: StorageEvent) => {
      if (e.key === "m4m-auth-event") {
        queryClient.clear();
        window.location.assign("/login");
      }
    };
    window.addEventListener("storage", authChanged);
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("storage", authChanged);
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfirmActionProvider>
        <WorkspaceShell>{children}</WorkspaceShell>
      </ConfirmActionProvider>
      <Toaster theme="dark" richColors position="bottom-right" closeButton />
      {!["/login", "/register"].includes(pathname) && (
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
        />
      )}
    </QueryClientProvider>
  );
}
