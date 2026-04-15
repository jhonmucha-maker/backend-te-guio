/**
 * Migration script: Upload local /uploads/ files to S3 and update database URLs.
 *
 * Usage: node scripts/migrate-uploads-to-s3.js
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const { PrismaClient } = require('@prisma/client');
const { uploadToS3 } = require('../config/s3');

const prisma = new PrismaClient();
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

async function migrateFiles() {
  console.log('=== Migration: Local uploads → S3 ===\n');

  // 1. Collect all local files
  const localFiles = [];
  function walk(dir, prefix = '') {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), rel);
      } else {
        localFiles.push(rel);
      }
    }
  }
  walk(UPLOADS_DIR);
  console.log(`Found ${localFiles.length} local files in uploads/\n`);

  // 2. Upload each file to S3
  let uploaded = 0;
  let skipped = 0;
  for (const relPath of localFiles) {
    const fullPath = path.join(UPLOADS_DIR, relPath);
    const s3Key = relPath.replace(/\\/g, '/');
    const contentType = mime.lookup(fullPath) || 'application/octet-stream';

    try {
      const body = fs.readFileSync(fullPath);
      await uploadToS3(s3Key, body, contentType);
      uploaded++;
      console.log(`  ✓ Uploaded: ${s3Key}`);
    } catch (err) {
      if (err.message && err.message.includes('already exists')) {
        skipped++;
        console.log(`  - Skipped (exists): ${s3Key}`);
      } else {
        console.error(`  ✗ Error uploading ${s3Key}:`, err.message);
      }
    }
  }
  console.log(`\nUpload complete: ${uploaded} uploaded, ${skipped} skipped\n`);

  // 3. Update database URLs
  const tables = [
    { name: 'tbl_fotos_productos', field: 'url' },
    { name: 'tbl_fotos_tiendas', field: 'url' },
    { name: 'tbl_fotos_galerias', field: 'url' },
    { name: 'tbl_archivos_suscripcion', field: 'url' },
  ];

  let totalUpdated = 0;
  for (const table of tables) {
    try {
      const rows = await prisma[table.name].findMany({
        where: { [table.field]: { startsWith: '/uploads/' } },
      });

      for (const row of rows) {
        const oldUrl = row[table.field];
        // /uploads/photos/3/5/file.jpg → photos/3/5/file.jpg (S3 key)
        const s3Key = oldUrl.replace(/^\/uploads\//, '');
        const newUrl = `/api/catalog/files/${s3Key}`;

        await prisma[table.name].update({
          where: { id: row.id },
          data: { [table.field]: newUrl },
        });
        totalUpdated++;
        console.log(`  ${table.name} #${row.id}: ${oldUrl} → ${newUrl}`);
      }
    } catch (err) {
      console.error(`  Error updating ${table.name}:`, err.message);
    }
  }

  console.log(`\nDatabase update complete: ${totalUpdated} URLs updated`);
  console.log('\n=== Migration finished ===');
}

migrateFiles()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
