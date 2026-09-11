/**
 * CompGranted email template tests (HOS-1171).
 *
 * Two things are worth pinning here, and neither is "it renders".
 *
 * 1. **The card paragraph is conditional.** A comp granted to a paying customer
 *    hard-cancels their MercadoPago preapproval, and this mail may be the only
 *    place they are told. A comp granted to someone who never subscribed must
 *    not mention a card they never gave us. Deleting the `hadActiveBilling`
 *    branch turns one of these two red whichever way it is deleted.
 *
 * 2. **It does not borrow the courtesy copy.** `courtesy-granted.tsx` promises a
 *    start date, an end date and that billing resumes automatically with the
 *    same card. All three are false for a comp, and the last one is false in the
 *    dangerous direction — it tells someone to expect a charge that cannot
 *    arrive on a preapproval that no longer exists.
 *
 * @module test/templates/comp-granted.templates.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CompGranted, type CompGrantedProps } from '../../src/templates/subscription/comp-granted';

const BASE_PROPS: CompGrantedProps = {
    recipientName: 'Laura Fernández',
    planName: 'Plan Premium',
    hadActiveBilling: false,
    baseUrl: 'https://hospeda.com.ar'
};

describe('CompGranted', () => {
    it('renders the plan name and the CTA', () => {
        const html = renderToStaticMarkup(CompGranted(BASE_PROPS));

        expect(html).toContain('Plan Premium');
        expect(html).toContain('Laura Fernández');
        expect(html).toContain('https://hospeda.com.ar/es/mi-cuenta/suscripcion/');
    });

    it('tells a paying customer their card will not be charged again', () => {
        const html = renderToStaticMarkup(CompGranted({ ...BASE_PROPS, hadActiveBilling: true }));

        expect(html).toContain('débito automático');
        expect(html).toContain('no vamos a hacer más cobros a tu tarjeta');
    });

    it('says nothing about a card to someone who never gave us one', () => {
        const html = renderToStaticMarkup(CompGranted({ ...BASE_PROPS, hadActiveBilling: false }));

        expect(html).not.toContain('tarjeta');
        expect(html).not.toContain('débito automático');
    });

    it('never promises that billing resumes, the way the courtesy mail does', () => {
        for (const hadActiveBilling of [true, false]) {
            const html = renderToStaticMarkup(CompGranted({ ...BASE_PROPS, hadActiveBilling }));

            // The three courtesy sentences that would be lies here.
            expect(html).not.toContain('Empieza el');
            expect(html).not.toContain('Termina el');
            expect(html).not.toContain('vuelve a la normalidad');
        }
    });

    it('states the two facts that make a comp a comp', () => {
        const html = renderToStaticMarkup(CompGranted(BASE_PROPS));

        expect(html).toContain('Sin cargo');
        expect(html).toContain('No vence');
    });
});
