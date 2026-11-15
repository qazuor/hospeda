/**
 * @file venue-public-list-no-contact-info.guard.test.ts
 * @description HOS-2042 owner decision: a venue's business contact channels are
 * published on the DETAIL responses only. The two public LIST routes must
 * project through `VenuePublicListItemSchema` (no `contactInfo`), and the detail
 * routes through `VenuePublicSchema` (with it). The response schema is what
 * strips unknown keys before a payload leaves the API, so which schema each
 * route names IS the exposure control.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const route = (file: string): string =>
    readFileSync(join(__dirname, '../../src/routes/venue/public', file), 'utf8');

describe('venue public routes: contactInfo on detail only (HOS-2042)', () => {
    it.each([
        'list.ts',
        'getByDestination.ts'
    ])('%s projects through the list-item schema', (file) => {
        const src = route(file);
        expect(src).toContain('responseSchema: VenuePublicListItemSchema');
        expect(src).not.toMatch(/responseSchema:\s*VenuePublicSchema/);
    });

    it.each(['getBySlug.ts', 'getById.ts'])('%s projects through the detail schema', (file) => {
        expect(route(file)).toMatch(/responseSchema:\s*VenuePublicSchema/);
    });
});
