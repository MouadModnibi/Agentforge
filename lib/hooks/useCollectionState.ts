"use client";
import { useEffect, useState } from "react";

// Private list navigation survives client-side route changes without adding
// workflow names/search terms to URLs or persistent browser storage. Auth
// changes already perform a full navigation, clearing this in-memory cache.
const collectionState = new Map<string, unknown>();
export function useCollectionState<T>(key: string, initial: T) {
  const state = useState<T>(() =>
    typeof window !== "undefined" && collectionState.has(key)
      ? (collectionState.get(key) as T)
      : initial,
  );
  const [value] = state;
  useEffect(() => {
    collectionState.set(key, value);
  }, [key, value]);
  return state;
}
