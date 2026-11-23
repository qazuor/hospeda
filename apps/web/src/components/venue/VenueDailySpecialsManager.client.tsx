/**
 * @file VenueDailySpecialsManager.client.tsx
 * @description The owner's menú del día editor for a venue listing
 * (HOS-1041).
 *
 * ## What this panel is FOR, and why the dates are the whole of it
 *
 * A restaurant that wants to announce today's plate can already do it by
 * editing the listing's description. What it cannot do is remember to take it
 * down, which is why listings carry last Tuesday's fish in April. Every special
 * typed here carries a window and stops being published when it passes — with
 * nobody doing anything.
 *
 * That is why the two date fields are not optional and are not hidden behind an
 * "advanced" toggle: a special with no expiry is the rotting free-text field
 * this replaces.
 *
 * ## Why it persists on its own, like the carta and the FAQ managers
 *
 * The parent editor's PATCH body is a diff of `ListingEditData`, and the
 * specials are a nested document with their own endpoints. Nothing here reaches
 * the parent's dirty tracking (HOS-811). The list is a local draft that the
 * editor save bar commits in one `PUT` of the whole document (HOS-2487), for
 * the reason the carta gives: adding today's plate and dropping yesterday's is
 * one thought and should be one transaction. Leaving with a dirty draft warns.
 * The rows are the kit `Repeater` (HOS-2490): removing one asks first.
 *
 * ## The 403 is a real state, not an error
 *
 * The menú del día is a `venue-pro` capability, and the page this mounts
 * on carries no entitlement information — the same situation
 * `VenueMenuManager` and `BrochureDownloadButton` are in. So the fields
 * render for every owner and the API decides; a refusal is shown as the upsell
 * sentence it is, never as "something went wrong".
 *
 * ## Why elapsed and scheduled rows are shown, and labelled
 *
 * `GET .../daily-specials` is deliberately unfiltered (see the route), so this
 * panel receives specials that are not currently on the public page. Showing
 * them without saying so would be worse than hiding them — an owner would read
 * the list as "what diners see". Each card therefore states which of the three
 * it is, computed against the owner's OWN today rather than the server's: the
 * label is a hint about a row the owner is editing, and the authoritative
 * filter runs server-side on the public read regardless of what this says.
 */

import type { JSX } from 'react';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { EditorSaveBar } from '@/components/account/editor-shell/EditorSaveBar';
import { Repeater } from '@/components/account/ui/Repeater';
import type { SaveOutcome } from '@/components/account/ui/use-save-bar';
import { type ListingPlanGate, useListingPlanGate } from '@/hooks/useListingPlanGate';
import { useSectionVaciar } from '@/hooks/useSectionVaciar';
import { apiClient } from '@/lib/api/client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import {
    type DailySpecialDraft,
    DailySpecialFields,
    DailySpecialReadOnly
} from './VenueDailySpecialRow.client';
import styles from './VenueDailySpecialsManager.module.css';
import {
    translateUpsell,
    VenueSectionLockedPanel,
    type VenueSectionState
} from './VenueSectionLockedPanel.client';

/** The entitlement the menú del día write requires. */
const DAILY_SPECIALS_ENTITLEMENT = 'manage_venue_daily_special';

/**
 * Catalog-plan wording for the menú del día upsell. Shared by the proactive
 * panel and the runtime 403 so the two can never disagree.
 */
const DAILY_SPECIALS_UPSELL_COPY = {
    key: 'venue.owner.editor.dailySpecials.locked',
    fallback: 'El menú del día está disponible desde el plan {{plan}}.',
    noPlanKey: 'venue.owner.editor.dailySpecials.lockedNoPlan',
    noPlanFallback: 'El menú del día está disponible en un plan pago.'
} as const;

/** Shape of `GET`/`PUT .../daily-specials`. */
interface DailySpecialsEnvelope {
    readonly specials: ReadonlyArray<{
        readonly title: string;
        readonly description: string | null;
        readonly priceCents: number | null;
        readonly validFrom: string;
        readonly validUntil: string;
    }>;
}

/** Props of {@link VenueDailySpecialsManager}. */
export interface VenueDailySpecialsManagerProps {
    /** UUID of the venue listing. */
    readonly listingId: string;
    /** Active UI locale. */
    readonly locale: SupportedLocale;
    /**
     * The resolved state of this listing's `dailySpecials` section (HOS-1854).
     * A locked section is read-only and shows its upsell on first render.
     */
    readonly sectionState?: VenueSectionState;
    /** Localized name of the cheapest catalog plan that unlocks this section. */
    readonly upsellPlanName?: string | null;
}

/** What the panel is doing right now. */
type PanelState = 'loading' | 'idle' | 'saving';

