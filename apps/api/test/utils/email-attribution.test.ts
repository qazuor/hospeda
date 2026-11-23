/**
 * @file email-attribution.test.ts
 * @description Pins every email catalog key `apps/api` sends with to a real
 * `EMAIL_CATALOG` entry (HOS-2359 AC-7): an unknown key renders a pixel that no
 * `umami:setup` run creates.
 */
import { EMAIL_CATALOG, findEmailCatalogEntry } from '@repo/notifications';
import { describe, expect, it } from 'vitest';
import {
    AUTH_EMAIL_KEYS,
    buildTransactionalAttribution,
    CONVERSATION_EMAIL_KEYS,
    TOKEN_REMINDER_TEMPLATE_KEYS
} from '../../src/utils/email-attribution';

const ALL_KEYS = [
    ...Object.values(AUTH_EMAIL_KEYS),
    ...Object.values(CONVERSATION_EMAIL_KEYS),
    ...Object.values(TOKEN_REMINDER_TEMPLATE_KEYS)
];

describe('apps/api email attribution keys', () => {
    it('covers the 8 emails the api sends itself', () => {
        expect(new Set(ALL_KEYS).size).toBe(8);
        expect(EMAIL_CATALOG.length).toBeGreaterThanOrEqual(125);
    });

    it.each(ALL_KEYS)('%s is an EMAIL_CATALOG entry', (key) => {
        expect(findEmailCatalogEntry({ key })).toBeDefined();
    });

    it('builds a transactional attribution with the pixel', () => {
        expect(buildTransactionalAttribution({ templateKey: AUTH_EMAIL_KEYS.verifyEmail })).toEqual(
            { medium: 'transactional', templateKey: 'auth.verify-email', includePixel: true }
        );
    });
});
