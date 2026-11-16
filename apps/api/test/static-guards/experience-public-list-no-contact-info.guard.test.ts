/**
 * @file experience-public-list-no-contact-info.guard.test.ts
 * @description HOS-2200 owner decision (same as HOS-2042 for venues): an
 * experience's business contact channels are published on the DETAIL responses
 * only, so nobody can harvest phone numbers in bulk from a list call. The two
 * public LIST routes must project through `ExperiencePublicListItemSchema` (no
 * `contactInfo`), and the detail routes through `ExperiencePublicSchema` (with
 * it). The response schema is what strips unknown keys before a payload leaves
 * the API, so which schema each route names IS the exposure control.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const route = (file: string): string =>
    readFileSync(join(__dirname, '../../src/routes/experience/public', file), 'utf8');

describe('experience public routes: contactInfo on detail only (HOS-2200)', () => {
    it.each([
        'list.ts',
        'getByDestination.ts'
    ])('%s projects through the list-item schema', (file) => {
        const src = route(file);
        expect(src).toContain('responseSchema: ExperiencePublicListItemSchema');
        expect(src).not.toMatch(/responseSchema:\s*ExperiencePublicSchema/);
    });

    it.each(['getBySlug.ts', 'getById.ts'])('%s projects through the detail schema', (file) => {
        expect(route(file)).toMatch(/responseSchema:\s*ExperiencePublicSchema/);
    });
});
