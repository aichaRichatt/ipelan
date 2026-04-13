#!/usr/bin/env node
/**
 * EPUB Extractor Script
 * Extracts EPUB content for offline testing
 * 
 * Usage: node scripts/extract-epub.js
 */

const fs = require('fs');
const path = require('path');

const EPUB_PATH = path.join(__dirname, '../assets/storage/books/libretest.epub');
const OUTPUT_DIR = path.join(__dirname, '../extracted_epub');

console.log('📚 EPUB Extractor Script');
console.log('========================\n');

// Check if unzip is available
const { execSync } = require('child_process');

try {
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Check if EPUB exists
  if (!fs.existsSync(EPUB_PATH)) {
    console.error(`❌ EPUB not found: ${EPUB_PATH}`);
    process.exit(1);
  }

  console.log(`✅ Found EPUB: ${EPUB_PATH}`);
  
  const stats = fs.statSync(EPUB_PATH);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`📦 Size: ${sizeMB} MB\n`);

  // Extract EPUB (it's a ZIP file)
  const extractDir = path.join(OUTPUT_DIR, 'libretest');
  
  console.log('📂 Extracting EPUB...');
  
  try {
    // Try using tar (works on Git Bash/WSL)
    execSync(`tar -xf "${EPUB_PATH}" -C "${OUTPUT_DIR}"`, { stdio: 'inherit' });
  } catch (e) {
    console.log('tar failed, trying PowerShell...');
    // Fallback: copy the file and rename to zip
    const zipPath = path.join(OUTPUT_DIR, 'libretest.zip');
    fs.copyFileSync(EPUB_PATH, zipPath);
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${OUTPUT_DIR}' -Force"`, { stdio: 'inherit' });
    fs.unlinkSync(zipPath);
  }

  // Check what was extracted
  console.log('\n📋 Extracted structure:');
  listFiles(extractDir, '');

  // Find and display OPF info
  const containerPath = path.join(extractDir, 'META-INF', 'container.xml');
  if (fs.existsSync(containerPath)) {
    const containerContent = fs.readFileSync(containerPath, 'utf-8');
    const opfMatch = containerContent.match(/full-path="([^"]+)"/);
    if (opfMatch) {
      const opfPath = path.join(extractDir, opfMatch[1]);
      const opfDir = path.dirname(opfPath);
      
      console.log('\n📖 EPUB Metadata:');
      console.log(`   OPF Path: ${opfMatch[1]}`);
      console.log(`   OPF Dir: ${opfDir}`);
      
      // Try to find and display title
      if (fs.existsSync(opfPath)) {
        const opfContent = fs.readFileSync(opfPath, 'utf-8');
        const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
        const authorMatch = opfContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
        
        if (titleMatch) console.log(`   Title: ${titleMatch[1]}`);
        if (authorMatch) console.log(`   Author: ${authorMatch[1]}`);
      }
      
      // Save metadata for the app
      const metadata = {
        opfPath: opfMatch[1],
        opfDir: opfDir,
        extractedAt: new Date().toISOString()
      };
      fs.writeFileSync(
        path.join(extractDir, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );
    }
  }

  console.log('\n✅ Extraction complete!');
  console.log(`📁 Output: ${extractDir}`);
  console.log('\n💡 To test in app, run: npm run test:epub');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

function listFiles(dir, prefix) {
  const files = fs.readdirSync(dir);
  files.forEach((file, index) => {
    const filePath = path.join(dir, file);
    const isDir = fs.statSync(filePath).isDirectory();
    const connector = index === files.length - 1 ? '└── ' : '├── ';
    console.log(`   ${prefix}${connector}${file}${isDir ? '/' : ''}`);
    if (isDir && files.length < 20) {
      listFiles(filePath, prefix + (index === files.length - 1 ? '    ' : '│   '));
    }
  });
}
