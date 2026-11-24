import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.join(rootDir, 'frontend');
const nodeModulesDir = path.join(frontendDir, 'node_modules');
const cleanMarker = path.join(nodeModulesDir, '.tulusy-clean-v1');
const rootLockfile = path.join(rootDir, 'package-lock.json');
const oxideWasiDir = path.join(nodeModulesDir, '@tailwindcss', 'oxide-wasm32-wasi');

// Remove stray root package-lock.json so Next.js doesn't infer the wrong workspace root
try {
  if (fs.existsSync(rootLockfile)) {
    fs.unlinkSync(rootLockfile);
  }
} catch {
  // Ignore
}

// Perform a one-time clean wipe if node_modules hasn't been cleanly installed with this marker
if (fs.existsSync(nodeModulesDir) && !fs.existsSync(cleanMarker)) {
  console.log('[install-frontend] Performing one-time clean reset of frontend/node_modules...');
  try {
    fs.rmSync(nodeModulesDir, { recursive: true, force: true });
  } catch (cleanErr) {
    console.warn('[install-frontend] Could not fully wipe node_modules:', cleanErr.message);
  }
}

// Clear out any dangling symlink or broken path that causes npm's Arborist ENOENT lstat crashes
try {
  const stat = fs.lstatSync(oxideWasiDir);
  if (stat.isSymbolicLink()) {
    fs.unlinkSync(oxideWasiDir);
  }
} catch {
  // Path does not exist yet
}

// Ensure the directory exists so npm's Arborist lstat succeeds cleanly
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
  try {
    fs.mkdirSync(nodeModulesDir, { recursive: true });
    fs.writeFileSync(cleanMarker, 'ok\n');
  } catch {
    // Ignore marker write failure
  }
  console.log('[install-frontend] Frontend dependencies installed successfully.');
} catch (err) {
  console.warn('[install-frontend] Standard install failed. Cleaning frontend/node_modules and retrying...');

  try {
    if (fs.existsSync(nodeModulesDir)) {
      fs.rmSync(nodeModulesDir, { recursive: true, force: true });
    }
    fs.mkdirSync(oxideWasiDir, { recursive: true });
  } catch (cleanErr) {
    console.warn('[install-frontend] Cleanup warning:', cleanErr.message);
  }

  try {
    execSync('npm install --include=dev --no-audit --no-fund', {
      cwd: frontendDir,
      stdio: 'inherit',
      env: process.env,
    });
    try {
      fs.mkdirSync(nodeModulesDir, { recursive: true });
      fs.writeFileSync(cleanMarker, 'ok\n');
    } catch {
      // Ignore
    }
    console.log('[install-frontend] Frontend dependencies installed successfully on retry.');
  } catch (retryErr) {
    console.error('[install-frontend] Retry failed:', retryErr);
    process.exit(1);
  }
}
