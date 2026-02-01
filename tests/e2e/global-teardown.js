const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const STATE_FILE = path.join(__dirname, '.e2e-state.json');

function killTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      // ignore
    }
  }
}

module.exports = async () => {
  if (process.env.QA_E2E_SKIP_SERVERS === '1') {
    return;
  }

  if (!fs.existsSync(STATE_FILE)) {
    return;
  }

  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  killTree(state.backendPid);
  killTree(state.aiPid);
  killTree(state.webappPid);

  fs.unlinkSync(STATE_FILE);
};
