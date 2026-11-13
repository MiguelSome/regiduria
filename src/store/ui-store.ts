import { create } from "zustand";

interface UiState {
  isDark: boolean;
  selectedProjectId: string;
  isProductionSelectionLocked: boolean;
  setTheme: (value: boolean) => void;
  toggleTheme: () => void;
  setSelectedProjectId: (projectId: string) => void;
  setProductionSelectionLocked: (value: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isDark: true,
  selectedProjectId: "",
  isProductionSelectionLocked: false,
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
}));
