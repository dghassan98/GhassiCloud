/**
 * Android Icon Generator for GhassiCloud
 * 
 * This script generates all required Android icon sizes from your source logo.
 * 
 * Prerequisites:
 *   npm install sharp
 * 
 * Usage:
 *   node generate-android-icons.js
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Source images from your public/logos folder
const SOURCE_SQUARE = path.join(__dirname, 'public/logos/logo-square-dark.png');
const SOURCE_ROUND = path.join(__dirname, 'public/logos/logo-circle-dark.png');

// Android resource directory
const ANDROID_RES = path.join(__dirname, 'android/app/src/main/res');

// Android icon size requirements (in pixels)
const ICON_SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192
};

// Adaptive icon foreground sizes (slightly larger for the safe zone)
const FOREGROUND_SIZES = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432
};

// Splash screen sizes
const SPLASH_SIZES = {
  'drawable-port-mdpi': { width: 320, height: 480 },
  'drawable-port-hdpi': { width: 480, height: 800 },
  'drawable-port-xhdpi': { width: 720, height: 1280 },
  'drawable-port-xxhdpi': { width: 1080, height: 1920 },
  'drawable-port-xxxhdpi': { width: 1440, height: 2560 },
  'drawable-land-mdpi': { width: 480, height: 320 },
  'drawable-land-hdpi': { width: 800, height: 480 },
  'drawable-land-xhdpi': { width: 1280, height: 720 },
  'drawable-land-xxhdpi': { width: 1920, height: 1080 },
  'drawable-land-xxxhdpi': { width: 2560, height: 1440 }
};

async function generateIcons() {
  console.log('🎨 Generating Android icons from your branding...\n');

  // Check if source files exist
  if (!fs.existsSync(SOURCE_SQUARE)) {
    console.error(`❌ Source file not found: ${SOURCE_SQUARE}`);
    process.exit(1);
  }

  // Generate launcher icons (square)
  console.log('📱 Generating launcher icons...');
  for (const [folder, size] of Object.entries(ICON_SIZES)) {
    const outputPath = path.join(ANDROID_RES, folder, 'ic_launcher.png');
    await sharp(SOURCE_SQUARE)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`   ✓ ${folder}/ic_launcher.png (${size}x${size})`);
  }

  // Generate round launcher icons
  console.log('\n🔵 Generating round launcher icons...');
  const roundSource = fs.existsSync(SOURCE_ROUND) ? SOURCE_ROUND : SOURCE_SQUARE;
  for (const [folder, size] of Object.entries(ICON_SIZES)) {
    const outputPath = path.join(ANDROID_RES, folder, 'ic_launcher_round.png');
    
    // Create a circular mask
    const roundedCorners = Buffer.from(
      `<svg><circle cx="${size/2}" cy="${size/2}" r="${size/2}"/></svg>`
    );
    
    await sharp(roundSource)
      .resize(size, size)
      .composite([{
        input: roundedCorners,
        blend: 'dest-in'
      }])
      .png()
      .toFile(outputPath);
    console.log(`   ✓ ${folder}/ic_launcher_round.png (${size}x${size})`);
  }

  // Generate adaptive icon foregrounds
  console.log('\n🖼️  Generating adaptive icon foregrounds...');
  for (const [folder, size] of Object.entries(FOREGROUND_SIZES)) {
    const outputPath = path.join(ANDROID_RES, folder, 'ic_launcher_foreground.png');
    
    // Create foreground with padding for adaptive icon safe zone
    const iconSize = Math.floor(size * 0.6); // Icon takes 60% of foreground
    const padding = Math.floor((size - iconSize) / 2);
    
    await sharp(SOURCE_SQUARE)
      .resize(iconSize, iconSize)
      .extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(outputPath);
    console.log(`   ✓ ${folder}/ic_launcher_foreground.png (${size}x${size})`);
  }

  // Generate splash screens
  console.log('\n💦 Generating splash screens...');
  for (const [folder, dimensions] of Object.entries(SPLASH_SIZES)) {
    const outputPath = path.join(ANDROID_RES, folder, 'splash.png');
    const logoSize = Math.min(dimensions.width, dimensions.height) * 0.3;
    
    // Ensure directory exists
    const dirPath = path.join(ANDROID_RES, folder);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    // Create splash with centered logo on dark background
    const logo = await sharp(SOURCE_SQUARE)
      .resize(Math.floor(logoSize), Math.floor(logoSize))
      .toBuffer();
    
    await sharp({
      create: {
        width: dimensions.width,
        height: dimensions.height,
        channels: 4,
        background: { r: 15, g: 23, b: 42, alpha: 1 } // #0f172a
      }
    })
      .composite([{
        input: logo,
        gravity: 'center'
      }])
      .png()
      .toFile(outputPath);
    console.log(`   ✓ ${folder}/splash.png (${dimensions.width}x${dimensions.height})`);
  }

  console.log('\n✅ All Android icons generated successfully!');
  console.log('\n📋 Next steps:');
  console.log('   1. Run: npm run build');
  console.log('   2. Run: npx cap sync android');
  console.log('   3. Open Android Studio: npm run cap:android');
}

generateIcons().catch(console.error);
