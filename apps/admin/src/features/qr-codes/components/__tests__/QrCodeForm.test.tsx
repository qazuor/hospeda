// @vitest-environment jsdom
/**
 * `QrCodeForm` — what the panel actually sends (HOS-981 PR 3).
 *
 * THE PROPERTY UNDER TEST IS THE SUBMITTED PAYLOAD, never the markup. The
 * failure this file guards against is invisible on screen: the form looks
 * correct, the save succeeds, and a drawing setting the operator never touched
 * is gone from the stored code. So every assertion is on the object handed to
 * `onSubmit`, compared with `toStrictEqual` — `objectContaining` is blind to a
 * key being present that should not be, and here the extra keys are the damage.
 *
 * The fixture is a code stored RED for that reason: black is the value a broken
 * patch would destroy it into, so a fixture left at the default could not tell
 * the two apart.
 *
 * Labels are queried with regular expressions rather than exact strings. Under
 * the suite's i18n mock a label renders as its key, and `getByLabelText` does
 * not honour `aria-hidden` — an exact-string query is one decoration away from
 * breaking for reasons that have nothing to do with the form.
 */

import type { QrCode } from '@repo/schemas';
import { QrCodeErrorCorrectionLevelEnum, QrCodeFormatEnum, QrCodeSourceEnum } from '@repo/schemas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { diffRenderOptions, QrCodeForm } from '../QrCodeForm';

const RED = '#ff0000';

/** A code stored red, exactly as the API would hand one back. */
function redQrCode(): QrCode {
    return {
        id: '11111111-1111-4111-8111-111111111111',
        slug: 'Live2345',
        targetUrl: 'https://hospeda.com.ar/es/destinos/colon/',
        label: 'Cartelera plaza Ramírez',
        description: null,
        source: QrCodeSourceEnum.MANUAL,
        entityType: null,
        entityId: null,
        renderOptions: {
            errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.M,
            format: QrCodeFormatEnum.SVG,
            margin: 4,
            size: null,
            foregroundColor: RED,
            backgroundColor: '#ffffff'
        },
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        deletedAt: null,
        createdById: null,
        updatedById: null,
        deletedById: null
    } as QrCode;
}

function renderEditForm() {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();
    render(
        <QrCodeForm
            mode="edit"
            initialData={redQrCode()}
            onSubmit={onSubmit}
            onCancel={onCancel}
        />
    );
    return { onSubmit, onCancel };
}

function submit() {
    fireEvent.click(screen.getByRole('button', { name: /actions\.save/i }));
}

describe('QrCodeForm — edit mode', () => {
    /**
     * The retarget: the one edit the whole entity exists for. Asserting the
     * payload rather than the input's value is what makes this a claim about a
     * request leaving, not about React holding state.
     */
    it('submits the new destination', async () => {
        const { onSubmit } = renderEditForm();

        fireEvent.change(screen.getByLabelText(/targetUrlLabel/i), {
            target: { value: 'https://hospeda.com.ar/es/alojamientos/hotel-plaza/' }
        });
        submit();

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0]?.[0]).toStrictEqual({
            targetUrl: 'https://hospeda.com.ar/es/alojamientos/hotel-plaza/'
        });
    });

    /**
     * THE COLOUR-SURVIVAL PROBE, panel side.
     *
     * Changing the margin must send the margin and nothing else. Sending the
     * whole render object would still "work" against a merging API, but it would
     * overwrite whatever a concurrent edit had changed, and it would make the
     * form's own "only what you touch is saved" copy untrue.
     */
    it('a margin change submits the margin alone — the red is not in the payload', async () => {
        const { onSubmit } = renderEditForm();

        fireEvent.change(screen.getByLabelText(/marginLabel/i), { target: { value: '8' } });
        submit();

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        const payload = onSubmit.mock.calls[0]?.[0] as { renderOptions: Record<string, unknown> };

        expect(payload).toStrictEqual({ renderOptions: { margin: 8 } });
        expect(payload.renderOptions).not.toHaveProperty('foregroundColor');
    });

    /**
     * The slug is already printed on a sticker, and the API refuses a body that
     * carries one. Renaming the label must not smuggle it in.
     */
    it('never submits a slug', async () => {
        const { onSubmit } = renderEditForm();

        fireEvent.change(screen.getByLabelText(/labelLabel/i), {
            target: { value: 'Cartelera peatonal' }
        });
        submit();

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0]?.[0]).not.toHaveProperty('slug');
    });

    /** The slug is shown, but as text — there is no field to type into. */
    it('renders the slug read-only, with no editable control for it', () => {
        renderEditForm();

        expect(screen.getByText('Live2345')).toBeInTheDocument();
        expect(screen.queryByLabelText(/slugLabel/i)).toBeNull();
    });

    /**
     * An untouched form submits an empty patch rather than re-writing every
     * field with the value it already had. Also the non-vacuity guard for the
     * tests above: if the form submitted everything unconditionally, they would
     * all pass on a payload that happened to contain the right key.
     */
    it('submits nothing when nothing changed', async () => {
        const { onSubmit } = renderEditForm();

        submit();

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0]?.[0]).toStrictEqual({});
    });

    /**
     * The save button must actually reach `onSubmit`. Reading form state during
     * render freezes it, leaving a button that never enables and a save that
     * neither happens nor complains — with typecheck perfectly happy. Every
     * assertion above depends on this one being true.
     */
    it('reaches onSubmit at all', async () => {
        const { onSubmit } = renderEditForm();

        expect(screen.getByRole('button', { name: /actions\.save/i })).not.toBeDisabled();
        submit();

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    });
});

describe('diffRenderOptions', () => {
    const original = {
        format: QrCodeFormatEnum.SVG,
        errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.M,
        margin: 4,
        size: '',
        foregroundColor: RED,
        backgroundColor: '#ffffff'
    };

    it('returns undefined when nothing moved', () => {
        expect(diffRenderOptions({ ...original }, original)).toBeUndefined();
    });

    it('reports only the field that moved', () => {
        expect(diffRenderOptions({ ...original, margin: 8 }, original)).toStrictEqual({
            margin: 8
        });
    });

    /**
     * Compares against the LOADED row, not against the schema defaults. A code
     * stored red must not be reported as "changed to black" merely because black
     * is what the schema would have defaulted to.
     */
    it('does not report a stored non-default value as a change', () => {
        expect(diffRenderOptions({ ...original, margin: 8 }, original)).not.toHaveProperty(
            'foregroundColor'
        );
    });

    /** An emptied size means "unconstrained", which is `null` and not `0`. */
    it('maps an emptied size to null', () => {
        expect(
            diffRenderOptions({ ...original, size: '' }, { ...original, size: '512' })
        ).toStrictEqual({ size: null });
    });

    it('reports a real colour change', () => {
        expect(
            diffRenderOptions({ ...original, foregroundColor: '#0000ff' }, original)
        ).toStrictEqual({ foregroundColor: '#0000ff' });
    });
});
