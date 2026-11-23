/**
 * @file VenueMenuManager.client.tsx
 * @description The owner's carta editor for a venue listing (HOS-895).
 *
 * ## Three ways to show a menu, side by side
 *
 * A small restaurant rarely has a published menu page, and before HOS-895 a
 * link to one was the only thing this product could store. This panel offers
 * the two others next to it:
 *
 *  - the **structured carta** — courses and dishes, typed;
 *  - an **uploaded photo or PDF** of the printed menu.
 *
 * The external link is the third part of the same section (DEC-FAC-062): it is
 * edited here, by `VenueMenuLinkField`, and saved with its own one-key PATCH of
 * the listing. Nothing here is mandatory and nothing here excludes anything
 * else: an owner may publish with a photo alone, and is never made to type
 * forty dishes.
 *
 * ## Why this manager persists on its own, like `ListingFaqManager`
 *
 * The parent editor's PATCH body is a diff of `ListingEditData`, and a carta is
 * a nested document with its own endpoints. It is mounted inside the form for
 * layout, exactly as the FAQ manager is, but nothing here reaches the parent's
 * dirty tracking (HOS-811).
 *
 * The two halves persist DIFFERENTLY, and deliberately:
 *
 *  - the carta is a local draft committed by the editor save bar (HOS-2487),
 *    in one `PUT` of the whole document — a course renamed, a dish moved and
 *    two deleted is one thought and one transaction. Leaving with a dirty
 *    draft warns, through the bar's single leave guard;
 *  - the file is persisted by the upload request ITSELF, with no Save, because
 *    it is a real Cloudinary asset. HOS-372 measured what deferring that costs:
 *    an owner who uploads and walks away leaves the asset billing with nothing
 *    pointing at it.
 *
 * ## The photo per dish (HOS-1045)
 *
 * Uploaded from the dish's own row, never from a gallery elsewhere on the page.
 * That is the whole point of the issue: a picture chosen in one list and later
 * matched to a dish in another is a matching task the owner has to redo every
 * time either list moves.
 *
 * It persists in TWO steps, and the split is forced by the carta's own write
 * model rather than chosen: the BYTES go up immediately
 * (`POST .../menu-item-photo`, because an upload is an upload), and the
 * ASSOCIATION rides in the next save of the carta like every other field of the
 * dish — because `PUT .../menu` mints a new id for every dish it writes, so
 * there is no id an upload could have attached itself to. The consequence is
 * visible and is worth stating: a photo uploaded and not saved is lost from the
 * carta, exactly as a dish name typed and not saved is.
 *
 * ## The 403 is a real state, not an error
 *
 * The structured carta is a `venue-pro` capability, and the page this
 * mounts on carries no entitlement information — the same situation
 * `BrochureDownloadButton` is in. So the fields render for every owner and the
 * API decides; a refusal is shown as the upsell sentence it is, never as
 * "something went wrong".
 *
 * ## Known BEFORE the click (owner decision, 2026-10-29)
 *
 * The uploaded photo/PDF needs the same `manage_venue_menu` as the carta
 * (`POST`/`DELETE .../menu-file` and `PUT .../menu` all declare it). So the
 * panel reads the owner's effective set (`useListingPlanGate`) and, when the
 * key is not held, renders the upload control and the carta fields DISABLED
 * with the reason next to them (so the bar never offers a save that can only
 * answer 403), instead of inviting an action that can only answer 403. The
 * reason has two wordings: a pre-trial owner unlocks it by publishing (the trial
 * starts then), anybody else by moving to Profesional. A pending or failed read
 * leaves the panel as it always was, and a 403 still lands in the same notice.
 *
 * ## Translations (HOS-1043)
 *
 * `nameEn`/`namePt`/`descriptionEn`/`descriptionPt` are plain draft fields,
 * unlike the photo: there is no separate upload endpoint to gate ahead of
 * time, because a translation has no bytes of its own. So the fields are
 * always editable and the gate fires only at the save, the same way the
 * carta's OWN gate does — the API decides, and a refusal is shown as the
 * upsell sentence it is (`isTranslationLocked`). A translation is submitted
 * ONLY when BOTH `en` and `pt` are filled (the ES leg comes from the legacy
 * `name`/`description` at save time): the write schema requires all three
 * locales together, so a half-filled pair would 400 rather than silently
 * publish an empty string as "the English name".
 *
 * ## Files (HOS-2490)
 *
 * State and requests live in `use-venue-menu.ts`, the draft model in
 * `venue-menu-draft.ts`; this file composes `VenueMenuLockedView`,
 * `VenueMenuFileBlock` and `VenueMenuCourses` (the kit `Repeater`).
 */

import type { JSX } from 'react';
import { useId } from 'react';
import { EditorSaveBar } from '@/components/account/editor-shell/EditorSaveBar';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { VenueUpsellPlans } from '@/lib/venue/section-upsell-plan';
import { useVenueMenu } from './use-venue-menu';
import { VenueMenuCourses } from './VenueMenuCourses.client';
import { VenueMenuFileBlock } from './VenueMenuFileBlock.client';
import { VenueMenuLinkField } from './VenueMenuLinkField.client';
import { VenueMenuLockedView } from './VenueMenuLockedView.client';
import styles from './VenueMenuManager.module.css';
import { VenueMenuPlanNotice } from './VenueMenuPlanNotice.client';
import { VenueSectionLockedPanel, type VenueSectionState } from './VenueSectionLockedPanel.client';

