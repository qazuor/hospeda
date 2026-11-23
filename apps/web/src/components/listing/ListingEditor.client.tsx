/**
 * @file ListingEditor.client.tsx
 * @description Editor island for ONE section of a listing owner's listing
 * (SPEC-249 Part A, extended in SPEC-253 and HOS-166 D-1; split one-page-per-
 * section in HOS-1080). Native HTML form (no TanStack Form, per web
 * conventions) that persists changes through the vertical's protected PATCH
 * endpoint (`updateOwn`).
 *
 * ## One island, one section (HOS-1080)
 *
 * Until HOS-1080 this component rendered every field group at once on a single
 * route, with an in-page scrollspy nav — the long form HOS-892 reported. It now
 * takes a `sectionId` and renders exactly that section, one per route, matching
 * the accommodation editor the two surfaces already shared their save bar
 * (`EditorSaveBar` since HOS-2487) and section styling with.
 *
 * What deliberately did NOT change is `buildPatchPayload`. Its per-field
 * contracts (`priceFrom` omits, `priceUnit` nulls, `contactInfo` ships
 * wholesale, the duration is diffed JOINED, `media` never ships) are the kind of
 * thing a per-section rewrite flattens without anything failing. It still builds
 * the full diff from the whole form state; `restrictPayloadToSection` then keeps
 * only the keys this page owns, so a section can never persist another's data
 * even if a future edit lets a foreign value into state.
 *
 * `slug` stays out of this form — the owner never edits it directly. The server
 * keeps it in sync with the name while the listing is still a draft, then stops
 * auto-changing it once the listing is published (HOS-784 stage 1).
 *
 * The diff (`listing-patch-payload.ts`), the form-state readers
 * (`listing-initial-data.ts`) and the field handlers (`use-listing-edit-state.ts`)
 * live beside this island since HOS-2415 (AC-12, files ≤ 500 lines).
 */

import {
    DUPLICATE_LOCATION_REASON,
    ExperienceOwnerUpdateInputSchema,
    VenueOwnerUpdateInputSchema
} from '@repo/schemas';
import { type JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ZodTypeAny } from 'zod';
import { EditorSaveBar } from '@/components/account/editor-shell/EditorSaveBar';
import type { SaveOutcome } from '@/components/account/ui/use-save-bar';
import type { DestinationOption } from '@/components/listing/destination-option';
import { resolveBusinessLinesFieldError } from '@/components/listing/editor/BusinessLinesField.client';
import { apiClient } from '@/lib/api/client';
import type { AmenityData } from '@/lib/api/types';
import { useZodForm } from '@/lib/forms/use-zod-form';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { LISTING_VERTICAL_FORM_CONFIG } from '@/lib/listing/listing-vertical-form-config';
import {
    buildLocationExceptionTarget,
    type LocationExceptionTarget,
    toLocationExceptionVertical
} from '@/lib/listing/location-exception';
import type { ListingDetail, VenueOrExperience } from '@/lib/listing/owner-listings';
import { shouldOfferPublishedSlugRefresh } from '@/lib/listing-slug-refresh';
import { refineStrictContactPhone } from '@/lib/phone-editor-validation';
import { addToast } from '@/store/toast-store';
import {
    LISTING_AGGREGATE_FIELDS,
    LISTING_FIELD_ID_SUFFIXES,
    LISTING_FIELD_PREFIX
} from './editor/field-ids';
import type { ListingEditData } from './editor/listing-edit-data';
import { buildListingInitialEditData } from './editor/listing-initial-data';
import { buildPatchPayload } from './editor/listing-patch-payload';
import {
    type ListingEditorFormSectionId,
    restrictPayloadToSection
} from './editor/listing-section-payload';
import { LISTING_SECTION_RENDERERS } from './editor/section-renderers';
import { useListingEditState } from './editor/use-listing-edit-state';
import styles from './ListingEditor.module.css';
import { LocationExceptionRequestTrigger } from './LocationExceptionRequestTrigger.client';

