import { create } from "zustand";

import type { DancePreferences } from "@/lib/types";

interface UiState {
  isDark: boolean;
  selectedProjectId: string;
  isProductionSelectionLocked: boolean;
  /** Shared with T4B/T7: null means there is no active execution session. */
  executionMode: "rehearsal" | "show" | null;
  /** T9 runtime cache only; Dexie (appSettings) is the source of truth. */
  dancePreferences: DancePreferences | null;
  setTheme: (value: boolean) => void;
  toggleTheme: () => void;
  setSelectedProjectId: (projectId: string) => void;
  setProductionSelectionLocked: (value: boolean) => void;
  setExecutionMode: (value: "rehearsal" | "show" | null) => void;
  setDancePreferences: (value: DancePreferences | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isDark: true,
  selectedProjectId: "",
  isProductionSelectionLocked: false,
  executionMode: null,
  dancePreferences: null,
  setTheme: (value) => set({ isDark: value }),
  toggleTheme: () => set((state) => ({ isDark: !state.isDark })),
  setSelectedProjectId: (projectId) => {
    if (typeof window !== "undefined") {
      if (projectId) {
        window.localStorage.setItem("regiduria:active-project", projectId);
      } else {
        window.localStorage.removeItem("regiduria:active-project");
      }
    }
    set({ selectedProjectId: projectId });
  },
  setProductionSelectionLocked: (value) => set({ isProductionSelectionLocked: value }),
  setExecutionMode: (value) => set({ executionMode: value }),
  setDancePreferences: (value) => set({ dancePreferences: value }),
}));
