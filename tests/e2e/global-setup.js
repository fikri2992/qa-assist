const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const BACKEND_DIR = path.join(ROOT, 'backend');
const STATE_FILE = path.join(__dirname, '.e2e-state.json');
const LOG_DIR = path.join(__dirname, '.logs');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function runSync(command, args, options = {}) {
  const result = spawnSync(command, args, {
    shell: true,
    stdio: 'inherit',
    ...options,
  });
  return result.status === 0;
}

async function waitForUrl(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // ignore
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timeout waiting for ${url}`);
}

function startProcess(name, command, args, options = {}) {
  ensureDir(LOG_DIR);
  const out = fs.openSync(path.join(LOG_DIR, `${name}.log`), 'a');
  const proc = spawn(command, args, {
    shell: true,
    stdio: ['ignore', out, out],
    ...options,
  });
  return proc;
}

module.exports = async () => {
  if (process.env.QA_E2E_SKIP_SERVERS === '1') {
    return;
  }

  ensureDir(LOG_DIR);

  // Ensure backend database exists and is migrated.
  runSync('mix', ['ecto.create'], { cwd: BACKEND_DIR });
  runSync('mix', ['ecto.migrate'], { cwd: BACKEND_DIR });

  const backendEnv = {
    ...process.env,
    AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000',
    PORT: process.env.QA_BACKEND_PORT || '4000',
  };

  const backend = startProcess('backend', 'mix', ['phx.server'], {
    cwd: BACKEND_DIR,
    env: backendEnv,
  });

  const aiEnv = {
    ...process.env,
    ADK_ENABLED: 'false',
    PYTHONUNBUFFERED: '1',
  };

  const ai = startProcess('ai', 'python', ['-m', 'uvicorn', 'ai.app.main:app', '--host', '127.0.0.1', '--port', '8000'], {
    cwd: ROOT,
    env: aiEnv,
  });

  await waitForUrl('http://127.0.0.1:4000/');
  await waitForUrl('http://127.0.0.1:8000/health');

  const state = {
    backendPid: backend.pid,
    aiPid: ai.pid,
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
};
