import { defineStore } from "pinia";
import { ref } from "vue";
import { useSessionsStore } from "./sessions";

export const useChatStore = defineStore("chat", () => {
  const messages = ref([]);
  const mode = ref("investigate");
  const model = ref("default");
  const loading = ref(false);
  let abortController = null;

  function addMessage(role, text) {
    messages.value.push({ role, text, timestamp: Date.now() });
  }

  function clearMessages() {
    messages.value = [];
  }

  function setMode(newMode) {
    mode.value = newMode;
  }

  async function sendMessage(text) {
    if (!text.trim()) return;

    const sessionsStore = useSessionsStore();
    if (!sessionsStore.currentSession) {
      addMessage("assistant", "Select a session first.");
      return;
    }

    addMessage("user", text);
    loading.value = true;
    abortController = new AbortController();

    try {
      const res = await fetch(
        `${sessionsStore.apiBase}/sessions/${sessionsStore.currentSession.id}/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-device-id": sessionsStore.deviceId,
            "x-device-secret": sessionsStore.deviceSecret,
          },
          body: JSON.stringify({ message: text, mode: mode.value, model: model.value }),
          signal: abortController.signal,
        }
      );

      if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
      const data = await res.json();
      addMessage("assistant", data.reply || "No reply.");
    } catch (err) {
      if (err.name !== "AbortError") {
        addMessage("assistant", err.message || "Chat failed.");
      }
    } finally {
      loading.value = false;
      abortController = null;
    }
  }

  function stopChat() {
    if (abortController) {
      abortController.abort();
    }
  }

  return {
    messages,
    mode,
    model,
    loading,
    addMessage,
    clearMessages,
    setMode,
    sendMessage,
    stopChat,
  };
});
