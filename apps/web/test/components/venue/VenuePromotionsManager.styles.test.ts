/** The manager must not override the kit's control/checkbox layout (HOS-2395). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
    resolve(__dirname, '../../../src/components/venue/VenuePromotionsManager.module.css'),
    'utf8'
);

describe('VenuePromotionsManager kit layout', () => {
    it('leaves control widths and label layouts to the kit', () => {
        expect(css).not.toMatch(/\.form\s+(input|textarea|select|label)\b/);
    });
});
