// Boots the Firestore emulator + Vite dev server together, both pointed only
// at local emulator data — for trying changes locally before anything is
// proposed for deploy, without ever touching the live production Firebase
// project. Ctrl+C stops both.
import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

const JAVA_HOME = path.join(os.homedir(), '.cache', 'justdosa-e2e', 'jdk-21.0.12+8', 'Contents', 'Home');
const PATH_WITH_JAVA = `${path.join(JAVA_HOME, 'bin')}:${process.env.PATH}`;

const children = [];

function spawnChild(name, command, args, env) {
  const child = spawn(command, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  children.push(child);
  child.on('exit', (code) => {
    console.log(`[${name}] exited with code ${code}`);
    // If either process dies, tear down the other so this script doesn't hang.
    children.forEach((c) => { if (c !== child && !c.killed) c.kill('SIGTERM'); });
  });
  return child;
}

function shutdown() {
  children.forEach((c) => { if (!c.killed) c.kill('SIGTERM'); });
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('Starting Firestore emulator (local data only, never production)...');
spawnChild('firestore-emulator', 'npx', ['firebase', 'emulators:start', '--only', 'firestore', '--project', 'just-dosa'], {
  JAVA_HOME,
  PATH: PATH_WITH_JAVA,
});

// Give the emulator a moment to bind its port before Vite starts making
// Firestore connections against it.
setTimeout(() => {
  console.log('Starting Vite dev server against the Firestore emulator...');
  spawnChild('vite', 'npx', ['vite', '--port=3000', '--host=0.0.0.0'], {
    VITE_USE_FIRESTORE_EMULATOR: 'true',
  });
}, 4000);
