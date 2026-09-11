/**
 * @file CommerceDailySpecialsManager.client.tsx
 * @description The owner's menú del día editor for a gastronomy listing
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
 * The parent editor's PATCH body is a diff of `CommerceEditData`, and the
 * specials are a nested document with their own endpoints. Nothing here reaches
 * the parent's dirty tracking (HOS-811). One explicit Save writes the whole
 * document in one `PUT`, for the reason the carta gives: adding today's plate
 * and dropping yesterday's is one thought and should be one transaction.
 *
 * ## The 403 is a real state, not an error
 *
 * The menú del día is a `gastronomy-pro` capability, and the page this mounts
 * on carries no entitlement information — the same situation
 * `CommerceMenuManager` and `BrochureDownloadButton` are in. So the fields
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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { centsToPesosInputValue, parsePesosInputToCents } from '@/lib/commerce/price-units';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './CommerceDailySpecialsManager.module.css';

/** One special, as held in form state. Ids are not carried — see the payload schema. */
interface DailySpecialDraft {
    title: string;
    description: string;
    /** Price in CENTAVOS, or `null` for "a consultar". */
    priceCents: number | null;
    /** Inclusive first day, `YYYY-MM-DD`. */
    validFrom: string;
    /** Inclusive last day, `YYYY-MM-DD`. */
    validUntil: string;
}

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

export interface CommerceDailySpecialsManagerProps {
    /** UUID of the gastronomy listing. */
    readonly listingId: string;
    /** Active UI locale. */
    readonly locale: SupportedLocale;
}

/** What the panel is doing right now. */
type PanelState = 'loading' | 'idle' | 'saving';

