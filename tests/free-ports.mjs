// Frees the ports the E2E harness uses before each run. The Firestore
// emulator's underlying Java process can be orphaned if a previous test run
// was killed abruptly (e.g. a timed-out CI job), which then blocks the next
// run with "port taken". This makes `npm run test:e2e` self-healing.
import { execSync } from 'node:child_process';

const PORTS = [8080, 4000, 3100, 4400, 4500, 9150];

try {
  const pids = execSync(`lsof -ti:${PORTS.join(',')}`, { stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim()
    .split('\n')
    .filter(Boolean);
  for (const pid of pids) {
    try {
      process.kill(Number(pid), 'SIGKILL');
      console.log(`Freed stale process on test port (pid ${pid})`);
    } catch {
      // already gone
    }
  }
} catch {
  // lsof found nothing using these ports — nothing to clean up.
}
