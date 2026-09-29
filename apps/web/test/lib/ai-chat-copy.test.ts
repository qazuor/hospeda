/**
 * AI chat copy resolution (HOS-1264). Covers the three failure modes that put
 * raw keys and «alojamiento» on a restaurant's chat panel.
 */
import type { AiChatEntityType } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import esExperience from '../../../../packages/i18n/src/locales/es/experience.json';
import esGastronomy from '../../../../packages/i18n/src/locales/es/gastronomy.json';
import { aiChatCopyKey, resolveAiChatCopy, resolveChatError } from '../../src/lib/ai-chat-copy';
import { pickClientNamespaces } from '../../src/lib/i18n-client-namespaces';

const VERTICALS = ['gastronomy', 'experience'] as const;
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
        ['gastronomy', esGastronomy.aiChat],
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
        const t = (key: string) => (key === 'gastronomy.aiChat.panelLabel' ? 'Panel' : key);
        expect(resolveAiChatCopy({ t, entityType: 'gastronomy', suffix: 'panelLabel' })).toBe(
            'Panel'
        );
    });
});

describe('resolveChatError', () => {
    const base = { t: missingT, message: null } as const;

    it.each([
        ['gastronomy', 'este local'],
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

    it('should keep saying alojamiento for an accommodation', () => {
        expect(resolveChatError({ ...base, entityType: 'accommodation', code: 'NOT_FOUND' })).toBe(
            'No encontramos este alojamiento.'
        );
    });

    it('should prefer a resolvable API message key', () => {
        const t = (key: string) =>
            key === 'gastronomy.aiChat.unavailable' ? 'No disponible' : key;
        expect(
            resolveChatError({
                t,
                entityType: 'gastronomy',
                code: 'ENTITLEMENT_REQUIRED',
                message: 'gastronomy.aiChat.unavailable'
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
        expect(aiChatCopyKey('gastronomy', 'panelLabel')).toBe('gastronomy.aiChat.panelLabel');
        expect(aiChatCopyKey('experience', 'fabLabel')).toBe('experience.aiChat.fabLabel');
    });
});
