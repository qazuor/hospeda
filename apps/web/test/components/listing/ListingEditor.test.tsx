/**
 * @file ListingEditor.test.tsx
 * @description Tests for the listing owner operational editor island
 * (SPEC-249 T-012). Verifies the save button stays disabled until a field
 * changes, and that submitting PATCHes the correct per-vertical endpoint with
 * only the dirty field group.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LISTING_FIELD_PREFIX } from '@/components/listing/editor/field-ids';
import { buildFieldId } from '@/lib/forms/build-field-id';
import { addToast } from '@/store/toast-store';
import type { ListingEditorFormSectionId } from '../../../src/components/listing/editor/listing-section-payload';
import { ListingEditor } from '../../../src/components/listing/ListingEditor.client';
import type { ListingDetail } from '../../../src/lib/listing/owner-listings';

vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));

vi.mock('../../../src/components/listing/ListingEditor.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

// Stub out the TranslationPanel so its "Descripción ampliada" label does not
// collide with the same label on the standalone richDescription textarea inside
// the editor itself.  Integration between the two components is tested separately
// in ListingTranslationPanel.test.tsx.
vi.mock('../../../src/components/listing/ListingTranslationPanel.client', () => ({
    ListingTranslationPanel: () => null,
    parseListingI18nValues: () => ({
        nameI18n: { es: '', en: '', pt: '' },
        summaryI18n: { es: '', en: '', pt: '' },
        descriptionI18n: { es: '', en: '', pt: '' },
        richDescriptionI18n: { es: '', en: '', pt: '' }
    })
}));

vi.mock('../../../src/lib/i18n', async (importOriginal) => ({
    // The kit save bar (HOS-2487) reads its copy through the real `createT`.
    ...(await importOriginal<typeof import('../../../src/lib/i18n')>()),
    // Mirror the real translator closely enough for the fields under test:
    //  - A key with no translation resolves to `[MISSING:<key>]` (not the bare
    //    key). `catalog-names` relies on that sentinel to fall back to a
    //    humanized label, so the mock must reproduce it.
    //  - The `summaryHint` key EXISTS in the real catalog as the template
    //    "{{count}}/300", so simulate that here. A bare `fallback ?? [MISSING]`
    //    mock would hide the BETA-124 bug: the real resolver returns the catalog
    //    value and ignores the fallback, so the count only shows up when it is
    //    passed as an interpolation param (not baked into the fallback string).
    //  - Interpolate `{{param}}` / `{param}` from the params object like the
    //    real `resolve()` does, so params actually take effect.
    createTranslations: () => ({
        t: (key: string, fallback?: string, params?: Record<string, unknown>) => {
            const raw =
                key === 'listing.owner.editor.validation.summaryHint'
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

// HOS-371: `richDescription` is a TipTap editor now, not a `<textarea>`. Booting
// the real editor in every render here would make this suite an order of
// magnitude slower for zero added signal — what these tests care about is the
// dirty-tracking/payload wiring, which only needs the controlled-value contract.
// The shim keeps the same accessible name so the existing assertions still
// target the same field. The REAL editor is exercised in
// `ListingEditor.rich-description.test.tsx` (mount must not dirty the
// form) and `host/editor/RichTextEditor.controlled-emit.test.tsx`.
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

vi.mock('../../../src/lib/api/client', () => ({
    apiClient: {
        patch: vi.fn()
    }
}));

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    protectedMediaApi: { deleteMedia: vi.fn().mockResolvedValue({ ok: true, data: {} }) },
    // HOS-372: MediaField is now self-contained and hydrates/persists through
    // `listingMediaApi` directly (no longer via the parent's `onChange` +
    // PATCH). `listMedia` must resolve so the child effect does not throw;
    // the other ops default to empty successes and are overridden per-test.
    listingMediaApi: {
        listMedia: vi.fn().mockResolvedValue({ ok: true, data: { media: [] } }),
        addMedia: vi.fn().mockResolvedValue({ ok: true, data: { media: {} } }),
        removeMedia: vi.fn().mockResolvedValue({ ok: true, data: {} }),
        setFeaturedMedia: vi.fn().mockResolvedValue({ ok: true, data: { media: {} } })
    }
}));

vi.mock('../../../src/lib/env', () => ({ getApiUrl: () => 'http://api.test' }));

vi.mock('../../../src/lib/logger', () => ({ webLogger: { warn: vi.fn() } }));

import { apiClient } from '../../../src/lib/api/client';
import { listingMediaApi, protectedMediaApi } from '../../../src/lib/api/endpoints-protected';

/**
 * Derived rather than written out (HOS-385): the section builds this id with
 * `buildFieldId`, so hardcoding it here would let the test and the markup drift
 * apart again — the exact failure mode this spec removes.
 */
