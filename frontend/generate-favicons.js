#!/usr/bin/env node

/**
 * Generates properly sized favicon files from existing logo PNGs
 * Requires sharp package: npm install sharp
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, 'public', 'logos');
const outputDir = path.join(__dirname, 'public');

// Logos to convert
const logos = [
  { input: 'logo-square-dark.png', output: 'favicon-square-dark' },
  { input: 'logo-circle-dark.png', output: 'favicon-circle-dark' },
  { input: 'logo-circle-cyan.png', output: 'favicon-circle-cyan' },
  { input: 'logo-circle-yellow.png', output: 'favicon-circle-yellow' },
];

// Sizes to generate
const sizes = [16, 32, 48];

async function generateFavicons() {
  console.log('🎨 Generating favicons...\n');

  for (const logo of logos) {
    const inputPath = path.join(publicDir, logo.input);
    
    // Check if input file exists
    if (!fs.existsSync(inputPath)) {
      console.log(`⚠️  Skipping ${logo.input} - file not found`);
      continue;
    }

    console.log(`📸 Processing ${logo.input}...`);

    try {
      // Generate different sizes
      for (const size of sizes) {
        const outputPath = path.join(outputDir, `${logo.output}-${size}x${size}.png`);
        await sharp(inputPath)
          .resize(size, size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .png()
          .toFile(outputPath);
        console.log(`   ✓ Generated ${size}x${size} → ${path.basename(outputPath)}`);
      }

      // Also create a multi-size ICO file (requires ico-convert or png-to-ico)
      // For now, we'll use the 32x32 as the default favicon
      const defaultFaviconPath = path.join(outputDir, `${logo.output}.png`);
      await sharp(inputPath)
        .resize(32, 32, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(defaultFaviconPath);
      console.log(`   ✓ Generated default 32x32 → ${path.basename(defaultFaviconPath)}`);

    } catch (error) {
      console.error(`   ✗ Error processing ${logo.input}:`, error.message);
    }

    console.log('');
  }

  console.log('✅ Favicon generation complete!\n');
  console.log('Generated files are in the public/ directory.');
  console.log('\nTo use them, update your code to reference:');
  console.log('  - favicon-square-dark.png (32x32 default)');
  console.log('  - favicon-square-dark-16x16.png');
  console.log('  - favicon-square-dark-32x32.png');
  console.log('  - favicon-square-dark-48x48.png');
}

// Run the favicon generation
generateFavicons().catch((error) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') {
    console.error('❌ Error: sharp package is not installed.');
    console.error('Please run: npm install sharp');
    console.error('\nOr install it as a dev dependency:');
    console.error('npm install --save-dev sharp');
    process.exit(1);
  } else {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
});
