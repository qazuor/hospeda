/**
 * @file TranslationFieldRow.client.tsx
 * @description One translatable field's card inside the host TranslationPanel.
 *
 * Split out of `TranslationPanel.client.tsx` when HOS-797 gave the card a second
 * half: the panel was already over this repo's 500-line ceiling, and the card is
 * now the larger of the two concerns.
 *
 * HOS-797 — the card shows the translated TEXT, not only whether a locale has
 * one. The panel had always received the text (`TranslatableFieldStatus.locales`
 * carries the full value) and rendered nothing but a badge from it, so the one
 * screen called "Traducciones" could report a clean green run over a translation
 * that had quietly renamed the business. Showing it is the whole fix; editing it
 * is deliberately NOT part of this delivery.
 *
 * Two rules hold the card together:
 *
 * - **Pill and text come from ONE call.** `localeDisplaysFor` answers both. The
 *   badge used to decide presence with its own inline `.trim()` while
 *   `missingLocalesFor` decided it in `translation-status.ts`, and the two
 *   disagreeing over a whitespace-only value is a bug this repo has shipped once
 *   already.
 * - **An empty locale is never blank.** It says which kind of empty it is —
 *   nothing written in Spanish yet, versus not translated yet — because a gap the
 *   host cannot name reads as a rendering failure.
 *
 * The long fields are Markdown source (`RichTextEditor` persists Markdown), shown
 * as plain text: this is a review surface, and rendering it would mean parsing and
 * sanitizing host content on the client for no gain in what the host has to check.
 *
 * HOS-2492 — the panel shows one kit `Tabs` panel per language, so a row is one
 * field IN one locale: its name, a `StatusPill` for the locale's role (original,
 * AI-generated, missing), a second pill for the field's run outcome, and the
 * text. The hand-drawn SVG badges went with the old per-field card.
 *
 * @module components/host/editor/TranslationFieldRow
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusPill, type StatusTone } from '@/components/account/ui';
import type { AccommodationTranslationData, TranslatableFieldStatus } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import styles from './TranslationPanel.module.css';
import type { FieldOutcome, LocaleDisplay, TranslatableField } from './translation-status';
import { localeDisplaysFor } from './translation-status';

type Translate = (key: string, fallback?: string, params?: Record<string, unknown>) => string;

/** Short locale codes shown on the tabs and in the failure notes. */
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
    es: 'ES',
    en: 'EN',
    pt: 'PT'
};

// ---------------------------------------------------------------------------
// Sub-component: ExpandableText
// ---------------------------------------------------------------------------

interface ExpandableTextProps {
    readonly text: string;
    readonly t: Translate;
}

/**
 * A translated value, clamped when it does not fit.
 *
 * The clamp is CSS. The full string is ALWAYS in the DOM — assistive tech reads
 * it, a selection copies it, and a test finds it — so the toggle changes what is
 * visible and never what exists. `description` and `richDescription` run to 5000
 * characters and there are three locales of each, which is the wall of text this
 * avoids without hiding anything behind a click for `name` or `summary`.
 *
 * Whether to OFFER the toggle is measured, not guessed from a character count: a
 * threshold cannot know the container's width, so it would promise "ver completo"
 * on text that is already complete. Measuring only while collapsed is what keeps
 * the button from removing itself the moment it is used — expanded, the element
 * no longer overflows.
 */
function ExpandableText({ text, t }: ExpandableTextProps) {
    const [expanded, setExpanded] = useState(false);
    const [overflows, setOverflows] = useState(false);
    const bodyRef = useRef<HTMLParagraphElement | null>(null);

    // `useEffect`, not `useLayoutEffect`: this island is server-rendered and the
    // layout variant warns there. The cost is that the toggle appears one frame
    // late, on a control nobody can click before hydration anyway.
    useEffect(() => {
        if (expanded) return;
        const element = bodyRef.current;
        if (!element) return;
        setOverflows(element.scrollHeight - element.clientHeight > 1);
    }, [expanded]);

    const toggle = useCallback(() => setExpanded((current) => !current), []);

    return (
        <>
            <p
                ref={bodyRef}
                className={expanded ? styles.localeTextBody : styles.localeTextBodyClamped}
            >
                {text}
            </p>
            {(overflows || expanded) && (
                <button
                    type="button"
                    className={styles.localeTextToggle}
                    onClick={toggle}
                >
                    {expanded
                        ? t('host.properties.editor.translation.collapseText', 'Ver menos')
                        : t('host.properties.editor.translation.expandText', 'Ver completo')}
                </button>
            )}
        </>
    );
}

