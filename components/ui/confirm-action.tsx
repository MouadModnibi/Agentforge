"use client";
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";
type Request = {
  title: string;
  description: string;
  action?: string;
  destructive?: boolean;
};
const ConfirmContext = createContext<(request: Request) => Promise<boolean>>(
  async () => false,
);
export const useConfirmAction = () => useContext(ConfirmContext);
export function ConfirmActionProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  const resolver = useRef<((answer: boolean) => void) | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  function finish(answer: boolean) {
    resolver.current?.(answer);
    resolver.current = null;
    setRequest(null);
  }
  return (
    <ConfirmContext.Provider
      value={(next) => {
        resolver.current?.(false);
        trigger.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        setRequest(next);
        return new Promise((resolve) => {
          resolver.current = resolve;
        });
      }}
    >
      {children}
      <AlertDialog
        open={!!request}
        onOpenChange={(open) => {
          if (!open) finish(false);
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(e) => {
            if (trigger.current?.isConnected) {
              e.preventDefault();
              trigger.current.focus();
            }
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{request?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {request?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => finish(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className={
                request?.destructive
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
              onClick={() => finish(true)}
            >
              {request?.action ?? "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}
