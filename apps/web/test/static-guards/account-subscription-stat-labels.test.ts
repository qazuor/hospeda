/**
 * @file account-subscription-stat-labels.test.ts
 * @description Static guard for the account dashboard's subscription stat card
 * (H-70 / H-130).
 *
 * The card renders two server-side strings BEFORE any data arrives, and then a
 * client script overwrites them with the real plan. Both server-side strings are
 * therefore LOADING PLACEHOLDERS — but in all three locales they had been
 * translated to the same value as `freeStatus` ("Plan Gratuito" / "Free Plan" /
 * "Plano Gratuito"), while the fallbacks written in the component are the
 * neutral "Plan actual" / "Estado de la suscripción".
 *
 * A translation that turns a loading marker into a claim about the user's plan
 * is a claim the page keeps making whenever the script is slow, blocked, or
 * broken — and an owner on a comped paid plan reads that they have nothing.
 *
 * Since HOS-2473 the card is a kit StatCard fed by `resolveSubscriptionStatText`
 * (`lib/account/general-dashboard.ts`); the last test pins that every live-plan
 * status has a label there.
 *
 * This guard lives under apps/web rather than packages/i18n on purpose:
 * `packages/i18n/test/setup.ts` mocks `node:fs` for the whole package, so a
 * test that reads locale files from there is reading the mock, not the disk.
 *
 * @module test/static-guards/account-subscription-stat-labels
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const LOCALES_DIR = path.resolve(__dirname, '../../../../packages/i18n/src/locales');
const STAT_RESOLVER = path.resolve(__dirname, '../../src/lib/account/general-dashboard.ts');

/** Locales the account dashboard ships in. */
const LOCALES = ['es', 'en', 'pt'] as const;

/** Shape of the stats subtree this guard inspects. */
type StatsLabels = Record<string, unknown>;

/** Reads `pages.dashboard.stats` out of one locale's account.json. */
function readStats(locale: string): StatsLabels {
    const file = path.join(LOCALES_DIR, locale, 'account.json');
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
        pages?: { dashboard?: { stats?: StatsLabels } };
    };
    const stats = parsed.pages?.dashboard?.stats;
    if (!stats) {
        throw new Error(`Missing pages.dashboard.stats in ${locale}/account.json`);
    }
    return stats;
}

describe('account subscription stat card — labels (H-70 / H-130)', () => {
    it('reads every locale (guards against a silently-empty scope)', () => {
        // Arrange & Act
        const found = LOCALES.filter((l) =>
            fs.existsSync(path.join(LOCALES_DIR, l, 'account.json'))
        );
        // Assert
        expect(found).toEqual([...LOCALES]);
    });

    for (const locale of LOCALES) {
        describe(`locale: ${locale}`, () => {
            const stats = readStats(locale);

            it('subscriptionDesc is a neutral placeholder, not the free-plan label', () => {
                // Arrange
                const desc = stats.subscriptionDesc;
                const free = stats.freeStatus;
                // Act & Assert
                expect(typeof desc).toBe('string');
                expect(desc).not.toBe(free);
            });

            it('subscriptionStatus is a neutral placeholder, not the free-plan label', () => {
                // Arrange
                const status = stats.subscriptionStatus;
                const free = stats.freeStatus;
                // Act & Assert
                expect(typeof status).toBe('string');
                expect(status).not.toBe(free);
            });

            it('compStatus exists, is non-empty, and is distinct from the free-plan label', () => {
                // Arrange
                const comp = stats.compStatus;
                // Act & Assert
                expect(typeof comp).toBe('string');
                expect(String(comp ?? '').trim().length).toBeGreaterThan(0);
                expect(comp).not.toBe(stats.freeStatus);
            });

            it.each([
                'gracePeriodStatus',
                'suspendedStatus',
                'cancelScheduledStatus'
            ])('%s exists, is non-empty, and is distinct from the free-plan label', (key) => {
                const label = stats[key];
                expect(typeof label).toBe('string');
                expect(String(label ?? '').trim().length).toBeGreaterThan(0);
                expect(label).not.toBe(stats.freeStatus);
            });
        });
    }

    it('the subscription StatCard resolver names a label for every live-plan status', () => {
        // Arrange — HOS-2473 replaced the DOM script (and its `data-label-*`
        // attributes) with a pure resolver; a status without a label key would
        // render a blank status line under a real plan.
        const source = fs.readFileSync(STAT_RESOLVER, 'utf-8');
        // Act & Assert
        for (const key of [
            'activeStatus',
            'gracePeriodStatus',
            'suspendedStatus',
            'cancelScheduledStatus',
            'pausedStatus',
            // HOS-2553: the two unsettled statuses and what to do about each.
            'chargeDeclinedStatus',
            'pendingAuthorizationStatus',
            'chargeDeclinedAction',
            'pendingAuthorizationAction'
        ]) {
            expect(source).toContain(`account.pages.dashboard.stats.${key}`);
        }
    });
});
