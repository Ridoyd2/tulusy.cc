import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.join(rootDir, 'frontend');
const oxideWasiDir = path.join(frontendDir, 'node_modules', '@tailwindcss', 'oxide-wasm32-wasi');

// Clear out any dangling symlink or broken path that causes npm's Arborist ENOENT lstat crashes
try {
  const stat = fs.lstatSync(oxideWasiDir);
  if (stat.isSymbolicLink()) {
    fs.unlinkSync(oxideWasiDir);
  }
} catch {
  // Path does not exist yet or cannot be lstated
}

// Ensure the directory exists so npm's Arborist find/lstat succeeds cleanly
try {
  fs.mkdirSync(oxideWasiDir, { recursive: true });
} catch {
  // Ignore
}

console.log('[install-frontend] Installing frontend dependencies...');

try {
  execSync('npm install --include=dev --no-audit --no-fund', {
    cwd: frontendDir,
    stdio: 'inherit',
    env: process.env,
  });
  console.log('[install-frontend] Frontend dependencies installed successfully.');
} catch (err) {
  console.warn('[install-frontend] Standard install failed. Cleaning @tailwindcss optional cache and retrying...');

  // Clean potentially broken optional platform bindings
  try {
    const tailwindDir = path.join(frontendDir, 'node_modules', '@tailwindcss');
    if (fs.existsSync(tailwindDir)) {
      fs.rmSync(tailwindDir, { recursive: true, force: true });
    }
    // Re-create dummy wasi dir
    fs.mkdirSync(oxideWasiDir, { recursive: true });
  } catch (cleanErr) {
    console.warn('[install-frontend] Cleanup warning:', cleanErr.message);
  }

  // Retry install
  try {
    execSync('npm install --include=dev --no-audit --no-fund', {
      cwd: frontendDir,
      stdio: 'inherit',
      env: process.env,
    });
    console.log('[install-frontend] Frontend dependencies installed successfully on retry.');
  } catch (retryErr) {
    console.error('[install-frontend] Retry failed:', retryErr);
    process.exit(1);
  }
}