export interface ListingEditorProps {
    /** Which vertical this listing belongs to (drives the PATCH endpoint + price group). */
    readonly vertical: VenueOrExperience;
    /**
     * Which section this page edits (HOS-1080). Decides what renders AND what
     * the save may persist — see `listing-section-payload.ts`.
     */
    readonly sectionId: ListingEditorFormSectionId;
    /** UUID of the listing being edited. */
    readonly listingId: string;
    /** Active UI locale. */
    readonly locale: SupportedLocale;
    /** Current operational + identity values fetched from the protected getById. */
    readonly initialData: ListingDetail;
    /** Amenity catalog for the multi-select (fetched SSR from the public endpoint). */
    readonly amenities?: readonly AmenityData[];
    /** Feature catalog for the multi-select (fetched SSR from the public endpoint). */
    readonly features?: readonly AmenityData[];
    /**
     * Destination options for the destination select (HOS-166 D-1). Fetched
     * SSR by the hosting page, same pattern as `amenities`/`features`.
     */
    readonly destinations?: readonly DestinationOption[];
    /**
     * `true` when the SSR destination catalog fetch failed (as opposed to
     * succeeding with a genuinely empty catalog). `destinationId` is REQUIRED
     * for publish-readiness (`resolveListingCompleteness`), so silently
     * hiding the select on a failed fetch (the old `destinations.length > 0`
     * gate) left the owner with no way to ever complete their listing and no
     * indication why the field was missing. Defaults to `false` so existing
     * callers/tests that omit it keep the prior behaviour.
     */
    readonly destinationsLoadFailed?: boolean;
}

/**
 * Client-side validation schemas: the real owner-update schemas (the same ones
 * {@link LISTING_VERTICAL_FORM_CONFIG} declares as `updateSchema`) plus the
 * strict Argentine phone rule (HOS-2034). The shared schema stays permissive so
 * stored legacy phones keep validating; only the editor refuses a too-short
 * `+54` value.
 */
const EDITOR_SCHEMAS: Readonly<Record<VenueOrExperience, ZodTypeAny>> = {
    venue: VenueOwnerUpdateInputSchema.superRefine(refineStrictContactPhone),
    experience: ExperienceOwnerUpdateInputSchema.superRefine(refineStrictContactPhone)
};

/**
 * Owner editor for ONE section. Tracks which field groups changed and PATCHes
 * only the dirty subset of the keys this section owns, so a save here can never
 * re-submit — let alone clobber — another section's data.
 */
