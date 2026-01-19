#!/usr/bin/env node

/**
 * Generates properly sized favicon files from existing logo PNGs
 * Requires: npm install sharp png-to-ico
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pngToIco from 'png-to-ico';
import logger from './src/logger'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, 'public', 'logos');
const outputDir = path.join(__dirname, 'public');

// Logos to convert
const logos = [
  { input: 'logo-circle-dark-alternative.png', output: 'favicon-circle-dark-alternative' },
  { input: 'logo-circle-dark.png', output: 'favicon-circle-dark' },
  { input: 'logo-circle-cyan.png', output: 'favicon-circle-cyan' },
  { input: 'ghassi_music.png', output: 'favicon-ghassi-music' },
  { input: 'logo-circle-yellow.png', output: 'favicon-circle-yellow' },
];

// Sizes to generate
const sizes = [16, 32, 48];

async function generateFavicons() {
  logger.info('🎨 Generating favicons...\n');

  // Clean up old PNG favicon files
  logger.info('🧹 Cleaning up old favicon files...');
  const files = fs.readdirSync(outputDir);
  let cleanedCount = 0;
  
  for (const file of files) {
    if (file.startsWith('favicon-') && file.endsWith('.png')) {
      const filePath = path.join(outputDir, file);
      fs.unlinkSync(filePath);
      cleanedCount++;
      logger.info(`   ✓ Removed ${file}`);
    }
  }
  
  if (cleanedCount > 0) {
    logger.info(`   Removed ${cleanedCount} old favicon file(s)\n`);
  } else {
    logger.info('   No old favicon files to remove\n');
  }

  for (const logo of logos) {
    const inputPath = path.join(publicDir, logo.input);
    
    // Check if input file exists
    if (!fs.existsSync(inputPath)) {
      logger.info(`⚠️  Skipping ${logo.input} - file not found`);
      continue;
    }

    logger.info(`📸 Processing ${logo.input}...`);

    try {
      // Generate temporary PNG files at different sizes
      const tempPngs = [];
      
      for (const size of sizes) {
        const tempPath = path.join(outputDir, `temp-${logo.output}-${size}x${size}.png`);
        await sharp(inputPath)
          .resize(size, size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .png()
          .toFile(tempPath);
        tempPngs.push(tempPath);
        logger.info(`   ✓ Generated ${size}x${size} temp PNG`);
      }

      // Convert PNGs to a single .ico file with multiple sizes
      const icoPath = path.join(outputDir, `${logo.output}.ico`);
      const icoBuffer = await pngToIco(tempPngs);
      fs.writeFileSync(icoPath, icoBuffer);
      logger.info(`   ✓ Generated ICO file → ${path.basename(icoPath)}`);

      // Clean up temporary PNG files
      tempPngs.forEach(tempPath => {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      });
      logger.info(`   ✓ Cleaned up temp files`);

    } catch (error) {
      logger.error(`   ✗ Error processing ${logo.input}:`, error.message);
    }

    logger.info('');
  }

  logger.info('✅ Favicon generation complete!\n');
  logger.info('Generated .ico files in the public/ directory.');
  logger.info('\nGenerated files:');
  logger.info('  - favicon-square-dark.ico');
  logger.info('  - favicon-circle-dark.ico');
  logger.info('  - favicon-circle-cyan.ico');
  logger.info('  - favicon-circle-yellow.ico');
}

// Run the favicon generation
generateFavicons().catch((error) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') {
    logger.error('❌ Error: sharp package is not installed.');
    logger.error('Please run: npm install sharp');
    logger.error('\nOr install it as a dev dependency:');
    logger.error('npm install --save-dev sharp');
    process.exit(1);
  } else {
    logger.error('❌ Error:', error.message);
    process.exit(1);
  }
});
