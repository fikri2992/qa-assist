<script setup>
import { ref } from "vue";
import { useSessionsStore } from "../stores/sessions";
import { storeToRefs } from "pinia";

const sessionsStore = useSessionsStore();
const { sessions, loading, error, authEmail, isAuthenticated } = storeToRefs(sessionsStore);

const email = ref(authEmail.value || "");
const password = ref("");

function handleLogin() {
  sessionsStore.login(email.value, password.value);
}

function handleLogout() {
  sessionsStore.logout();
}
</script>

<template>
  <div class="welcome-page">
    <div class="welcome-content">
      <div v-if="!isAuthenticated" class="login-panel">
        <div class="welcome-icon">
          <i class="pi pi-lock"></i>
        </div>
        <h1>Sign in</h1>
        <p class="welcome-desc">
          Use your QA Assist account to load recorded sessions.
        </p>

        <div class="login-form">
          <label>
            Email
            <input v-model="email" type="email" placeholder="demo@qaassist.local" />
          </label>
          <label>
            Password
            <input v-model="password" type="password" placeholder="••••••••" />
          </label>
          <button class="login-btn" @click="handleLogin">Login</button>
        </div>

        <p v-if="error" class="error-text">{{ error }}</p>
      </div>

      <template v-else>
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

          <button class="logout-btn" @click="handleLogout">Logout</button>
        </template>
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

.login-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  align-items: center;
}

.login-form {
  width: 100%;
  display: grid;
  gap: var(--space-3);
  text-align: left;
}

.login-form label {
  display: grid;
  gap: var(--space-2);
  font-size: 12px;
  color: var(--text-secondary);
}

.login-form input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  color: var(--text-primary);
}

.login-btn,
.logout-btn {
  margin-top: var(--space-2);
  padding: 10px 16px;
  border-radius: 10px;
  border: none;
  background: var(--accent);
  color: white;
  font-weight: 600;
  cursor: pointer;
}

.logout-btn {
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}

.error-text {
  color: #ef4444;
  font-size: 12px;
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
