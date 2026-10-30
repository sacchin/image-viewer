// Copies the hooks in scripts/git-hooks into .git/hooks so they run locally.
// Hooks are never committed by git itself, so every clone runs this once.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(__dirname, 'git-hooks');

let gitDir;
try {
  gitDir = execSync('git rev-parse --git-dir', { cwd: repoRoot, encoding: 'utf8' }).trim();
} catch {
  console.error('install-git-hooks: not a git repository, nothing to do');
  process.exit(0);
}
const hooksDir = path.resolve(repoRoot, gitDir, 'hooks');
fs.mkdirSync(hooksDir, { recursive: true });

for (const name of fs.readdirSync(sourceDir)) {
  const src = path.join(sourceDir, name);
  const dest = path.join(hooksDir, name);
  fs.copyFileSync(src, dest);
  fs.chmodSync(dest, 0o755);
  console.log(`installed ${name} -> ${path.relative(repoRoot, dest)}`);
}

const termsFile = path.join(repoRoot, '.private-terms');
if (!fs.existsSync(termsFile)) {
  console.log('note: .private-terms not found; the hooks stay inactive until you create it (see .private-terms.example)');
}
