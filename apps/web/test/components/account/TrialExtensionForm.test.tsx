/**
 * @file TrialExtensionForm.test.tsx
 * @description RTL tests for the promo-code form (HOS-1012 T-039, HOS-1171).
 *
 * Covers:
 *  - The success message renders the date the SERVER persisted, never a date
 *    the client projected from `extraDays`
 *  - The dashboard is asked to refresh after a successful apply
 *  - A refusal (no trial running, code already used) surfaces the server's
 *    message and leaves the field usable for another attempt
 *  - HOS-1171: the `/validate` pre-flight decides what happens next — a
 *    DISCOUNT and a COMP code are never sent to `/apply`, so they are never
 *    spent, and an invalid code produces a SPECIFIC message rather than the
 *    generic one a 422 would collapse to
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrialExtensionForm } from '../../../src/components/account/TrialExtensionForm.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/account/TrialExtensionForm.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../src/lib/i18n', () => {
    const t = (_key: string, fallback?: string, params?: Record<string, unknown>): string => {
        const raw = fallback ?? _key;
        if (!params) return raw;
        return Object.keys(params).reduce(
            (acc, k) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(params[k])),
            raw
        );
    };
    return { createT: () => t, createTranslations: () => ({ t }) };
});

vi.mock('../../../src/lib/format-utils', () => ({
    formatDate: ({ date }: { date: string }) => `formatted:${date}`
}));

vi.mock('../../../src/lib/api-errors', () => ({
    translateApiError: ({
        error,
        fallback
    }: {
        error?: { message?: string; reason?: string };
        fallback: string;
    }) => error?.reason ?? error?.message ?? fallback
}));

const mockApplyPromoCode = vi.fn();
const mockValidatePromoCode = vi.fn();
vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    billingApi: {
        applyPromoCode: (...args: unknown[]) => mockApplyPromoCode(...args),
        validatePromoCode: (...args: unknown[]) => mockValidatePromoCode(...args)
    }
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SUBSCRIPTION_ID = '33333333-3333-4333-8333-333333333333';
const USER_ID = '11111111-1111-4111-8111-111111111111';

/** A date no client-side projection would produce (in the past, odd time). */
const PERSISTED_TRIAL_END = '2026-02-03T04:05:06.000Z';

/** `/validate` success carrying one effect kind. */
function validAs(effectKind: 'trial_extension' | 'discount' | 'comp') {
    return {
        ok: true,
        data: { valid: true, effectPreview: { effectKind } }
    };
}

/** Types a code and presses the submit button. */
async function submit(code: string) {
    await userEvent.type(screen.getByRole('textbox'), code);
    await userEvent.click(screen.getByRole('button', { name: /Aplicar/ }));
}

