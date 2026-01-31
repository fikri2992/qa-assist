<script setup>
import { ref, watch, nextTick } from "vue";
import { useAppStore } from "../stores/app";
import { useChatStore } from "../stores/chat";
import { useSessionsStore } from "../stores/sessions";
import { storeToRefs } from "pinia";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import SelectButton from "primevue/selectbutton";
import Select from "primevue/select";
import Drawer from "primevue/drawer";

const appStore = useAppStore();
const chatStore = useChatStore();
const sessionsStore = useSessionsStore();

const { assistantOpen } = storeToRefs(appStore);
const { messages, mode, model, loading } = storeToRefs(chatStore);
const { currentSession } = storeToRefs(sessionsStore);

const inputText = ref("");
const messagesContainer = ref(null);

const modeOptions = [
  { label: "Investigate", value: "investigate" },
  { label: "Summarize", value: "summarize" },
  { label: "Triage", value: "triage" },
];

const modelOptions = [
  { label: "Auto", value: "default" },
  { label: "Flash", value: "gemini-3-flash" },
  { label: "Pro", value: "gemini-3-pro-preview" },
];

// Auto-scroll on new messages
watch(messages, async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}, { deep: true });

// Reset chat when session changes
watch(currentSession, () => {
  chatStore.clearMessages();
  if (currentSession.value) {
    chatStore.addMessage("assistant", "Ask me about this session's logs, UI issues, or repro steps.");
  }
});

async function handleSend() {
  if (!inputText.value.trim() || loading.value) return;
  const text = inputText.value;
  inputText.value = "";
  await chatStore.sendMessage(text);
}

function handleKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

function closePanel() {
  appStore.toggleAssistant();
}
</script>

<template>
  <Drawer
    v-model:visible="assistantOpen"
    position="right"
    :modal="false"
    class="assistant-drawer"
    header="AI Assistant"
  >
    <template #header>
      <div class="drawer-header">
        <i class="pi pi-sparkles"></i>
        <span>AI Assistant</span>
      </div>
    </template>

    <div class="chat-container">
      <div ref="messagesContainer" class="chat-messages">
        <div
          v-for="(msg, i) in messages"
          :key="i"
          class="chat-bubble"
          :class="msg.role"
        >
          {{ msg.text }}
        </div>
        <div v-if="!messages.length" class="chat-empty">
          <i class="pi pi-comments"></i>
          <p>Select a session to start chatting</p>
        </div>
      </div>

      <div class="chat-controls">
        <div class="chat-input-row">
          <InputText
            v-model="inputText"
            placeholder="Ask about this session..."
            class="flex-1"
            :disabled="loading"
            @keydown="handleKeydown"
          />
          <Button
            icon="pi pi-send"
            :loading="loading"
            :disabled="!inputText.trim()"
            @click="handleSend"
          />
        </div>

        <div class="chat-options">
          <SelectButton
            v-model="mode"
            :options="modeOptions"
            optionLabel="label"
            optionValue="value"
            size="small"
          />
          <Select
            v-model="model"
            :options="modelOptions"
            optionLabel="label"
            optionValue="value"
            size="small"
            class="model-select"
          />
        </div>
      </div>
    </div>
  </Drawer>
</template>

<style scoped>
.drawer-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 600;
}

.drawer-header i {
  color: var(--accent);
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.chat-bubble {
  max-width: 85%;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: 13px;
  line-height: 1.6;
}

.chat-bubble.user {
  align-self: flex-end;
  background: var(--accent);
  color: white;
  border-bottom-right-radius: var(--radius-sm);
}

.chat-bubble.assistant {
  align-self: flex-start;
  background: var(--bg-elevated);
  color: var(--text-primary);
  border-bottom-left-radius: var(--radius-sm);
}

.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  text-align: center;
}

.chat-empty i {
  font-size: 32px;
  margin-bottom: var(--space-3);
  opacity: 0.5;
}

.chat-empty p {
  margin: 0;
  font-size: 13px;
}

.chat-controls {
  padding: var(--space-4);
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.chat-input-row {
  display: flex;
  gap: var(--space-2);
}

.chat-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
}

.model-select {
  width: 100px;
}
</style>
