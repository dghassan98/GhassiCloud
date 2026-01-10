#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

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
  console.log(`\n🚀 Current version: ${currentVersion}\n`);

  // Ask for version bump type
  const bumpType = await question(
    'Bump type? (major/minor/patch) [patch]: '
  );
  const type = bumpType.trim() || 'patch';
  const newVersion = incrementVersion(currentVersion, type);

  console.log(`\n📦 New version will be: ${newVersion}\n`);

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
  console.log('\n📝 Enter changelog entries (one per line, empty line to finish):\n');
  const changes = [];
  while (true) {
    const change = await question(`  - `);
    if (!change.trim()) break;
    changes.push(change.trim());
  }

  if (changes.length === 0) {
    console.log('\n❌ No changelog entries provided. Aborting.');
    rl.close();
    return;
  }

  // Confirm
  console.log('\n📋 Summary:');
  console.log(`   Version: ${currentVersion} → ${newVersion}`);
  console.log(`   Date: ${releaseDate}`);
  console.log(`   Changes:`);
  changes.forEach((c) => console.log(`     • ${c}`));
  console.log('');

  const confirm = await question('Proceed? (y/N): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('\n❌ Aborted.');
    rl.close();
    return;
  }

  // Update frontend/package.json
  frontendPackageJson.version = newVersion;
  writeFileSync(frontendPackagePath, JSON.stringify(frontendPackageJson, null, 2) + '\n');
  console.log('\n✅ Updated frontend/package.json');

  // Update root package-lock.json (update the frontend package entry if present)
  const lockPath = join(rootDir, 'package-lock.json');
  try {
    const lockJson = JSON.parse(readFileSync(lockPath, 'utf8'));
    // Support keys like 'frontend' or './frontend'
    const frontendKey = lockJson.packages && (lockJson.packages['frontend'] ? 'frontend' : (lockJson.packages['./frontend'] ? './frontend' : null));
    if (frontendKey) {
      lockJson.packages[frontendKey].version = newVersion;
      writeFileSync(lockPath, JSON.stringify(lockJson, null, 2) + '\n');
      console.log('✅ Updated root package-lock.json (frontend entry)');
    }
  } catch (err) {
    console.log('⚠️  Warning: Could not update root package-lock.json:', err.message);
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
    console.log('✅ Updated ChangelogModal.jsx');
  } else {
    console.log('⚠️  Warning: Could not find CHANGELOG object in ChangelogModal.jsx');
    console.log('   You may need to manually add the changelog entry.');
  }

  console.log(`\n🎉 Version bumped to ${newVersion}!`);
  console.log('\n📌 Next steps:');
  console.log('   1. Review the changes');
  console.log('   2. Restart Vite dev server if running (vite auto-loads version from package.json)');
  console.log('   3. Commit: git add -A && git commit -m "Release v' + newVersion + '"');
  console.log('   4. Tag: git tag v' + newVersion);
  console.log('   5. Deploy: npm run build\n');

  rl.close();
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  rl.close();
  process.exit(1);
});