describe('TrialExtensionForm (HOS-1012 T-039, HOS-1171)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: a trial-extension code, the only kind this surface applies.
        // Set here rather than per-test because `clearAllMocks` drops calls but
        // NOT implementations — a default left in one test would leak into the
        // next and make it pass for reasons of ordering.
        mockValidatePromoCode.mockResolvedValue(validAs('trial_extension'));
    });

    it('renders the trial end the server persisted, not one projected client-side', async () => {
        // Arrange
        mockApplyPromoCode.mockResolvedValue({
            ok: true,
            data: { effectKind: 'trial_extension', extraDays: 60, trialEnd: PERSISTED_TRIAL_END }
        });
        const onApplied = vi.fn();
        render(
            <TrialExtensionForm
                locale="es"
                userId={USER_ID}
                subscriptionId={SUBSCRIPTION_ID}
                onApplied={onApplied}
            />
        );

        // Act
        await submit('LANZAMIENTO60');

        // Assert
        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent(
                `formatted:${PERSISTED_TRIAL_END}`
            );
        });
        expect(mockApplyPromoCode).toHaveBeenCalledWith({
            code: 'LANZAMIENTO60',
            subscriptionId: SUBSCRIPTION_ID
        });
        // The dashboard must re-read the subscription so the header date agrees.
        expect(onApplied).toHaveBeenCalledTimes(1);
    });

    it('omits subscriptionId when it was not supplied (the standalone redeem page)', async () => {
        // Arrange — the redeem page does not know which row holds the trial;
        // the endpoint resolves the caller's own. Asserted with `toEqual` on the
        // whole object because `objectContaining` is blind to an extra key, and
        // sending `subscriptionId: undefined` is exactly the bug to catch.
        mockApplyPromoCode.mockResolvedValue({
            ok: true,
            data: { effectKind: 'trial_extension', extraDays: 60, trialEnd: PERSISTED_TRIAL_END }
        });
        render(
            <TrialExtensionForm
                locale="es"
                userId={USER_ID}
                variant="redeem"
            />
        );

        // Act
        await submit('LANZAMIENTO60');

        // Assert
        await waitFor(() => {
            expect(mockApplyPromoCode).toHaveBeenCalledTimes(1);
        });
        expect(mockApplyPromoCode.mock.calls[0]?.[0]).toStrictEqual({ code: 'LANZAMIENTO60' });
    });

    it('pre-fills the field from a shared link and applies that code', async () => {
        // Arrange
        mockApplyPromoCode.mockResolvedValue({
            ok: true,
            data: { effectKind: 'trial_extension', extraDays: 60, trialEnd: PERSISTED_TRIAL_END }
        });
        render(
            <TrialExtensionForm
                locale="es"
                userId={USER_ID}
                variant="redeem"
                initialCode="LANZAMIENTO60"
            />
        );

        // Assert — pre-filled, but NOT auto-applied: nothing was sent on mount.
        expect(screen.getByRole('textbox')).toHaveValue('LANZAMIENTO60');
        expect(mockValidatePromoCode).not.toHaveBeenCalled();
        expect(mockApplyPromoCode).not.toHaveBeenCalled();

        // Act — the customer confirms.
        await userEvent.click(screen.getByRole('button', { name: /Aplicar/ }));

        // Assert
        await waitFor(() => {
            expect(mockApplyPromoCode).toHaveBeenCalledTimes(1);
        });
    });

    it('HOS-1171 refuses a DISCOUNT code without spending it', async () => {
        // Arrange
        mockValidatePromoCode.mockResolvedValue(validAs('discount'));
        render(
            <TrialExtensionForm
                locale="es"
                userId={USER_ID}
                variant="redeem"
                plansHref="/es/planes/anfitriones/precios/"
            />
        );

        // Act
        await submit('SAVE30');

        // Assert — the notice, the "see plans" way out, and above all: the code
        // was never sent to /apply, so it is still usable at checkout.
        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent(/es un descuento/i);
        });
        expect(screen.getByRole('link', { name: /Ver planes/ })).toHaveAttribute(
            'href',
            '/es/planes/anfitriones/precios/'
        );
        expect(mockApplyPromoCode).not.toHaveBeenCalled();
        // Not the error style — the code is fine, it just belongs elsewhere.
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('HOS-1195 refuses a COMP code without sending it anywhere', async () => {
        // Arrange
        mockValidatePromoCode.mockResolvedValue(validAs('comp'));
        render(
            <TrialExtensionForm
                locale="es"
                userId={USER_ID}
                variant="redeem"
            />
        );

        // Act
        await submit('HOSPEDA_FREE');

        // Assert
        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent(/no se puede canjear/i);
        });
        expect(mockApplyPromoCode).not.toHaveBeenCalled();
        // The copy must NOT confirm what kind of code it is — "see plans" would.
        expect(screen.queryByRole('link', { name: /Ver planes/ })).toBeNull();
    });

    it('HOS-1171 treats an untyped effect as a discount (fails closed)', async () => {
        // Arrange — a legacy row whose `value_kind` was never backfilled comes
        // back valid with no `effectPreview`. Guessing permissively here would
        // hand it to /apply, which the API refuses anyway — but only after the
        // customer watched a spinner for nothing.
        mockValidatePromoCode.mockResolvedValue({ ok: true, data: { valid: true } });
        render(
            <TrialExtensionForm
                locale="es"
                userId={USER_ID}
                variant="redeem"
            />
        );

        // Act
        await submit('LEGACY10');

        // Assert
        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent(/es un descuento/i);
        });
        expect(mockApplyPromoCode).not.toHaveBeenCalled();
    });

    it('HOS-1171 shows the SPECIFIC validate error, not the generic fallback', async () => {
        // Arrange — this is the whole reason the pre-flight exists: /apply would
        // answer 422, whose status-derived code collapses to VALIDATION_ERROR
        // ("Los datos enviados no son válidos") for a code that simply expired.
        mockValidatePromoCode.mockResolvedValue({
            ok: true,
            data: { valid: false, errorCode: 'PROMO_CODE_EXPIRED' }
        });
        render(
            <TrialExtensionForm
                locale="es"
                userId={USER_ID}
                variant="redeem"
            />
        );

        // Act
        await submit('CADUCADO');

        // Assert
        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Este código ya venció.');
        });
        expect(mockApplyPromoCode).not.toHaveBeenCalled();
    });

    it('surfaces the refusal when no trial is running and keeps the field usable', async () => {
        // Arrange — the 422 the route answers when there is nothing to extend.
        // `reason` is what HOS-1171 whitelisted so the client can tell this
        // apart from every other 422; the mocked translator prefers it.
        mockApplyPromoCode.mockResolvedValue({
            ok: false,
            error: {
                reason: 'NO_ACTIVE_TRIAL',
                message: 'No trial is currently running on this account.'
            }
        });
        render(
            <TrialExtensionForm
                locale="es"
                userId={USER_ID}
                subscriptionId={SUBSCRIPTION_ID}
            />
        );

        // Act
        await submit('FREEMONTH');

        // Assert
        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('NO_ACTIVE_TRIAL');
        });
        // Still a form, not a success state — the code was not consumed.
        expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('does not call the endpoint with an empty code', async () => {
        render(
            <TrialExtensionForm
                locale="es"
                userId={USER_ID}
                subscriptionId={SUBSCRIPTION_ID}
            />
        );

        expect(screen.getByRole('button', { name: /Aplicar/ })).toBeDisabled();
        expect(mockValidatePromoCode).not.toHaveBeenCalled();
        expect(mockApplyPromoCode).not.toHaveBeenCalled();
    });
});
