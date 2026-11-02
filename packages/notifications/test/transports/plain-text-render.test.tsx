import { render } from '@react-email/render';
import { describe, expect, it } from 'vitest';
import { SignupConfirmed } from '../../src/templates/billing/signup-confirmed';

describe('plain-text rendering of a real template (HOS-1990)', () => {
    it('renders readable text without markup', async () => {
        const element = (
            <SignupConfirmed
                planName="Básico"
                firstPaymentAmount="$18.000,00"
                nextChargeDate={null}
            />
        );

        const text = await render(element, { plainText: true });

        expect(text).toContain('Básico');
        expect(text).toContain('Ya cobramos el primer pago');
        expect(text).not.toMatch(/<\/?(html|body|table|div|p)\b/i);
    });
});
