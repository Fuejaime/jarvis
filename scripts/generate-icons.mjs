#!/usr/bin/env node
/**
 * generate-icons.mjs
 * Genera todos los PNG necesarios para la PWA desde icon-source.svg usando sharp.
 */
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..');
const SRC   = join(ROOT, 'public', 'icons', 'icon-source.svg');
const OUT   = join(ROOT, 'public', 'icons');

const svg = readFileSync(SRC);

const icons = [
  // PWA manifest
  { name: 'icon-192.png',             size: 192 },
  { name: 'icon-512.png',             size: 512 },
  // Apple touch icons
  { name: 'apple-touch-icon.png',     size: 180 },
  { name: 'apple-touch-icon-180.png', size: 180 },
  { name: 'apple-touch-icon-167.png', size: 167 },
  { name: 'apple-touch-icon-152.png', size: 152 },
];

for (const { name, size } of icons) {
  const dest = join(OUT, name);
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(dest);
  console.log(`✓ ${name} (${size}x${size})`);
}

console.log('\nDone — all icons generated.');
