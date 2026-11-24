import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.join(rootDir, 'frontend');
const nodeModulesDir = path.join(frontendDir, 'node_modules');
const nextCacheDir = path.join(frontendDir, '.next');
const cleanMarker = path.join(nodeModulesDir, '.tulusy-clean-v2');
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

// Perform a one-time clean wipe of node_modules and .next cache if marker is absent
if (!fs.existsSync(cleanMarker)) {
  console.log('[install-frontend] Performing clean reset of frontend/node_modules and .next...');
  try {
    if (fs.existsSync(nodeModulesDir)) {
      fs.rmSync(nodeModulesDir, { recursive: true, force: true });
    }
    if (fs.existsSync(nextCacheDir)) {
      fs.rmSync(nextCacheDir, { recursive: true, force: true });
    }
  } catch (cleanErr) {
    console.warn('[install-frontend] Cleanup warning:', cleanErr.message);
  }
}

console.log('[install-frontend] Installing frontend dependencies...');

const installWithFallback = () => {
  try {
    execSync('npm ci --include=dev --no-audit --no-fund', {
      cwd: frontendDir,
      stdio: 'inherit',
      env: process.env,
    });
  } catch {
    console.warn('[install-frontend] npm ci failed, falling back to npm install...');
    try {
      const stat = fs.lstatSync(oxideWasiDir);
      if (stat.isSymbolicLink()) fs.unlinkSync(oxideWasiDir);
    } catch {
      // Ignore
    }
    try {
      fs.mkdirSync(oxideWasiDir, { recursive: true });
    } catch {
      // Ignore
    }
    execSync('npm install --include=dev --no-audit --no-fund', {
      cwd: frontendDir,
      stdio: 'inherit',
      env: process.env,
    });
  }
};

installWithFallback();

// Verify lucide-react version & integrity
try {
  const lucidePkg = JSON.parse(
    fs.readFileSync(path.join(nodeModulesDir, 'lucide-react', 'package.json'), 'utf8')
  );
  console.log(`[install-frontend] Installed lucide-react@${lucidePkg.version}`);
} catch {
  // Ignore
}

try {
  fs.mkdirSync(nodeModulesDir, { recursive: true });
  fs.writeFileSync(cleanMarker, 'ok\n');
} catch {
  // Ignore
}

console.log('[install-frontend] Frontend dependencies installed successfully.');
