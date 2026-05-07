import { exec } from 'node:child_process';

// eslint-disable-next-line no-promise-executor-return
const run = (cmd) => new Promise((resolve, reject) => exec(
  cmd,
  (error, stdout) => {
    if (error) reject(error);
    else resolve(stdout);
  },
));

const changeset = await run('git diff --cached --name-only --diff-filter=ACMR');
const modifiedFiles = changeset.split('\n').filter(Boolean);

// check if there are any model files staged
const modifledPartials = modifiedFiles.filter((file) => file.match(/(^|\/)_.*.json/));
if (modifledPartials.length > 0) {
  const output = await run('npm run build:json --silent');
  // eslint-disable-next-line no-console
  console.log(output);
  await run('git add component-models.json component-definition.json component-filters.json');
}

// SET-03: enforce no-Publish constraint by scanning staged runtime-code files
// for any reference to an AEM Cloud publish hostname. Skip docs/planning/config dirs.
const PUBLISH_HOST_RE = /publish-[A-Za-z0-9-]+\.adobeaemcloud\.com/;

const isRuntimeCodePath = (file) => {
  // Allowlist of runtime-code paths per D-05.
  if (file.startsWith('blocks/')) return true;
  if (file.startsWith('scripts/')) return true;
  // Top-level *.html / *.json only (no nested config — those are skipped).
  if (!file.includes('/')) {
    if (file.endsWith('.html')) return true;
    if (file.endsWith('.json')) return true;
  }
  return false;
};

const violations = [];
const runtimeFiles = modifiedFiles.filter(isRuntimeCodePath);
// eslint-disable-next-line no-restricted-syntax
for (const file of runtimeFiles) {
  // Read STAGED content (not working-tree content) so the guard reflects
  // exactly what is about to be committed.
  let staged = null;
  try {
    // eslint-disable-next-line no-await-in-loop
    staged = await run(`git show :${file}`);
  } catch {
    // File staged for deletion or unreadable — nothing to scan.
    staged = null;
  }
  if (staged !== null) {
    const lines = staged.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const match = lines[i].match(PUBLISH_HOST_RE);
      if (match) {
        violations.push({ file, line: i + 1, match: match[0] });
      }
    }
  }
}

if (violations.length > 0) {
  /* eslint-disable no-console */
  console.error('');
  console.error('pre-commit: publish-tier AEM hostnames are banned in runtime code.');
  console.error('  See ROADMAP Phase 1 SET-03 — the EDS demo intentionally has no Publish tier.');
  console.error('');
  // eslint-disable-next-line no-restricted-syntax
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  matched '${v.match}'`);
  }
  console.error('');
  console.error('Fix: replace with the Author host from scripts/config.js (AEM_AUTHOR_HOST),');
  console.error('     or move the reference to .planning/ / docs/ if it is documentation.');
  /* eslint-enable no-console */
  process.exit(1);
}
