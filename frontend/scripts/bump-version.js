#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import logger from '../src/logger'

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Read package.json
const packagePath = join(rootDir, 'package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
const currentVersion = packageJson.version;

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

  // Update package.json
  packageJson.version = newVersion;
  writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
  logger.info('\n✅ Updated package.json');

  // Update ChangelogModal.jsx
  const changelogPath = join(rootDir, 'src', 'components', 'ChangelogModal.jsx');
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
    logger.info('⚠️  Warning: Could not find CHANGELOG object in ChangelogModal.jsx');
    logger.info('   You may need to manually add the changelog entry.');
  }

  logger.info(`\n🎉 Version bumped to ${newVersion}!`);
  logger.info('\n📌 Next steps:');
  logger.info('   1. Review the changes');
  logger.info('   2. Commit: git add -A && git commit -m "Release v' + newVersion + '"');
  logger.info('   3. Tag: git tag v' + newVersion);
  logger.info('   4. Deploy: npm run build\n');

  rl.close();
}

main().catch((err) => {
  logger.error('\n❌ Error:', err.message);
  rl.close();
  process.exit(1);
});
