<script setup>
import { ref, watch, nextTick, computed } from "vue";
import { useAppStore } from "../stores/app";
import { useChatStore } from "../stores/chat";
import { useSessionsStore } from "../stores/sessions";
import { storeToRefs } from "pinia";

const appStore = useAppStore();
const chatStore = useChatStore();
const sessionsStore = useSessionsStore();

const { assistantOpen } = storeToRefs(appStore);
const { messages, mode, model, loading } = storeToRefs(chatStore);
const { currentSession } = storeToRefs(sessionsStore);

const inputText = ref("");
const messagesContainer = ref(null);
const showModelDropdown = ref(false);
const showModeDropdown = ref(false);

const modes = [
  { value: "investigate", label: "Investigate", icon: "pi-search", desc: "Deep dive into issues" },
  { value: "summarize", label: "Summarize", icon: "pi-align-left", desc: "Quick overview" },
  { value: "triage", label: "Triage", icon: "pi-filter", desc: "Prioritize issues" },
];

const currentMode = computed(() => modes.find(m => m.value === mode.value) || modes[0]);

const models = [
  { value: "default", label: "Auto", desc: "Best for most tasks" },
  { value: "gemini-3-flash", label: "Flash", desc: "Fast responses" },
  { value: "gemini-3-pro-preview", label: "Pro", desc: "Complex reasoning" },
];

const currentModel = computed(() => models.find(m => m.value === model.value) || models[0]);

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
    chatStore.addMessage("assistant", "I can help you investigate this session. Ask me about logs, UI issues, errors, or how to reproduce bugs.");
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

function selectModel(m) {
  model.value = m.value;
  showModelDropdown.value = false;
}

function selectMode(m) {
  chatStore.setMode(m.value);
  showModeDropdown.value = false;
}

function useSuggestion(text) {
  inputText.value = text;
}
</script>

