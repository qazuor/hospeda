/**
 * @file share-intents.test.ts
 * @description HOS-2359 §6.C.1: the four network share-intent URL builders,
 * extracted from `ShareButtons` so the presentation index reuses them.
 */
import { describe, expect, it } from 'vitest';
import { buildShareIntentUrl, SHARE_INTENT_NETWORKS } from '../../src/lib/share-intents';

const URL_TO_SHARE = 'https://hospeda.com.ar/go/aloj-wa/?a=1&b=2';
const TITLE = 'Publicá tu alojamiento & más';
const U = encodeURIComponent(URL_TO_SHARE);
const T = encodeURIComponent(TITLE);

describe('buildShareIntentUrl', () => {
    it.each([
        ['whatsapp', `https://wa.me/?text=${T}%20${U}`],
        ['facebook', `https://www.facebook.com/sharer/sharer.php?u=${U}`],
        ['x', `https://twitter.com/intent/tweet?url=${U}&text=${T}`],
        ['telegram', `https://t.me/share/url?url=${U}&text=${T}`]
    ] as const)('builds the %s intent', (network, expected) => {
        // Act
        const result = buildShareIntentUrl({ network, url: URL_TO_SHARE, title: TITLE });

        // Assert
        expect(result).toBe(expected);
    });

    it('lists exactly the four networks', () => {
        expect(SHARE_INTENT_NETWORKS).toEqual(['whatsapp', 'facebook', 'x', 'telegram']);
    });
});
