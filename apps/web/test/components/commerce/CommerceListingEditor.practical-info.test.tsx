/**
 * @file CommerceListingEditor.practical-info.test.tsx
 * @description The owner editor's practical-details section — duration
 * (HOS-898), the two checklists (HOS-1046), the cancellation policy (HOS-1047)
 * and the private-groups toggle (HOS-1056).
 *
 * Sibling of `CommerceListingEditor.meeting-point.test.tsx` and set up the same
 * way, because the same four wiring mistakes are the ones that fail silently:
 *
 *  - the section renders for `experience` and NOT for `gastronomy` (none of
 *    these keys is on `GastronomyOwnerUpdateInputSchema`, so a control drawn
 *    there would offer an edit every save strips while answering 200);
 *  - a persisted value seeds the form (an editor that opens blank re-saves
 *    blank, deleting data the owner never touched);
 *  - clearing sends an explicit `null` rather than omitting the key, which is
 *    the omit-instead-of-null bug H-156 had to fix for `priceUnit`;
 *  - the duration's TWO boxes collapse to ONE column, and the diff is taken on
 *    the joined value — otherwise "90 min" to "1 h 30 min" would mark the form
 *    dirty and PATCH a value identical to the stored one.
 *
 * What these do NOT prove: anything about the public page. Vitest cannot render
 * `.astro`, so the read side is covered where it executes — the tier parse in
 * `packages/schemas` and `toExperienceDetailPageProps` in `transforms.test.ts`.
 *
 * Assertions run against a JSON round-trip of the body (`wireBody`), because
 * `toHaveBeenCalledWith` uses `toEqual` semantics and cannot tell an absent key
 * from one explicitly set to `undefined` — exactly the distinction the
 * clear-to-null contract rests on.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommerceListingEditor } from '../../../src/components/commerce/CommerceListingEditor.client';
import type { CommerceListingDetail } from '../../../src/lib/commerce/owner-listings';

const { I18N_INITIAL } = vi.hoisted(() => {
    const blank = () => ({ es: '', en: '', pt: '' });
    return {
        I18N_INITIAL: {
            nameI18n: blank(),
            summaryI18n: blank(),
            descriptionI18n: blank(),
            richDescriptionI18n: blank()
        }
    };
});

vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));

vi.mock('../../../src/components/commerce/CommerceListingEditor.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/components/commerce/CommerceTranslationPanel.client', () => ({
    CommerceTranslationPanel: () => null,
    parseCommerceI18nValues: () => I18N_INITIAL
}));

// The rich-text editor is irrelevant here and expensive to boot; the sibling
// suite `CommerceListingEditor.rich-description.test.tsx` covers the real one.
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
import { addToast } from '../../../src/store/toast-store';

const mockPatch = vi.mocked(apiClient.patch);

const DESTINATION_1 = '11111111-1111-4111-8111-111111111111';

function buildListing(overrides: Record<string, unknown> = {}): CommerceListingDetail {
    return {
        id: 'abc',
        ownerId: 'owner-1',
        name: 'Excursión a Colón',
        slug: 'excursion-a-colon',
        lifecycleState: 'DRAFT',
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
            destinations={[{ id: DESTINATION_1, name: 'Concepción del Uruguay' }]}
        />
    );
}

const saveButton = () => screen.getByRole('button', { name: 'Guardar' });

/** The PATCH body as it goes over the wire — `undefined` keys dropped. */
async function wireBody(): Promise<Record<string, unknown>> {
    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    const raw = mockPatch.mock.calls[0]?.[0]?.body;
    return JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
}

const POLICY = 'Si baja el río reprogramamos sin cargo.';

const hoursBox = () => screen.getByLabelText('Duración — horas');
const minutesBox = () => screen.getByLabelText('Duración — minutos');
const whatToBringBox = () => screen.getByLabelText('Qué llevar');
const requirementsBox = () => screen.getByLabelText('Requisitos');
const policyBox = () => screen.getByLabelText('Política de cancelación');
const groupsToggle = () => screen.getByLabelText('Hago precio especial para grupos privados');