const WORK_EMAIL_ID = buildFieldId({
    prefix: LISTING_FIELD_PREFIX,
    name: 'contactInfo.workEmail'
});

const mockPatch = vi.mocked(apiClient.patch);

/**
 * The media endpoints stay MOCKED even though HOS-1080 moved photos to their own
 * route and no test here drives them any more.
 *
 * They are asserted, not just stubbed: this island must not reach the media API
 * at all now, and a real module would make that failure a network call in jsdom
 * rather than a failed expectation. Their coverage lives in
 * `host/editor/PhotoSection.verticals.test.tsx`.
 */
const mockListMedia = vi.mocked(listingMediaApi.listMedia);
const mockDeleteMedia = vi.mocked(protectedMediaApi.deleteMedia);

// destinationId is `.uuid()`-validated on the domain schema (mirrors the
// amenityIds/featureIds UUID requirement in the seeding test below) — use
// UUID-shaped fixture ids throughout, not short human-readable ones.
const DESTINATION_1 = '11111111-1111-4111-8111-111111111111';
const DESTINATION_2 = '22222222-2222-4222-8222-222222222222';

const baseData = {
    id: 'abc',
    ownerId: 'owner-1',
    name: 'La Parrilla',
    slug: 'la-parrilla',
    destinationId: DESTINATION_1,
    description: 'Descripción original con suficiente longitud para pasar validación.',
    richDescription: 'old text'
} as unknown as ListingDetail;

const newDraftData = {
    ...baseData,
    description: '',
    priceFrom: null,
    priceUnit: null,
    isPriceOnRequest: false
} as ListingDetail;

const destinationOptions = [
    { id: DESTINATION_1, name: 'Concepción del Uruguay' },
    { id: DESTINATION_2, name: 'Colón' }
];

function renderEditor(
    vertical: 'venue' | 'experience',
    sectionId: ListingEditorFormSectionId = 'basicInfo'
) {
    return render(
        <ListingEditor
            vertical={vertical}
            sectionId={sectionId}
            listingId="abc"
            locale="es"
            initialData={baseData}
            // A non-empty destination catalog keeps this default helper free of
            // the HOS-260 empty-catalog `role="alert"` message, which would
            // otherwise collide with (and resolve before) the API-error alerts
            // several tests below assert on.
            destinations={destinationOptions}
        />
    );
}

/**
 * The save failure's banner: the save bar's own `role="alert"` line. Owner
 * decision 7 (Mi cuenta UI epic) removed the duplicate form-level notice, so
 * this also asserts no alert stands outside the bar and the fields.
 *
 * @returns The banner; throws until it renders (for `waitFor`).
 */
function formBanner(): HTMLElement {
    const strays = Array.from(
        document.querySelectorAll<HTMLElement>('[role="alert"]:not([id])')
    ).filter((el) => !el.closest('[data-editor-save-signal]'));
    if (strays.length > 0) throw new Error('a form-level alert duplicates the save bar');
    const banner = document.querySelector<HTMLElement>('[data-editor-save-signal] [role="alert"]');
    if (!banner) throw new Error('no save-bar banner yet');
    return banner;
}

/** The phone number inputs in DOM order: main, landline, WhatsApp (HOS-2497). */
function phoneNumbers(): HTMLInputElement[] {
    return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="tel"]'));
}

