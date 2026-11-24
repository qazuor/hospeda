/**
 * @file venue-menu-draft.ts
 * @description The carta's draft model (HOS-895, HOS-1043, HOS-1045): the
 * form-state types, the mapping from `GET .../menu` and the payload `PUT
 * .../menu` receives. Pure functions, no React, split out of
 * `VenueMenuManager.client.tsx` (HOS-2490) so the panel stays under the
 * 500-line ceiling.
 */

/** What the API returns for the uploaded photo/PDF. */
export interface MenuFile {
    readonly url: string;
    readonly kind: 'image' | 'pdf';
}

/** A localized `{es,en,pt}` value, or `null` when never translated. */
export interface I18nTextValue {
    readonly es: string;
    readonly en: string;
    readonly pt: string;
}

/** One dish, as held in form state. Ids are not carried — see the payload schema. */
export interface MenuItemDraft {
    readonly name: string;
    readonly description: string;
    /** Price in CENTAVOS, or `null` for "a consultar". */
    readonly priceCents: number | null;
    readonly isAvailable: boolean;
    /** Delivery URL of the dish photo (HOS-1045), or `null` for none. */
    readonly photoUrl: string | null;
    /** Cloudinary id of that asset, round-tripped so the server can destroy it. */
    readonly photoPublicId: string | null;
    /** Alt text; `null` lets the public page fall back to the dish's name. */
    readonly photoAlt: string | null;
    /** English translation of {@link name} (HOS-1043). Empty means "not translated". */
    readonly nameEn: string;
    /** Portuguese translation of {@link name} (HOS-1043). */
    readonly namePt: string;
    /** English translation of {@link description} (HOS-1043). */
    readonly descriptionEn: string;
    /** Portuguese translation of {@link description} (HOS-1043). */
    readonly descriptionPt: string;
}

/** One course, as held in form state. */
export interface MenuSectionDraft {
    readonly name: string;
    readonly description: string;
    /** English translation of {@link name} (HOS-1043). Empty means "not translated". */
    readonly nameEn: string;
    /** Portuguese translation of {@link name} (HOS-1043). */
    readonly namePt: string;
    /** English translation of {@link description} (HOS-1043). */
    readonly descriptionEn: string;
    /** Portuguese translation of {@link description} (HOS-1043). */
    readonly descriptionPt: string;
    readonly items: readonly MenuItemDraft[];
}

/** One stored dish, as `GET .../menu` returns it. */
interface MenuItemRow {
    readonly name: string;
    readonly description: string | null;
    readonly nameI18n: I18nTextValue | null;
    readonly descriptionI18n: I18nTextValue | null;
    readonly priceCents: number | null;
    readonly isAvailable: boolean;
    readonly photoUrl: string | null;
    readonly photoPublicId: string | null;
    readonly photoAlt: string | null;
}

/** Shape of `GET /{id}/menu`. */
export interface MenuEnvelope {
    readonly sections: ReadonlyArray<{
        readonly name: string;
        readonly description: string | null;
        readonly nameI18n: I18nTextValue | null;
        readonly descriptionI18n: I18nTextValue | null;
        readonly items: readonly MenuItemRow[];
    }>;
    readonly file: MenuFile | null;
}

/** What the per-dish photo upload route answers with. */
export interface MenuItemPhotoUpload {
    readonly url: string;
    readonly publicId: string;
}

/** A fresh dish draft. */
export const EMPTY_ITEM: MenuItemDraft = {
    name: '',
    description: '',
    priceCents: null,
    isAvailable: true,
    photoUrl: null,
    photoPublicId: null,
    photoAlt: null,
    nameEn: '',
    namePt: '',
    descriptionEn: '',
    descriptionPt: ''
};

/** A fresh section draft — see {@link EMPTY_ITEM} for the translation fields. */
export const EMPTY_SECTION: MenuSectionDraft = {
    name: '',
    description: '',
    nameEn: '',
    namePt: '',
    descriptionEn: '',
    descriptionPt: '',
    items: []
};

