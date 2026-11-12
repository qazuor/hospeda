import {
    AdminSubscriptionStatusSchema,
    RECONCILIATION_ADDON_INSTANCE_STATUS_VALUES,
    RECONCILIATION_EVENT_ACTOR_TYPE_VALUES,
    RECONCILIATION_MANUAL_PAYMENT_STATUS_VALUES,
    RECONCILIATION_MARK_REASON_VALUES,
    RECONCILIATION_PAYMENT_STATUS_VALUES
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { DOMAIN_EVENT_ACTOR_TYPES } from '../src/schemas/domain-event/domain_event.dbschema.ts';
import { ADDON_INSTANCE_STATUSES } from '../src/schemas/vertical/addon-product.dbschema.ts';
import { MANUAL_PAYMENT_STATUSES } from '../src/schemas/vertical/manual-payment.dbschema.ts';
import { PAYMENT_STATUSES } from '../src/schemas/vertical/payment.dbschema.ts';
import { RECONCILIATION_MARK_REASONS } from '../src/schemas/vertical/reconciliation-mark-reasons.ts';
import { SUBSCRIPTION_STATUSES } from '../src/schemas/vertical/subscription.dbschema.ts';

describe('HOS-1761 the admin vocabulary copies in @repo/schemas match @repo/db', () => {
    it('keeps reconciliation reasons in parity', () => {
        // Arrange
        const expected = [...RECONCILIATION_MARK_REASONS];
        // Act
        const actual = RECONCILIATION_MARK_REASON_VALUES;
        // Assert
        expect(actual).toEqual(expected);
    });
    it('keeps subscription statuses in parity', () => {
        // Arrange
        const expected = [...SUBSCRIPTION_STATUSES];
        // Act
        const actual = AdminSubscriptionStatusSchema.options;
        // Assert
        expect(actual).toEqual(expected);
    });
    it('keeps add-on statuses in parity', () => {
        // Arrange
        const expected = [...ADDON_INSTANCE_STATUSES];
        // Act
        const actual = RECONCILIATION_ADDON_INSTANCE_STATUS_VALUES;
        // Assert
        expect(actual).toEqual(expected);
    });
    it('keeps payment statuses in parity', () => {
        // Arrange
        const expected = [...PAYMENT_STATUSES];
        // Act
        const actual = RECONCILIATION_PAYMENT_STATUS_VALUES;
        // Assert
        expect(actual).toEqual(expected);
    });
    it('keeps manual payment statuses in parity', () => {
        // Arrange
        const expected = [...MANUAL_PAYMENT_STATUSES];
        // Act
        const actual = RECONCILIATION_MANUAL_PAYMENT_STATUS_VALUES;
        // Assert
        expect(actual).toEqual(expected);
    });
    it('keeps actor types in parity', () => {
        // Arrange
        const expected = [...DOMAIN_EVENT_ACTOR_TYPES];
        // Act
        const actual = RECONCILIATION_EVENT_ACTOR_TYPE_VALUES;
        // Assert
        expect(actual).toEqual(expected);
    });
});
