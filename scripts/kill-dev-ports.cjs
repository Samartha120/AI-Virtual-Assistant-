/* eslint-disable no-console */
const { execSync } = require('node:child_process');

const PORTS = [3000, 3001, 3002, 5001];

function collectListeningPids() {
  const byPort = new Map();
  for (const port of PORTS) byPort.set(port, new Set());

  let output = '';
  try {
    output = execSync('netstat -ano -p tcp', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  } catch {
    return byPort;
  }

  const lines = output.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('TCP')) continue;
    if (!/\sLISTENING\s/i.test(trimmed)) continue;

    // Example:
    // TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
    const parts = trimmed.split(/\s+/);
    const local = parts[1] || '';
    const state = parts[3] || '';
    const pidStr = parts[4] || '';
    if (!/LISTENING/i.test(state)) continue;

    const match = local.match(/:(\d+)$/);
    if (!match) continue;

    const port = Number(match[1]);
    if (!byPort.has(port)) continue;

    const pid = Number(pidStr);
    if (!Number.isFinite(pid) || pid <= 0) continue;

    byPort.get(port).add(pid);
  }

  return byPort;
}

function killPid(pid) {
  try {
    // /T ensures children are killed too (prevents orphaned Vite/nodemon)
    execSync(`taskkill /PID ${pid} /F /T`, { stdio: ['ignore', 'ignore', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

function main() {
  const byPort = collectListeningPids();

  const killed = [];
  for (const port of PORTS) {
    const pids = Array.from(byPort.get(port) || []);
    for (const pid of pids) {
      // Avoid killing system processes (PID 4/8). We don't expect these on our dev ports.
      if (pid === 4 || pid === 8) continue;
      if (killPid(pid)) killed.push({ port, pid });
    }
  }

  if (killed.length) {
    console.log('[dev] Freed ports:', killed.map((k) => `${k.port} (pid ${k.pid})`).join(', '));
  } else {
    console.log('[dev] Ports already free:', PORTS.join(', '));
  }
}

main();