export function ListingEditor({
    vertical,
    sectionId,
    listingId,
    locale,
    initialData,
    amenities = [],
    features = [],
    destinations = [],
    destinationsLoadFailed = false
}: ListingEditorProps): JSX.Element {
    const { t } = createTranslations(locale);
    // Per-vertical data (update schema, PATCH endpoint, business-line presence)
    // read from the shared record instead of compared against a literal.
    const { patchPath, showsBusinessLines } = LISTING_VERTICAL_FORM_CONFIG[vertical];

    // Field-level validation is delegated to the shared `useZodForm` primitive
    // (HOS-190 slice 3) against the REAL per-vertical owner-update schema — the
    // exact schema `PATCH /api/v1/protected/{venues|experiences}/:id`
    // validates the request body against (`apps/api/src/routes/.../protected/patch.ts`).
    // Validating the full dirty-field payload against it (instead of the two ad
    // hoc summary/priceFrom checks this editor had) closes contact
    // (mobilePhone/workEmail), social networks, opening hours, and the
    // priceFrom/priceUnit null-vs-undefined bug (see `buildPayload` below).
    const schema = EDITOR_SCHEMAS[vertical];
    const { fieldErrors, formError, validate, handleApiError, setFormError, reset } = useZodForm({
        schema,
        t,
        // HOS-373: a failed submit focuses the first invalid field on the page.
        // HOS-385: derived from the Zod key by the same `buildFieldId` the
        // sections render with, so this is a namespace plus the genuine
        // exceptions — not a table that can disagree with the markup.
        fieldIdPrefix: LISTING_FIELD_PREFIX,
        fieldIdSuffixes: LISTING_FIELD_ID_SUFFIXES,
        // HOS-814: `openingHours` is 7 days x N shifts under one Zod key, so
        // every rejection arrives at a nested path and nothing read the bare
        // key — the section's <FieldError> and the focus move were both dead.
        // Rolling the first nested message up revives both.
        aggregateFields: LISTING_AGGREGATE_FIELDS
    });

    // HOS-372: media is never buffered here (MediaSection persists per
    // operation on its own route). The readers live in `listing-initial-data.ts`.
    const buildInitialEditData = (): ListingEditData =>
        buildListingInitialEditData({ initialData });
    const {
        formData,
        setFormData,
        baseline,
        setBaseline,
        status,
        setStatus,
        onFieldChange,
        updateContact,
        updateSocial,
        onPolicyChange,
        toggleAmenity,
        changeAmenityAttribute,
        toggleFeature,
        handleI18nChange
    } = useListingEditState({ buildInitialEditData });
    // TYPE-WORKAROUND: the detail is a venue|experience union; the publication status is read by key.
    const data = initialData as unknown as Record<string, unknown>;

    const currentPublicationStatus = String(data.publicationStatus ?? 'DRAFT');

    /** HOS-2192: the address of the save refused with 409 `DUPLICATE_LOCATION`, to request an exception for it. */
    const exceptionVertical = toLocationExceptionVertical({ vertical });
    const [refusedTarget, setRefusedTarget] = useState<LocationExceptionTarget | null>(null);

    /**
     * The PATCH body: the diff between the edited form and the last persisted
     * snapshot (see `buildPatchPayload` for the per-field contract). Memoized so
     * `canSave` can be derived from it without rebuilding the payload on every
     * render.
     */
    const patchPayload = useMemo(
        () =>
            restrictPayloadToSection({
                payload: buildPatchPayload({
                    current: formData,
                    baseline,
                    vertical,
                    publicationStatus: currentPublicationStatus
                }),
                sectionId
            }),
        [formData, baseline, vertical, currentPublicationStatus, sectionId]
    );

    // HOS-1787 leaf 5.7: a type change revalidates the business lines. An
    // invalid selection must block the save and show the catalog's reason, never
    // silently drop a line (removing one hides the content it owns). The helper
    // is the web's only `validateBusinessLines` caller (G-FAC-09/G-FAC-03).
    const businessLinesError = showsBusinessLines
        ? resolveBusinessLinesFieldError({
              vertical,
              type: formData.listingType,
              selected: formData.businessLines,
              t
          })
        : undefined;

    const shouldOfferSlugRefresh = shouldOfferPublishedSlugRefresh({
        currentPublicationStatus,
        initialName: baseline.name,
        currentName: formData.name
    });

    useEffect(() => {
        if (!shouldOfferSlugRefresh && formData.refreshSlugFromName) {
            setFormData((prev) => ({ ...prev, refreshSlugFromName: false }));
        }
    }, [formData.refreshSlugFromName, shouldOfferSlugRefresh, setFormData]);

    const save = useCallback(async (): Promise<SaveOutcome> => {
        // HOS-816: retire the previous attempt's banner as this one STARTS.
        // Nothing else ever cleared it: `handleApiError` only ever sets a
        // message, and the success branch below left whatever was on screen
        // untouched — so a save that failed and then succeeded showed the
        // green toast and the red banner at the same time, and the banner
        // is the one a person believes. It has to run before the no-changes
        // early return too, or the stale banner outlives that path as well.
        // Every other consumer of `useZodForm` (PostEditor, EventEditor,
        // ProfileEditForm, PartnerEditForm, HostTradeEditForm,
        // use-accommodation-section-form) already opens its submit this way;
        // this editor and `ListingCreateForm` were the two that did not.
        setFormError(null);
        setRefusedTarget(null);
        if (Object.keys(patchPayload).length === 0) {
            // Never save silently (HOS-190): "Guardar" always visibly does
            // something. This used to be a bare `return`, which was
            // invisible but harmless while the button was disabled with
            // nothing to save. Enter in a field can still submit, so
            // without this the owner would press a live button and get no
            // response at all.
            addToast({
                type: 'info',
                message: t('listing.owner.editor.noChanges', 'No hay cambios para guardar')
            });
            return { ok: true };
        }

        // A selection the new type does not admit blocks the save before it
        // reaches the API. The field already renders the same reason; this
        // keeps the form from sending a write the server would reject and
        // whose section effects the owner has not seen.
        if (businessLinesError) {
            setFormError(businessLinesError);
            return { ok: false, invalidFields: ['businessLines'] };
        }

        const payload = patchPayload;
        // Snapshot the values this request persists, so the baseline resync
        // below records exactly what was saved even if the owner keeps
        // typing while the request is in flight.
        const persisted = formData;

        // Full payload validation against the real per-vertical owner-update
        // schema (see `schema` above) — replaces the two ad hoc
        // summary/priceFrom checks this editor previously ran by hand.
        const parsed = validate(payload);
        if (!parsed.success) {
            return {
                ok: false,
                invalidFields: parsed.error.issues.map((issue) => String(issue.path[0] ?? ''))
            };
        }

        setStatus({ kind: 'saving' });

        const result = await apiClient.patch<unknown>({
            path: patchPath(listingId),
            body: payload
        });

        if (result.ok) {
            setBaseline({ ...persisted, refreshSlugFromName: false });
            setFormData((prev) => ({ ...prev, refreshSlugFromName: false }));
            setStatus({ kind: 'idle' });
            addToast({
                type: 'success',
                message: t('listing.owner.editor.success', 'Cambios guardados.')
            });
            return { ok: true };
        }
        // A section the listing's business lines no longer own (409
        // SECTION_ABSENT) has its own copy: "no longer applies to your
        // venue's business lines" names the cause, while the generic
        // save-failed banner would hide it.
        if (result.error?.status === 409 && result.error.reason === 'SECTION_ABSENT') {
            setFormError(
                t(
                    'listing.owner.editor.errors.sectionAbsent',
                    'Esa sección ya no aplica a los rubros de tu local.'
                )
            );
            setStatus({ kind: 'error' });
            return { ok: false };
        }
        // HOS-1810: moving a published listing onto an address its owner
        // already publishes (409 DUPLICATE_LOCATION). Nothing was saved.
        if (result.error?.status === 409 && result.error.reason === DUPLICATE_LOCATION_REASON) {
            // HOS-2192 (D-23): keep the address the owner tried to save so the
            // exception request carries it (a venue only; an experience has no address).
            setRefusedTarget(
                exceptionVertical
                    ? buildLocationExceptionTarget({
                          street: persisted.location.street,
                          number: persisted.location.number,
                          floor: persisted.location.floor,
                          apartment: persisted.location.apartment
                      })
                    : null
            );
            setFormError(
                t(
                    'listing.owner.locationDuplicate.blocked',
                    'Esta dirección ya tiene una ficha publicada tuya. Cada local físico va en una sola ficha: sumale el rubro que falta en vez de crear otra.'
                )
            );
            setStatus({ kind: 'error' });
            return { ok: false };
        }
        // Previously discarded `result.error` entirely and always showed
        // a fixed banner string. `handleApiError` maps per-field details
        // when the API sent them, falling back to a real (translated)
        // banner message otherwise — see `field-errors.ts` module doc.
        handleApiError(
            result.error,
            t('listing.owner.editor.error', 'No se pudieron guardar los cambios.')
        );
        setStatus({ kind: 'error' });
        return { ok: false };
    }, [
        patchPayload,
        formData,
        patchPath,
        listingId,
        exceptionVertical,
        businessLinesError,
        validate,
        handleApiError,
        setFormError,
        t,
        setBaseline,
        setFormData,
        setStatus
    ]);

    const isSaving = status.kind === 'saving';

    /**
     * Announces that this island has hydrated, by setting `data-hydrated` on the
     * form once mounted (HOS-1080).
     *
     * Every control in every section is server-rendered, so "the input is
     * visible and editable" is true long before React attaches a single
     * handler — the false gate HOS-371 already had to fix once, when writing
     * into a not-yet-listening node left the form clean and Save silent. Its fix
     * was to wait for `.ProseMirror`, which TipTap creates at runtime; that
     * worked while the editor was ONE page carrying the rich-text field. With
     * one page per section, seven of the eight sections have no client-created
     * DOM at all, so there is nothing on them to wait for.
     *
     * A parent effect is the strongest signal available and needs no per-section
     * table: React runs child effects BEFORE parent effects, so by the time this
     * fires every section component below has finished mounting — strictly later
     * than `.ProseMirror` appearing, not merely equivalent to it.
     *
     * Set through a ref rather than through state so it costs no extra render.
     * React never rewrites an attribute it does not itself render, so it
     * survives every subsequent update.
     */
    const formRef = useRef<HTMLFormElement>(null);
    useEffect(() => {
        formRef.current?.setAttribute('data-hydrated', 'true');
    }, []);

    /** Form `onSubmit` (Enter in a field): runs {@link save}. */
    const handleSubmit = useCallback(
        async (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            await save();
        },
        [save]
    );

    /** Puts every field back to the last saved snapshot (the bar's «Descartar»). */
    const discard = useCallback(() => {
        setFormData(baseline);
        reset();
        setRefusedTarget(null);
        setStatus({ kind: 'idle' });
    }, [baseline, reset, setStatus, setFormData]);

    // HOS-373 / HOS-2487: the leave warning lives in the `EditorSaveBar` below
    // (`useSaveBar` → the shared guard), fed by the same diff as the save.

    return (
        <form
            ref={formRef}
            className={styles.editor}
            onSubmit={handleSubmit}
            aria-busy={isSaving}
            noValidate
        >
            {LISTING_SECTION_RENDERERS[sectionId]({
                locale,
                vertical,
                data: formData,
                errors: businessLinesError
                    ? {
                          ...fieldErrors,
                          businessLines: fieldErrors.businessLines ?? businessLinesError
                      }
                    : fieldErrors,
                destinations,
                destinationsLoadFailed,
                amenities,
                features,
                onFieldChange,
                onPolicyChange,
                onContactChange: updateContact,
                onSocialChange: updateSocial,
                onToggleAmenity: toggleAmenity,
                onToggleFeature: toggleFeature,
                onChangeAmenityAttribute: changeAmenityAttribute,
                onI18nChange: handleI18nChange,
                shouldOfferSlugRefresh,
                listingId
            })}

            {formError && (
                <p
                    className={styles.error}
                    role="alert"
                >
                    {formError}
                </p>
            )}

            {refusedTarget && exceptionVertical && (
                <LocationExceptionRequestTrigger
                    locale={locale}
                    vertical={exceptionVertical}
                    listingId={listingId}
                    location={refusedTarget}
                />
            )}

            <EditorSaveBar
                locale={locale}
                isDirty={Object.keys(patchPayload).length > 0}
                onSave={save}
                onDiscard={discard}
                idPrefix={LISTING_FIELD_PREFIX}
                suffixes={LISTING_FIELD_ID_SUFFIXES}
            />
        </form>
    );
}
