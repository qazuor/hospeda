/**
 * @file listing-whatsapp-brand-mark.test.ts
 * @description HOS-2629: every WhatsApp control on a listing page renders the
 * official brand mark (`WhatsappIcon`, simpleicons) that the mobile action bar
 * uses, never the generic Phosphor `WhatsappLogo`. One page used to show two
 * different WhatsApp logos depending on where you looked.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../../src');

const LISTING_WHATSAPP_SURFACES = [
    'components/listing/contact/ListingActionBarButtons.tsx',
    'components/listing/contact/ListingContactActions.tsx',
    'components/accommodation/WhatsAppContact.client.tsx'
] as const;

describe('listing WhatsApp controls use the brand mark (HOS-2629)', () => {
    it.each(LISTING_WHATSAPP_SURFACES)('%s renders WhatsappIcon and never WhatsappLogo', (file) => {
        // Arrange
        const source = readFileSync(resolve(SRC, file), 'utf8');

        // Act
        const usesPhosphor = /\bWhatsappLogo\b/.test(source);
        const usesBrand = /<WhatsappIcon\b/.test(source);

        // Assert
        expect(usesPhosphor).toBe(false);
        expect(usesBrand).toBe(true);
    });
});
