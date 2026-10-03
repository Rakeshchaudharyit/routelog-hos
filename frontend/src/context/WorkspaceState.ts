import { createContext } from "react";
import type { useWorkspaceState } from "./WorkspaceContext";
// Keep context identity stable while Vite refreshes the provider and its consumers.
export const Context = createContext<ReturnType<
  typeof useWorkspaceState
> | null>(null);
