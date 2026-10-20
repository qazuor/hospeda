import { describe, expect, it } from 'vitest';
import { asMajor } from '../../src/types/money.js';

describe('TEST:1626:2 notification money type', () => {
    it('brands major amounts without arithmetic', () => {
        expect(asMajor(150)).toBe(150);
        expect(asMajor(0)).toBe(0);
    });

    it('preserves negative major amounts', () => {
        expect(asMajor(-25)).toBe(-25);
    });
});
