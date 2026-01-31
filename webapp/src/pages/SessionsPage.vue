<script setup>
import { useSessionsStore } from "../stores/sessions";
import { storeToRefs } from "pinia";

const sessionsStore = useSessionsStore();
const { sessions, loading } = storeToRefs(sessionsStore);
</script>

<template>
  <div class="welcome-page">
    <div class="welcome-content">
      <div v-if="loading" class="loading-state">
        <i class="pi pi-spin pi-spinner"></i>
        <span>Loading sessions...</span>
      </div>
      <template v-else>
        <div class="welcome-icon">
          <i class="pi pi-box"></i>
        </div>
        <h1>Welcome to QA Assist</h1>
        <p class="welcome-desc">
          Capture, annotate, and analyze your QA sessions with AI-powered insights.
        </p>
        
        <div class="features">
          <div class="feature">
            <i class="pi pi-video"></i>
            <span>Session Recording</span>
          </div>
          <div class="feature">
            <i class="pi pi-chart-bar"></i>
            <span>AI Analysis</span>
          </div>
          <div class="feature">
            <i class="pi pi-comments"></i>
            <span>Smart Assistant</span>
          </div>
        </div>

        <p v-if="sessions.length" class="session-hint">
          <i class="pi pi-check-circle"></i>
          {{ sessions.length }} session(s) available. Select one from the sidebar.
        </p>
        <p v-else class="session-hint muted">
          <i class="pi pi-arrow-left"></i>
          Enter your API details and load sessions to get started.
        </p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.welcome-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: var(--space-6);
  background: var(--bg-base);
}

.welcome-content {
  text-align: center;
  max-width: 480px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  color: var(--text-muted);
}

.loading-state i {
  font-size: 32px;
  color: var(--accent);
}

.welcome-icon {
  width: 80px;
  height: 80px;
  border-radius: 20px;
  background: linear-gradient(135deg, var(--accent) 0%, #f59e0b 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto var(--space-5);
  box-shadow: 0 8px 32px rgba(249, 115, 22, 0.25);
}

.welcome-icon i {
  font-size: 36px;
  color: white;
}

.welcome-content h1 {
  margin: 0 0 var(--space-3);
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
}

.welcome-desc {
  margin: 0 0 var(--space-6);
  font-size: 15px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.features {
  display: flex;
  justify-content: center;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.feature {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  min-width: 120px;
}

.feature i {
  font-size: 24px;
  color: var(--accent);
}

.feature span {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.session-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-3) var(--space-4);
  background: rgba(34, 197, 94, 0.1);
  border-radius: 10px;
  font-size: 13px;
  color: #22c55e;
}

.session-hint.muted {
  background: var(--bg-surface);
  color: var(--text-muted);
}

.session-hint i {
  font-size: 16px;
}
</style>