// ---------------------------------------------------------------------------
// Sub-component: RolePill
// ---------------------------------------------------------------------------

/** Tone per locale role: the original is neutral, a gap is a warning. */
const ROLE_TONE: Readonly<Record<LocaleDisplay['role'], StatusTone>> = {
    source: 'neutral',
    translated: 'success',
    missing: 'warning'
};

interface LocaleTextProps {
    readonly display: LocaleDisplay;
    readonly t: Translate;
}

function RolePill({ display, t }: LocaleTextProps) {
    const label =
        display.role === 'source'
            ? t('host.properties.editor.translation.roleSource', 'Original')
            : display.role === 'translated'
              ? t('host.properties.editor.translation.roleTranslated', 'Generado con IA')
              : t('host.properties.editor.translation.roleMissing', 'Sin traducir');
    return <StatusPill tone={ROLE_TONE[display.role]}>{label}</StatusPill>;
}

function LocaleTextBody({ display, t }: LocaleTextProps) {
    if (display.text !== null) {
        return (
            // Keyed by the value. A run folding a translation into this locale
            // replaces the text under a component whose measured overflow — and
            // whose expanded/collapsed state — were both taken against the old
            // one. Remounting re-measures and starts collapsed, which is the
            // right default for text the host has not seen yet.
            <ExpandableText
                key={display.text}
                text={display.text}
                t={t}
            />
        );
    }

    if (display.presenceOnly) {
        // Filled, but this page cannot say with what: the run reported the pair
        // as succeeded and returned no text. The refresh the panel offers is the
        // way to actually read it.
        return (
            <p className={styles.localeTextEmpty}>
                {t(
                    'host.properties.editor.translation.textUnavailable',
                    'Se generó recién. Actualizá la página para leerlo.'
                )}
            </p>
        );
    }

    if (display.role === 'source') {
        return (
            <p className={styles.localeTextEmpty}>
                {t(
                    'host.properties.editor.translation.sourceEmpty',
                    'Todavía no escribiste este contenido.'
                )}
            </p>
        );
    }

    return (
        <p className={styles.localeTextEmpty}>
            {t(
                'host.properties.editor.translation.translationEmpty',
                'Todavía no se generó esta traducción.'
            )}
        </p>
    );
}

// ---------------------------------------------------------------------------
// Sub-component: FieldNote
// ---------------------------------------------------------------------------

interface FieldNoteProps {
    readonly sourced: boolean;
    readonly outcome?: FieldOutcome;
    readonly t: Translate;
}

/** The field's run outcome (HOS-317) as a pill, or the «no source» note. */
function FieldNote({ sourced, outcome, t }: FieldNoteProps) {
    if (outcome) {
        if (outcome.status === 'pending') {
            return (
                <StatusPill tone="info">
                    {t('host.properties.editor.translation.fieldPending', 'Generando...')}
                </StatusPill>
            );
        }
        if (outcome.status === 'translated') {
            return (
                <StatusPill tone="success">
                    {t('host.properties.editor.translation.fieldTranslated', 'Traducido')}
                </StatusPill>
            );
        }
        if (outcome.status === 'failed') {
            // `failedLocales` can be empty even here: a locale the client cannot
            // name is dropped from the list but never cancels the failure itself.
            const named = outcome.failedLocales.map((locale) => LOCALE_LABELS[locale]).join(', ');
            return (
                <StatusPill tone="danger">
                    {named
                        ? t(
                              'host.properties.editor.translation.fieldFailed',
                              'No se pudo traducir a {{locales}}',
                              { locales: named }
                          )
                        : t(
                              'host.properties.editor.translation.fieldFailedUnknown',
                              'No se pudo traducir este campo'
                          )}
                </StatusPill>
            );
        }
        return (
            <StatusPill tone="neutral">
                {t('host.properties.editor.translation.fieldUntouched', 'Sin cambios')}
            </StatusPill>
        );
    }

    if (!sourced) {
        return (
            <StatusPill tone="neutral">
                {t(
                    'host.properties.editor.translation.fieldNoSource',
                    'Sin contenido para traducir'
                )}
            </StatusPill>
        );
    }

    return null;
}

