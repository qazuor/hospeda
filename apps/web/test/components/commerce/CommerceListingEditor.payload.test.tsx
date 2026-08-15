/**
 * @file CommerceListingEditor.payload.test.tsx
 * @description Payload-contract tests for the commerce owner editor (HOS-258).
 *
 * These tests pin the EXACT shape of the PATCH body produced by `buildPayload`,
 * field group by field group, BEFORE the state-consolidation refactor of HOS-258
 * PR 1 replaces the manual `dirty` Set with a diff against a `baseline` snapshot.
 *
 * They exist because `buildPayload` is not a uniform diff — it carries per-field
 * semantics that a naive rewrite silently flattens:
 *
 *  - gastronomy `priceRange`/`menuUrl` are `.nullish()` on the domain schema and
 *    send an explicit `null` when cleared;
 *  - experience `priceFrom` REJECTS `null` (T-021) and must omit the key
 *    entirely when cleared; `priceUnit` no longer does — H-156 made the column
 *    nullable, so it clears to an explicit `null` like the gastronomy fields;
 *  - `contactInfo`/`socialNetworks`/the four i18n fields are replaced WHOLESALE,
 *    so the payload must carry the untouched members too — the JSONB block is
 *    overwritten server-side, not merged;
 *  - `media` is never sent at all since HOS-372: photos are persisted per
 *    operation by `MediaSection` against the relational media endpoints.
 *
 * Assertions run against a JSON round-trip of the body (`wireBody`) rather than
 * the raw object, because `toHaveBeenCalledWith` uses `toEqual` semantics and
 * cannot tell an absent key from a key explicitly set to `undefined` — which is
 * precisely the distinction the priceFrom/priceUnit contract depends on.
 */
import { ExperiencePriceUnitEnum } from '@repo/schemas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommerceListingEditor } from '../../../src/components/commerce/CommerceListingEditor.client';
import type { CommerceListingDetail } from '../../../src/lib/commerce/owner-listings';

const { I18N_INITIAL, I18N_EDITED } = vi.hoisted(() => {
    const blank = () => ({ es: '', en: '', pt: '' });
    return {
        I18N_INITIAL: {
            nameI18n: blank(),
            summaryI18n: blank(),
            descriptionI18n: blank(),
            richDescriptionI18n: blank()
        },
        I18N_EDITED: {
            nameI18n: { es: 'Nombre ES', en: 'Name EN', pt: '' },
            summaryI18n: { es: 'Resumen ES', en: '', pt: '' },
            descriptionI18n: { es: 'Descripción ES', en: '', pt: '' },
            richDescriptionI18n: { es: 'Ampliada ES', en: '', pt: '' }
        }
    };
});

vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));

vi.mock('../../../src/components/commerce/CommerceListingEditor.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

// Shallow-stub the translation panel: its own behaviour is covered by
// CommerceTranslationPanel.test.tsx. Here it only needs to be able to FIRE an
// i18n change, so the editor's four-keys-at-once payload rule can be asserted.
vi.mock('../../../src/components/commerce/CommerceTranslationPanel.client', () => ({
    CommerceTranslationPanel: ({ onChange }: { onChange: (next: unknown) => void }) => (
        <button
            type="button"
            data-testid="i18n-trigger"
            onClick={() => onChange(I18N_EDITED)}
        >
            i18n
        </button>
    ),
    parseCommerceI18nValues: () => I18N_INITIAL
}));

// HOS-371: `richDescription` is a TipTap editor now. This suite pins PATCH body
// shapes, so booting a real editor per render would only add runtime — the
// controlled-value contract is all these tests need. The real editor is covered
// in `CommerceListingEditor.rich-description.test.tsx`.
vi.mock('@/components/host/editor/RichTextEditor.client', () => ({
    RichTextEditor: ({
        value,
        onChange,
        ariaLabel
    }: {
        value: string;
        onChange: (value: string) => void;
        ariaLabel?: string;
    }) => (
        <textarea
            aria-label={ariaLabel}
            value={value}
            onChange={(event) => onChange(event.target.value)}
        />
    )
}));

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string, params?: Record<string, unknown>) => {
            const raw =
                key === 'commerce.owner.editor.validation.summaryHint'
                    ? '{{count}}/300'
                    : (fallback ?? `[MISSING:${key}]`);
            if (!params) return raw;
            return Object.keys(params).reduce(
                (acc, k) =>
                    acc
                        .replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(params[k]))
                        .replace(new RegExp(`\\{${k}\\}`, 'g'), String(params[k])),
                raw
            );
        }
    })
}));

