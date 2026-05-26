/**
 * @file constants.test.ts
 * @description Unit tests for application constants.
 */

import { describe, expect, it } from 'vitest';
import {
    BRAND_NAME,
    ORGANIZATION_INFO,
    SOCIAL_PROFILES,
    TITLE_SEPARATOR
} from '../../src/lib/constants';

describe('constants', () => {
    it('should export BRAND_NAME as Hospeda', () => {
        expect(BRAND_NAME).toBe('Hospeda');
    });

    it('should export TITLE_SEPARATOR with spaces around pipe', () => {
        expect(TITLE_SEPARATOR).toBe(' | ');
    });
});

describe('contact number — AR mobile format', () => {
    // Argentine mobile numbers carry a `9` after the country code (54 9 ...).
    // Without it, wa.me links don't open a chat to a cell phone. The contact
    // page already used the `9` form; the footer/JSON-LD lagged behind.
    it('WhatsApp link uses the AR mobile prefix 549', () => {
        const whatsapp = SOCIAL_PROFILES.find((p) => p.platform === 'whatsapp');
        expect(whatsapp?.url).toBe('https://wa.me/5493442453797');
    });

    it('Organization telephone is E.164 with the AR mobile 9 (+549)', () => {
        expect(ORGANIZATION_INFO.telephone).toBe('+5493442453797');
    });
});