/** Props of {@link VenueMenuManager}. */
export interface VenueMenuManagerProps {
    /** UUID of the venue listing. */
    readonly listingId: string;
    /** Active UI locale. */
    readonly locale: SupportedLocale;
    /**
     * The resolved state of this listing's `menu` section (HOS-1854).
     *
     * `locked` puts the panel in its read-only, proactive state: the upsell is
     * rendered on the first paint instead of appearing after a 403, the data is
     * shown without editable controls, and emptying the section is the one
     * write that stays available (DEC-FAC-025 / DEC-FAC-041).
     */
    readonly sectionState?: VenueSectionState;
    /**
     * The venue's external menu link (HOS-1854). On a `locked` carta it is one
     * more stored datum: shown read-only and cleared by "Vaciar" with a one-key
     * `PATCH` of the listing.
     */
    readonly menuUrl?: string | null;
    /** Catalog plan names used by each carta upsell, including runtime 403 notices. */
    readonly upsellPlans?: Pick<VenueUpsellPlans, 'menu' | 'itemPhotos' | 'translations'>;
}

/**
 * The carta editor of a venue listing.
 *
 * @param props - See {@link VenueMenuManagerProps}.
 * @returns The panel.
 */
export function VenueMenuManager({
    listingId,
    locale,
    sectionState = 'available',
    menuUrl = null,
    upsellPlans
}: VenueMenuManagerProps): JSX.Element {
    const { t } = createTranslations(locale);
    const menu = useVenueMenu({ listingId, locale, menuUrl, upsellPlans });
    const planNoticeId = useId();

    const isMenuGated = menu.menuGate !== 'open';
    const isSectionLocked = sectionState === 'locked';
    const lockedGate = menu.menuGate === 'open' ? 'plan' : menu.menuGate;
    const busy = menu.state !== 'idle';

    // The three things a carta owns (DEC-FAC-062) decide BOTH the empty state
    // and whether "Vaciar" exists: dishes, the uploaded file, and the link.
    const lockedHasData =
        menu.sections.length > 0 || menu.file !== null || menu.currentMenuUrl !== null;

    return (
        <section
            className={styles.panel}
            id="editor-menu"
        >
            <h2 className={styles.heading}>{t('venue.owner.editor.menuManager.title', 'Carta')}</h2>
            <p className={styles.intro}>
                {isSectionLocked
                    ? t(
                          'venue.owner.editor.menuManager.lockedIntro',
                          'Mostrá tu carta en tu ficha.'
                      )
                    : t(
                          'venue.owner.editor.menuManager.intro',
                          'Cargá tu carta plato por plato, o subí una foto o un PDF del menú. Podés usar las dos formas, y ninguna es obligatoria.'
                      )}
            </p>

            {isSectionLocked ? (
                <VenueSectionLockedPanel
                    id={planNoticeId}
                    gate={lockedGate}
                    locale={locale}
                    messageKey="venue.owner.editor.menuManager.locked"
                    messageFallback="Tu carta completa está disponible desde el plan {{plan}}."
                    noPlanMessageFallback="Tu carta completa está disponible en un plan pago."
                    planName={upsellPlans?.menu}
                    preTrialMessageKey="venue.owner.editor.menuManager.lockedPreTrial"
                    preTrialMessageFallback="La carta se habilita cuando publiques tu ficha."
                    sectionLabel={t('venue.owner.editor.menuManager.title', 'Carta')}
                    hasData={lockedHasData}
                    vaciar={menu.vaciar}
                >
                    <VenueMenuLockedView
                        t={t}
                        sections={menu.sections}
                        file={menu.file}
                        menuUrl={menu.currentMenuUrl}
                        hasData={lockedHasData}
                    />
                </VenueSectionLockedPanel>
            ) : (
                <>
                    {isMenuGated ? (
                        <VenueMenuPlanNotice
                            id={planNoticeId}
                            gate={lockedGate}
                            locale={locale}
                            planName={upsellPlans?.menu}
                        />
                    ) : null}

                    {/* The external link (DEC-FAC-062): its own one-key PATCH. */}
                    <VenueMenuLinkField
                        listingId={listingId}
                        locale={locale}
                        menuUrl={menu.currentMenuUrl}
                        disabled={isMenuGated}
                        onSaved={menu.setCurrentMenuUrl}
                    />

                    <VenueMenuFileBlock
                        t={t}
                        file={menu.file}
                        pickedFileName={menu.pickedFileName}
                        busy={busy}
                        gated={isMenuGated}
                        planNoticeId={planNoticeId}
                        onUpload={(file) => {
                            void menu.uploadFile(file);
                        }}
                        onDelete={() => {
                            void menu.deleteFile();
                        }}
                    />

                    <VenueMenuCourses
                        t={t}
                        locale={locale}
                        menu={menu}
                        readOnly={isMenuGated || menu.isLocked}
                        translationPlanName={upsellPlans?.translations}
                    />

                    <EditorSaveBar
                        locale={locale}
                        isDirty={menu.isDirty}
                        onSave={menu.saveMenu}
                        onDiscard={menu.discard}
                    />
                </>
            )}

            {menu.message ? (
                <p
                    className={styles.message}
                    role="status"
                >
                    {menu.message}
                </p>
            ) : null}
        </section>
    );
}
