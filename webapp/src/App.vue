<script setup>
import { onMounted } from "vue";
import { initApp } from "./app";

onMounted(() => {
  initApp();
});
</script>

<template>
  <div class="app-shell">
    <!-- Sidebar -->
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sidebar-header">
        <div class="logo">
          <span class="logo-icon">◈</span>
          <span class="logo-text">QA Assist</span>
        </div>
        <button id="collapseSidebar" class="btn-icon collapse-btn" title="Collapse sidebar">
          <span class="collapse-icon">‹</span>
        </button>
      </div>

      <div class="sidebar-section">
        <div class="section-label">Connection</div>
        <input
          id="apiBase"
          type="text"
          placeholder="http://localhost:4000/api"
          class="input-field"
        />
        <input
          id="deviceId"
          type="text"
          placeholder="Device UUID"
          class="input-field"
        />
        <button id="loadSessions" class="btn-primary">
          <span class="btn-text">Load Sessions</span>
          <span class="btn-icon-only">↻</span>
        </button>
      </div>

      <div class="sidebar-section flex-1">
        <div class="section-label">Sessions</div>
        <ul id="sessionList" class="session-list"></ul>
      </div>
    </aside>

    <!-- Collapsed Sidebar Rail -->
    <div id="sidebarRail" class="sidebar-rail">
      <button id="expandSidebar" class="rail-btn" title="Expand sidebar">
        <span class="logo-icon">◈</span>
      </button>
    </div>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Top Bar -->
      <header class="top-bar">
        <div class="session-info">
          <h1 id="sessionTitle" class="session-title">Select a session</h1>
          <span id="sessionMeta" class="session-meta"></span>
        </div>
        <div class="session-actions">
          <span id="sessionStatus" class="status-badge"></span>
          <button id="toggleTheme" class="btn-icon" title="Toggle theme">
            <span class="theme-icon">◐</span>
          </button>
          <button id="toggleAssistant" class="btn-icon-label" title="AI Assistant">
            <span>✦</span>
            Assistant
          </button>
        </div>
      </header>

      <!-- Video Section -->
      <section class="video-section">
        <div class="video-container">
          <video id="videoPlayer" controls playsinline class="video-player"></video>
          <div id="annotationOverlay" class="annotation-overlay"></div>
        </div>

        <!-- Timeline -->
        <div class="timeline-container">
          <div id="timelineTrack" class="timeline-track"></div>
          <div id="timelinePins" class="timeline-pins"></div>
        </div>

        <!-- Chunk Pills -->
        <div id="chunkList" class="chunk-list"></div>
      </section>

      <!-- Tabbed Content -->
      <section class="tabs-section">
        <div class="tabs-nav">
          <button class="tab-btn active" data-tab="analysis">
            <span class="tab-icon">📊</span>
            Analysis
            <span id="issueCount" class="tab-badge">0</span>
          </button>
          <button class="tab-btn" data-tab="events">
            <span class="tab-icon">👆</span>
            Interactions
          </button>
          <button class="tab-btn" data-tab="logs">
            <span class="tab-icon">📋</span>
            Logs
          </button>
          <button class="tab-btn" data-tab="annotations">
            <span class="tab-icon">📌</span>
            Annotations
            <span id="annotationCount" class="tab-badge">0</span>
          </button>
          <button class="tab-btn" data-tab="markers">
            <span class="tab-icon">🚩</span>
            Markers
            <span id="markerCount" class="tab-badge">0</span>
          </button>
          <button class="tab-btn" data-tab="environment">
            <span class="tab-icon">💻</span>
            Environment
          </button>
          <button class="tab-btn" data-tab="artifacts">
            <span class="tab-icon">📦</span>
            Artifacts
          </button>
        </div>

        <div class="tabs-content">
          <!-- Analysis Tab -->
          <div id="tab-analysis" class="tab-panel active">
            <div class="analysis-header">
              <div class="analysis-summary">
                <span id="analysisStatus" class="status-chip">pending</span>
                <p id="analysisSummary" class="summary-text">No analysis available yet.</p>
              </div>
              <div id="analysisBadges" class="severity-badges"></div>
            </div>
            <div id="analysisIssues" class="issues-grid"></div>
            <details class="raw-data">
              <summary>Raw Report</summary>
              <pre id="analysisReport" class="code-block"></pre>
            </details>
            <div class="autonomy-section">
              <h3 class="subsection-title">Agent Timeline</h3>
              <div id="autonomyList" class="autonomy-list"></div>
            </div>
          </div>

          <!-- Events Tab -->
          <div id="tab-events" class="tab-panel">
            <div id="eventPane" class="events-list"></div>
          </div>

          <!-- Logs Tab -->
          <div id="tab-logs" class="tab-panel">
            <pre id="logPane" class="code-block"></pre>
          </div>

          <!-- Annotations Tab -->
          <div id="tab-annotations" class="tab-panel">
            <div id="annotationList" class="cards-grid"></div>
          </div>

          <!-- Markers Tab -->
          <div id="tab-markers" class="tab-panel">
            <div id="markerList" class="cards-grid"></div>
          </div>

          <!-- Environment Tab -->
          <div id="tab-environment" class="tab-panel">
            <div id="envPane" class="env-grid"></div>
          </div>

          <!-- Artifacts Tab -->
          <div id="tab-artifacts" class="tab-panel">
            <div id="artifactList" class="cards-grid"></div>
          </div>
        </div>
      </section>
    </main>

    <!-- AI Assistant Panel -->
    <aside id="assistantPanel" class="assistant-panel">
      <div class="assistant-header">
        <h2 class="assistant-title">Assistant</h2>
        <button id="closeAssistant" class="btn-icon">✕</button>
      </div>

      <div id="chatList" class="chat-messages"></div>

      <div class="chat-controls">
        <div class="chat-input-wrapper">
          <input
            id="chatInput"
            type="text"
            placeholder="Ask about this session..."
            class="chat-input"
          />
          <button id="chatSend" class="btn-send">↑</button>
        </div>

        <div class="chat-options">
          <div class="chat-mode-pills">
            <button class="mode-pill active" data-mode="investigate">Investigate</button>
            <button class="mode-pill" data-mode="summarize">Summarize</button>
            <button class="mode-pill" data-mode="triage">Triage</button>
          </div>
          <div class="chat-model-select">
            <select id="chatModel" class="model-dropdown">
              <option value="default">Auto</option>
              <option value="gemini-3-flash">Flash</option>
              <option value="gemini-3-pro-preview">Pro</option>
            </select>
            <button id="chatStop" class="btn-stop" disabled>Stop</button>
          </div>
        </div>

        <!-- Hidden select for JS compatibility -->
        <select id="chatMode" style="display: none;">
          <option value="investigate">Investigate</option>
          <option value="summarize">Summarize</option>
          <option value="triage">Triage</option>
        </select>
      </div>
    </aside>
  </div>
</template>
