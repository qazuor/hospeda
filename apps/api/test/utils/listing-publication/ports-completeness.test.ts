/** TEST:1744:7 — the production publication composition implements the PB3 port. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('listing publication ports completeness', () => {
    it('wires incomplete listing evaluation into the transaction', () => {
        const source = readFileSync(
            new URL('../../../src/utils/listing-publication/ports.ts', import.meta.url),
            'utf8'
        );
        expect(source).toContain('async readIncompleteListingIds(input)');
        expect(source).toContain('readIncompleteListingIds(input)');
    });
});