/**
 * Today as `YYYY-MM-DD` in the BROWSER's timezone.
 *
 * Built from the local date parts rather than `toISOString()`, which converts
 * to UTC first and therefore reports tomorrow's date for anyone west of
 * Greenwich after 21:00 — the exact off-by-one this repo has hit repeatedly
 * (see `packages/utils/src/calendar-date.ts`).
 *
 * Used ONLY to default a new row's window and to label existing rows. The
 * authoritative "is this published" decision is the server's, in the AR market
 * timezone; an owner in another timezone may see a label disagree by a day, and
 * that is a strictly better failure than a wrong `min` silently rejecting a
 * date they are entitled to pick.
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

export function CommerceDailySpecialsManager({
    listingId,
    locale
}: CommerceDailySpecialsManagerProps): JSX.Element {
    const { t } = createTranslations(locale);

    const [specials, setSpecials] = useState<DailySpecialDraft[]>([]);
    const [state, setState] = useState<PanelState>('loading');
    const [message, setMessage] = useState<string | null>(null);
    const [isLocked, setIsLocked] = useState(false);

    const basePath = `/api/v1/protected/gastronomies/${listingId}/daily-specials`;

    // Read once per mount rather than per render: `localToday()` reads the
    // clock, and calling it inside the map would make the rendered labels
    // depend on when React happened to re-render.
    const today = useMemo(() => localToday(), []);

    // ── Load ────────────────────────────────────────────────────────────────
    // The panel reads its own state rather than receiving it from the SSR page,
    // for the reason the carta's editor gives: the specials are not part of the
    // listing payload, and adding them there would make every editor load pay
    // for a document most owners will not open.
    useEffect(() => {
        let cancelled = false;

        void (async () => {
            const result = await apiClient.get<DailySpecialsEnvelope>({ path: basePath });
            if (cancelled) {
                return;
            }
            if (result.ok) {
                setSpecials(
                    result.data.specials.map((special) => ({
                        title: special.title,
                        description: special.description ?? '',
                        priceCents: special.priceCents,
                        validFrom: special.validFrom,
                        validUntil: special.validUntil
                    }))
                );
            }
            setState('idle');
        })();

        return () => {
            cancelled = true;
        };
    }, [basePath]);

    const addSpecial = useCallback(() => {
        // Defaults to TODAY ONLY — both bounds the same day. That is what "menú
        // del día" means, and it makes the safe choice the zero-effort one: an
        // owner who ignores the dates entirely publishes for today and nothing
        // is left behind tomorrow.
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

    const save = useCallback(async () => {
        setState('saving');
        setMessage(null);

        // Untitled rows are DROPPED rather than rejected, matching the carta's
        // editor: an empty row is what an owner leaves behind after clicking
        // "add" and changing their mind, and failing the whole save over it
        // would lose the plates they did type.
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
            setMessage(t('commerce.owner.editor.dailySpecials.saved', 'Menú del día guardado.'));
            return;
        }

        // A refusal here is the plan speaking, not a failure. `status` is the
        // only thing that separates "your plan does not include this" from a
        // genuine error, and showing the second for the first is how an upsell
        // turns into a bug report.
        if (result.error.status === 403) {
            setIsLocked(true);
            setMessage(
                t(
                    'commerce.owner.editor.dailySpecials.locked',
                    'El menú del día está disponible desde el plan Profesional.'
                )
            );
            return;
        }

        setMessage(
            t(
                'commerce.owner.editor.dailySpecials.saveError',
                'No se pudo guardar el menú del día.'
            )
        );
    }, [basePath, specials, t]);

    const busy = state === 'loading' || state === 'saving';

    return (
        <section className={styles.panel}>
            <h2 className={styles.heading}>
                {t('commerce.owner.editor.dailySpecials.title', 'Menú del día')}
            </h2>
            <p className={styles.intro}>
                {t(
                    'commerce.owner.editor.dailySpecials.intro',
                    'El plato del día o la sugerencia del chef. Cada uno vale hasta la fecha que le pongas y después deja de mostrarse solo — no hace falta que vuelvas a sacarlo.'
                )}
            </p>

            <div className={styles.specialsBlock}>
                {specials.map((special, index) => {
                    const isExpired = special.validUntil < today;
                    const isScheduled = special.validFrom > today;

                    return (
                        <fieldset
                            // biome-ignore lint/suspicious/noArrayIndexKey: draft rows carry no stable id by design
                            key={`special-${index}`}
                            className={styles.specialCard}
                        >
                            <legend className={styles.srOnly}>
                                {special.title ||
                                    t(
                                        'commerce.owner.editor.dailySpecials.newSpecial',
                                        'Nuevo plato del día'
                                    )}
                            </legend>

                            <div className={styles.specialRow}>
                                <input
                                    className={styles.input}
                                    type="text"
                                    value={special.title}
                                    maxLength={150}
                                    placeholder={t(
                                        'commerce.owner.editor.dailySpecials.titlePlaceholder',
                                        'Milanesa a la napolitana con puré'
                                    )}
                                    aria-label={t(
                                        'commerce.owner.editor.dailySpecials.titleLabel',
                                        'Plato'
                                    )}
                                    onChange={(event) =>
                                        patchSpecial(index, { title: event.target.value })
                                    }
                                />
                                <input
                                    className={styles.priceInput}
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={centsToPesosInputValue({ cents: special.priceCents })}
                                    placeholder={t(
                                        'commerce.owner.editor.dailySpecials.pricePlaceholder',
                                        'Precio'
                                    )}
                                    aria-label={t(
                                        'commerce.owner.editor.dailySpecials.priceLabel',
                                        'Precio en pesos'
                                    )}
                                    onChange={(event) =>
                                        patchSpecial(index, {
                                            priceCents: parsePesosInputToCents({
                                                raw: event.target.value
                                            })
                                        })
                                    }
                                />
                                <button
                                    type="button"
                                    className={styles.iconButton}
                                    disabled={index === 0}
                                    onClick={() => moveSpecial(index, -1)}
                                >
                                    ↑
                                    <span className={styles.srOnly}>
                                        {t('commerce.owner.editor.dailySpecials.moveUp', 'Subir')}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    className={styles.iconButton}
                                    disabled={index === specials.length - 1}
                                    onClick={() => moveSpecial(index, 1)}
                                >
                                    ↓
                                    <span className={styles.srOnly}>
                                        {t('commerce.owner.editor.dailySpecials.moveDown', 'Bajar')}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    className={styles.dangerButton}
                                    onClick={() => removeSpecial(index)}
                                >
                                    {t('commerce.owner.editor.dailySpecials.remove', 'Quitar')}
                                </button>
                            </div>

                            <div className={styles.specialRow}>
                                <input
                                    className={styles.input}
                                    type="text"
                                    value={special.description}
                                    maxLength={500}
                                    placeholder={t(
                                        'commerce.owner.editor.dailySpecials.descriptionPlaceholder',
                                        'Con guarnición y postre'
                                    )}
                                    aria-label={t(
                                        'commerce.owner.editor.dailySpecials.descriptionLabel',
                                        'Detalle'
                                    )}
                                    onChange={(event) =>
                                        patchSpecial(index, { description: event.target.value })
                                    }
                                />
                            </div>

                            <div className={styles.specialRow}>
                                <label className={styles.dateLabel}>
                                    {t('commerce.owner.editor.dailySpecials.from', 'Desde')}
                                    <input
                                        className={styles.dateInput}
                                        type="date"
                                        value={special.validFrom}
                                        onChange={(event) =>
                                            patchSpecial(index, { validFrom: event.target.value })
                                        }
                                    />
                                </label>
                                <label className={styles.dateLabel}>
                                    {t('commerce.owner.editor.dailySpecials.until', 'Hasta')}
                                    <input
                                        className={styles.dateInput}
                                        type="date"
                                        value={special.validUntil}
                                        onChange={(event) =>
                                            patchSpecial(index, { validUntil: event.target.value })
                                        }
                                    />
                                </label>
                            </div>

                            {isExpired && (
                                <p className={styles.expiredNote}>
                                    {t(
                                        'commerce.owner.editor.dailySpecials.expired',
                                        'Ya venció — no se está mostrando.'
                                    )}
                                </p>
                            )}
                            {isScheduled && (
                                <p className={styles.scheduledNote}>
                                    {t(
                                        'commerce.owner.editor.dailySpecials.scheduled',
                                        'Programado — todavía no se muestra.'
                                    )}
                                </p>
                            )}
                        </fieldset>
                    );
                })}

                <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={addSpecial}
                >
                    {t('commerce.owner.editor.dailySpecials.add', 'Agregar plato del día')}
                </button>
            </div>

            <button
                type="button"
                className={styles.primaryButton}
                disabled={busy || isLocked}
                onClick={() => void save()}
            >
                {state === 'saving'
                    ? t('commerce.owner.editor.dailySpecials.saving', 'Guardando…')
                    : t('commerce.owner.editor.dailySpecials.save', 'Guardar menú del día')}
            </button>

            {message && <p className={styles.message}>{message}</p>}
        </section>
    );
}
