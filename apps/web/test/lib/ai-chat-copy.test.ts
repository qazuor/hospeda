/**
 * AI chat copy resolution (HOS-1264). Covers the three failure modes that put
 * raw keys and «alojamiento» on a restaurant's chat panel.
 */
import type { AiChatEntityType } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import enAccommodations from '../../../../packages/i18n/src/locales/en/accommodations.json';
import enVenue from '../../../../packages/i18n/src/locales/en/venue.json';
import esAccommodations from '../../../../packages/i18n/src/locales/es/accommodations.json';
import esExperience from '../../../../packages/i18n/src/locales/es/experience.json';
import esVenue from '../../../../packages/i18n/src/locales/es/venue.json';
import ptAccommodations from '../../../../packages/i18n/src/locales/pt/accommodations.json';
import ptVenue from '../../../../packages/i18n/src/locales/pt/venue.json';
import { aiChatCopyKey, resolveAiChatCopy, resolveChatError } from '../../src/lib/ai-chat-copy';
import { pickClientNamespaces } from '../../src/lib/i18n-client-namespaces';

const VERTICALS = ['venue', 'experience'] as const;
const VERTICAL_KEYS = [
    'fabLabel',
    'panelLabel',
    'headerDisclaimer',
    'priceDisclaimer',
    'unavailable'
] as const;

/** Mimics production `t()`: a miss returns the fallback when given, else the KEY. */
const missingT = (key: string, fallback?: string): string => fallback ?? key;

describe('client bundle carries the vertical chat namespaces (root cause)', () => {
    it.each([
        ['venue', esVenue.aiChat],
        ['experience', esExperience.aiChat]
    ] as const)('should ship every %s.aiChat key to the browser', (ns, block) => {
        // Arrange
        const messages: Record<string, string> = {};
        for (const [k, v] of Object.entries(block)) messages[`${ns}.aiChat.${k}`] = v as string;
        messages[`${ns}.somethingElse`] = 'x';

        // Act
        const picked = pickClientNamespaces(messages);

        // Assert
        expect(Object.keys(picked).sort()).toStrictEqual(
            Object.keys(block)
                .map((k) => `${ns}.aiChat.${k}`)
                .sort()
        );
    });
});

describe('resolveAiChatCopy', () => {
    it.each(
        VERTICALS.flatMap((v) => VERTICAL_KEYS.map((k) => [v, k] as const))
    )('should never render the raw key for %s / %s when unresolved', (entityType, suffix) => {
        const out = resolveAiChatCopy({ t: missingT, entityType, suffix });
        expect(out).not.toContain('aiChat');
        expect(out.length).toBeGreaterThan(0);
    });

    it('should not name an accommodation in another vertical fallback', () => {
        for (const entityType of VERTICALS) {
            for (const suffix of VERTICAL_KEYS) {
                expect(resolveAiChatCopy({ t: missingT, entityType, suffix })).not.toMatch(
                    /alojamiento/i
                );
            }
        }
    });

    it('should return the translation when the key resolves', () => {
        const t = (key: string) => (key === 'venue.aiChat.panelLabel' ? 'Panel' : key);
        expect(resolveAiChatCopy({ t, entityType: 'venue', suffix: 'panelLabel' })).toBe('Panel');
    });
});

describe('resolveChatError', () => {
    const base = { t: missingT, message: null } as const;

    it.each([
        ['venue', 'este local'],
        ['experience', 'esta experiencia']
    ] as const)('should name the %s subject on ENTITLEMENT_REQUIRED', (entityType, subject) => {
        const out = resolveChatError({ ...base, entityType, code: 'ENTITLEMENT_REQUIRED' });
        expect(out).toContain(subject);
        expect(out).not.toMatch(/alojamiento/i);
    });

    it.each(
        VERTICALS.flatMap((v) => ['NOT_FOUND', 'LIMIT_REACHED'].map((c) => [v, c] as const))
    )('should not say alojamiento for %s / %s', (entityType, code) => {
        expect(resolveChatError({ ...base, entityType, code })).not.toMatch(/alojamiento/i);
    });

    it.each([
        'accommodation',
        'venue',
        'experience'
    ] as const)('should resolve EMPTY_ANSWER for %s to readable copy (HOS-2095)', (entityType) => {
        const out = resolveChatError({ ...base, entityType, code: 'EMPTY_ANSWER' });
        expect(out).toBe('No pudimos generar una respuesta. Probá de nuevo en un momento.');
    });

    it('should keep saying alojamiento for an accommodation', () => {
        expect(resolveChatError({ ...base, entityType: 'accommodation', code: 'NOT_FOUND' })).toBe(
            'No encontramos este alojamiento.'
        );
    });

    it('should prefer a resolvable API message key', () => {
        const t = (key: string) => (key === 'venue.aiChat.unavailable' ? 'No disponible' : key);
        expect(
            resolveChatError({
                t,
                entityType: 'venue',
                code: 'ENTITLEMENT_REQUIRED',
                message: 'venue.aiChat.unavailable'
            })
        ).toBe('No disponible');
    });

    it('should never render a raw message key or the default key', () => {
        const out = resolveChatError({
            t: missingT,
            entityType: 'experience' as AiChatEntityType,
            code: null,
            message: 'experience.aiChat.unavailable'
        });
        expect(out).not.toContain('aiChat');
    });
});

describe('aiChatCopyKey', () => {
    it('should route vertical keys to the vertical namespace', () => {
        expect(aiChatCopyKey('venue', 'panelLabel')).toBe('venue.aiChat.panelLabel');
        expect(aiChatCopyKey('experience', 'fabLabel')).toBe('experience.aiChat.fabLabel');
    });
});

describe('readNotice (HOS-2075: the reader is named per vertical)', () => {
    const COMMERCE =
        'El comercio puede leer las preguntas que hagas en este chat. No compartas datos personales.';
    const HOST =
        'El anfitrión puede leer las preguntas que hagas en este chat. No compartas datos personales.';

    it.each([
        ['accommodation', 'accommodations.aiChat.readNotice'],
        ['venue', 'venue.aiChat.readNotice'],
        ['experience', 'experience.aiChat.readNotice']
    ] as const)('should route %s to its own key', (entityType, key) => {
        expect(aiChatCopyKey(entityType, 'readNotice')).toBe(key);
    });

    it('should use host wording for an accommodation, never the commerce one', () => {
        const out = resolveAiChatCopy({
            t: missingT,
            entityType: 'accommodation',
            suffix: 'readNotice'
        });
        expect(out).toBe(HOST);
        expect(esAccommodations.aiChat.readNotice).toBe(HOST);
    });

    it.each([
        'venue',
        'experience'
    ] as const)('should keep the commerce wording for %s', (entityType) => {
        const out = resolveAiChatCopy({ t: missingT, entityType, suffix: 'readNotice' });
        expect(out).toBe(COMMERCE);
    });

    it('should ship the venue and experience keys in es', () => {
        expect(esVenue.aiChat.readNotice).toBe(COMMERCE);
        expect(esExperience.aiChat.readNotice).toBe(COMMERCE);
    });

    it.each([
        ['es', esAccommodations.aiChat.readNotice, esVenue.aiChat.readNotice],
        ['en', enAccommodations.aiChat.readNotice, enVenue.aiChat.readNotice],
        ['pt', ptAccommodations.aiChat.readNotice, ptVenue.aiChat.readNotice]
    ] as const)('should differ between accommodation and venue in %s', (_l, acc, venue) => {
        expect(acc.length).toBeGreaterThan(10);
        expect(venue.length).toBeGreaterThan(10);
        expect(acc).not.toBe(venue);
    });
});
