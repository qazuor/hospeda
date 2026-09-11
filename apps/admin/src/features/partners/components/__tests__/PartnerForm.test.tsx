// @vitest-environment jsdom
/**
 * PartnerForm — regression tests for the silent submit (H-161).
 *
 * THE PROPERTY UNDER TEST IS THAT A REQUEST LEAVES, not that the form renders.
 * The bug this file exists for produced a form that looked entirely healthy:
 * the submit button was enabled, `checkValidity()` answered true, no field went
 * `aria-invalid`, the console stayed clean — and no PUT was ever emitted. Four
 * save attempts through three different input methods all landed on that same
 * nothing. So every test here asserts on `onSubmit`, the callback that carries
 * the request, and never on markup that was already correct while the bug was
 * live.
 *
 * Two independent defects meet in that silence and each gets its own test:
 *
 * 1. A hand-written `planId` validator demanded a value the schema declares
 *    `.nullable().optional()`. Every partner in production carries
 *    `plan_id = NULL`, so editing ANY of them was blocked before the submit
 *    handler ran.
 * 2. `form.handleSubmit()` resolves normally when a field validator refuses, so
 *    the abort had no channel at all. Even a legitimately invalid form must say
 *    so — a save that neither succeeds nor complains is worse than one that
 *    fails loudly.
 */

import { PartnerSubscriptionStatusEnum, PartnerTierEnum, PartnerTypeEnum } from '@repo/schemas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import type { PartnerFormProps } from '../PartnerForm';
import { PartnerForm } from '../PartnerForm';

const PLAN_ID = '00000000-0000-4000-a000-0000000000b1';

const PLANS: PartnerFormProps['plans'] = [
    {
        id: PLAN_ID,
        slug: 'partner-gold',
        name: 'Partner Gold',
        description: null,
        monthlyPriceArs: 1_500_000
    }
];

/**
 * A partner exactly as production holds one.
 *
 * Copied from the shape of `partners` on prod, where all 8 live rows carry
 * `plan_id = NULL` — that null is the whole point of the fixture, so do not
 * "fix" it into a uuid.
 */
function prodPartner() {
    return {
        name: 'Fundación Entre Ríos Sustentable',
        slug: 'fundacion-entre-rios-sustentable',
        type: PartnerTypeEnum.NGO,
        tier: PartnerTierEnum.GOLD,
        logoUrl: 'https://images.pexels.com/photos/1108572/pexels-photo-1108572.jpeg',
        websiteUrl: 'https://www.entreriossustentable.org.ar',
        description: 'Una fundación de prueba.',
        planId: null,
        subscriptionStatus: PartnerSubscriptionStatusEnum.ACTIVE,
        lifecycleState: 'ACTIVE',
        startsAt: new Date('2025-01-15T00:00:00.000Z'),
        endsAt: null
    } as unknown as PartnerFormProps['initialData'];
}

function renderForm(overrides: Partial<PartnerFormProps> = {}) {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
        <PartnerForm
            initialData={prodPartner()}
            plans={PLANS}
            submitLabel="Guardar cambios"
            onSubmit={onSubmit}
            {...overrides}
        />
    );
    return { onSubmit };
}

/** The submit button, addressed by role so a copy change does not break this. */
function submitButton() {
    return screen.getByRole('button', { name: /Guardar cambios/ });
}

describe('PartnerForm — the save actually leaves (H-161)', () => {
    it('submits a production partner whose planId is null', async () => {
        const { onSubmit } = renderForm();

        fireEvent.click(submitButton());

        // The assertion is the CALL, not the absence of an error message: the
        // bug rendered no error message either.
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
            slug: 'fundacion-entre-rios-sustentable',
            tier: PartnerTierEnum.GOLD,
            planId: null
        });
    });

    it('carries an edited tier through to the submitted values', async () => {
        const { onSubmit } = renderForm();

        // Changing the tier is the operation H-161 blocked outright, and per
        // HOS-294 it is the one that decides whether the partner has a public
        // page at all.
        fireEvent.change(screen.getByLabelText(/^Tier/), {
            target: { value: PartnerTierEnum.SILVER }
        });
        fireEvent.click(submitButton());

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ tier: PartnerTierEnum.SILVER });
    });

    it('submits a partner that does have a plan', async () => {
        const { onSubmit } = renderForm({
            initialData: { ...prodPartner(), planId: PLAN_ID } as PartnerFormProps['initialData']
        });

        fireEvent.click(submitButton());

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ planId: PLAN_ID });
    });
});