/** Catalog-plan wording for the per-dish photo upsell (HOS-1045). */
export const PHOTO_UPSELL_COPY = {
    key: 'venue.owner.editor.menuManager.photoLocked',
    fallback:
        'Las fotos por plato están disponibles desde el plan {{plan}}. Podés quitar las fotos y guardar la carta igual.',
    noPlanKey: 'venue.owner.editor.menuManager.photoLockedNoPlan',
    noPlanFallback:
        'Las fotos por plato están disponibles en un plan pago. Podés quitar las fotos y guardar la carta igual.'
} as const;

/** Catalog-plan wording for the carta translation upsell (HOS-1043). */
export const TRANSLATION_UPSELL_COPY = {
    key: 'venue.owner.editor.menuManager.translationLocked',
    fallback:
        'Traducir la carta está disponible desde el plan {{plan}}. Podés borrar las traducciones y guardar la carta en español.',
    noPlanKey: 'venue.owner.editor.menuManager.translationLockedNoPlan',
    noPlanFallback:
        'Traducir la carta está disponible en un plan pago. Podés borrar las traducciones y guardar la carta en español.'
} as const;

/** MIME types the per-dish photo input and the API both accept — images only. */
export const ACCEPTED_ITEM_PHOTO_TYPES = 'image/jpeg,image/png,image/webp';

/** MIME types the upload input and the API both accept. */
export const ACCEPTED_MENU_FILE_TYPES = 'image/jpeg,image/png,image/webp,application/pdf';

/** The entitlement every menu write (carta and photo/PDF) requires. */
export const MENU_ENTITLEMENT = 'manage_venue_menu';

/**
 * The `error.code` the listing-access gate answers when an entitlement is
 * missing. A 403 carrying any other code (`EMAIL_NOT_VERIFIED`, a plain
 * `FORBIDDEN`) is NOT a plan problem: it must show the ordinary retryable
 * error and must never latch the plan notice.
 */
const ENTITLEMENT_REQUIRED_CODE = 'ENTITLEMENT_REQUIRED';

/**
 * Whether a refusal is the entitlement gate speaking.
 *
 * @param status - HTTP status of the refusal.
 * @param code - `error.code` of the refusal.
 * @returns `true` for a 403 `ENTITLEMENT_REQUIRED`.
 */
export function isEntitlementRefusal(
    status: number | undefined,
    code: string | undefined
): boolean {
    return status === 403 && code === ENTITLEMENT_REQUIRED_CODE;
}

/**
 * Reads `error.code` from a raw `fetch` error response (the multipart upload
 * does not go through `apiClient`, which parses it for the other calls). A body
 * that is not the API's JSON envelope yields `undefined`.
 *
 * @param response - The failed response.
 * @returns The error code, if any.
 */
export async function readErrorCode(response: Response): Promise<string | undefined> {
    try {
        const body = (await response.json()) as { error?: { code?: unknown } };
        return typeof body.error?.code === 'string' ? body.error.code : undefined;
    } catch {
        return undefined;
    }
}

/**
 * Builds the `{es,en,pt}` payload for a translated field (HOS-1043), or
 * `null` when there is nothing to submit.
 *
 * Requires BOTH `en` and `pt` non-empty before building anything: the write
 * schema (`i18nText`) requires all three locales together whenever the object
 * is present, so a half-filled pair would 400 instead of quietly publishing
 * the untranslated legacy text as "the English name".
 *
 * @param legacy - The `es` source (the section/item's own `name`/`description`).
 * @param en - The draft English translation.
 * @param pt - The draft Portuguese translation.
 * @returns The `{es,en,pt}` object, or `null`.
 */
export function buildI18nField(legacy: string, en: string, pt: string): I18nTextValue | null {
    const trimmedEn = en.trim();
    const trimmedPt = pt.trim();
    if (!trimmedEn || !trimmedPt) {
        return null;
    }
    return { es: legacy.trim(), en: trimmedEn, pt: trimmedPt };
}

/**
 * Moves one entry of an array, returning a new array. Out-of-range is a no-op.
 *
 * @param list - The list.
 * @param index - Position of the entry to move.
 * @param delta - How many positions to move it.
 * @returns The reordered copy.
 */
export function movedBy<T>(list: readonly T[], index: number, delta: number): T[] {
    const target = index + delta;
    if (target < 0 || target >= list.length) {
        return [...list];
    }
    const next = [...list];
    const [moved] = next.splice(index, 1);
    if (moved !== undefined) {
        next.splice(target, 0, moved);
    }
    return next;
}