vi.mock('../../../src/lib/api/client', () => ({ apiClient: { patch: vi.fn() } }));

// `MediaSection` hydrates itself from `commerceMediaApi.listMedia` on mount
// (HOS-372), so the editor cannot render without it stubbed.
vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    commerceMediaApi: {
        listMedia: vi.fn().mockResolvedValue({ ok: true, data: { media: [] } }),
        addMedia: vi.fn(),
        removeMedia: vi.fn(),
        setFeaturedMedia: vi.fn()
    },
    protectedMediaApi: { deleteMedia: vi.fn().mockResolvedValue({ ok: true, data: {} }) }
}));

vi.mock('../../../src/lib/env', () => ({ getApiUrl: () => 'http://api.test' }));

vi.mock('../../../src/lib/logger', () => ({ webLogger: { warn: vi.fn() } }));

import { apiClient } from '../../../src/lib/api/client';
import { commerceMediaApi, protectedMediaApi } from '../../../src/lib/api/endpoints-protected';
import { addToast } from '../../../src/store/toast-store';

const mockPatch = vi.mocked(apiClient.patch);
const mockDeleteMedia = vi.mocked(protectedMediaApi.deleteMedia);
const mockListMedia = vi.mocked(commerceMediaApi.listMedia);

const DESTINATION_1 = '11111111-1111-4111-8111-111111111111';
const DESTINATION_2 = '22222222-2222-4222-8222-222222222222';

const destinationOptions = [
    { id: DESTINATION_1, name: 'Concepción del Uruguay' },
    { id: DESTINATION_2, name: 'Colón' }
];

const galleryImage = {
    url: 'http://cdn.test/g1.jpg',
    publicId: 'commerce/g1',
    width: 800,
    height: 600,
    moderationState: 'APPROVED' as const
};

/** VideoSchema requires only `moderationState` + a valid `url`. */
const preservedVideo = {
    url: 'http://cdn.test/v1.mp4',
    moderationState: 'APPROVED' as const
};

const archivedImage = {
    url: 'http://cdn.test/archived.jpg',
    publicId: 'commerce/archived',
    width: 640,
    height: 480,
    moderationState: 'APPROVED' as const
};

/**
 * Build a listing fixture. Every field the payload contract touches can be
 * seeded, so "cleared" cases start from a real persisted value.
 */
function buildListing(overrides: Record<string, unknown> = {}): CommerceListingDetail {
    return {
        id: 'abc',
        ownerId: 'owner-1',
        name: 'La Parrilla',
        slug: 'la-parrilla',
        destinationId: DESTINATION_1,
        description: 'Descripción original con suficiente longitud para pasar validación.',
        ...overrides
    } as unknown as CommerceListingDetail;
}

function renderEditor(
    vertical: 'gastronomy' | 'experience',
    initialData: CommerceListingDetail = buildListing()
) {
    return render(
        <CommerceListingEditor
            vertical={vertical}
            listingId="abc"
            locale="es"
            initialData={initialData}
            destinations={destinationOptions}
        />
    );
}

const saveButton = () => screen.getByRole('button', { name: 'Guardar' });

/**
 * Resolve once the editor has resynced its baseline to the values a save just
 * persisted.
 *
 * `mockPatch` resolving is NOT that moment: the mock is invoked before the
 * awaited promise settles, so `setBaseline` has not run yet. The success toast
 * is emitted on the line after it, which makes it the first observable event
 * that the resync is complete. This used to be spelled as "wait for Save to go
 * back to disabled" — an option the shared `ActionBar` removed by keeping Save
 * permanently enabled.
 */
async function waitForBaselineResync(times: number): Promise<void> {
    await waitFor(() =>
        expect(
            vi.mocked(addToast).mock.calls.filter(([arg]) => arg.type === 'success')
        ).toHaveLength(times)
    );
}

