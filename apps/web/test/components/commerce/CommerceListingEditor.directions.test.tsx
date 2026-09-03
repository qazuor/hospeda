/**
 * @file CommerceListingEditor.directions.test.tsx
 * @description The owner editor's how-to-get-there field (HOS-1049).
 *
 * The sibling suite `CommerceListingEditor.meeting-point.test.tsx` covers the
 * FREE half of this section. This one covers the single paid field, which
 * behaves differently in three ways a wiring mistake breaks silently:
 *
 *  - it is rendered for EVERY experience provider and only DISABLED for the
 *    unentitled ones. Hiding it would make a downgrade read as data loss, and
 *    would make the capability invisible to the one person who could buy it;
 *  - an unentitled provider's stored instructions still SEED the control, so
 *    they can see what their public page is no longer showing;
 *  - a save that touched only the FREE field does not drag the paid key along.
 *    That falls out of the diff contract — the editor emits a key only when its
 *    value differs from the seeded baseline — and it is what keeps an
 *    unentitled provider's ordinary save from collecting a 403.
 *
 * The API refuses the write independently — see
 * `apps/api/test/commerce/experience-directions-entitlement.e2e.test.ts` for
 * the pair of BLOCK/ALLOW cases that prove the real gate. Nothing here is the
 * enforcement.
 *
 * Assertions run against a JSON round-trip of the body (`wireBody`), because
 * `toHaveBeenCalledWith` uses `toEqual` semantics and cannot tell an absent key
 * from one explicitly set to `undefined`.
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

vi.mock('../../../src/lib/api/client', () => ({
    apiClient: {
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
            sectionId="meetingPoint"
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

const DIRECTIONS = [
    'Estacioná en la bajada municipal, sobre la costanera',
    'El colectivo 4 te deja en la rotonda'
];

const directionsField = () => screen.getByLabelText('Cómo llegar');

describe('CommerceListingEditor — how to get there (HOS-1049)', () => {
    beforeEach(() => {
        mockPatch.mockReset();
        mockPatch.mockResolvedValue({ ok: true, data: {} });
        vi.mocked(addToast).mockClear();
    });

    it('offers the field to an entitled provider', () => {
        // Arrange / Act
        renderEditor(
            'experience',
            buildListing({ meetingPoint: MEETING_POINT, meetingPointDirectionsEnabled: true })
        );

        // Assert
        expect(directionsField()).toBeEnabled();
    });

    it('shows the field DISABLED, not hidden, to an unentitled provider', () => {
        // Hiding it would make a downgrade look like data loss and would keep
        // the capability invisible to the person who could buy it. The control
        // is present and inert.
        // Arrange / Act
        renderEditor(
            'experience',
            buildListing({ meetingPoint: MEETING_POINT, meetingPointDirectionsEnabled: false })
        );

        // Assert
        expect(directionsField()).toBeDisabled();
    });

    it('treats a MISSING flag as not entitled', () => {
        // A legacy protected response, or a route that forgot to resolve it.
        // Absent must read as refusal — the one direction where guessing gives
        // the product away.
        // Arrange / Act
        renderEditor('experience', buildListing({ meetingPoint: MEETING_POINT }));

        // Assert
        expect(directionsField()).toBeDisabled();
    });

    it('seeds a downgraded provider with what they had written', () => {
        // They can no longer publish it, but they must be able to SEE it: an
        // editor that opened blank here would look like the instructions were
        // deleted rather than withheld.
        // Arrange / Act
        renderEditor(
            'experience',
            buildListing({
                meetingPoint: MEETING_POINT,
                meetingPointDirections: DIRECTIONS,
                meetingPointDirectionsEnabled: false
            })
        );

        // Assert
        expect(directionsField()).toHaveValue(DIRECTIONS.join('\n'));
    });

    it('sends the edited instructions for an entitled provider', async () => {
        // Arrange
        renderEditor(
            'experience',
            buildListing({ meetingPoint: MEETING_POINT, meetingPointDirectionsEnabled: true })
        );

        // Act
        fireEvent.change(directionsField(), {
            target: { value: DIRECTIONS.join('\n') }
        });
        fireEvent.click(saveButton());

        // Assert
        expect(await wireBody()).toMatchObject({ meetingPointDirections: DIRECTIONS });
    });

    it('sends an EMPTY list when an entitled provider clears every line', async () => {
        // `[]` is how the owner removes them all, exactly as with whatToBring.
        // Omitting the key means "no change" and the stale instructions would
        // survive the save in silence.
        // Arrange
        renderEditor(
            'experience',
            buildListing({
                meetingPoint: MEETING_POINT,
                meetingPointDirections: DIRECTIONS,
                meetingPointDirectionsEnabled: true
            })
        );

        // Act
        fireEvent.change(directionsField(), { target: { value: '' } });
        fireEvent.click(saveButton());

        // Assert
        expect(await wireBody()).toMatchObject({ meetingPointDirections: [] });
    });

    it('never puts the key in the body when only the free field changed', async () => {
        // Pins the diff contract, which is what actually keeps the paid key out
        // of an unentitled provider's PATCH: the editor emits a key only when
        // its value DIFFERS from the seeded baseline, so a save of the meeting
        // point alone cannot drag the untouched instructions along and take a
        // 403 with them. (There is deliberately no second entitlement guard in
        // `buildPatchPayload` — see its comment for why that branch would be
        // unreachable.)
        // Arrange
        renderEditor(
            'experience',
            buildListing({
                meetingPoint: MEETING_POINT,
                meetingPointDirections: DIRECTIONS,
                meetingPointDirectionsEnabled: false
            })
        );

        // Act — edit the FREE field, so there is a real save to make.
        fireEvent.change(screen.getByLabelText('Punto de encuentro'), {
            target: { value: 'Muelle 1, junto a la rampa' }
        });
        fireEvent.click(saveButton());

        // Assert — the free change ships, the paid key does not. `wireBody`
        // is a JSON round-trip, so this distinguishes an absent key from one
        // set to `undefined`.
        const body = await wireBody();
        expect(body).toMatchObject({ meetingPoint: 'Muelle 1, junto a la rampa' });
        expect(body).not.toHaveProperty('meetingPointDirections');
    });
});