describe('PartnerForm — a refused save says so (H-161)', () => {
    it('shows an error instead of doing nothing when a required field is empty', async () => {
        // The name IS genuinely required, by the schema and by the validator
        // alike. What must never happen again is the click landing on silence.
        const { onSubmit } = renderForm({
            initialData: { ...prodPartner(), name: '' } as PartnerFormProps['initialData']
        });

        fireEvent.click(submitButton());

        await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
        expect(onSubmit).not.toHaveBeenCalled();
    });
});

describe('PartnerForm — a rejected save says so (HOS-1061)', () => {
    /**
     * Before this fix, a `PUT` that answered 409 (a slug already used by
     * another partner) left `await onSubmit(result.data)` uncaught: the
     * rejection vanished, nothing rendered, and the operator was left
     * believing the save had succeeded while their edit never persisted.
     */
    it('shows role="alert" and marks the slug field when the save rejects with a 409 slug conflict', async () => {
        const conflictMessage = 'A partner with this slug already exists';
        const onSubmit = vi
            .fn()
            .mockRejectedValue(new ApiError(conflictMessage, { status: 409, code: 'CONFLICT' }));

        render(
            <PartnerForm
                initialData={prodPartner()}
                plans={PLANS}
                submitLabel="Guardar cambios"
                onSubmit={onSubmit}
            />
        );

        fireEvent.click(submitButton());

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

        // The form-wide alert AND the slug field's own error both say it —
        // an operator scanning only the field, or only the top of the form,
        // must see it either way.
        await waitFor(() => {
            const alert = screen.getByRole('alert');
            expect(alert).toHaveTextContent(conflictMessage);
        });
        const matches = await screen.findAllByText(conflictMessage);
        expect(matches.length).toBeGreaterThanOrEqual(2);

        // The operator's slug input keeps their (duplicate) value on
        // screen — it must NOT look like a successful save discarded it.
        expect(screen.getByLabelText(/^Slug/)).toHaveValue(prodPartner()?.slug);
    });

    it('clears the slug field conflict as soon as the operator edits the slug again', async () => {
        const conflictMessage = 'A partner with this slug already exists';
        const onSubmit = vi
            .fn()
            .mockRejectedValue(new ApiError(conflictMessage, { status: 409, code: 'CONFLICT' }));

        render(
            <PartnerForm
                initialData={prodPartner()}
                plans={PLANS}
                submitLabel="Guardar cambios"
                onSubmit={onSubmit}
            />
        );

        fireEvent.click(submitButton());
        await waitFor(() => expect(screen.getAllByText(conflictMessage).length).toBeGreaterThan(0));

        fireEvent.change(screen.getByLabelText(/^Slug/), {
            target: { value: 'fundacion-entre-rios-sustentable-2' }
        });

        // The form-wide alert may persist until the next submit attempt, but
        // the slug field's own conflict marker must clear immediately —
        // otherwise it keeps blaming a value the operator already changed.
        await waitFor(() => expect(screen.getAllByText(conflictMessage).length).toBe(1));
    });

    it('still shows the generic global error for a non-409 failure (unchanged behavior)', async () => {
        const onSubmit = vi.fn().mockRejectedValue(new Error('Network error'));

        render(
            <PartnerForm
                initialData={prodPartner()}
                plans={PLANS}
                submitLabel="Guardar cambios"
                onSubmit={onSubmit}
            />
        );

        fireEvent.click(submitButton());

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Network error');
        });
    });
});