// ---------------------------------------------------------------------------
// Component: TranslationFieldRow
// ---------------------------------------------------------------------------

/** Props of {@link TranslationFieldRow}. */
export interface TranslationFieldRowProps {
    readonly status: TranslatableFieldStatus;
    readonly sourceLocale: SupportedLocale;
    /** The locale whose tab this row renders in. */
    readonly displayLocale: SupportedLocale;
    readonly fieldLabel: string;
    readonly outcome?: FieldOutcome;
    readonly t: Translate;
}

/**
 * One field in one locale: name, role pill, run-outcome pill and the text.
 *
 * @param props - See {@link TranslationFieldRowProps}.
 * @returns The `<li>` row.
 */
export function TranslationFieldRow({
    status,
    sourceLocale,
    displayLocale,
    fieldLabel,
    outcome,
    t
}: TranslationFieldRowProps) {
    const displays = localeDisplaysFor({ status, sourceLocale });
    // Read off the same answer the pills and the text use, so a row cannot
    // offer to translate from a source it just rendered as empty.
    const sourced = displays.some((display) => display.role === 'source' && display.text !== null);
    const display = displays.find((candidate) => candidate.locale === displayLocale);

    return (
        <li
            className={styles.fieldCard}
            data-locale={displayLocale}
            data-role={display?.role}
        >
            <div className={styles.fieldHead}>
                <p className={styles.fieldName}>{fieldLabel}</p>
                {display ? (
                    <RolePill
                        display={display}
                        t={t}
                    />
                ) : null}
                <FieldNote
                    sourced={sourced}
                    outcome={outcome}
                    t={t}
                />
            </div>
            {display ? (
                <LocaleTextBody
                    display={display}
                    t={t}
                />
            ) : null}
        </li>
    );
}

/**
 * How many of the given rows are missing in a locale (for the tab count).
 *
 * @param params - The field statuses, the source locale and the locale.
 * @returns The number of fields whose role in that locale is `missing`.
 */
export function countMissingInLocale({
    statuses,
    sourceLocale,
    locale
}: {
    readonly statuses: readonly TranslatableFieldStatus[];
    readonly sourceLocale: SupportedLocale;
    readonly locale: SupportedLocale;
}): number {
    return statuses.filter((status) =>
        localeDisplaysFor({ status, sourceLocale }).some(
            (display) => display.locale === locale && display.role === 'missing'
        )
    ).length;
}

/** One field row of the panel, before it is placed in a locale tab. */
export interface TranslationRowModel {
    readonly field: TranslatableField;
    readonly status: TranslatableFieldStatus;
    readonly label: string;
}

/**
 * The panel's field rows, in display order.
 *
 * BETA-199: the rich-description row is absent when the owner's plan has no
 * rich description — the API omits the premium pair entirely, and a row that
 * can never fill in is what kept the generate button alive forever.
 *
 * @param params - The (possibly run-folded) translations and the translator.
 * @returns The rows.
 */
export function buildTranslationRows({
    translations,
    t
}: {
    readonly translations: AccommodationTranslationData;
    readonly t: Translate;
}): readonly TranslationRowModel[] {
    const rows: TranslationRowModel[] = [
        {
            field: 'name',
            status: translations.name,
            label: t('host.properties.editor.field.name', 'Nombre')
        },
        {
            field: 'summary',
            status: translations.summary,
            label: t('host.properties.editor.field.summary', 'Resumen')
        },
        {
            field: 'description',
            status: translations.description,
            label: t('host.properties.editor.field.description', 'Descripción')
        }
    ];
    if (translations.richDescription !== null) {
        rows.push({
            field: 'richDescription',
            status: translations.richDescription,
            label: t(
                'host.properties.editor.translation.fieldRichDescription',
                'Descripción enriquecida'
            )
        });
    }
    return rows;
}
