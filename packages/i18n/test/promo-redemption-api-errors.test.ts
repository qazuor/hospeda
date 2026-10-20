import { describe, expect, it } from 'vitest';
import { PromoRedemptionReason } from '../../service-core/src/services/billing/promo/promo-redemption-reasons.js';
import en from '../src/locales/en/common.json';
import es from '../src/locales/es/common.json';
import pt from '../src/locales/pt/common.json';

describe('TEST:B9b:2 AC:B9b:2 promo redemption API error texts', () => {
    it('keeps the provider-floor copy literal and translates every reason', () => {
        const reasons = Object.values(PromoRedemptionReason);
        expect(es.apiError.PROMO_BELOW_PROVIDER_MINIMUM).toBe(
            'este código deja el importe por debajo del mínimo que Mercado Pago permite cobrar'
        );
        for (const reason of reasons) {
            expect(es.apiError[reason]).toBeTruthy();
            expect(en.apiError[reason]).toBeTruthy();
            expect(pt.apiError[reason]).toBeTruthy();
        }
    });
});
