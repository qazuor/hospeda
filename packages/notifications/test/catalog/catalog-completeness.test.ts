/**
 * Completeness and shape of the email template catalog (HOS-2519 AC-4.1,
 * AC-4.3). The outbox half of completeness (AC-4.2) lives in `apps/api`,
 * which owns the renderer registry.
 */
import { describe, expect, it } from 'vitest';
import { EMAIL_CATALOG, findEmailCatalogEntry } from '../../src/catalog/index';
import { NOTIFICATION_TYPES_WITH_TEMPLATE } from '../../src/services/notification-render';
import { NotificationType } from '../../src/types/notification.types';

/**
 * The six `NotificationType` values without a notification template, and the
 * catalog entry that covers each instead. Frozen on purpose: a new enum value
 * must get a `notification.*` entry or be added here with its real path.
 */
const NOTIFICATION_TYPES_COVERED_ELSEWHERE: Readonly<Record<string, string>> = Object.freeze({
    [NotificationType.TRIAL_ENDING_2D]: 'outbox.trial_ending_2d',
    [NotificationType.TRIAL_ENDING_TODAY]: 'outbox.trial_ending_today',
    [NotificationType.TRIAL_WIN_BACK_15D]: 'outbox.trial_win_back_15d',
    [NotificationType.NEWSLETTER_VERIFICATION]: 'newsletter.verify',
    [NotificationType.NEWSLETTER_WELCOME]: 'newsletter.welcome',
    [NotificationType.NEWSLETTER_CAMPAIGN]: 'newsletter.campaign'
});

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe('email catalog completeness', () => {
    it('has a notification entry for every type with a template, and an exception for the rest', () => {
        for (const type of Object.values(NotificationType)) {
            const elsewhere = NOTIFICATION_TYPES_COVERED_ELSEWHERE[type];
            if (elsewhere) {
                expect(
                    NOTIFICATION_TYPES_WITH_TEMPLATE,
                    `${type} is listed as covered elsewhere but has a notification template`
                ).not.toContain(type);
                expect(
                    findEmailCatalogEntry({ key: elsewhere }),
                    `${elsewhere} is missing`
                ).toBeDefined();
                continue;
            }
            expect(
                findEmailCatalogEntry({ key: `notification.${type}` }),
                `notification.${type} has no catalog entry and no exception`
            ).toBeDefined();
        }
    });

    it('has exactly the 46 notification entries renderNotificationEmail supports', () => {
        const ids = EMAIL_CATALOG.filter((entry) => entry.sendPath === 'notification').map(
            (entry) => entry.id
        );
        expect(ids).toHaveLength(46);
        expect(new Set(ids)).toEqual(new Set(NOTIFICATION_TYPES_WITH_TEMPLATE));
    });

    it.each([
        ['auth', 2],
        ['conversation', 6],
        ['alert-digest', 1],
        ['newsletter', 3],
        ['outbox', 65]
    ] as const)('has %s entries: %i', (sendPath, count) => {
        expect(EMAIL_CATALOG.filter((entry) => entry.sendPath === sendPath)).toHaveLength(count);
    });

    it('marks only the newsletter verify and welcome entries as not wired', () => {
        expect(EMAIL_CATALOG.filter((entry) => !entry.wired).map((entry) => entry.key)).toEqual([
            'newsletter.verify',
            'newsletter.welcome'
        ]);
    });
});

describe('email catalog shape', () => {
    it('has unique keys built from the send path and the id', () => {
        const keys = EMAIL_CATALOG.map((entry) => entry.key);
        expect(new Set(keys).size).toBe(keys.length);
        for (const entry of EMAIL_CATALOG) {
            expect(entry.key).toBe(`${entry.sendPath}.${entry.id}`);
        }
    });

    it('gives every entry a name and 1+ scenarios with unique kebab-case ids and labels', () => {
        for (const entry of EMAIL_CATALOG) {
            expect(entry.name.trim(), entry.key).not.toBe('');
            expect(entry.scenarios.length, entry.key).toBeGreaterThan(0);
            const ids = entry.scenarios.map((scenario) => scenario.id);
            expect(new Set(ids).size, `${entry.key} has duplicate scenario ids`).toBe(ids.length);
            for (const scenario of entry.scenarios) {
                expect(scenario.id, entry.key).toMatch(KEBAB_CASE);
                expect(scenario.label.trim(), `${entry.key}/${scenario.id}`).not.toBe('');
            }
        }
    });

    it('returns undefined for an unknown key', () => {
        expect(findEmailCatalogEntry({ key: 'outbox.no-such-template' })).toBeUndefined();
    });
});
