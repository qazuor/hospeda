/**
 * HOS-1883 AC-13, AC-15: the adapter maps each add-on fact to its `addon_*` event with an exact
 * payload, never to `billing_*`, and derives a stable `event_uuid` from §4's dedupe key.
 */
import { AnalyticsEventSchemas } from '@repo/analytics';
import { VerticalEnum } from '@repo/schemas';
import type { AddonFact } from '@repo/service-core';
import { describe, expect, it, vi } from 'vitest';
import { deriveAnalyticsEventUuid } from '../../../src/lib/analytics-event-uuid.js';
import { createAnalyticsFactSink } from '../../../src/utils/analytics/analytics-facts.js';

vi.mock('@repo/logger', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/logger')>();
    return {
        ...actual,
        createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn() })
    };
});

const at = new Date('2026-11-01T12:00:00.000Z');
const subject = {
    userId: 'owner-1',
    addonInstanceId: 'inst-1',
    addonId: 'addon-1',
    addonVersionId: 'ver-1',
    addonProductId: 'prod-1',
    chargeKind: 'PERIODICO',
    scopeType: 'LISTING',
    vertical: VerticalEnum.ACCOMMODATION,
    subscriptionId: 'comp-1'
} as const;
const common = {
    addon_instance_id: 'inst-1',
    addon_id: 'addon-1',
    addon_version_id: 'ver-1',
    addon_product_id: 'prod-1',
    charge_kind: 'PERIODICO',
    scope_type: 'LISTING',
    vertical: 'accommodation',
    subscription_id: 'comp-1'
};

function captureOne(fact: AddonFact) {
    const capture = vi.fn();
    createAnalyticsFactSink({ capture }).emit(fact);
    expect(capture).toHaveBeenCalledTimes(1);
    return capture.mock.calls[0]?.[0];
}

const cases: readonly {
    readonly fact: AddonFact;
    readonly event: keyof typeof AnalyticsEventSchemas;
    readonly dedupeKey: string;
    readonly properties: Record<string, unknown>;
}[] = [
    {
        fact: {
            kind: 'ADDON_CHECKOUT_STARTED',
            ...subject,
            actorKind: 'USER',
            occurredAt: at,
            amountMinor: 150000,
            currency: 'ARS',
            cycle: 'monthly'
        },
        event: 'addon_checkout_started',
        dedupeKey: 'inst-1',
        properties: {
            ...common,
            actor_kind: 'USER',
            amount_minor: 150000,
            currency: 'ARS',
            cycle: 'monthly'
        }
    },
    {
        fact: {
            kind: 'ADDON_CHECKOUT_ABANDONED',
            ...subject,
            actorKind: 'SYSTEM',
            occurredAt: at,
            reason: 'WINDOW_EXPIRED',
            secondsInPending: 3600
        },
        event: 'addon_checkout_abandoned',
        dedupeKey: 'inst-1',
        properties: {
            ...common,
            actor_kind: 'SYSTEM',
            reason: 'WINDOW_EXPIRED',
            seconds_in_pending: 3600
        }
    },
    {
        fact: {
            kind: 'ADDON_ACTIVATED',
            ...subject,
            actorKind: 'SYSTEM',
            occurredAt: at,
            amountMinor: 150000,
            currency: 'ARS',
            cycle: 'monthly',
            secondsInPending: 60
        },
        event: 'addon_activated',
        dedupeKey: 'inst-1',
        properties: {
            ...common,
            actor_kind: 'SYSTEM',
            amount_minor: 150000,
            currency: 'ARS',
            cycle: 'monthly',
            seconds_in_pending: 60
        }
    },
    {
        fact: {
            kind: 'ADDON_CHARGE_CREDITED',
            ...subject,
            actorKind: 'SYSTEM',
            occurredAt: at,
            paymentId: 'pay-1',
            amountMinor: 150000,
            currency: 'ARS',
            isFirstCharge: true,
            cycle: 'monthly',
            promoApplied: false
        },
        event: 'addon_charge_succeeded',
        dedupeKey: 'pay-1',
        properties: {
            ...common,
            actor_kind: 'SYSTEM',
            payment_id: 'pay-1',
            amount_minor: 150000,
            currency: 'ARS',
            is_first_charge: true,
            cycle: 'monthly',
            promo_applied: false
        }
    },
    {
        fact: {
            kind: 'ADDON_CHARGE_REJECTED',
            ...subject,
            actorKind: 'SYSTEM',
            occurredAt: at,
            paymentId: 'pay-2',
            amountMinor: 150000,
            currency: 'ARS',
            isFirstCharge: false,
            hasRetryWindow: true
        },
        event: 'addon_charge_declined',
        dedupeKey: 'pay-2',
        properties: {
            ...common,
            actor_kind: 'SYSTEM',
            payment_id: 'pay-2',
            amount_minor: 150000,
            currency: 'ARS',
            is_first_charge: false,
            has_retry_window: true
        }
    },
    {
        fact: {
            kind: 'ADDON_CANCELLED',
            ...subject,
            actorKind: 'USER',
            occurredAt: at,
            path: 'OWNER_WITHDREW',
            wasScheduled: false,
            lifetimeDays: 12
        },
        event: 'addon_cancelled',
        dedupeKey: 'inst-1',
        properties: {
            ...common,
            actor_kind: 'USER',
            path: 'OWNER_WITHDREW',
            was_scheduled: false,
            lifetime_days: 12
        }
    },
    {
        fact: {
            kind: 'ADDON_GRANTED_FREE',
            ...subject,
            actorKind: 'ADMIN',
            occurredAt: at,
            source: 'S20_CONVERSION',
            previousAmountMinor: 150000,
            previousCycle: 'monthly',
            previousSubscriptionId: 'comp-0'
        },
        event: 'addon_granted_free',
        dedupeKey: 'inst-1',
        properties: {
            ...common,
            actor_kind: 'ADMIN',
            source: 'S20_CONVERSION',
            previous_amount_minor: 150000,
            previous_cycle: 'monthly',
            previous_subscription_id: 'comp-0'
        }
    }
];

