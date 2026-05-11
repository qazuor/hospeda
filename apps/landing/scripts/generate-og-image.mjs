#!/usr/bin/env node
/**
 * generate-og-image.mjs
 *
 * One-shot script: takes one of the hero images, crops it to 1200x630
 * (the Open Graph / Twitter Card standard), darkens it slightly so any
 * text overlay rendered by the social platform on top of it stays
 * legible, and writes the result to `public/og-image.jpg`.
 *
 * Re-run only when the brand image or framing changes. The output is
 * committed to git so the runtime build doesn't need to do this work.
 *
 *   pnpm exec node scripts/generate-og-image.mjs
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const inputPath = resolve(__dirname, '../src/assets/hero/hero-atardecer.jpg');
const outputPath = resolve(__dirname, '../public/og-image.jpg');

// Width and height match the Facebook / Twitter / LinkedIn recommendation.
// 1.91:1 aspect ratio renders correctly across every major social card.
const WIDTH = 1200;
const HEIGHT = 630;

const overlay = Buffer.from(
    `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="darken" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#000" stop-opacity="0.15" />
                <stop offset="60%" stop-color="#000" stop-opacity="0.35" />
                <stop offset="100%" stop-color="#000" stop-opacity="0.55" />
            </linearGradient>
        </defs>
        <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#darken)" />
    </svg>`
);

await sharp(inputPath)
    .resize({
        width: WIDTH,
        height: HEIGHT,
        fit: 'cover',
        position: 'attention'
    })
    .composite([{ input: overlay, blend: 'over' }])
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toFile(outputPath);

console.log(`✓ Generated ${outputPath} (${WIDTH}x${HEIGHT})`);
