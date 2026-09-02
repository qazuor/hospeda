/**
 * @file PayerEmailConfirmDialog.plus.test.tsx
 * @description Regression coverage for HOS-1021 (HOS-937 spec §11 OQ-1,
 * resolved as option 1): a payer email containing `+` must STOP the checkout
 * here and ask for an alternative, never be silently rewritten.
 *
 * MercadoPago rejects a `payer_email` containing `+` outright, answering
 * `User bad request` with no field name and no code. Since `payer_email`
 * became binding, that rejection kills the whole checkout — and MercadoPago
 * never tells the user which email it expected, it just says "contact the
 * seller". The correction therefore has to happen on this screen, before the
 * redirect.
 *
 * Each test below is written to FAIL if a specific piece of the guard is
 * removed; the mapping is stated per test so a future edit cannot weaken one
 * without a red.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PayerEmailConfirmDialog } from '../../../src/components/billing/PayerEmailConfirmDialog.client';

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

/** The `+`-specific copy, as rendered through the fallback-returning i18n mock. */
const PLUS_ERROR =
    'Mercado Pago no acepta emails con «+». Escribí otra dirección para poder pagar.';
/** The generic format copy. Must NOT appear for a `+` address. */
const INVALID_ERROR = 'Ingresá un email válido';

const CONFIRM_LABEL = 'Continuar';

function renderDialog(defaultEmail: string) {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
        <PayerEmailConfirmDialog
            isOpen={true}
            locale="es"
            defaultEmail={defaultEmail}
            onCancel={onCancel}
            onConfirm={onConfirm}
        />
    );
    return { onConfirm, onCancel };
}

describe('PayerEmailConfirmDialog — emails containing "+" (HOS-1021)', () => {
    it('shows the "+" explanation on open, with no interaction at all', () => {
        // Fails if `showError` loses its `|| hasRejectedCharacter` term.
        //
        // This is the load-bearing case: the `+` address is normally the one
        // WE pre-filled from the session, so the user has no reason to touch
        // the field. Gated on `touched`, they would press Continue, watch
        // nothing happen, and have no way to find out why.
        renderDialog('qazuor+smoke@gmail.com');

        expect(screen.getByRole('alert')).toHaveTextContent(PLUS_ERROR);
    });

    it('refuses to confirm a "+" address', async () => {
        // Fails if `isValid` drops `&& !hasRejectedCharacter`, or if
        // `handleConfirm` goes back to testing EMAIL_PATTERN alone — the
        // exact mutation that would let the address reach MercadoPago and
        // die there with an opaque error.
        const user = userEvent.setup();
        const { onConfirm } = renderDialog('qazuor+smoke@gmail.com');

        await user.click(screen.getByRole('button', { name: CONFIRM_LABEL }));

        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('names the "+" as the reason, not the generic format error', () => {
        // Fails if both cases collapse onto `invalidError`. The address IS
        // well-formed, so "enter a valid email" tells the user nothing and
        // leaves them retyping the same thing.
        renderDialog('qazuor+smoke@gmail.com');

        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent(PLUS_ERROR);
        expect(alert).not.toHaveTextContent(INVALID_ERROR);
    });

    it('keeps the generic error for a malformed address that has no "+"', async () => {
        // The negative control for the test above: without it, always
        // rendering the "+" copy would pass every other assertion here.
        const user = userEvent.setup();
        renderDialog('no-arroba');

        await user.click(screen.getByRole('button', { name: CONFIRM_LABEL }));

        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent(INVALID_ERROR);
        expect(alert).not.toHaveTextContent(PLUS_ERROR);
    });

    it('confirms once the user replaces it with an address that has no "+"', async () => {
        // The recovery this whole screen exists for: whatever is typed here
        // is sent as `payerEmail` and wins over both server-side sources
        // (spec §6.3), so a clean replacement must actually get through.
        const user = userEvent.setup();
        const { onConfirm } = renderDialog('qazuor+smoke@gmail.com');

        const input = screen.getByRole('textbox');
        await user.clear(input);
        await user.type(input, 'qazuor@gmail.com');
        await user.click(screen.getByRole('button', { name: CONFIRM_LABEL }));

        expect(onConfirm).toHaveBeenCalledWith('qazuor@gmail.com');
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('detects the "+" after trimming, so surrounding whitespace cannot smuggle it through', async () => {
        // `handleConfirm` passes the TRIMMED value on, so the check has to
        // run on the trimmed value too — otherwise a pasted address with a
        // trailing space is validated as one string and sent as another.
        const user = userEvent.setup();
        const { onConfirm } = renderDialog('  qazuor+smoke@gmail.com  ');

        await user.click(screen.getByRole('button', { name: CONFIRM_LABEL }));

        expect(onConfirm).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent(PLUS_ERROR);
    });
});
