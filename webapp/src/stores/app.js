import { defineStore } from "pinia";
import { ref, watch } from "vue";

export const useAppStore = defineStore("app", () => {
  // Theme
  const theme = ref(localStorage.getItem("qa_theme") || "system");
  
  function initTheme() {
    const stored = localStorage.getItem("qa_theme");
    if (stored && stored !== "system") {
      document.documentElement.setAttribute("data-theme", stored);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("qa_theme", next);
    theme.value = next;
  }

  // Sidebar
  const sidebarCollapsed = ref(localStorage.getItem("qa_sidebar_collapsed") === "true");

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
    localStorage.setItem("qa_sidebar_collapsed", sidebarCollapsed.value);
  }

  // Assistant Panel
  const assistantOpen = ref(false);

  function toggleAssistant() {
    assistantOpen.value = !assistantOpen.value;
  }

  return {
    theme,
    initTheme,
    toggleTheme,
    sidebarCollapsed,
    toggleSidebar,
    assistantOpen,
    toggleAssistant,
  };
});
