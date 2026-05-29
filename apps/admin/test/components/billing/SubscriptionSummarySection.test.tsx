/**
 * @file SubscriptionSummarySection.test.tsx
 * @description Source-based + helper-function tests for the Section 1
 * component of Mi facturación (SPEC-156 T-034). The full render path lives
 * inside the smoke test (account.smoke.test.tsx); these tests target the
 * pure helpers and the wiring of route + hook in source.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    formatPeriodEnd,
    statusBadgeVariant,
    statusTranslationKey
} from '../../../src/components/billing/SubscriptionSummarySection';

const sectionSrc = readFileSync(
    resolve(__dirname, '../../../src/components/billing/SubscriptionSummarySection.tsx'),
    'utf8'
);

describe('statusTranslationKey (T-034)', () => {
    it('maps known statuses 1:1 to admin-pages.billing.subscription.status.* keys', () => {
        expect(statusTranslationKey('active')).toBe(
            'admin-pages.billing.subscription.status.active'
        );
        expect(statusTranslationKey('trialing')).toBe(
            'admin-pages.billing.subscription.status.trialing'
        );
        expect(statusTranslationKey('past_due')).toBe(
            'admin-pages.billing.subscription.status.past_due'
        );
    });

    it('collapses cancelled (en-GB) to canceled (en-US) for the i18n key', () => {
        expect(statusTranslationKey('cancelled')).toBe(
            'admin-pages.billing.subscription.status.canceled'
        );
        expect(statusTranslationKey('canceled')).toBe(
            'admin-pages.billing.subscription.status.canceled'
        );
    });

    it('falls back to .unknown for missing or unrecognized statuses', () => {
        expect(statusTranslationKey(undefined)).toBe(
            'admin-pages.billing.subscription.status.unknown'
        );
        expect(statusTranslationKey('weird_status')).toBe(
            'admin-pages.billing.subscription.status.unknown'
        );
    });
});

describe('statusBadgeVariant (T-034)', () => {
    it('marks active + trialing as default tone', () => {
        expect(statusBadgeVariant('active')).toBe('default');
        expect(statusBadgeVariant('trialing')).toBe('default');
    });

    it('marks past_due + canceled + incomplete_expired as destructive tone', () => {
        expect(statusBadgeVariant('past_due')).toBe('destructive');
        expect(statusBadgeVariant('canceled')).toBe('destructive');
        expect(statusBadgeVariant('cancelled')).toBe('destructive');
        expect(statusBadgeVariant('incomplete_expired')).toBe('destructive');
    });

    it('falls back to outline for unknown statuses', () => {
        expect(statusBadgeVariant(undefined)).toBe('outline');
        expect(statusBadgeVariant('weird_status')).toBe('outline');
    });
});

describe('formatPeriodEnd (T-034)', () => {
    it('returns null when the date is missing', () => {
        expect(formatPeriodEnd(undefined, 'es')).toBeNull();
    });

    it('returns null when the date is malformed', () => {
        expect(formatPeriodEnd('not-a-date', 'es')).toBeNull();
    });

    it('returns a non-empty localized date when the ISO is valid', () => {
        const out = formatPeriodEnd('2026-12-31T00:00:00.000Z', 'es');
        expect(out).not.toBeNull();
        expect((out ?? '').length).toBeGreaterThan(0);
    });
});

describe('SubscriptionSummarySection.tsx (T-034)', () => {
    it('wires to GET /api/v1/protected/billing/subscriptions via useMySubscription', () => {
        expect(sectionSrc).toContain('useMySubscription');
        expect(sectionSrc).toContain("from '@/hooks/use-my-billing'");
    });

    it('renders a loading skeleton when the query is in flight', () => {
        expect(sectionSrc).toContain('data-testid="subscription-loading"');
    });

    it('renders an error message when the query fails', () => {
        expect(sectionSrc).toContain("'admin-pages.billing.subscription.errorLoading'");
    });

    it('renders the noActive empty state when the API returns null', () => {
        expect(sectionSrc).toContain('admin-pages.billing.subscription.noActive.title');
        expect(sectionSrc).toContain('admin-pages.billing.subscription.noActive.description');
    });

    it('renders the status badge + currentPeriodEnd when there is an active row', () => {
        expect(sectionSrc).toContain('data-testid="subscription-status-badge"');
        expect(sectionSrc).toContain('admin-pages.billing.subscription.currentPeriodEnd');
    });
});