/**
 * The PATCH body as it actually goes over the wire.
 *
 * `JSON.stringify` drops keys whose value is `undefined` and keeps `null`, which
 * is exactly the difference between "omit the key = no change" (experience
 * price fields) and "explicitly clear this column" (gastronomy price fields).
 * Asserting on the raw mock argument cannot distinguish the two.
 */
async function wireBody(): Promise<Record<string, unknown>> {
    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    const raw = mockPatch.mock.calls[0]?.[0]?.body;
    return JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
}

/** Pick the first real (non-placeholder) option value of a `<select>`. */
function firstRealOption(select: HTMLElement): string {
    const options = Array.from((select as HTMLSelectElement).options);
    const real = options.find((option) => option.value !== '');
    if (!real) {
        throw new Error('select has no non-empty option');
    }
    return real.value;
}

describe('CommerceListingEditor — PATCH payload contract (HOS-258)', () => {
    beforeEach(() => {
        mockPatch.mockReset();
        mockPatch.mockResolvedValue({ ok: true, data: {} });
        mockDeleteMedia.mockClear();
        // `waitForBaselineResync` counts success toasts, so they must not carry
        // over between tests or the wait resolves against a previous test's save.
        vi.mocked(addToast).mockClear();
    });

    describe('gastronomy price fields clear to null', () => {
        it('sends priceRange as an explicit null when the tier is cleared', async () => {
            renderEditor('gastronomy', buildListing({ priceRange: 'MID' }));

            const select = screen.getByLabelText('Rango de precios');
            expect(select).toHaveValue('MID');

            fireEvent.change(select, { target: { value: '' } });
            fireEvent.click(saveButton());

            const body = await wireBody();
            // `.nullish()` on the domain schema: null is how the owner clears it.
            expect(body).toHaveProperty('priceRange', null);
        });

        it('sends menuUrl as an explicit null when the link is cleared', async () => {
            renderEditor('gastronomy', buildListing({ menuUrl: 'https://old.test/menu' }));

            const input = screen.getByLabelText('Enlace al menú');
            expect(input).toHaveValue('https://old.test/menu');

            fireEvent.change(input, { target: { value: '' } });
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body).toHaveProperty('menuUrl', null);
        });

        it('sends menuUrl as the new value when set', async () => {
            renderEditor('gastronomy');

            fireEvent.change(screen.getByLabelText('Enlace al menú'), {
                target: { value: 'https://menu.test/carta' }
            });
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body).toHaveProperty('menuUrl', 'https://menu.test/carta');
        });
    });

    describe('experience price fields omit the key instead of sending null (T-021)', () => {
        it('omits priceFrom from the wire body when cleared', async () => {
            renderEditor('experience', buildListing({ priceFrom: 500 }));

            const input = screen.getByLabelText(/Precio desde/);
            expect(input).toHaveValue(500);

            fireEvent.change(input, { target: { value: '' } });
            fireEvent.click(saveButton());

            const body = await wireBody();
            // `z.number().int().nonnegative()` rejects null outright — the key
            // must not reach the wire at all.
            expect(Object.keys(body)).not.toContain('priceFrom');
        });

        // H-156 reversed this. It used to assert the key was OMITTED, because
        // `priceUnit` rejected `null` (T-021). That contract had a hole the
        // assertion hid: omitting the key means "no change", so an owner who
        // ticked "price on request" and cleared the unit saw the edit accepted
        // and the stale unit stay on the row. The column is nullable now, so
        // clearing sends an explicit `null` — the same way gastronomy's
        // `priceRange` already did.
        it('sends priceUnit as an explicit null when cleared (H-156)', async () => {
            const seededUnit = Object.values(ExperiencePriceUnitEnum)[0] as string;
            renderEditor('experience', buildListing({ priceUnit: seededUnit }));

            const select = screen.getByLabelText('Unidad de precio');
            // Guard against a vacuous pass: the field must genuinely start with a
            // persisted value, otherwise "clearing" it changes nothing.
            expect(select).toHaveValue(seededUnit);

            fireEvent.change(select, { target: { value: '' } });
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(Object.keys(body)).toContain('priceUnit');
            expect(body).toHaveProperty('priceUnit', null);
        });

        it('sends priceFrom as a number when set', async () => {
            renderEditor('experience');

            fireEvent.change(screen.getByLabelText(/Precio desde/), { target: { value: '750' } });
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body).toHaveProperty('priceFrom', 750);
        });

        it('sends priceUnit as the selected enum value when set', async () => {
            renderEditor('experience');

            const select = screen.getByLabelText('Unidad de precio');
            const unit = firstRealOption(select);
            fireEvent.change(select, { target: { value: unit } });
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body).toHaveProperty('priceUnit', unit);
        });

        it('sends isPriceOnRequest as a boolean when toggled', async () => {
            renderEditor('experience');

            fireEvent.click(screen.getByLabelText('Precio a consultar'));
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body).toHaveProperty('isPriceOnRequest', true);
        });
    });

    describe('grouped JSONB blocks travel whole, not per-leaf', () => {
        it('re-sends the untouched contact member when only one contact field changes', async () => {
            renderEditor(
                'gastronomy',
                buildListing({
                    contactInfo: {
                        mobilePhone: '+5491100000000',
                        workEmail: 'dueno@test.com'
                    }
                })
            );

            // HOS-371: the editable control is the local-number input; the
            // combobox contributes the dial code, and the stored string is
            // recomposed as `"<dialCode> <number>"`. The seeded
            // `+5491100000000` parses back to (+54, "91100000000").
            fireEvent.change(screen.getByLabelText('Número'), {
                target: { value: '91199999999' }
            });
            fireEvent.click(saveButton());

            const body = await wireBody();
            // The server REPLACES the contactInfo JSONB block. Sending only the
            // changed leaf would wipe workEmail.
            expect(body.contactInfo).toEqual({
                mobilePhone: '+54 91199999999',
                workEmail: 'dueno@test.com'
            });
        });

        it('re-sends the untouched social members when only one social URL changes', async () => {
            renderEditor(
                'gastronomy',
                buildListing({
                    socialNetworks: {
                        facebook: 'https://facebook.com/old',
                        instagram: 'https://instagram.com/keepme'
                    }
                })
            );

            fireEvent.change(screen.getByLabelText('facebook'), {
                target: { value: 'https://facebook.com/new' }
            });
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body.socialNetworks).toEqual({
                facebook: 'https://facebook.com/new',
                instagram: 'https://instagram.com/keepme'
            });
        });

        it('sends all four i18n fields together when any locale is edited', async () => {
            renderEditor('gastronomy');

            fireEvent.click(screen.getByTestId('i18n-trigger'));
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body).toMatchObject({
                nameI18n: I18N_EDITED.nameI18n,
                summaryI18n: I18N_EDITED.summaryI18n,
                descriptionI18n: I18N_EDITED.descriptionI18n,
                richDescriptionI18n: I18N_EDITED.richDescriptionI18n
            });
        });
    });

    describe('media never travels in the PATCH body (HOS-372)', () => {
        it('omits media even when the listing was loaded with photos', async () => {
            renderEditor(
                'gastronomy',
                buildListing({
                    summary: 'Resumen original con largo suficiente.',
                    media: {
                        featuredImage: galleryImage,
                        gallery: [galleryImage],
                        videos: [preservedVideo],
                        archivedGallery: [archivedImage]
                    }
                })
            );

            // Any unrelated edit is enough: the question is whether the editor
            // still carries a buffered `media` block alongside it.
            fireEvent.change(screen.getByLabelText('Resumen'), {
                target: { value: 'Resumen editado con largo suficiente.' }
            });
            fireEvent.click(saveButton());

            const body = await wireBody();
            // `MediaSection` persists every photo operation on its own against
            // the relational endpoints. Re-adding `media` here would overwrite
            // those rows with a stale snapshot — the bug HOS-372 fixed.
            expect(body).not.toHaveProperty('media');
            expect(body).toEqual({ summary: 'Resumen editado con largo suficiente.' });
        });

        it('never fires the client-side Cloudinary delete', async () => {
            renderEditor('gastronomy', buildListing({ media: { gallery: [galleryImage] } }));

            await waitFor(() => expect(mockListMedia).toHaveBeenCalled());
            // Removal goes through `commerceMediaApi.removeMedia`, which deletes
            // the binary server-side. `delete-entity` rejects commerce verticals
            // with a 400, so any call here is a regression.
            expect(mockDeleteMedia).not.toHaveBeenCalled();
        });
    });

    describe('identity and catalog fields', () => {
        it('sends only type when the category changes', async () => {
            renderEditor('gastronomy');

            const select = screen.getByLabelText('Categoría');
            const type = firstRealOption(select);
            fireEvent.change(select, { target: { value: type } });
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body).toEqual({ type });
        });

        it('sends only summary when the summary changes', async () => {
            renderEditor('gastronomy');

            fireEvent.change(screen.getByLabelText('Resumen'), {
                target: { value: 'Un resumen suficientemente largo para validar.' }
            });
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body).toEqual({ summary: 'Un resumen suficientemente largo para validar.' });
        });
    });

    describe('baseline diffing (HOS-258 PR 1 behaviour change)', () => {
        it('drops a field that was edited and then reverted by hand', async () => {
            const { container } = renderEditor('gastronomy');

            const input = screen.getByLabelText('Nombre del comercio');
            fireEvent.change(input, { target: { value: 'Otro nombre' } });
            fireEvent.change(input, { target: { value: 'La Parrilla' } });

            // Under the old dirty-Set model the field stayed "dirty" and shipped
            // a no-op write. Diffing against the baseline makes the form clean
            // again, which is what the submit below proves. (This used to also
            // assert the save button was disabled; the shared `ActionBar` keeps
            // it enabled, so the request — or its absence — is now the signal.)
            fireEvent.submit(container.querySelector('form') as HTMLFormElement);
            await Promise.resolve();
            expect(mockPatch).not.toHaveBeenCalled();
        });

        it('sends only the still-changed field when another was reverted', async () => {
            renderEditor('gastronomy');

            const nameInput = screen.getByLabelText('Nombre del comercio');
            fireEvent.change(nameInput, { target: { value: 'Otro nombre' } });
            fireEvent.change(nameInput, { target: { value: 'La Parrilla' } });
            fireEvent.change(screen.getByLabelText('Resumen'), {
                target: { value: 'Un resumen suficientemente largo para validar.' }
            });
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body).toEqual({ summary: 'Un resumen suficientemente largo para validar.' });
        });

        it('lets the owner undo a just-saved field without reloading (HOS-190 F6)', async () => {
            renderEditor('gastronomy');

            const input = screen.getByLabelText('Nombre del comercio');
            fireEvent.change(input, { target: { value: 'La Nueva Parrilla' } });
            fireEvent.click(saveButton());

            await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
            expect(mockPatch.mock.calls[0]?.[0]?.body).toEqual({ name: 'La Nueva Parrilla' });

            // The baseline must have been resynced to the persisted value. If it
            // still pointed at the load-time `initialData`, restoring the
            // original name would diff to nothing and the owner could not undo
            // their own save without a full page reload.
            await waitForBaselineResync(1);
            fireEvent.change(input, { target: { value: 'La Parrilla' } });
            fireEvent.click(saveButton());

            await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(2));
            expect(mockPatch.mock.calls[1]?.[0]?.body).toEqual({ name: 'La Parrilla' });
        });
    });

    describe('submit gating', () => {
        it('does not PATCH at all when nothing changed', async () => {
            const { container } = renderEditor('gastronomy');

            const form = container.querySelector('form');
            expect(form).not.toBeNull();
            // Submit the form directly: the save button is disabled with a clean
            // form, so clicking it would assert nothing.
            fireEvent.submit(form as HTMLFormElement);

            await Promise.resolve();
            expect(mockPatch).not.toHaveBeenCalled();
        });

        it('carries every dirty group in a single PATCH', async () => {
            renderEditor('gastronomy', buildListing({ priceRange: 'MID' }));

            fireEvent.change(screen.getByLabelText('Nombre del comercio'), {
                target: { value: 'La Nueva Parrilla' }
            });
            fireEvent.change(screen.getByLabelText('Número'), {
                target: { value: '91100000000' }
            });
            fireEvent.change(screen.getByLabelText('Rango de precios'), {
                target: { value: '' }
            });
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body).toEqual({
                name: 'La Nueva Parrilla',
                contactInfo: { mobilePhone: '+54 91100000000' },
                priceRange: null
            });
        });
    });
});