<template>
  <Transition name="slide">
    <aside v-if="assistantOpen" class="assistant-panel">
      <!-- Header -->
      <div class="panel-header">
        <div class="header-left">
          <div class="header-icon">
            <i class="pi pi-sparkles"></i>
          </div>
          <div class="header-info">
            <h2>Assistant</h2>
            <span class="header-status">
              <span class="status-dot" :class="{ active: currentSession }"></span>
              {{ currentSession ? 'Ready' : 'No session' }}
            </span>
          </div>
        </div>
        <button class="close-btn" @click="appStore.toggleAssistant">
          <i class="pi pi-times"></i>
        </button>
      </div>

      <!-- Messages -->
      <div ref="messagesContainer" class="messages-area">
        <!-- Empty State -->
        <div v-if="!messages.length" class="empty-state">
          <div class="empty-icon">
            <i class="pi pi-comments"></i>
          </div>
          <h3>How can I help?</h3>
          <p>Ask me anything about this session</p>
          
          <div class="quick-actions">
            <button class="quick-btn" @click="useSuggestion('What errors occurred?')">
              <i class="pi pi-exclamation-triangle"></i>
              Find errors
            </button>
            <button class="quick-btn" @click="useSuggestion('Summarize this session')">
              <i class="pi pi-file-edit"></i>
              Summarize
            </button>
            <button class="quick-btn" @click="useSuggestion('How to reproduce this bug?')">
              <i class="pi pi-replay"></i>
              Repro steps
            </button>
            <button class="quick-btn" @click="useSuggestion('What user actions led to this?')">
              <i class="pi pi-user"></i>
              User journey
            </button>
          </div>
        </div>

        <!-- Messages -->
        <template v-else>
          <div
            v-for="(msg, i) in messages"
            :key="i"
            class="message"
            :class="msg.role"
          >
            <div class="msg-avatar">
              <i :class="msg.role === 'user' ? 'pi pi-user' : 'pi pi-sparkles'"></i>
            </div>
            <div class="msg-body">
              <span class="msg-role">{{ msg.role === 'user' ? 'You' : 'Assistant' }}</span>
              <div class="msg-text">{{ msg.text }}</div>
            </div>
          </div>

          <!-- Typing indicator -->
          <div v-if="loading" class="message assistant">
            <div class="msg-avatar">
              <i class="pi pi-sparkles"></i>
            </div>
            <div class="msg-body">
              <div class="typing">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Input Area - All controls grouped here -->
      <div class="input-area">
        <!-- Main input box -->
        <div class="input-box" :class="{ focused: inputText, disabled: !currentSession }">
          <textarea
            v-model="inputText"
            placeholder="Ask about this session..."
            :disabled="loading || !currentSession"
            rows="1"
            @keydown="handleKeydown"
          ></textarea>
          
          <!-- Bottom toolbar -->
            <div class="input-toolbar">
            <!-- Left: Mode dropdown -->
            <div class="toolbar-left">
              <div class="mode-selector" @click.stop>
                <button class="mode-btn" @click="showModeDropdown = !showModeDropdown">
                  <i :class="['pi', currentMode.icon]"></i>
                  <span>{{ currentMode.label }}</span>
                  <i class="pi pi-chevron-down"></i>
                </button>
                
                <Transition name="dropdown">
                  <div v-if="showModeDropdown" class="mode-dropdown">
                    <button
                      v-for="m in modes"
                      :key="m.value"
                      class="mode-option"
                      :class="{ active: mode === m.value }"
                      @click="selectMode(m)"
                    >
                      <i :class="['pi', m.icon]"></i>
                      <div class="option-info">
                        <span class="option-label">{{ m.label }}</span>
                        <span class="option-desc">{{ m.desc }}</span>
                      </div>
                      <i v-if="mode === m.value" class="pi pi-check check-icon"></i>
                    </button>
                  </div>
                </Transition>
              </div>
            </div>

            <!-- Right: Model selector + Send -->
            <div class="toolbar-right">
              <!-- Model selector -->
              <div class="model-selector" @click.stop>
                <button class="model-btn" @click="showModelDropdown = !showModelDropdown">
                  <i class="pi pi-microchip"></i>
                  <span>{{ currentModel.label }}</span>
                  <i class="pi pi-chevron-down"></i>
                </button>
                
                <Transition name="dropdown">
                  <div v-if="showModelDropdown" class="model-dropdown">
                    <button
                      v-for="m in models"
                      :key="m.value"
                      class="model-option"
                      :class="{ active: model === m.value }"
                      @click="selectModel(m)"
                    >
                      <div class="option-info">
                        <span class="option-label">{{ m.label }}</span>
                        <span class="option-desc">{{ m.desc }}</span>
                      </div>
                      <i v-if="model === m.value" class="pi pi-check"></i>
                    </button>
                  </div>
                </Transition>
              </div>

              <!-- Send button -->
              <button
                class="send-btn"
                :disabled="loading || !inputText.trim() || !currentSession"
                @click="handleSend"
              >
                <i v-if="loading" class="pi pi-spin pi-spinner"></i>
                <i v-else class="pi pi-arrow-up"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </Transition>

  <!-- Click outside to close dropdowns -->
  <div v-if="showModelDropdown || showModeDropdown" class="backdrop" @click="showModelDropdown = false; showModeDropdown = false"></div>
</template>

<style scoped>
.assistant-panel {
  position: fixed;
  right: 0;
  top: 0;
  width: 420px;
  height: 100vh;
  background: var(--bg-surface);
  border-left: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  z-index: 100;
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.12);
}

/* Transitions */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.backdrop {
  position: fixed;
  inset: 0;
  z-index: 99;
}

/* Header */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-base);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.header-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--accent) 0%, #fb923c 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
}

.header-info h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.header-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
}

.status-dot.active {
  background: #22c55e;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* Messages Area */
.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: var(--space-4);
}

.empty-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: var(--bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-4);
}

.empty-icon i {
  font-size: 24px;
  color: var(--text-muted);
}