describe('ListingEditor', () => {
    beforeEach(() => {
        mockPatch.mockReset();
        mockDeleteMedia.mockClear();
        mockListMedia.mockClear();
        mockListMedia.mockResolvedValue({ ok: true, data: { media: [] } });
    });

    it.each([
        'venue',
        'experience'
    ] as const)('opens an empty-description %s draft and saves its first description', async (vertical) => {
        mockPatch.mockResolvedValueOnce({ ok: true, data: {} });
        render(
            <ListingEditor
                vertical={vertical}
                sectionId="basicInfo"
                listingId="abc"
                locale="es"
                initialData={newDraftData}
                destinations={destinationOptions}
            />
        );
        const description = screen.getByLabelText('Descripción');
        expect(description).toHaveValue('');
        const text = 'A complete description entered after the draft was created.';
        fireEvent.change(description, { target: { value: text } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
        await waitFor(() => expect(mockPatch).toHaveBeenCalledOnce());
        expect(mockPatch.mock.calls[0]?.[0]?.body).toEqual({ description: text });
    });

    it('opens an unpriced experience draft and saves its first price and unit', async () => {
        mockPatch.mockResolvedValueOnce({ ok: true, data: {} });
        render(
            <ListingEditor
                vertical="experience"
                sectionId="price"
                listingId="abc"
                locale="es"
                initialData={newDraftData}
            />
        );
        expect(screen.getByLabelText(/Precio desde/)).toHaveValue(null);
        fireEvent.change(screen.getByLabelText(/Precio desde/), { target: { value: '15000' } });
        fireEvent.change(screen.getByLabelText('Unidad de precio'), {
            target: { value: 'per_person' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
        await waitFor(() => expect(mockPatch).toHaveBeenCalledOnce());
        expect(mockPatch.mock.calls[0]?.[0]?.body).toMatchObject({
            priceFrom: 1500000,
            priceUnit: 'per_person'
        });
    });

    /*
     * This used to assert the save button was DISABLED with nothing to save.
     * Adopting the shared `ActionBar` reversed that on purpose (HOS-190: "Save"
     * always visibly does something), so the invariant worth keeping is not the
     * disabled attribute — it is that pressing Save with no changes still sends
     * no request. Asserting only the toast would pass just as well if the editor
     * PATCHed an empty body alongside it.
     */
    it('marks the form hydrated only from a mount effect, never in the markup (HOS-1080)', async () => {
        // The E2E suite's hydration gate. Every control in every section is
        // server-rendered, so "visible and editable" is true long before React
        // attaches a handler — the HOS-371 class of bug, where an edit lands on
        // a node React is not listening to and Save silently sends nothing.
        //
        // Two halves, and both matter. The attribute must be ABSENT from what
        // the component renders (otherwise it ships in the SSR HTML and gates
        // nothing), and PRESENT once mounted. `renderToStaticMarkup` is the only
        // way to observe the first half: `render()` runs effects, so it can
        // never tell a server-rendered attribute from an effect-set one.
        const { renderToStaticMarkup } = await import('react-dom/server');

        const ssr = renderToStaticMarkup(
            <ListingEditor
                vertical="venue"
                sectionId="basicInfo"
                listingId="abc"
                locale="es"
                initialData={baseData}
                destinations={destinationOptions}
            />
        );
        expect(ssr).not.toContain('data-hydrated');

        const { container } = renderEditor('venue');
        await waitFor(() =>
            expect(container.querySelector('form')).toHaveAttribute('data-hydrated', 'true')
        );
    });

    it('never touches the media endpoints from a form section (HOS-1080)', async () => {
        // Photos are their own route now, mounting `PhotoSection` directly. A
        // form section that still hydrated media would be paying for two extra
        // requests per page and could overwrite rows the owner just saved —
        // the HOS-372 failure, reintroduced by the split rather than fixed by it.
        renderEditor('venue');

        await waitFor(() =>
            expect(document.querySelector('[data-editor-save-signal="bar"]')).not.toBeNull()
        );
        expect(mockListMedia).not.toHaveBeenCalled();
        expect(mockDeleteMedia).not.toHaveBeenCalled();
    });

    it('answers a no-op save with a toast instead of a request', () => {
        renderEditor('venue');

        // Clean: the save bar is hidden (HOS-2487), but Enter in a field still
        // submits, and that must visibly answer (HOS-190).
        expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull();
        fireEvent.submit(document.querySelector('form') as HTMLFormElement);

        expect(mockPatch).not.toHaveBeenCalled();
        expect(addToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'info', message: 'No hay cambios para guardar' })
        );
    });

    it('renders the summary counter interpolated, not the literal {{count}} template (BETA-124)', () => {
        renderEditor('venue');

        // Summary starts empty → the kit counter reads "0 de 300 caracteres"
        // (HOS-2488), never a raw "{{...}}" template (BETA-124).
        const hint = screen.getByText('0 de 300 caracteres');
        expect(hint).toBeInTheDocument();
        expect(hint.textContent).not.toContain('{{');

        // Typing a valid-length summary updates the interpolated counter.
        fireEvent.change(screen.getByLabelText('Resumen'), {
            target: { value: 'hello world!' }
        });
        expect(screen.getByText('12 de 300 caracteres')).toBeInTheDocument();
    });

    it('PATCHes the venue endpoint with only the dirty field on submit', async () => {
        mockPatch.mockResolvedValueOnce({ ok: true, data: {} });
        renderEditor('venue');

        fireEvent.change(screen.getByLabelText('Descripción ampliada'), {
            target: { value: 'new text' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        expect(mockPatch).toHaveBeenCalledWith({
            path: '/api/v1/protected/venues/abc',
            body: { richDescription: 'new text' }
        });
        // Success is surfaced as a toast now, not an inline role=status banner.
        await waitFor(() =>
            expect(vi.mocked(addToast)).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'success' })
            )
        );
    });

    it('PATCHes the experience endpoint for the experience vertical', async () => {
        mockPatch.mockResolvedValueOnce({ ok: true, data: {} });
        renderEditor('experience');

        fireEvent.change(screen.getByLabelText('Descripción ampliada'), {
            target: { value: 'changed' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        expect(mockPatch).toHaveBeenCalledWith({
            path: '/api/v1/protected/experiences/abc',
            body: { richDescription: 'changed' }
        });
    });

    it('shows an error message when the PATCH fails', async () => {
        mockPatch.mockResolvedValueOnce({ ok: false, error: { status: 500, message: 'boom' } });
        renderEditor('venue');

        fireEvent.change(screen.getByLabelText('Descripción ampliada'), {
            target: { value: 'x' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => formBanner());
    });

    it('surfaces the REAL API error message on PATCH failure, not a fixed banner string (HOS-190 regression)', async () => {
        // Regression guard: the `else` branch used to discard `result.error`
        // entirely and always render the same hardcoded string
        // ("No se pudieron guardar los cambios."), so a distinctive
        // server-side message (e.g. a uniqueness conflict) was invisible to
        // the owner. `handleApiError` now surfaces the actual message.
        mockPatch.mockResolvedValueOnce({
            ok: false,
            error: { status: 409, message: 'Ese teléfono ya está en uso' }
        });
        renderEditor('venue', 'contact');

        // HOS-371: the phone is a country-code combobox + local number pair now,
        // so the editable control is the phone number input; the dial code comes
        // from the combobox and is recomposed into the stored string.
        fireEvent.change(phoneNumbers()[0], {
            target: { value: '9 11 1234 5678' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        const alert = await waitFor(() => formBanner());
        expect(alert.textContent).toBe('Ese teléfono ya está en uso');
        expect(alert.textContent).not.toBe('No se pudieron guardar los cambios.');
    });

    it('shows the fixed localized banner, never the API message, on a 5xx PATCH failure (HOS-2312)', async () => {
        mockPatch.mockResolvedValueOnce({
            ok: false,
            error: { status: 500, message: 'An unexpected error occurred' }
        });
        renderEditor('venue', 'contact');
        fireEvent.change(phoneNumbers()[0], {
            target: { value: '9 11 1234 5678' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        const alert = await waitFor(() => formBanner());
        expect(alert.textContent).toBe('No se pudieron guardar los cambios.');
    });

    it('sends priceFrom as undefined (not null) when cleared, so the PATCH succeeds (experience)', async () => {
        // Regression guard: `ExperienceSchema.priceFrom` is
        // `z.number().int().nonnegative()` — NOT `.nullable()` — so clearing
        // the field used to build `payload.priceFrom = priceFrom ?? null`,
        // sending an explicit `null` the domain schema rejects. There was no
        // client-side validation to catch this before submit, so the PATCH
        // always fired and only failed against the real API. The fix sends
        // `undefined` (omit the key = "no change") instead.
        //
        // HOS-258: `priceFrom` is now SEEDED from `initialData` and then
        // cleared, instead of being typed in and cleared within the same
        // session. Since PR 1 the payload is a diff against the last persisted
        // snapshot, so typing 500 and deleting it again returns the field to
        // its original value and produces no change at all — that setup
        // exercised the old dirty-Set mechanism, not the null-vs-undefined
        // contract this test is about. The assertion below is unchanged.
        mockPatch.mockResolvedValueOnce({ ok: true, data: {} });
        render(
            <ListingEditor
                vertical="experience"
                sectionId="price"
                listingId="abc"
                locale="es"
                initialData={{ ...baseData, priceFrom: 50000 } as unknown as ListingDetail}
                destinations={destinationOptions}
            />
        );

        // HOS-809: the row stores 50000 centavos, the field shows $ 500.
        const priceFromInput = screen.getByLabelText(/Precio desde/);
        expect(priceFromInput).toHaveValue(500);
        fireEvent.change(priceFromInput, { target: { value: '' } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        const body = mockPatch.mock.calls[0]?.[0]?.body as { priceFrom?: number | null };
        expect(body.priceFrom).toBeUndefined();
    });

    it('PATCHes only the priceRange field group when the price tier changes (venue)', async () => {
        mockPatch.mockResolvedValueOnce({ ok: true, data: {} });
        renderEditor('venue', 'price');

        fireEvent.change(screen.getByLabelText('Rango de precios'), { target: { value: 'MID' } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        expect(mockPatch).toHaveBeenCalledWith({
            path: '/api/v1/protected/venues/abc',
            body: { priceRange: 'MID' }
        });
    });

    it('PATCHes the contactInfo group when a contact field changes', async () => {
        mockPatch.mockResolvedValueOnce({ ok: true, data: {} });
        renderEditor('venue', 'contact');

        // HOS-371: the local number is recomposed with the combobox's dial code
        // (defaulting to Argentina) into the single `mobilePhone` string the
        // backend stores — the same `<dialCode> <number>` shape the
        // accommodation editor writes and `InternationalPhoneRegex` validates.
        fireEvent.change(phoneNumbers()[0], {
            target: { value: '9 11 1234 5678' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        // HOS-1190: `contactInfo` is MERGED server-side now, so an empty member
        // travels as an explicit `null` — under merge an omitted key means
        // "keep the stored value", which would make a clear un-saveable.
        // `website` is not part of this owner surface (SPEC-253 AC-4) and is
        // therefore absent rather than nulled.
        expect(mockPatch).toHaveBeenCalledWith({
            path: '/api/v1/protected/venues/abc',
            body: {
                contactInfo: {
                    mobilePhone: '+54 9 11 1234 5678',
                    workEmail: null
                }
            }
        });
    });

    it('lets the owner pick a different country code and recomposes the stored phone (HOS-371)', async () => {
        mockPatch.mockResolvedValueOnce({ ok: true, data: {} });
        renderEditor('venue', 'contact');

        // The combobox trigger leads with the field name, then the selection.
        fireEvent.click(
            screen.getAllByRole('button', { name: /País: Argentina/ })[0] as HTMLElement
        );
        fireEvent.mouseDown(screen.getByRole('option', { name: /Brasil|Brazil/ }));

        fireEvent.change(phoneNumbers()[0], {
            target: { value: '11 91234 5678' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        const body = mockPatch.mock.calls[0]?.[0]?.body as {
            contactInfo?: { mobilePhone?: string };
        };
        expect(body.contactInfo?.mobilePhone).toBe('+55 11 91234 5678');
    });

    describe('contact email accessibility (HOS-371)', () => {
        it('labels the email input with a real <label>, not just an aria-label', () => {
            const { container } = renderEditor('venue', 'contact');

            // An `aria-label` alone leaves a sighted user staring at an
            // anonymous empty box (WCAG 3.3.2). `getByLabelText` matches both
            // mechanisms, so assert the <label> element exists and points at
            // the input — that is what distinguishes the two.
            const label = [...container.querySelectorAll('label')].find(
                (el) => el.textContent?.trim() === 'Email'
            );
            expect(label).toBeDefined();
            expect(label?.getAttribute('for')).toBe(WORK_EMAIL_ID);

            const input = container.querySelector(`#${WORK_EMAIL_ID}`);
            expect(input).toBeInstanceOf(HTMLInputElement);
            expect((input as HTMLInputElement).type).toBe('email');
        });

        it('still PATCHes the contactInfo group from the labelled email input', async () => {
            mockPatch.mockResolvedValueOnce({ ok: true, data: {} });
            renderEditor('venue', 'contact');

            fireEvent.change(screen.getByLabelText('Email'), {
                target: { value: 'hola@laparrilla.test' }
            });
            fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

            await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
            const body = mockPatch.mock.calls[0]?.[0]?.body as {
                contactInfo?: { workEmail?: string };
            };
            expect(body.contactInfo?.workEmail).toBe('hola@laparrilla.test');
        });
    });

    it('shows the price-on-request toggle for the experience vertical (no price select)', () => {
        renderEditor('experience', 'price');
        expect(screen.queryByLabelText('Rango de precios')).toBeNull();
        expect(screen.getByLabelText('Precio a consultar')).toBeInTheDocument();
    });

    it('PATCHes the socialNetworks group when a social URL changes', async () => {
        mockPatch.mockResolvedValueOnce({ ok: true, data: {} });
        renderEditor('venue', 'contact');

        fireEvent.change(screen.getByLabelText(/^Facebook/), {
            target: { value: 'https://facebook.com/x' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        expect(mockPatch).toHaveBeenCalledWith({
            path: '/api/v1/protected/venues/abc',
            body: {
                // An empty member travels as `null`, not `undefined`: the column
                // is merged by the API (HOS-1262), so an omitted key would
                // leave a stored link in place.
                socialNetworks: {
                    facebook: 'https://facebook.com/x',
                    instagram: null,
                    twitter: null,
                    tiktok: null,
                    youtube: null,
                    linkedIn: null
                }
            }
        });
    });

    it('PATCHes openingHours when an open day is toggled closed', async () => {
        // HOS-906: an untouched day now defaults to CLOSED (dayOf()'s
        // honest default — see OpeningHoursSection.client.tsx), so a listing
        // must already carry an OPEN day to exercise toggling it closed. A
        // real saved listing always has a full, valid week after HOS-906,
        // so this fixture mirrors that instead of the never-configured
        // `openingHours: null` `baseData` starts from.
        mockPatch.mockResolvedValueOnce({ ok: true, data: {} });
        const withOpenMonday = {
            ...baseData,
            openingHours: {
                timezone: 'America/Argentina/Buenos_Aires',
                days: {
                    mon: { closed: false, shifts: [{ open: '09:00', close: '18:00' }] },
                    tue: { closed: true, shifts: [] },
                    wed: { closed: true, shifts: [] },
                    thu: { closed: true, shifts: [] },
                    fri: { closed: true, shifts: [] },
                    sat: { closed: true, shifts: [] },
                    sun: { closed: true, shifts: [] }
                }
            }
        } as unknown as ListingDetail;

        render(
            <ListingEditor
                vertical="venue"
                sectionId="openingHours"
                listingId="abc"
                locale="es"
                initialData={withOpenMonday}
                destinations={destinationOptions}
            />
        );

        fireEvent.click(screen.getByRole('switch', { name: 'Lunes abierto' }));
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        const call = mockPatch.mock.calls[0]?.[0] as {
            body: { openingHours?: { days?: Record<string, { closed: boolean }> } };
        };
        expect(call.body.openingHours?.days?.mon?.closed).toBe(true);
    });

    /**
     * HOS-906 regression — the bug this whole spec closes: a host who opens
     * the editor on a listing that never had opening hours configured
     * (`baseData` carries no `openingHours`, so every day starts at
     * `dayOf()`'s default), touches exactly ONE day, and saves. Before the
     * fix, the untouched six days rebuilt from `withDay()` as
     * `{ closed: false, shifts: [] }` and saved that ambiguous state
     * silently. Now every untouched day resolves CLOSED, so the save must
     * go through and every day in the payload must be a valid resolution —
     * never open with zero shifts.
     */
    it('HOS-906: touching a single day and saving succeeds, with every other day resolving closed', async () => {
        mockPatch.mockResolvedValueOnce({ ok: true, data: {} });
        renderEditor('venue', 'openingHours');

        // Open Monday — the minimal real "configure one day" flow. Since
        // HOS-2446, unticking «Cerrado» on a day without shifts seeds the
        // default 09:00-18:00 shift, so no extra "add shift" click is needed.
        // Every other day is left untouched.
        fireEvent.click(screen.getByRole('switch', { name: 'Lunes abierto' }));
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        const call = mockPatch.mock.calls[0]?.[0] as {
            body: {
                openingHours?: {
                    days?: Record<string, { closed: boolean; shifts: Array<unknown> }>;
                };
            };
        };
        const days = call.body.openingHours?.days ?? {};
        expect(days.mon).toEqual({ closed: false, shifts: [{ open: '09:00', close: '18:00' }] });
        for (const [key, day] of Object.entries(days)) {
            if (key === 'mon') continue;
            expect(day).toEqual({ closed: true, shifts: [] });
        }
    });
    /*
     * The three HOS-372 media tests that lived here (featured upload, the
     * `media`-never-in-the-PATCH guard, and gallery removal) were retired by
     * HOS-1080, not weakened. Photos moved to their own route, which mounts
     * `PhotoSection` directly with no form and no Save — so this island cannot
     * reach media at all any more, and every behaviour they covered is asserted
     * where it now lives:
     *
     *  - upload / remove / featured, and the absence of a client-side Cloudinary
     *    delete: `host/editor/PhotoSection.verticals.test.tsx`;
     *  - `media` never travelling in the PATCH body, and `listMedia` never being
     *    called from a form section: `ListingEditor.payload.test.tsx`;
     *  - `PhotoSection` being imported by the `fotos` route and by no other:
     *    `test/pages/listing-editor-routes.test.ts`.
     */

    it('seeds amenity selection and PATCHes amenityIds/featureIds when toggled', async () => {
        mockPatch.mockResolvedValueOnce({ ok: true, data: {} });

        // HOS-190 slice 3: `amenityIds`/`featureIds` are now validated as real
        // UUIDs against `VenueOwnerUpdateInputSchema` before the PATCH
        // fires — short fixture ids like 'a1' used to be harmless (no
        // validation existed) but now fail `.uuid()` and silently block
        // submission. Use UUID-shaped fixture ids throughout.
        const AMENITY_A1 = '11111111-1111-4111-8111-111111111111';
        const AMENITY_A2 = '22222222-2222-4222-8222-222222222222';
        const FEATURE_F1 = '33333333-3333-4333-8333-333333333333';

        render(
            <ListingEditor
                vertical="venue"
                sectionId="amenities"
                listingId="abc"
                locale="es"
                initialData={
                    {
                        id: 'abc',
                        ownerId: 'owner-1',
                        name: 'La Parrilla',
                        slug: 'la-parrilla',
                        amenityIds: [AMENITY_A1]
                    } as unknown as ListingDetail
                }
                // SPEC-266: catalog items carry `slug` (no `name`). The amenity
                // label resolves via translateAmenityName, which humanizes the
                // slug when no i18n key exists (`wifi` → `Wifi`, `terraza` →
                // `Terraza`). Features render `t(featureNames.<slug>, slug)`,
                // which falls back to the raw slug.
                amenities={[
                    { id: AMENITY_A1, slug: 'wifi', category: null },
                    { id: AMENITY_A2, slug: 'terraza', category: null }
                ]}
                features={[{ id: FEATURE_F1, slug: 'pet_friendly', category: null }]}
            />
        );

        // a1 starts checked (seeded from initialData.amenityIds).
        expect(screen.getByLabelText('Wifi')).toBeChecked();
        expect(screen.getByLabelText('Terraza')).not.toBeChecked();

        // Select a second amenity and a feature.
        fireEvent.click(screen.getByLabelText('Terraza'));
        fireEvent.click(screen.getByLabelText('pet_friendly'));
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        const body = mockPatch.mock.calls[0]?.[0]?.body as {
            amenityIds?: string[];
            featureIds?: string[];
        };
        expect(body.amenityIds).toEqual([AMENITY_A1, AMENITY_A2]);
        expect(body.featureIds).toEqual([FEATURE_F1]);
    });

    it('carries an amenity toggled inside a COLLAPSED accordion through to the payload (HOS-371)', async () => {
        // The test above uses `category: null` amenities, which all land in the
        // single "Otros" bucket — and that bucket is first, therefore open. So
        // it proves "toggle → payload" but never "toggle from behind a closed
        // summary → payload", which is what the accordions actually introduced.
        //
        // <details> keeps its children in the DOM whether open or not, so the
        // checkbox is reachable either way. That is precisely the property worth
        // pinning: swapping <details> for conditional rendering would unmount it
        // and break the write path with no other test noticing.
        const WIFI = '11111111-1111-4111-8111-111111111111';
        const TERRAZA = '33333333-3333-4333-8333-333333333333';

        mockPatch.mockResolvedValueOnce({ ok: true, data: {} });
        const { container } = render(
            <ListingEditor
                vertical="venue"
                sectionId="amenities"
                listingId="abc"
                locale="es"
                initialData={
                    {
                        id: 'abc',
                        ownerId: 'owner-1',
                        name: 'La Parrilla',
                        slug: 'la-parrilla'
                    } as unknown as ListingDetail
                }
                amenities={[
                    { id: WIFI, slug: 'wifi', category: 'CONNECTIVITY' },
                    { id: TERRAZA, slug: 'terraza', category: 'OUTDOORS' }
                ]}
                features={[]}
            />
        );

        // Assert the group really IS collapsed before clicking — otherwise this
        // silently degrades into a duplicate of the test above.
        const outdoors = Array.from(container.querySelectorAll('details')).find((el) =>
            el.querySelector('summary')?.textContent?.includes('Exteriores')
        );
        expect(outdoors?.open).toBe(false);

        fireEvent.click(screen.getByLabelText('Terraza'));
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        const collapsedBody = mockPatch.mock.calls[0]?.[0]?.body as { amenityIds?: string[] };
        expect(collapsedBody.amenityIds).toEqual([TERRAZA]);
    });

    describe('D-1 identity fields (name/destinationId/description) — HOS-166', () => {
        it('renders name, destinationId, and description seeded from initialData', () => {
            render(
                <ListingEditor
                    vertical="venue"
                    sectionId="basicInfo"
                    listingId="abc"
                    locale="es"
                    initialData={baseData}
                    destinations={destinationOptions}
                />
            );

            expect(screen.getByLabelText('Nombre del comercio')).toHaveValue('La Parrilla');
            expect(screen.getByLabelText('Ciudad / Destino')).toHaveValue(DESTINATION_1);
            expect(screen.getByLabelText('Descripción')).toHaveValue(
                'Descripción original con suficiente longitud para pasar validación.'
            );
        });

        it('dirty-tracks name and PATCHes only name when changed', async () => {
            mockPatch.mockResolvedValueOnce({ ok: true, data: {} });
            render(
                <ListingEditor
                    vertical="venue"
                    sectionId="basicInfo"
                    listingId="abc"
                    locale="es"
                    initialData={baseData}
                    destinations={destinationOptions}
                />
            );

            fireEvent.change(screen.getByLabelText('Nombre del comercio'), {
                target: { value: 'La Nueva Parrilla' }
            });
            fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

            await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
            expect(mockPatch).toHaveBeenCalledWith({
                path: '/api/v1/protected/venues/abc',
                body: { name: 'La Nueva Parrilla' }
            });
        });

        it('dirty-tracks destinationId and PATCHes only destinationId when changed', async () => {
            mockPatch.mockResolvedValueOnce({ ok: true, data: {} });
            render(
                <ListingEditor
                    vertical="venue"
                    sectionId="basicInfo"
                    listingId="abc"
                    locale="es"
                    initialData={baseData}
                    destinations={destinationOptions}
                />
            );

            fireEvent.change(screen.getByLabelText('Ciudad / Destino'), {
                target: { value: DESTINATION_2 }
            });
            fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

            await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
            expect(mockPatch).toHaveBeenCalledWith({
                path: '/api/v1/protected/venues/abc',
                body: { destinationId: DESTINATION_2 }
            });
        });

        it('dirty-tracks description and PATCHes only description when changed (AC-19)', async () => {
            mockPatch.mockResolvedValueOnce({ ok: true, data: {} });
            render(
                <ListingEditor
                    vertical="venue"
                    sectionId="basicInfo"
                    listingId="abc"
                    locale="es"
                    initialData={baseData}
                    destinations={destinationOptions}
                />
            );

            fireEvent.change(screen.getByLabelText('Descripción'), {
                target: { value: 'Una descripción completamente nueva y suficientemente larga.' }
            });
            fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

            await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
            expect(mockPatch).toHaveBeenCalledWith({
                path: '/api/v1/protected/venues/abc',
                body: {
                    description: 'Una descripción completamente nueva y suficientemente larga.'
                }
            });
        });

        it('control fields (visibility/publicationStatus/moderationState/isFeatured/ownerId) stay absent from the payload', async () => {
            mockPatch.mockResolvedValueOnce({ ok: true, data: {} });
            render(
                <ListingEditor
                    vertical="venue"
                    sectionId="basicInfo"
                    listingId="abc"
                    locale="es"
                    initialData={baseData}
                    destinations={destinationOptions}
                />
            );

            fireEvent.change(screen.getByLabelText('Nombre del comercio'), {
                target: { value: 'Otro nombre' }
            });
            fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

            await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
            const body = mockPatch.mock.calls[0]?.[0]?.body as Record<string, unknown>;
            expect(body).not.toHaveProperty('visibility');
            expect(body).not.toHaveProperty('publicationStatus');
            expect(body).not.toHaveProperty('moderationState');
            expect(body).not.toHaveProperty('isFeatured');
            expect(body).not.toHaveProperty('ownerId');
        });
    });

    describe('destinationsLoadFailed (judgment-day fix)', () => {
        it('shows an error message instead of silently hiding the destination select', () => {
            render(
                <ListingEditor
                    vertical="venue"
                    sectionId="basicInfo"
                    listingId="abc"
                    locale="es"
                    initialData={baseData}
                    destinations={[]}
                    destinationsLoadFailed
                />
            );

            expect(screen.getByRole('alert')).toHaveTextContent(
                'No pudimos cargar el listado de ciudades / destinos.'
            );
            expect(screen.queryByLabelText('Ciudad / Destino')).not.toBeInTheDocument();
        });

        it('shows an empty-catalog message (not the load-failed one) when destinations legitimately loaded empty', () => {
            render(
                <ListingEditor
                    vertical="venue"
                    sectionId="basicInfo"
                    listingId="abc"
                    locale="es"
                    initialData={baseData}
                    destinations={[]}
                />
            );

            // HOS-260: a genuinely empty catalog must not leave the required
            // destinationId field silently missing with zero explanation.
            expect(screen.getByRole('alert')).toHaveTextContent(
                'Todavía no hay ciudades / destinos cargados.'
            );
            expect(screen.queryByLabelText('Ciudad / Destino')).not.toBeInTheDocument();
        });
    });
});
