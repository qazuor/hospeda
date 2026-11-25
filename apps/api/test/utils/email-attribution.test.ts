/**
 * @file email-attribution.test.ts
 * @description Pins every email catalog key `apps/api` sends with to a real
 * `EMAIL_CATALOG` entry (HOS-2359 AC-7): an unknown key tags a template nothing else knows.
 */
import { EMAIL_CATALOG, findEmailCatalogEntry } from '@repo/notifications';
import { describe, expect, it } from 'vitest';
import {
    AUTH_EMAIL_KEYS,
    buildAppEmailLayout,
    buildTransactionalAttribution,
    CONVERSATION_EMAIL_KEYS,
    NEWSLETTER_EMAIL_KEYS,
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
        expect(EMAIL_CATALOG.length).toBeGreaterThanOrEqual(123);
    });

    it.each(ALL_KEYS)('%s is an EMAIL_CATALOG entry', (key) => {
        expect(findEmailCatalogEntry({ key })).toBeDefined();
    });

    it.each(
        Object.values(NEWSLETTER_EMAIL_KEYS)
    )('%s is an EMAIL_CATALOG entry the newsletter dispatcher sends', (key) => {
        expect(findEmailCatalogEntry({ key })?.wired).toBe(true);
    });

    it('builds a transactional attribution', () => {
        expect(buildTransactionalAttribution({ templateKey: AUTH_EMAIL_KEYS.verifyEmail })).toEqual(
            { medium: 'transactional', templateKey: 'auth.verify-email' }
        );
    });

    it.each(
        Object.values(AUTH_EMAIL_KEYS)
    )('HOS-2580 sends %s with the account illustration its entry declares', (templateKey) => {
        expect(buildAppEmailLayout({ templateKey }).illustration).toBe('account');
    });
});
