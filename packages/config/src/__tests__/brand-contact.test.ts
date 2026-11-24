import { describe, expect, it } from 'vitest';
import {
    BRAND_CONTACT_EMAIL,
    BRAND_PHONE_DISPLAY,
    BRAND_SOCIAL_PROFILES,
    BRAND_WHATSAPP_URL,
    buildBrandWhatsAppUrl
} from '../brand-contact.js';
import { HOSPEDA_ENV_VARS } from '../env-registry.hospeda.js';

describe('brand contact (HOS-2565 D12)', () => {
    it('lists the four env-independent profiles in render order', () => {
        // Act
        const platforms = BRAND_SOCIAL_PROFILES.map((profile) => profile.platform);

        // Assert
        expect(platforms).toEqual(['facebook', 'instagram', 'x', 'youtube']);
        for (const profile of BRAND_SOCIAL_PROFILES) {
            expect(profile.url).toMatch(/^https:\/\//);
        }
    });

    it('pins the production phone to the HOSPEDA_BRAND_PHONE registry default', () => {
        // Arrange
        const entry = HOSPEDA_ENV_VARS.find((variable) => variable.name === 'HOSPEDA_BRAND_PHONE');

        // Assert
        expect(entry?.defaultValue).toBe(BRAND_PHONE_DISPLAY);
    });

    it('exposes the public contact email', () => {
        // Assert
        expect(BRAND_CONTACT_EMAIL).toBe('info@hospeda.com.ar');
    });

    it('inserts the AR mobile 9 when building the WhatsApp link', () => {
        // Act
        const url = buildBrandWhatsAppUrl({ phone: '+54 3442 470650' });

        // Assert
        expect(url).toBe('https://wa.me/5493442470650');
        expect(BRAND_WHATSAPP_URL).toBe(url);
    });

    it('does not insert a second 9 when the phone already carries it', () => {
        // Act
        const url = buildBrandWhatsAppUrl({ phone: '+54 9 3442 470650' });

        // Assert
        expect(url).toBe('https://wa.me/5493442470650');
    });
});
