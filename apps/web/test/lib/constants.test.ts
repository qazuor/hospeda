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

describe('contact number — single source, two derived forms (HOS-364)', () => {
    // Argentine mobile numbers need a `9` after the country code (54 9 ...) to
    // reach a mobile over WhatsApp — but that `9` does NOT belong on a plain
    // phone call, which is what the schema.org Organization telephone
    // represents. Both forms now derive from the same HOSPEDA_BRAND_PHONE
    // (see @/lib/brand-phone) instead of being hand-typed per surface.
    it('WhatsApp link uses the AR mobile prefix 549', () => {
        const whatsapp = SOCIAL_PROFILES.find((p) => p.platform === 'whatsapp');
        expect(whatsapp?.url).toBe('https://wa.me/5493442453797');
    });

    it('Organization telephone is E.164 WITHOUT the AR mobile 9 — a plain call, not WhatsApp', () => {
        expect(ORGANIZATION_INFO.telephone).toBe('+543442453797');
    });
});
