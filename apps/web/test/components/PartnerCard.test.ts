import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/components/partner/PartnerCard.astro'),
    'utf8'
);

describe('PartnerCard.astro', () => {
    it('uses sponsored noopener rel for external partner links', () => {
        expect(src).toContain('rel="sponsored noopener"');
    });

    it('renders tier-specific card variants', () => {
        expect(src).toContain('partner-card--gold');
        expect(src).toContain('partner-card--silver');
        expect(src).toContain('partner-card--bronze');
    });
});
