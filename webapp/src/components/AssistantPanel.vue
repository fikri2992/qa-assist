<script setup>
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from "vue";
import { useAppStore } from "../stores/app";
import { useChatStore } from "../stores/chat";
import { useSessionsStore } from "../stores/sessions";
import { storeToRefs } from "pinia";

const appStore = useAppStore();
const chatStore = useChatStore();
const sessionsStore = useSessionsStore();

const { assistantOpen } = storeToRefs(appStore);
const { messages, mode, model, loading } = storeToRefs(chatStore);
const { currentSession, logs, interactions, annotations, markers, analysis, artifacts } = storeToRefs(sessionsStore);

const inputText = ref("");
const messagesContainer = ref(null);
const textareaRef = ref(null);
const fileInputRef = ref(null);
const showModelDropdown = ref(false);
const showModeDropdown = ref(false);
const showMentionMenu = ref(false);
const mentionFilter = ref("");
const attachedResources = ref([]);
const attachedImages = ref([]);

// Close dropdowns when clicking outside
function closeDropdowns(e) {
  if (!e.target.closest('.mode-selector')) {
    showModeDropdown.value = false;
  }
  if (!e.target.closest('.model-selector')) {
    showModelDropdown.value = false;
  }
  if (!e.target.closest('.mention-menu') && !e.target.closest('textarea')) {
    showMentionMenu.value = false;
  }
}

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

// Available resources to mention (mock data for testing)
const availableResources = computed(() => {
  return [
    { id: "logs", label: "Logs", icon: "pi-list", count: 24, type: "logs" },
    { id: "events", label: "Interactions", icon: "pi-mouse", count: 18, type: "events" },
    { id: "annotations", label: "Annotations", icon: "pi-bookmark", count: 5, type: "annotations" },
    { id: "markers", label: "Markers", icon: "pi-flag", count: 3, type: "markers" },
    { id: "analysis", label: "Analysis", icon: "pi-chart-bar", count: 1, type: "analysis" },
    { id: "artifacts", label: "Artifacts", icon: "pi-download", count: 2, type: "artifacts" },
    { id: "environment", label: "Environment", icon: "pi-desktop", count: 1, type: "environment" },
    { id: "errors", label: "Errors", icon: "pi-exclamation-triangle", count: 7, type: "errors" },
  ];
});

const filteredResources = computed(() => {
  if (!mentionFilter.value) return availableResources.value;
  const filter = mentionFilter.value.toLowerCase();
  return availableResources.value.filter(r => r.label.toLowerCase().includes(filter));
});

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
  const resources = [...attachedResources.value];
  const images = [...attachedImages.value];
  inputText.value = "";
  attachedResources.value = [];
  attachedImages.value = [];
  await chatStore.sendMessage(text, resources, images);
}

function handleKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

function handleInput(e) {
  const value = e.target.value;
  const lastAtIndex = value.lastIndexOf("@");
  
  if (lastAtIndex !== -1) {
    const afterAt = value.slice(lastAtIndex + 1);
    // Check if we're in a mention context (no space after @)
    if (!afterAt.includes(" ")) {
      mentionFilter.value = afterAt;
      showMentionMenu.value = true;
      return;
    }
  }
  showMentionMenu.value = false;
  mentionFilter.value = "";
}

function selectResource(resource) {
  // Remove the @... from input
  const lastAtIndex = inputText.value.lastIndexOf("@");
  if (lastAtIndex !== -1) {
    inputText.value = inputText.value.slice(0, lastAtIndex);
  }
  
  // Add to attached resources if not already there
  if (!attachedResources.value.find(r => r.id === resource.id)) {
    attachedResources.value.push(resource);
  }
  
  showMentionMenu.value = false;
  mentionFilter.value = "";
  
  // Focus back on textarea
  nextTick(() => textareaRef.value?.focus());
}

function removeResource(resourceId) {
  attachedResources.value = attachedResources.value.filter(r => r.id !== resourceId);
}

function triggerImageUpload() {
  fileInputRef.value?.click();
}

function handleImageUpload(e) {
  const files = e.target.files;
  if (!files) return;
  
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        attachedImages.value.push({
          id: Date.now() + Math.random(),
          name: file.name,
          url: event.target.result
        });
      };
      reader.readAsDataURL(file);
    }
  }
  // Reset input
  e.target.value = '';
}

function removeImage(imageId) {
  attachedImages.value = attachedImages.value.filter(img => img.id !== imageId);
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
  nextTick(() => textareaRef.value?.focus());
}

// Lifecycle
onMounted(() => {
  document.addEventListener('click', closeDropdowns);
});

