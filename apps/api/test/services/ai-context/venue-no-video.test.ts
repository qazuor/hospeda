/**
 * HOS-2258 T-2: the venue AI context must not carry linked videos, so a plan
 * without `can_embed_video` cannot leak one through the chat. The gate lives in
 * the public projection; this pins that no side door is added in the context.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const DIR = new URL('../../../src/services/ai-context/', import.meta.url);

describe('venue AI context (HOS-2258)', () => {
    it.each(
        readdirSync(DIR).filter((file) => file.endsWith('.ts'))
    )('%s never reads videos', (file) => {
        const source = readFileSync(new URL(file, DIR), 'utf8');

        expect(source).not.toMatch(/video/i);
    });
});