/**
 * Today as `YYYY-MM-DD` in the BROWSER's timezone.
 *
 * Built from the local date parts rather than `toISOString()`, which converts
 * to UTC first and therefore reports tomorrow's date for anyone west of
 * Greenwich after 21:00 (see `packages/utils/src/calendar-date.ts`). Used ONLY
 * to default a new row's window and to label existing rows; the authoritative
 * "is this published" decision is the server's.
 *
 * @returns Today, `YYYY-MM-DD`.
 */
function localToday(): string {
    const now = new Date();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const day = `${now.getDate()}`.padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
}

/** Moves one entry of an array, returning a new array. Out-of-range is a no-op. */
function movedBy<T>(list: readonly T[], index: number, delta: number): T[] {
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
 * The menú del día editor of a venue listing.
 *
 * @param props - See {@link VenueDailySpecialsManagerProps}.
 * @returns The panel.
 */
export function VenueDailySpecialsManager({
    listingId,
    locale,
    sectionState = 'available',
    upsellPlanName
}: VenueDailySpecialsManagerProps): JSX.Element {
    const { t } = createTranslations(locale);

    const [specials, setSpecials] = useState<readonly DailySpecialDraft[]>([]);
    const [savedSpecials, setSavedSpecials] = useState<readonly DailySpecialDraft[]>([]);
    const [state, setState] = useState<PanelState>('loading');
    const [message, setMessage] = useState<string | null>(null);
    const [isLocked, setIsLocked] = useState(false);
    /**
     * HOS-1854. The plan gate is read for the proactive upsell's wording; the
     * section state itself comes from the page, so this panel never has to
     * wait for a 403 to know the section is locked.
     */
    const { gate: readGate } = useListingPlanGate({
        vertical: 'venue',
        entitlementKey: DAILY_SPECIALS_ENTITLEMENT
    });
    const isSectionLocked = sectionState === 'locked';
    const lockedGate: Exclude<ListingPlanGate, 'open'> = readGate === 'open' ? 'plan' : readGate;
    const planNoticeId = useId();

    const basePath = `/api/v1/protected/venues/${listingId}/daily-specials`;

    // Read once per mount rather than per render: `localToday()` reads the
    // clock, and the labels must not depend on when React re-renders.
    const today = useMemo(() => localToday(), []);

    // The panel reads its own state (the specials are not part of the listing
    // payload). Protected read, same reason as `VenueMenuManager` (HOS-1854):
    // without the session cookie the API answers 401.
    useEffect(() => {
        let cancelled = false;

        void (async () => {
            const result = await apiClient.getProtected<DailySpecialsEnvelope>({ path: basePath });
            if (cancelled) {
                return;
            }
            if (result.ok) {
                const loaded = result.data.specials.map((special) => ({
                    title: special.title,
                    description: special.description ?? '',
                    priceCents: special.priceCents,
                    validFrom: special.validFrom,
                    validUntil: special.validUntil
                }));
                setSpecials(loaded);
                setSavedSpecials(loaded);
            }
            setState('idle');
        })();

        return () => {
            cancelled = true;
        };
    }, [basePath]);

    const addSpecial = useCallback(() => {
        // Defaults to TODAY ONLY — both bounds the same day. That is what "menú
        // del día" means, and it makes the safe choice the zero-effort one.
        setSpecials((prev) => [
            ...prev,
            { title: '', description: '', priceCents: null, validFrom: today, validUntil: today }
        ]);
    }, [today]);

    const removeSpecial = useCallback((index: number) => {
        setSpecials((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const moveSpecial = useCallback((index: number, delta: number) => {
        setSpecials((prev) => movedBy(prev, index, delta));
    }, []);

    const patchSpecial = useCallback((index: number, patch: Partial<DailySpecialDraft>) => {
        setSpecials((prev) =>
            prev.map((special, i) => (i === index ? { ...special, ...patch } : special))
        );
    }, []);

    const isDirty = JSON.stringify(specials) !== JSON.stringify(savedSpecials);

    const discard = useCallback(() => {
        setSpecials(savedSpecials);
        setMessage(null);
    }, [savedSpecials]);

    const save = useCallback(async (): Promise<SaveOutcome> => {
        setState('saving');
        setMessage(null);

        // Untitled rows are DROPPED rather than rejected, matching the carta's
        // editor: an abandoned "add" click should not fail the whole save.
        const payload = {
            specials: specials
                .filter((special) => special.title.trim().length > 0)
                .map((special) => ({
                    title: special.title.trim(),
                    description: special.description.trim() || null,
                    priceCents: special.priceCents,
                    validFrom: special.validFrom,
                    validUntil: special.validUntil
                }))
        };

        const result = await apiClient.put<DailySpecialsEnvelope>({
            path: basePath,
            body: payload
        });
        setState('idle');

        if (result.ok) {
            setSavedSpecials(specials);
            setMessage(t('venue.owner.editor.dailySpecials.saved', 'Menú del día guardado.'));
            return { ok: true };
        }

        // A refusal here is the plan speaking, not a failure: `status` is the
        // only thing that separates an upsell from a bug report.
        if (result.error.status === 403) {
            setIsLocked(true);
            setMessage(
                translateUpsell({ t, planName: upsellPlanName, ...DAILY_SPECIALS_UPSELL_COPY })
            );
            return { ok: false };
        }

        // Told by the save bar alone (owner decision 7), never repeated below.
        return {
            ok: false,
            message: t(
                'venue.owner.editor.dailySpecials.saveError',
                'No se pudo guardar el menú del día.'
            )
        };
    }, [basePath, specials, t, upsellPlanName]);

    /**
     * HOS-1854. Empties a locked menú del día through the API's `delete`
     * intent: an empty `specials` array classifies the write as a deletion
     * (DEC-FAC-041), authorized even on a locked section.
     */
    const clearSpecials = useCallback(async (): Promise<boolean> => {
        setState('saving');
        setMessage(null);

        const result = await apiClient.put<DailySpecialsEnvelope>({
            path: basePath,
            body: { specials: [] }
        });
        setState('idle');

        if (!result.ok) {
            setMessage(
                t('venue.owner.editor.lockedSection.vaciarError', 'No se pudo vaciar la sección.')
            );
            return false;
        }

        setSpecials([]);
        setSavedSpecials([]);
        setMessage(t('venue.owner.editor.lockedSection.vaciarSuccess', 'Se vació la sección.'));
        return true;
    }, [basePath, t]);

    const vaciar = useSectionVaciar({ clear: clearSpecials });
    const newSpecial = t('venue.owner.editor.dailySpecials.newSpecial', 'Nuevo plato del día');

    return (
        <section className={styles.panel}>
            <h2 className={styles.heading}>
                {t('venue.owner.editor.dailySpecials.title', 'Menú del día')}
            </h2>
            <p className={styles.intro}>
                {t(
                    'venue.owner.editor.dailySpecials.intro',
                    'El plato del día o la sugerencia del chef. Cada uno vale hasta la fecha que le pongas y después deja de mostrarse solo — no hace falta que vuelvas a sacarlo.'
                )}
            </p>

            {isSectionLocked ? (
                <VenueSectionLockedPanel
                    id={planNoticeId}
                    gate={lockedGate}
                    locale={locale}
                    messageKey="venue.owner.editor.dailySpecials.locked"
                    messageFallback="El menú del día está disponible desde el plan {{plan}}."
                    noPlanMessageFallback="El menú del día está disponible en un plan pago."
                    planName={upsellPlanName}
                    preTrialMessageKey="venue.owner.editor.dailySpecials.lockedPreTrial"
                    preTrialMessageFallback="El menú del día se habilita cuando publiques tu ficha."
                    sectionLabel={t('venue.owner.editor.dailySpecials.title', 'Menú del día')}
                    hasData={specials.length > 0}
                    vaciar={vaciar}
                >
                    {specials.length === 0 ? (
                        <p className={styles.intro}>
                            {t(
                                'venue.owner.editor.lockedSection.empty',
                                'No hay datos cargados en esta sección.'
                            )}
                        </p>
                    ) : (
                        specials.map((special, index) => (
                            <DailySpecialReadOnly
                                // biome-ignore lint/suspicious/noArrayIndexKey: stored rows carry no id in this draft shape
                                key={`locked-special-${index}`}
                                special={special}
                                today={today}
                                t={t}
                            />
                        ))
                    )}
                </VenueSectionLockedPanel>
            ) : (
                <>
                    <Repeater
                        locale={locale}
                        label={t('venue.owner.editor.dailySpecials.title', 'Menú del día')}
                        items={specials}
                        getKey={(_special, index) => `special-${index}`}
                        getItemLabel={(special) => special.title || newSpecial}
                        disabled={isLocked || state === 'loading'}
                        onMove={moveSpecial}
                        onRemove={removeSpecial}
                        onAdd={addSpecial}
                        addLabel={t(
                            'venue.owner.editor.dailySpecials.add',
                            'Agregar plato del día'
                        )}
                        renderItem={(special, index) => (
                            <DailySpecialFields
                                special={special}
                                today={today}
                                locale={locale}
                                t={t}
                                readOnly={isLocked}
                                onPatch={(patch) => patchSpecial(index, patch)}
                            />
                        )}
                    />

                    <EditorSaveBar
                        locale={locale}
                        isDirty={isDirty}
                        onSave={save}
                        onDiscard={discard}
                    />
                </>
            )}

            {message && (
                <p
                    className={styles.message}
                    role="status"
                >
                    {message}
                </p>
            )}
        </section>
    );
}
