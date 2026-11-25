/**
 * HOS-2603 regression: the newsletter subscriber service must be built with a real
 * notification dispatcher.
 *
 * Without one the service falls back to a no-op dispatcher and the double opt-in
 * verification email is never sent: the guest subscribe route answers
 * `201 pending_verification` and the row stays pending forever.
 *
 * Two layers:
 * - behavioural: each singleton hands the service a dispatcher with both methods;
 * - static: every `new NewsletterSubscriberService(` in `apps/api/src` names
 *   `notificationDispatcher`, so a third construction site cannot reintroduce the trap.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { constructorSpy } = vi.hoisted(() => ({ constructorSpy: vi.fn() }));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    class SpiedNewsletterSubscriberService {
        constructor(...args: unknown[]) {
            constructorSpy(...args);
        }
    }
    return { ...actual, NewsletterSubscriberService: SpiedNewsletterSubscriberService };
});

vi.mock('../../../src/utils/env', () => ({
    env: {
        HOSPEDA_NEWSLETTER_HMAC_SECRET: 'test-hmac-secret-test-hmac-secret',
        HOSPEDA_NEWSLETTER_HMAC_SECRET_PREV: undefined,
        HOSPEDA_NEWSLETTER_SOFTCAP_DAYS: 7,
        HOSPEDA_EMAIL_API_KEY: 'test-key',
        HOSPEDA_API_URL: 'https://api.example.test',
        HOSPEDA_SITE_URL: 'https://example.test',
        NODE_ENV: 'test'
    }
}));

import {
    _resetNewsletterRouteSingletons,
    getDefaultNewsletterService as getProtectedService
} from '../../../src/routes/newsletter/protected/_singletons';
import {
    _resetProfileRouteSingletons,
    getDefaultNewsletterService as getProfileService
} from '../../../src/routes/profile/protected/_singletons';

const API_SRC = resolve(__dirname, '../../../src');

function collectSourceFiles(dir: string): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            found.push(...collectSourceFiles(full));
        } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
            found.push(full);
        }
    }
    return found;
}

describe('NewsletterSubscriberService dispatcher wiring (HOS-2603)', () => {
    beforeEach(() => {
        constructorSpy.mockClear();
        _resetNewsletterRouteSingletons();
        _resetProfileRouteSingletons();
    });

    it.each([
        [
            'newsletter protected singleton (also serves the guest subscribe/resend routes)',
            getProtectedService
        ],
        ['profile protected singleton', getProfileService]
    ])('%s injects a real dispatcher', (_label, getService) => {
        // Arrange / Act
        getService();

        // Assert
        expect(constructorSpy).toHaveBeenCalledTimes(1);
        const options = constructorSpy.mock.calls[0]?.[1] as {
            notificationDispatcher?: { sendVerification?: unknown; sendWelcome?: unknown };
        };
        expect(typeof options.notificationDispatcher?.sendVerification).toBe('function');
        expect(typeof options.notificationDispatcher?.sendWelcome).toBe('function');
    });

    it('every construction site in apps/api/src passes notificationDispatcher', () => {
        // Arrange
        const offenders: string[] = [];

        // Act
        for (const file of collectSourceFiles(API_SRC)) {
            const source = readFileSync(file, 'utf8');
            let from = source.indexOf('new NewsletterSubscriberService(');
            while (from !== -1) {
                const window = source.slice(from, from + 600);
                if (!window.includes('notificationDispatcher')) {
                    offenders.push(relative(API_SRC, file));
                }
                from = source.indexOf('new NewsletterSubscriberService(', from + 1);
            }
        }

        // Assert
        expect(offenders).toEqual([]);
    });
});
