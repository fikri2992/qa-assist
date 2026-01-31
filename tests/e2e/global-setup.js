const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');
const net = require('net');

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

async function waitForUrl(url, timeoutMs = 60000) {
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
  const logPath = path.join(LOG_DIR, `${name}.log`);
  fs.writeFileSync(logPath, '');
  const out = fs.openSync(logPath, 'a');
  const procCommand = process.platform === 'win32' ? 'cmd' : command;
  const procArgs =
    process.platform === 'win32' ? ['/c', command, ...args] : args;
  const proc = spawn(procCommand, procArgs, {
    shell: false,
    stdio: ['ignore', out, out],
    ...options,
  });
  return proc;
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

function pickRandomPort() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function resolvePort(preferred) {
  if (preferred && Number.isFinite(preferred)) {
    const free = await isPortFree(preferred);
    if (!free) {
      throw new Error(`Port ${preferred} is already in use`);
    }
    return preferred;
  }
  return pickRandomPort();
}

module.exports = async () => {
  if (process.env.QA_E2E_SKIP_SERVERS === '1') {
    return;
  }

  ensureDir(LOG_DIR);

  // Ensure backend database exists and is migrated.
  runSync('mix', ['ecto.create'], { cwd: BACKEND_DIR });
  const migrated = runSync('mix', ['ecto.migrate'], { cwd: BACKEND_DIR });
  if (!migrated) {
    throw new Error('mix ecto.migrate failed');
  }
  runSync('mix', ['run', 'priv/repo/seeds.exs'], { cwd: BACKEND_DIR });

  const backendPort = await resolvePort(
    process.env.QA_BACKEND_PORT ? Number(process.env.QA_BACKEND_PORT) : null
  );
  const aiPort = await resolvePort(
    process.env.QA_AI_PORT ? Number(process.env.QA_AI_PORT) : null
  );

  const backendEnv = {
    ...process.env,
    AI_SERVICE_URL: process.env.AI_SERVICE_URL || `http://127.0.0.1:${aiPort}`,
    PORT: String(backendPort),
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

  const ai = startProcess('ai', 'python', ['-m', 'uvicorn', 'ai.app.main:app', '--host', '127.0.0.1', '--port', String(aiPort)], {
    cwd: ROOT,
    env: aiEnv,
  });

  await waitForUrl(`http://127.0.0.1:${backendPort}/`);
  await waitForUrl(`http://127.0.0.1:${aiPort}/health`);

  const state = {
    backendPid: backend.pid,
    aiPid: ai.pid,
    backendPort,
    aiPort,
    apiBase: `http://127.0.0.1:${backendPort}/api`,
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
};
