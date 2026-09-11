/**
 * The AI chat's per-vertical copy resolution (HOS-400).
 *
 * Five of the widget's eighteen copy strings NAME the thing being asked about
 * ("este alojamiento" / "este local" / "esta experiencia"); the other thirteen
 * are vertical-agnostic. `aiChatCopyKey` is what routes each one to the right
 * bundle, and this file is what stops the split from silently collapsing —
 * either direction is a real bug:
 *
 * - a vertical-specific key resolved to `accommodations` shows a restaurant
 *   visitor copy about an accommodation;
 * - a shared key resolved to `gastronomy` resolves to a missing key, and `t()`
 *   returns the KEY ITSELF in production (HOS-292), so the raw dotted string
 *   reaches the screen.
 */

import { describe, expect, it } from 'vitest';
import { aiChatCopyKey } from '../../../src/components/accommodation/AiChatWidget';

/** The keys whose copy names the vertical. */
const VERTICAL_SPECIFIC = [
    'fabLabel',
    'panelLabel',
    'headerDisclaimer',
    'priceDisclaimer',
    'unavailable'
] as const;

/** A representative sample of the keys that are the same in every vertical. */
const SHARED = ['send', 'sending', 'thinking', 'placeholder', 'newConversation'] as const;

describe('aiChatCopyKey', () => {
    describe('for an accommodation', () => {
        it.each([
            ...VERTICAL_SPECIFIC,
            ...SHARED
        ])('should resolve %s to the accommodations bundle', (suffix) => {
            expect(aiChatCopyKey('accommodation', suffix)).toBe(`accommodations.aiChat.${suffix}`);
        });
    });

    describe('for a commerce vertical', () => {
        it.each([
            ['gastronomy', 'gastronomy'],
            ['experience', 'experience']
        ] as const)('should send %s vertical-specific keys to its own bundle', (entity, ns) => {
            for (const suffix of VERTICAL_SPECIFIC) {
                expect(aiChatCopyKey(entity, suffix)).toBe(`${ns}.aiChat.${suffix}`);
            }
        });

        it.each([
            'gastronomy',
            'experience'
        ] as const)('should keep %s shared keys in the accommodations bundle', (entity) => {
            // Copying the thirteen shared strings into two more bundles to
            // vary five of them would create two more places for the other
            // thirteen to drift.
            for (const suffix of SHARED) {
                expect(aiChatCopyKey(entity, suffix)).toBe(`accommodations.aiChat.${suffix}`);
            }
        });
    });

    describe('the unavailable key', () => {
        it('should match what the API throws for each vertical', () => {
            // The API's ENTITLEMENT_REQUIRED message IS this key — chat.ts's
            // UNAVAILABLE_COPY_BY_ENTITY_TYPE. If the two drift, an owner
            // without the entitlement gets a raw dotted string on screen.
            expect(aiChatCopyKey('accommodation', 'unavailable')).toBe(
                'accommodations.aiChat.unavailable'
            );
            expect(aiChatCopyKey('gastronomy', 'unavailable')).toBe(
                'gastronomy.aiChat.unavailable'
            );
            expect(aiChatCopyKey('experience', 'unavailable')).toBe(
                'experience.aiChat.unavailable'
            );
        });
    });
});
