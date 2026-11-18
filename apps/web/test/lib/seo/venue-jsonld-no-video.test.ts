/**
 * HOS-2258 T-2: the venue JSON-LD must not mention videos. The venue's videos
 * are gated by `can_embed_video`; a structured-data block built from the raw
 * payload would be a way around the gate.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const FILES = [
    '../../../src/lib/seo/venue-jsonld.ts',
    '../../../src/components/seo/VenueJsonLd.astro'
] as const;

describe('venue JSON-LD (HOS-2258)', () => {
    it.each(FILES)('%s has no video reference', (file) => {
        const source = readFileSync(new URL(file, import.meta.url), 'utf8');

        expect(source).not.toMatch(/video/i);
    });
});
