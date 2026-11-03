import { describe, expect, it } from 'vitest';
import { PaymentProviderError } from '../src/provider/errors';

describe('PaymentProviderError governor marker', () => {
    it('adds the marker only when the governor rejected (kills unconditional marker assignment)', () => {
        const ordinary = new PaymentProviderError({
            code: 'UNAVAILABLE',
            capability: 'read',
            message: 'offline'
        });
        const rejected = new PaymentProviderError({
            code: 'UNAVAILABLE',
            capability: 'read',
            message: 'limited',
            governorRejected: true
        });
        expect(Object.hasOwn(ordinary, 'governorRejected')).toBe(false);
        expect(rejected.governorRejected).toBe(true);
    });
});
