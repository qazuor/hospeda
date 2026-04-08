/**
 * @file constants.test.ts
 * @description Unit tests for application constants.
 */

import { describe, expect, it } from 'vitest';
import { BRAND_NAME, TITLE_SEPARATOR } from '../../src/lib/constants';

describe('constants', () => {
    it('should export BRAND_NAME as Hospeda', () => {
        expect(BRAND_NAME).toBe('Hospeda');
    });

    it('should export TITLE_SEPARATOR with spaces around pipe', () => {
        expect(TITLE_SEPARATOR).toBe(' | ');
    });
});