/**
 * Maps the stored carta to its form draft.
 *
 * @param envelope - `GET .../menu`.
 * @returns The section drafts.
 */
export function draftFromEnvelope(envelope: MenuEnvelope): MenuSectionDraft[] {
    return envelope.sections.map((section) => ({
        name: section.name,
        description: section.description ?? '',
        nameEn: section.nameI18n?.en ?? '',
        namePt: section.nameI18n?.pt ?? '',
        descriptionEn: section.descriptionI18n?.en ?? '',
        descriptionPt: section.descriptionI18n?.pt ?? '',
        items: section.items.map((item) => ({
            name: item.name,
            description: item.description ?? '',
            nameEn: item.nameI18n?.en ?? '',
            namePt: item.nameI18n?.pt ?? '',
            descriptionEn: item.descriptionI18n?.en ?? '',
            descriptionPt: item.descriptionI18n?.pt ?? '',
            priceCents: item.priceCents,
            isAvailable: item.isAvailable,
            photoUrl: item.photoUrl ?? null,
            photoPublicId: item.photoPublicId ?? null,
            photoAlt: item.photoAlt ?? null
        }))
    }));
}

/**
 * Builds the `PUT .../menu` body from the draft.
 *
 * Sections without a heading are DROPPED rather than rejected: an empty row is
 * what an owner leaves behind after clicking "add course" and changing their
 * mind, and failing the whole save over it would lose the forty dishes they
 * did type. Same for a nameless dish. Translations are submitted ONLY when
 * BOTH en and pt are filled (see {@link buildI18nField}).
 *
 * @param sections - The draft.
 * @returns The payload.
 */
export function buildMenuPayload(sections: readonly MenuSectionDraft[]) {
    return {
        sections: sections
            .filter((section) => section.name.trim().length > 0)
            .map((section) => ({
                name: section.name.trim(),
                description: section.description.trim() || null,
                nameI18n: buildI18nField(section.name, section.nameEn, section.namePt),
                descriptionI18n: buildI18nField(
                    section.description,
                    section.descriptionEn,
                    section.descriptionPt
                ),
                items: section.items
                    .filter((item) => item.name.trim().length > 0)
                    .map((item) => ({
                        name: item.name.trim(),
                        description: item.description.trim() || null,
                        nameI18n: buildI18nField(item.name, item.nameEn, item.namePt),
                        descriptionI18n: buildI18nField(
                            item.description,
                            item.descriptionEn,
                            item.descriptionPt
                        ),
                        priceCents: item.priceCents,
                        isAvailable: item.isAvailable,
                        photoUrl: item.photoUrl,
                        photoPublicId: item.photoPublicId,
                        photoAlt: item.photoAlt
                    }))
            }))
    };
}

/** The `PUT .../menu` body. */
export type MenuPayload = ReturnType<typeof buildMenuPayload>;

/**
 * Which per-key gate a refused payload is attributed to.
 *
 * THREE entitlements can produce the carta's 403 and they mean different
 * things, so the payload decides which upsell to show rather than the response
 * body (every refusal carries `ENTITLEMENT_REQUIRED`). Checked in the SAME
 * order `handlePutVenueMenu` checks them server-side: photo gate, then
 * translations gate, then the carta gate itself.
 *
 * @param payload - The refused body.
 * @returns `photo`, `translation` or `menu`.
 */
export function refusedGateOf(payload: MenuPayload): 'photo' | 'translation' | 'menu' {
    const carriedPhoto = payload.sections.some((section) =>
        section.items.some((item) => Boolean(item.photoUrl))
    );
    if (carriedPhoto) return 'photo';

    const carriedTranslation = payload.sections.some(
        (section) =>
            Boolean(section.nameI18n) ||
            Boolean(section.descriptionI18n) ||
            section.items.some((item) => Boolean(item.nameI18n) || Boolean(item.descriptionI18n))
    );
    return carriedTranslation ? 'translation' : 'menu';
}

/**
 * Whether two drafts hold the same carta (the bar's dirty check).
 *
 * @param a - One draft.
 * @param b - The other.
 * @returns `true` when equal field by field.
 */
export function sameMenuDraft(
    a: readonly MenuSectionDraft[],
    b: readonly MenuSectionDraft[]
): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}