describe('add-on analytics facts adapter (HOS-1883 AC-13, AC-15)', () => {
    it.each(cases)('maps $fact.kind to $event with an exact, schema-valid payload', (testCase) => {
        // Arrange + Act
        const captured = captureOne(testCase.fact);

        // Assert
        expect(captured).toEqual({
            distinctId: 'owner-1',
            name: testCase.event,
            properties: testCase.properties,
            uuid: deriveAnalyticsEventUuid({
                event: testCase.event,
                dedupeKey: testCase.dedupeKey
            }),
            timestamp: at
        });
        expect(String(captured?.name).startsWith('billing_')).toBe(false);
        expect(AnalyticsEventSchemas[testCase.event].parse(captured?.properties)).toEqual(
            testCase.properties
        );
    });

    it('omits absent optional properties instead of sending undefined keys', () => {
        // Arrange
        const { vertical: _v, subscriptionId: _s, ...bare } = subject;

        // Act
        const captured = captureOne({
            kind: 'ADDON_CANCELLED',
            ...bare,
            chargeKind: 'UNA_VEZ',
            actorKind: 'SYSTEM',
            occurredAt: at,
            path: 'LISTING_PURGED',
            wasScheduled: false
        });

        // Assert
        expect(captured?.properties).toEqual({
            addon_instance_id: 'inst-1',
            addon_id: 'addon-1',
            addon_version_id: 'ver-1',
            addon_product_id: 'prod-1',
            charge_kind: 'UNA_VEZ',
            scope_type: 'LISTING',
            actor_kind: 'SYSTEM',
            path: 'LISTING_PURGED',
            was_scheduled: false
        });
    });

    it('derives the same event_uuid for a repeated fact, so a replay deduplicates', () => {
        // Arrange
        const fact = cases[3]?.fact;
        if (!fact) throw new Error('missing case');

        // Act
        const first = captureOne(fact);
        const second = captureOne(fact);

        // Assert
        expect(second?.uuid).toBe(first?.uuid);
    });

    it('still drops a HOS-1878 fact of a COMPLEMENTO, so add-on revenue never reaches billing_*', () => {
        // Arrange
        const capture = vi.fn();

        // Act
        createAnalyticsFactSink({ capture }).emit({
            kind: 'CHARGE_CREDITED',
            userId: 'owner-1',
            vertical: VerticalEnum.ACCOMMODATION,
            subscriptionId: 'comp-1',
            subscriptionClass: 'COMPLEMENTO',
            actorKind: 'SYSTEM',
            occurredAt: at,
            paymentId: 'pay-1',
            amountMinor: 150000,
            currency: 'ARS',
            isFirstCharge: true,
            cycle: 'monthly'
        });

        // Assert
        expect(capture).not.toHaveBeenCalled();
    });

    it('does not propagate a failed capture of an add-on event', () => {
        // Arrange
        const capture = vi.fn(() => {
            throw new Error('offline');
        });
        const fact = cases[0]?.fact;
        if (!fact) throw new Error('missing case');

        // Act + Assert
        expect(() => createAnalyticsFactSink({ capture }).emit(fact)).not.toThrow();
        expect(capture).toHaveBeenCalledTimes(1);
    });
});
