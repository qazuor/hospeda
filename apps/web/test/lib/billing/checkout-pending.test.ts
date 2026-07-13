/**
 * @file checkout-pending.test.ts
 * @description Unit tests for the paid-checkout sessionStorage plumbing
 * (HOS-151 Bug A).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    CHECKOUT_PENDING_SUB_KEY,
    clearPendingCheckoutSubId,
    readPendingCheckoutSubId,
    storePendingCheckoutSubId
} from '../../../src/lib/billing/checkout-pending';

describe('checkout-pending sessionStorage helpers', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
    });
    afterEach(() => {
        window.sessionStorage.clear();
        vi.restoreAllMocks();
    });

    it('stores and reads back the pending subscription id under the shared key', () => {
        storePendingCheckoutSubId('sub-uuid');

        expect(window.sessionStorage.getItem(CHECKOUT_PENDING_SUB_KEY)).toBe('sub-uuid');
        expect(readPendingCheckoutSubId()).toBe('sub-uuid');
    });

    it('returns null when nothing is stored', () => {
        expect(readPendingCheckoutSubId()).toBeNull();
    });

    it('clears the stored id', () => {
        storePendingCheckoutSubId('sub-uuid');
        clearPendingCheckoutSubId();

        expect(readPendingCheckoutSubId()).toBeNull();
        expect(window.sessionStorage.getItem(CHECKOUT_PENDING_SUB_KEY)).toBeNull();
    });

    it('treats an empty stored value as absent', () => {
        window.sessionStorage.setItem(CHECKOUT_PENDING_SUB_KEY, '');
        expect(readPendingCheckoutSubId()).toBeNull();
    });

    it('degrades to null (never throws) when sessionStorage access throws', () => {
        vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => {
            throw new Error('storage disabled');
        });
        expect(() => readPendingCheckoutSubId()).not.toThrow();
        expect(readPendingCheckoutSubId()).toBeNull();
    });

    it('store degrades to a no-op (never throws) when sessionStorage access throws', () => {
        vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
            throw new Error('storage disabled');
        });
        expect(() => storePendingCheckoutSubId('sub-uuid')).not.toThrow();
    });
});
