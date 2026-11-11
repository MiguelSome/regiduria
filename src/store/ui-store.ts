import { create } from "zustand";

interface UiState {
  isDark: boolean;
  selectedProjectId: string;
  setTheme: (value: boolean) => void;
  toggleTheme: () => void;
  setSelectedProjectId: (projectId: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isDark: true,
  selectedProjectId: "p-1",
  setTheme: (value) => set({ isDark: value }),
  toggleTheme: () => set((state) => ({ isDark: !state.isDark })),
  setSelectedProjectId: (projectId) => set({ selectedProjectId: projectId }),
}));
