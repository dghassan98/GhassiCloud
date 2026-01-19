#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

import logger from '../backend/src/logger.js'

// Read frontend package.json
const frontendPackagePath = join(rootDir, 'frontend', 'package.json');
const frontendPackageJson = JSON.parse(readFileSync(frontendPackagePath, 'utf8'));
const currentVersion = frontendPackageJson.version;

// Parse version
function parseVersion(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return { major, minor, patch };
}

// Increment version
function incrementVersion(version, type) {
  const v = parseVersion(version);
  switch (type) {
    case 'major':
      return `${v.major + 1}.0.0`;
    case 'minor':
      return `${v.major}.${v.minor + 1}.0`;
    case 'patch':
      return `${v.major}.${v.minor}.${v.patch + 1}`;
    default:
      return version;
  }
}

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  logger.info(`\n🚀 Current version: ${currentVersion}\n`);

  // Ask for version bump type
  const bumpType = await question(
    'Bump type? (major/minor/patch) [patch]: '
  );
  const type = bumpType.trim() || 'patch';
  const newVersion = incrementVersion(currentVersion, type);

  logger.info(`\n📦 New version will be: ${newVersion}\n`);

  // Get release date
  const dateInput = await question(
    'Release date? (YYYY-MM-DD or leave empty for today): '
  );
  const releaseDate = dateInput.trim()
    ? new Date(dateInput).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

  // Get changelog entries
  logger.info('\n📝 Enter changelog entries (one per line, empty line to finish):\n');
  const changes = [];
  while (true) {
    const change = await question(`  - `);
    if (!change.trim()) break;
    changes.push(change.trim());
  }

  if (changes.length === 0) {
    logger.info('\n❌ No changelog entries provided. Aborting.');
    rl.close();
    return;
  }

  // Confirm
  logger.info('\n📋 Summary:');
  logger.info(`   Version: ${currentVersion} → ${newVersion}`);
  logger.info(`   Date: ${releaseDate}`);
  logger.info(`   Changes:`);
  changes.forEach((c) => logger.info(`     • ${c}`));
  logger.info('');

  const confirm = await question('Proceed? (y/N): ');
  if (confirm.toLowerCase() !== 'y') {
    logger.info('\n❌ Aborted.');
    rl.close();
    return;
  }

  // Update frontend/package.json
  frontendPackageJson.version = newVersion;
  writeFileSync(frontendPackagePath, JSON.stringify(frontendPackageJson, null, 2) + '\n');
  logger.info('\n✅ Updated frontend/package.json');

  // Update root package.json
  const rootPackagePath = join(rootDir, 'package.json');
  try {
    const rootPackageJson = JSON.parse(readFileSync(rootPackagePath, 'utf8'));
    rootPackageJson.version = newVersion;
    writeFileSync(rootPackagePath, JSON.stringify(rootPackageJson, null, 2) + '\n');
    logger.info('✅ Updated root package.json');
  } catch (err) {
    logger.warn('⚠️  Warning: Could not update root package.json:', err.message);
  }

  // Update backend/package.json
  const backendPackagePath = join(rootDir, 'backend', 'package.json');
  try {
    const backendPackageJson = JSON.parse(readFileSync(backendPackagePath, 'utf8'));
    backendPackageJson.version = newVersion;
    writeFileSync(backendPackagePath, JSON.stringify(backendPackageJson, null, 2) + '\n');
    logger.info('✅ Updated backend/package.json');
  } catch (err) {
    logger.warn('⚠️  Warning: Could not update backend/package.json:', err.message);
  }

  // Update root package-lock.json (update root/frontend/backend package entries if present)
  const lockPath = join(rootDir, 'package-lock.json');
  try {
    const lockJson = JSON.parse(readFileSync(lockPath, 'utf8'));
    // Update top-level lock version
    if (lockJson.version) lockJson.version = newVersion;
    // Support keys like '' (root), 'frontend', './frontend', 'backend', './backend'
    if (lockJson.packages) {
      if (lockJson.packages['']) lockJson.packages[''].version = newVersion;
      const frontKey = lockJson.packages['frontend'] ? 'frontend' : (lockJson.packages['./frontend'] ? './frontend' : null);
      if (frontKey) lockJson.packages[frontKey].version = newVersion;
      const backKey = lockJson.packages['backend'] ? 'backend' : (lockJson.packages['./backend'] ? './backend' : null);
      if (backKey) lockJson.packages[backKey].version = newVersion;
    }
    writeFileSync(lockPath, JSON.stringify(lockJson, null, 2) + '\n');
    logger.info('✅ Updated root package-lock.json (root/frontend/backend entries)');
  } catch (err) {
    logger.warn('⚠️  Warning: Could not update root package-lock.json:', err.message);
  }

  // Update ChangelogModal.jsx
  const changelogPath = join(rootDir, 'frontend', 'src', 'components', 'ChangelogModal.jsx');
  let changelogContent = readFileSync(changelogPath, 'utf8');

  // Build new changelog entry
  const newEntry = `  '${newVersion}': {
    date: '${releaseDate}',
    changes: [
${changes.map((c) => `      '${c.replace(/'/g, "\\'")}',`).join('\n')}
    ],
  },`;

  // Find the CHANGELOG object and insert new entry after the opening brace
  // Handle different line endings (Windows \r\n or Unix \n)
  const changelogRegex = /(const CHANGELOG = \{)(\r?\n)/;
  if (changelogRegex.test(changelogContent)) {
    changelogContent = changelogContent.replace(
      changelogRegex,
      `$1$2${newEntry}\n`
    );
    writeFileSync(changelogPath, changelogContent);
    logger.info('✅ Updated ChangelogModal.jsx');
  } else {
    logger.warn('⚠️  Warning: Could not find CHANGELOG object in ChangelogModal.jsx');
    logger.warn('   You may need to manually add the changelog entry.');
  }

  // Update VITE_APP_VERSION fallback defaults in frontend source files
  const viteFallbackRegex = /import\.meta\.env\.VITE_APP_VERSION\s*\|\|\s*'[^']*'/g;
  const filesToPatch = [
    join(rootDir, 'frontend', 'src', 'hooks', 'usePWAUpdate.js'),
    join(rootDir, 'frontend', 'src', 'pages', 'Settings.jsx'),
    join(rootDir, 'frontend', 'src', 'components', 'ChangelogModal.jsx'),
  ];
  filesToPatch.forEach((p) => {
    try {
      let c = readFileSync(p, 'utf8');
      if (viteFallbackRegex.test(c)) {
        c = c.replace(viteFallbackRegex, `import.meta.env.VITE_APP_VERSION || '${newVersion}'`);
        writeFileSync(p, c);
        logger.info(`✅ Updated VITE_APP_VERSION fallback in ${p}`);
      } else {
        logger.info(`ℹ️  No VITE_APP_VERSION fallback found in ${p}`);
      }
    } catch (err) {
      logger.warn(`⚠️  Could not update ${p}:`, err.message);
    }
  });

  logger.info(`\n🎉 Version bumped to ${newVersion}!`);
  logger.info('\n📌 Next steps:');
  logger.info('   1. Review the changes');
  logger.info('   2. Restart Vite dev server if running (vite auto-loads version from package.json)');
  logger.info('   3. Commit: git add -A && git commit -m "Release v' + newVersion + '"');
  logger.info('   4. Tag: git tag v' + newVersion);
  logger.info('   5. Deploy: npm run build\n');

  rl.close();
}

main().catch((err) => {
  logger.error('\n❌ Error:', err.message);
  rl.close();
  process.exit(1);
});