onUnmounted(() => {
  document.removeEventListener('click', closeDropdowns);
});
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

      <!-- Input Area -->
      <div class="input-area">
        <div class="input-box">
          <!-- Attached Resources & Images -->
          <div v-if="attachedResources.length || attachedImages.length" class="attachments">
            <div
              v-for="resource in attachedResources"
              :key="resource.id"
              class="resource-chip"
            >
              <i :class="['pi', resource.icon]"></i>
              <span>{{ resource.label }}</span>
              <button class="chip-remove" @click="removeResource(resource.id)">
                <i class="pi pi-times"></i>
              </button>
            </div>
            <div
              v-for="image in attachedImages"
              :key="image.id"
              class="image-chip"
            >
              <img :src="image.url" :alt="image.name" />
              <button class="chip-remove" @click="removeImage(image.id)">
                <i class="pi pi-times"></i>
              </button>
            </div>
          </div>

          <!-- Mention Menu -->
          <Transition name="dropdown">
            <div v-if="showMentionMenu && filteredResources.length" class="mention-menu">
              <div class="mention-header">Reference session data</div>
              <button
                v-for="resource in filteredResources"
                :key="resource.id"
                class="mention-option"
                @click="selectResource(resource)"
              >
                <i :class="['pi', resource.icon]"></i>
                <span class="mention-label">{{ resource.label }}</span>
                <span class="mention-count">{{ resource.count }}</span>
              </button>
            </div>
          </Transition>

          <textarea
            ref="textareaRef"
            v-model="inputText"
            placeholder="Ask about this session... (type @ to reference data)"
            :disabled="loading"
            rows="3"
            @keydown="handleKeydown"
            @input="handleInput"
          ></textarea>
          
          <div class="input-toolbar">
            <!-- Hidden file input -->
            <input
              ref="fileInputRef"
              type="file"
              accept="image/*"
              multiple
              hidden
              @change="handleImageUpload"
            />
            
            <!-- Left: Mode dropdown + Image upload -->
            <div class="toolbar-left">
              <button class="icon-btn" @click="triggerImageUpload" title="Attach image">
                <i class="pi pi-image"></i>
              </button>
              
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
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-surface);
}

.input-box {
  display: flex;
  flex-direction: column;
  position: relative;
}

/* Attached Resources */
.attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.resource-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  background: var(--accent-soft);
  border-radius: 4px;
  font-size: 10px;
  color: var(--accent);
}

.resource-chip i {
  font-size: 9px;
}

.image-chip {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  overflow: hidden;
}

.image-chip img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-chip .chip-remove {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 14px;
  height: 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.15s;
}

.image-chip:hover .chip-remove {
  opacity: 1;
}

.chip-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  margin-left: 1px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--accent);
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.15s;
}

.chip-remove:hover {
  opacity: 1;
}

.chip-remove i {
  font-size: 7px;
}

/* Mention Menu */
.mention-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  margin-bottom: 4px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 1001;
}

.mention-header {
  padding: 8px 12px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-subtle);
}

.mention-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s;
  text-align: left;
}

.mention-option:hover {
  background: var(--bg-hover);
}

.mention-option > .pi {
  font-size: 12px;
  color: var(--accent);
  width: 16px;
}

.mention-label {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}

.mention-count {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-elevated);
  padding: 2px 6px;
  border-radius: 4px;
}

.input-box textarea {
  width: 100%;
  padding: var(--space-3);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  background: var(--bg-base);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  line-height: 1.5;
  resize: none;
  outline: none;
  min-height: 80px;
  max-height: 150px;
  transition: border-color 0.15s;
  cursor: text;
}

.input-box textarea:focus {
  border-color: var(--accent);
}

.input-box textarea::placeholder {
  color: var(--text-muted);
}

.input-box textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Input Toolbar */
.input-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* Mode Selector */
.mode-selector {
  position: relative;
  z-index: 1000;
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.mode-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.mode-btn > .pi:first-child {
  font-size: 11px;
}

.mode-btn .pi-chevron-down {
  font-size: 8px;
  opacity: 0.5;
}

.mode-dropdown {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  width: 120px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 1001;
  padding: 4px;
}

.mode-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 4px;
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
  font-size: 11px;
  color: var(--text-muted);
}

.mode-option.active > .pi:first-child {
  color: var(--accent);
}

.mode-option .option-info {
  flex: 1;
}

.mode-option .option-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-primary);
}

.mode-option .option-desc {
  display: none;
}

.mode-option .check-icon {
  color: var(--accent);
  font-size: 9px;
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
