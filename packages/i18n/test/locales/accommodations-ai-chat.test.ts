/**
 * @file accommodations-ai-chat.test.ts
 * @description Key-presence test for the `aiChat` sub-tree inside the
 * accommodations namespace (SPEC-200 REQ-200-7 AC-7.1).
 *
 * Guards that every aiChat.* key exists in all three locales (es, en, pt)
 * with non-empty string values.
 */

import { describe, expect, it } from 'vitest';
import enAccommodations from '../../src/locales/en/accommodations.json';
import esAccommodations from '../../src/locales/es/accommodations.json';
import ptAccommodations from '../../src/locales/pt/accommodations.json';

/**
 * All aiChat.* keys required by SPEC-200 REQ-200-7 AC-7.1.
 * The namespace prefix is stripped — these are paths inside the aiChat object.
 * Keys `expand` and `collapse` were added by FIX-4 (a11y/i18n hardcoded labels).
 */
const AI_CHAT_KEYS = [
    'fabLabel',
    'panelLabel',
    'headerDisclaimer',
    'priceDisclaimer',
    'placeholder',
    'send',
    'sending',
    'errorDefault',
    'atCapMessage',
    'newConversation',
    'close',
    'expand',
    'collapse'
] as const;

/** Resolves a dot-notation key against a nested object. */
function resolveKey(obj: Record<string, unknown>, key: string): unknown {
    return key.split('.').reduce<unknown>((current, part) => {
        if (current && typeof current === 'object' && !Array.isArray(current)) {
            return (current as Record<string, unknown>)[part];
        }
        return undefined;
    }, obj);
}

describe('accommodations aiChat keys (SPEC-200 REQ-200-7 AC-7.1)', () => {
    it('has all 13 aiChat keys in es locale with non-empty values', () => {
        const aiChat = (esAccommodations as Record<string, unknown>).aiChat;
        expect(aiChat).toBeDefined();
        expect(typeof aiChat).toBe('object');

        const missing = AI_CHAT_KEYS.filter((key) => {
            const value = resolveKey(aiChat as Record<string, unknown>, key);
            return typeof value !== 'string' || value.length === 0;
        });

        expect(missing, 'aiChat keys missing or empty in es/accommodations.json').toEqual([]);
    });

    it('has all 13 aiChat keys in en locale with non-empty values', () => {
        const aiChat = (enAccommodations as Record<string, unknown>).aiChat;
        expect(aiChat).toBeDefined();
        expect(typeof aiChat).toBe('object');

        const missing = AI_CHAT_KEYS.filter((key) => {
            const value = resolveKey(aiChat as Record<string, unknown>, key);
            return typeof value !== 'string' || value.length === 0;
        });

        expect(missing, 'aiChat keys missing or empty in en/accommodations.json').toEqual([]);
    });

    it('has all 13 aiChat keys in pt locale with non-empty values', () => {
        const aiChat = (ptAccommodations as Record<string, unknown>).aiChat;
        expect(aiChat).toBeDefined();
        expect(typeof aiChat).toBe('object');

        const missing = AI_CHAT_KEYS.filter((key) => {
            const value = resolveKey(aiChat as Record<string, unknown>, key);
            return typeof value !== 'string' || value.length === 0;
        });

        expect(missing, 'aiChat keys missing or empty in pt/accommodations.json').toEqual([]);
    });

    it('has exactly 13 keys in the aiChat section (no extra keys)', () => {
        const esAiChat = (esAccommodations as Record<string, unknown>).aiChat as Record<
            string,
            unknown
        >;
        const enAiChat = (enAccommodations as Record<string, unknown>).aiChat as Record<
            string,
            unknown
        >;
        const ptAiChat = (ptAccommodations as Record<string, unknown>).aiChat as Record<
            string,
            unknown
        >;

        expect(Object.keys(esAiChat).sort()).toEqual([...AI_CHAT_KEYS].sort());
        expect(Object.keys(enAiChat).sort()).toEqual([...AI_CHAT_KEYS].sort());
        expect(Object.keys(ptAiChat).sort()).toEqual([...AI_CHAT_KEYS].sort());
    });
});
