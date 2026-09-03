/**
 * @file CommerceListingEditor.meeting-point.test.tsx
 * @description The owner editor's meeting-point section (HOS-1048).
 *
 * ## What each assertion actually proves
 *
 * These mount the REAL editor and read the REAL PATCH body, so they cover the
 * three things a wiring mistake breaks silently:
 *
 *  - the section renders for `experience` and NOT for `gastronomy` (the field
 *    is absent from `GastronomyOwnerUpdateInputSchema`, so a control drawn
 *    there would offer an edit every save strips, and answer 200 doing it);
 *  - a persisted value seeds the form (an editor that opens blank re-saves
 *    blank, quietly deleting a meeting point the owner never touched);
 *  - clearing the text sends an explicit `null`, not an omitted key — the
 *    omit-instead-of-null bug H-156 had to fix for `priceUnit`, where the PATCH
 *    dropped the change and the stale value survived.
 *
 * What they do NOT prove: anything about the public page. Vitest cannot render
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

// `get` is stubbed because the gastronomy branch of the editor mounts
// `CommerceMenuManager`, which reads its own carta on mount (HOS-895).
vi.mock('../../../src/lib/api/client', () => ({
    apiClient: {
        get: vi.fn().mockResolvedValue({ ok: true, data: { sections: [], file: null } }),
        patch: vi.fn()
    }
}));

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
const MEETING_POINT = 'Muelle 3 del puerto, frente a la caseta azul';

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

describe('CommerceListingEditor — meeting point (HOS-1048)', () => {
    beforeEach(() => {
        mockPatch.mockReset();
        mockPatch.mockResolvedValue({ ok: true, data: {} });
        vi.mocked(addToast).mockClear();
    });

    describe('which vertical gets the section', () => {
        it('renders the meeting-point fields for an experience', () => {
            // Arrange / Act
            const { container } = renderEditor('experience');

            // Assert
            expect(container.querySelector('#editor-meetingPoint')).not.toBeNull();
            expect(screen.getByLabelText('Punto de encuentro')).toBeInTheDocument();
            expect(screen.getByLabelText('Latitud (opcional)')).toBeInTheDocument();
            expect(screen.getByLabelText('Longitud (opcional)')).toBeInTheDocument();
        });

        it('renders nothing of the kind for a gastronomy listing', () => {
            // A restaurant's address is its address; `meetingPoint` is not on
            // `GastronomyOwnerUpdateInputSchema`, so a control here would offer
            // an edit the API silently strips while answering 200.
            const { container } = renderEditor('gastronomy');

            expect(container.querySelector('#editor-meetingPoint')).toBeNull();
            expect(screen.queryByLabelText('Punto de encuentro')).toBeNull();
        });

        it('lists the section in the nav for an experience, and not for gastronomy', () => {
            // Arrange
            const { unmount } = renderEditor('experience');

            // Act
            const experienceNav = screen
                .getByRole('navigation', { name: 'Navegación de secciones del formulario' })
                .querySelectorAll('a');
            const experienceIds = [...experienceNav].map((a) => a.getAttribute('href'));

            // Assert — present, and positioned right after the basic-info entry,
            // which is where the section renders. The scrollspy takes the FIRST
            // visible entry of the array, so an out-of-order entry highlights
            // the wrong link whenever two sections share the viewport.
            expect(experienceIds).toContain('#editor-meetingPoint');
            expect(experienceIds.indexOf('#editor-meetingPoint')).toBe(
                experienceIds.indexOf('#editor-basicInfo') + 1
            );

            unmount();
            renderEditor('gastronomy');
            const gastronomyIds = [
                ...screen
                    .getByRole('navigation', { name: 'Navegación de secciones del formulario' })
                    .querySelectorAll('a')
            ].map((a) => a.getAttribute('href'));
            expect(gastronomyIds).not.toContain('#editor-meetingPoint');
        });
    });

    describe('seeding from the persisted row', () => {
        it('opens with the stored meeting point and coordinates', () => {
            // An editor that opens blank re-saves blank: the diff would then see
            // "was X, is now empty" and clear a value the owner never touched.
            renderEditor(
                'experience',
                buildListing({
                    meetingPoint: MEETING_POINT,
                    meetingPointLat: -32.4825,
                    meetingPointLong: -58.2333
                })
            );

            expect(screen.getByLabelText('Punto de encuentro')).toHaveValue(MEETING_POINT);
            expect(screen.getByLabelText('Latitud (opcional)')).toHaveValue(-32.4825);
            expect(screen.getByLabelText('Longitud (opcional)')).toHaveValue(-58.2333);
        });

        it('opens with an empty coordinate when the row has none', () => {
            renderEditor('experience', buildListing({ meetingPoint: MEETING_POINT }));

            // Empty, NOT `0`: an unpinned meeting point must not read as a
            // listing off the coast of Africa.
            expect(screen.getByLabelText('Latitud (opcional)')).toHaveValue(null);
        });

        it('keeps a stored coordinate of 0 rather than showing an empty box', () => {
            renderEditor('experience', buildListing({ meetingPointLat: 0 }));

            expect(screen.getByLabelText('Latitud (opcional)')).toHaveValue(0);
        });
    });

    describe('the PATCH body', () => {
        it('sends the meeting point when the owner types one', async () => {
            // Arrange
            renderEditor('experience');

            // Act
            fireEvent.change(screen.getByLabelText('Punto de encuentro'), {
                target: { value: MEETING_POINT }
            });
            fireEvent.click(saveButton());

            // Assert
            const body = await wireBody();
            expect(body).toHaveProperty('meetingPoint', MEETING_POINT);
        });

        it('sends an explicit null when the meeting point is cleared', async () => {
            // The schema is `.nullish()` and the column is nullable, so `null`
            // is the only way to say "I removed the address I had". Omitting the
            // key means "no change" and the stale value would survive the save.
            renderEditor('experience', buildListing({ meetingPoint: MEETING_POINT }));

            fireEvent.change(screen.getByLabelText('Punto de encuentro'), {
                target: { value: '' }
            });
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body).toHaveProperty('meetingPoint', null);
        });

        it('sends the coordinates as numbers, not strings', async () => {
            renderEditor('experience');

            fireEvent.change(screen.getByLabelText('Latitud (opcional)'), {
                target: { value: '-32.4825' }
            });
            fireEvent.change(screen.getByLabelText('Longitud (opcional)'), {
                target: { value: '-58.2333' }
            });
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body).toHaveProperty('meetingPointLat', -32.4825);
            expect(body).toHaveProperty('meetingPointLong', -58.2333);
        });

        it('sends an explicit null when a coordinate is cleared', async () => {
            renderEditor('experience', buildListing({ meetingPointLat: -32.4825 }));

            fireEvent.change(screen.getByLabelText('Latitud (opcional)'), {
                target: { value: '' }
            });
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body).toHaveProperty('meetingPointLat', null);
        });

        it('omits the meeting-point keys entirely when nothing about it changed', async () => {
            // Arrange — an untouched section must not appear in the diff, or
            // every save of an unrelated field would rewrite it.
            renderEditor('experience', buildListing({ meetingPoint: MEETING_POINT }));

            // Act
            fireEvent.change(screen.getByLabelText('Nombre del comercio'), {
                target: { value: 'Excursión a Colón II' }
            });
            fireEvent.click(saveButton());

            // Assert
            const body = await wireBody();
            expect(body).toHaveProperty('name', 'Excursión a Colón II');
            expect(body).not.toHaveProperty('meetingPoint');
            expect(body).not.toHaveProperty('meetingPointLat');
            expect(body).not.toHaveProperty('meetingPointLong');
        });

        it('never sends a meeting point from the gastronomy branch', async () => {
            // Non-vacuity for the vertical split: the state object is shared
            // between both verticals, so only `buildPatchPayload` keeps the key
            // off a gastronomy PATCH.
            renderEditor('gastronomy', buildListing({ meetingPoint: MEETING_POINT }));

            fireEvent.change(screen.getByLabelText('Nombre del comercio'), {
                target: { value: 'La Parrilla Nueva' }
            });
            fireEvent.click(saveButton());

            const body = await wireBody();
            expect(body).not.toHaveProperty('meetingPoint');
        });
    });
});