.empty-state h3 {
  margin: 0 0 var(--space-1);
  font-size: 16px;
  font-weight: 600;
}

.empty-state > p {
  margin: 0 0 var(--space-5);
  font-size: 13px;
  color: var(--text-muted);
}

.quick-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
  width: 100%;
}

.quick-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  background: var(--bg-base);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.quick-btn:hover {
  background: var(--bg-hover);
  border-color: var(--accent);
  color: var(--text-primary);
}

.quick-btn i {
  font-size: 14px;
  color: var(--accent);
}

/* Messages */
.message {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.msg-avatar {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.msg-avatar i {
  font-size: 12px;
  color: var(--text-muted);
}

.message.assistant .msg-avatar {
  background: linear-gradient(135deg, var(--accent) 0%, #fb923c 100%);
}

.message.assistant .msg-avatar i {
  color: white;
}

.msg-body {
  flex: 1;
  min-width: 0;
}

.msg-role {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.msg-text {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
}

/* Typing indicator */
.typing {
  display: flex;
  gap: 4px;
}

.typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
  animation: bounce 1.4s infinite ease-in-out;
}

.typing span:nth-child(2) { animation-delay: 0.16s; }
.typing span:nth-child(3) { animation-delay: 0.32s; }

@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-6px); }
}

/* Input Area */
.input-area {
  padding: var(--space-4);
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-base);
}

.input-box {
  border: 1px solid var(--border-default);
  border-radius: 16px;
  background: var(--bg-surface);
  overflow: hidden;
  transition: all 0.15s;
}

.input-box.focused {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.input-box.disabled {
  opacity: 0.6;
}

.input-box textarea {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  min-height: 44px;
  max-height: 120px;
}

.input-box textarea::placeholder {
  color: var(--text-muted);
}

/* Input Toolbar */
.input-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-base);
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* Mode Selector */
.mode-selector {
  position: relative;
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.mode-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.mode-btn .pi-chevron-down {
  font-size: 10px;
  opacity: 0.6;
}

.mode-dropdown {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 8px;
  min-width: 200px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 10;
}

.mode-option {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3);
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s;
  text-align: left;
}

.mode-option:hover {
  background: var(--bg-hover);
}

.mode-option.active {
  background: var(--accent-soft);
}

.mode-option > .pi:first-child {
  font-size: 14px;
  color: var(--text-muted);
  width: 20px;
  text-align: center;
}

.mode-option.active > .pi:first-child {
  color: var(--accent);
}

.mode-option .check-icon {
  color: var(--accent);
  font-size: 12px;
  margin-left: auto;
}

/* Model Selector */
.model-selector {
  position: relative;
}

.model-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.model-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.model-btn .pi-chevron-down {
  font-size: 10px;
  opacity: 0.6;
}

.model-dropdown {
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: 8px;
  min-width: 180px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 10;
}

.model-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--space-3);
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s;
  text-align: left;
}

.model-option:hover {
  background: var(--bg-hover);
}

.model-option.active {
  background: var(--accent-soft);
}

.option-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.option-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.option-desc {
  font-size: 11px;
  color: var(--text-muted);
}

.model-option .pi-check {
  color: var(--accent);
  font-size: 12px;
}

/* Send Button */
.send-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: none;
  background: var(--accent);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.send-btn:hover:not(:disabled) {
  background: var(--accent-hover);
  transform: scale(1.05);
}

.send-btn:disabled {
  background: var(--bg-elevated);
  color: var(--text-muted);
  cursor: not-allowed;
}

.send-btn i {
  font-size: 14px;
}

/* Helper Text */
.helper-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  margin: var(--space-2) 0 0;
  font-size: 11px;
  color: var(--text-muted);
}

.helper-text.muted {
  opacity: 0.7;
}

.helper-text kbd {
  padding: 2px 6px;
  background: var(--bg-elevated);
  border-radius: 4px;
  font-family: inherit;
  font-size: 10px;
}
</style>
