/**
 * Recipient locale resolution (HOS-722, reused by the MCP binding in HOS-2335):
 * the user's `settings.languageWeb` when supported, `es` for anything else, and
 * never a throw.
 *
 * @module test/services/notification-recipient-locale
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findById, warn } = vi.hoisted(() => ({ findById: vi.fn(), warn: vi.fn() }));

vi.mock('@repo/db', () => ({
    UserModel: vi.fn(function () {
        return { findById };
    })
}));
vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: { warn, error: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));

import { resolveRecipientLocale } from '../../src/services/notification-recipient-locale';

const USER_ID = '2f6e1c3a-8b9d-4a7e-b5c4-d3e2f1a0b9c8';

describe('resolveRecipientLocale', () => {
    beforeEach(() => {
        findById.mockReset();
        warn.mockReset();
    });

    it.each(['es', 'en', 'pt'] as const)('returns the stored %s locale', async (locale) => {
        findById.mockResolvedValue({ settings: { languageWeb: locale } });

        await expect(resolveRecipientLocale({ userId: USER_ID })).resolves.toBe(locale);
        expect(findById).toHaveBeenCalledWith(USER_ID);
    });

    it.each([
        ['an unsupported code', { settings: { languageWeb: 'xx' } }],
        ['a path-like value', { settings: { languageWeb: '../x' } }],
        ['an undefined language', { settings: { languageWeb: undefined } }],
        ['settings that are missing', { id: USER_ID }],
        ['a user that does not exist', null]
    ])('falls back to es for %s', async (_label, user) => {
        findById.mockResolvedValue(user);

        await expect(resolveRecipientLocale({ userId: USER_ID })).resolves.toBe('es');
    });

    it('falls back to es without reading anything when there is no user id', async () => {
        await expect(resolveRecipientLocale({ userId: null })).resolves.toBe('es');
        expect(findById).not.toHaveBeenCalled();
    });

    it('falls back to es and does not throw when the lookup fails', async () => {
        findById.mockRejectedValue(new Error('db down'));

        await expect(resolveRecipientLocale({ userId: USER_ID })).resolves.toBe('es');
        expect(warn).toHaveBeenCalledTimes(1);
    });
});