describe('CommerceListingEditor — practical details', () => {
    beforeEach(() => {
        mockPatch.mockReset();
        mockPatch.mockResolvedValue({ ok: true, data: {} });
        vi.mocked(addToast).mockClear();
    });

    describe('which vertical gets the section', () => {
        it('renders every practical field for an experience', () => {
            const { container } = renderEditor('experience');

            expect(container.querySelector('#editor-practicalInfo')).not.toBeNull();
            expect(hoursBox()).toBeInTheDocument();
            expect(minutesBox()).toBeInTheDocument();
            expect(whatToBringBox()).toBeInTheDocument();
            expect(requirementsBox()).toBeInTheDocument();
            expect(policyBox()).toBeInTheDocument();
            expect(groupsToggle()).toBeInTheDocument();
        });

        it('renders nothing of the kind for a gastronomy listing', () => {
            // None of these keys is on `GastronomyOwnerUpdateInputSchema`, so a
            // control here would offer an edit the API strips while answering 200.
            const { container } = renderEditor('gastronomy');

            expect(container.querySelector('#editor-practicalInfo')).toBeNull();
            expect(screen.queryByLabelText('Qué llevar')).toBeNull();
            expect(screen.queryByLabelText('Política de cancelación')).toBeNull();
        });

        it('lists the section in the nav right after the meeting point', () => {
            // The scrollspy takes the FIRST visible entry of the nav array, so
            // an entry out of DOM order highlights the wrong link whenever two
            // sections share the viewport.
            const { unmount } = renderEditor('experience');

            const ids = [
                ...screen
                    .getByRole('navigation', { name: 'Navegación de secciones del formulario' })
                    .querySelectorAll('a')
            ].map((anchor) => anchor.getAttribute('href'));

            expect(ids).toContain('#editor-practicalInfo');
            expect(ids.indexOf('#editor-practicalInfo')).toBe(
                ids.indexOf('#editor-meetingPoint') + 1
            );

            unmount();
            renderEditor('gastronomy');
            const gastronomyIds = [
                ...screen
                    .getByRole('navigation', { name: 'Navegación de secciones del formulario' })
                    .querySelectorAll('a')
            ].map((anchor) => anchor.getAttribute('href'));
            expect(gastronomyIds).not.toContain('#editor-practicalInfo');
        });
    });

    describe('seeding from the persisted row', () => {
        it('splits a stored duration across the two boxes', () => {
            renderEditor('experience', buildListing({ durationMinutes: 150 }));

            expect(hoursBox()).toHaveValue(2);
            expect(minutesBox()).toHaveValue(30);
        });

        it('leaves both boxes EMPTY when no duration is stored', () => {
            // Empty, not `0`: "0 h 0 min" reads as a declared duration of
            // nothing, which is a different claim from "not declared".
            renderEditor('experience');

            expect(hoursBox()).toHaveValue(null);
            expect(minutesBox()).toHaveValue(null);
        });

        it('opens with the stored checklists, one item per line', () => {
            renderEditor(
                'experience',
                buildListing({
                    whatToBring: ['Repelente', 'Calzado cerrado'],
                    requirements: ['Edad mínima 12 años']
                })
            );

            expect(whatToBringBox()).toHaveValue('Repelente\nCalzado cerrado');
            expect(requirementsBox()).toHaveValue('Edad mínima 12 años');
        });

        it('opens with the stored policy and group flag', () => {
            renderEditor(
                'experience',
                buildListing({ cancellationPolicy: POLICY, acceptsPrivateGroups: true })
            );

            expect(policyBox()).toHaveValue(POLICY);
            expect(groupsToggle()).toBeChecked();
        });

        it('survives a row saved before the columns existed', () => {
            // A legacy listing carries none of these keys. The editor must open
            // with empty controls rather than throwing on `undefined.join`.
            renderEditor('experience', buildListing());

            expect(whatToBringBox()).toHaveValue('');
            expect(groupsToggle()).not.toBeChecked();
        });
    });

    describe('the PATCH body', () => {
        it('joins the two duration boxes into one durationMinutes', async () => {
            renderEditor('experience');

            fireEvent.change(hoursBox(), { target: { value: '2' } });
            fireEvent.change(minutesBox(), { target: { value: '30' } });
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body).toHaveProperty('durationMinutes', 150);
        });

        it('accepts minutes alone, with the hours box left empty', async () => {
            renderEditor('experience');

            fireEvent.change(minutesBox(), { target: { value: '45' } });
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body).toHaveProperty('durationMinutes', 45);
        });

        it('sends an explicit null when both duration boxes are cleared', async () => {
            renderEditor('experience', buildListing({ durationMinutes: 150 }));

            fireEvent.change(hoursBox(), { target: { value: '' } });
            fireEvent.change(minutesBox(), { target: { value: '' } });
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body).toHaveProperty('durationMinutes', null);
        });

        it('does NOT send a duration when the boxes are only regrouped', async () => {
            // 150 stored, re-entered as 1 h 90 min: both boxes moved, the joined
            // value did not. Diffing the halves instead of the join would mark
            // the form dirty and PATCH a value identical to the stored one.
            renderEditor('experience', buildListing({ durationMinutes: 150 }));

            fireEvent.change(hoursBox(), { target: { value: '1' } });
            fireEvent.change(minutesBox(), { target: { value: '90' } });
            fireEvent.change(screen.getByLabelText('Nombre del comercio'), {
                target: { value: 'Excursión a Colón II' }
            });
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body).toHaveProperty('name', 'Excursión a Colón II');
            expect(body).not.toHaveProperty('durationMinutes');
        });

        it('sends a checklist as an array of trimmed lines', async () => {
            renderEditor('experience');

            fireEvent.change(whatToBringBox(), {
                target: { value: '  Repelente  \nCalzado cerrado' }
            });
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body).toHaveProperty('whatToBring', ['Repelente', 'Calzado cerrado']);
        });

        it('drops blank lines instead of sending an empty item', async () => {
            // The schema rejects an empty item, so a stray blank line — which
            // everybody leaves while typing a list — would fail the save with an
            // error about a line the owner cannot see.
            renderEditor('experience');

            fireEvent.change(requirementsBox(), {
                target: { value: 'Saber nadar\n\n   \nEdad mínima 12 años' }
            });
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body).toHaveProperty('requirements', ['Saber nadar', 'Edad mínima 12 años']);
        });

        it('sends an EMPTY ARRAY when a checklist is cleared, not null', async () => {
            // `[]` is how the owner removes every item, and the column is NOT
            // NULL — a null here would be rejected by the database.
            renderEditor('experience', buildListing({ whatToBring: ['Repelente'] }));

            fireEvent.change(whatToBringBox(), { target: { value: '' } });
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body).toHaveProperty('whatToBring', []);
        });

        it('sends an explicit null when the cancellation policy is cleared', async () => {
            renderEditor('experience', buildListing({ cancellationPolicy: POLICY }));

            fireEvent.change(policyBox(), { target: { value: '' } });
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body).toHaveProperty('cancellationPolicy', null);
        });

        it('sends false — not null — when the group toggle is switched off', async () => {
            // The column is NOT NULL with a false default, so switching off is a
            // real value, never an absence.
            renderEditor('experience', buildListing({ acceptsPrivateGroups: true }));

            fireEvent.click(groupsToggle());
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body).toHaveProperty('acceptsPrivateGroups', false);
        });

        it('omits every practical key when nothing about them changed', async () => {
            // An untouched section must not appear in the diff, or every save of
            // an unrelated field would rewrite it.
            renderEditor(
                'experience',
                buildListing({
                    durationMinutes: 150,
                    whatToBring: ['Repelente'],
                    cancellationPolicy: POLICY,
                    acceptsPrivateGroups: true
                })
            );

            fireEvent.change(screen.getByLabelText('Nombre del comercio'), {
                target: { value: 'Excursión a Colón II' }
            });
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body).toHaveProperty('name', 'Excursión a Colón II');
            expect(body).not.toHaveProperty('durationMinutes');
            expect(body).not.toHaveProperty('whatToBring');
            expect(body).not.toHaveProperty('requirements');
            expect(body).not.toHaveProperty('cancellationPolicy');
            expect(body).not.toHaveProperty('acceptsPrivateGroups');
        });

        it('never sends a practical key from the gastronomy branch', async () => {
            // Non-vacuity for the vertical split: the form-state object is
            // shared between both verticals, so only `buildPatchPayload` keeps
            // these keys off a gastronomy PATCH.
            renderEditor(
                'gastronomy',
                buildListing({ durationMinutes: 150, acceptsPrivateGroups: true })
            );

            fireEvent.change(screen.getByLabelText('Nombre del comercio'), {
                target: { value: 'La Parrilla Nueva' }
            });
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body).not.toHaveProperty('durationMinutes');
            expect(body).not.toHaveProperty('acceptsPrivateGroups');
        });
    });
});
