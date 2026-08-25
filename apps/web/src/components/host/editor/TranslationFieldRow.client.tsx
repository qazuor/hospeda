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
 * - **Badges and text come from ONE call.** `localeDisplaysFor` answers both. The
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
 * @module components/host/editor/TranslationFieldRow
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TranslatableFieldStatus } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import styles from './TranslationPanel.module.css';
import type { FieldOutcome, LocaleDisplay } from './translation-status';
import { localeDisplaysFor } from './translation-status';

/** Translator handed down from the panel, which owns the locale. */
type Translate = (key: string, fallback?: string, params?: Record<string, unknown>) => string;

/** Human-readable label for each locale. */
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
    es: 'ES',
    en: 'EN',
    pt: 'PT'
};

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

/** Pencil — the locale the content is authored in. */
function SourceIcon() {
    return (
        <svg
            className={styles.localeIcon}
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            focusable="false"
        >
            <path
                d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.609Z"
                fill="currentColor"
            />
        </svg>
    );
}

/** Check — the locale holds a translation. */
function PresentIcon() {
    return (
        <svg
            className={styles.localeIcon}
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            focusable="false"
        >
            <path
                d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"
                fill="currentColor"
            />
        </svg>
    );
}

/** Dash — the locale holds nothing. */
function MissingIcon() {
    return (
        <svg
            className={styles.localeIcon}
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            focusable="false"
        >
            <path
                d="M2 8a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8Z"
                fill="currentColor"
            />
        </svg>
    );
}

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
// Sub-component: LocaleText
// ---------------------------------------------------------------------------

interface LocaleTextProps {
    readonly display: LocaleDisplay;
    readonly t: Translate;
}

/**
 * One locale's block: which locale it is, where its content came from, and the
 * content itself.
 *
 * The role line is what AC-2 asks for — the source locale is what the host wrote,
 * the others are what a machine produced from it, and a host who cannot tell them
 * apart has no reason to read the second kind sceptically.
 */
function LocaleText({ display, t }: LocaleTextProps) {
    const roleLabel =
        display.role === 'source'
            ? t('host.properties.editor.translation.roleSource', 'Original')
            : display.role === 'translated'
              ? t('host.properties.editor.translation.roleTranslated', 'Generado con IA')
              : t('host.properties.editor.translation.roleMissing', 'Sin traducir');

    return (
        <li className={styles.localeText}>
            <p className={styles.localeTextHead}>
                <span className={styles.localeTextCode}>{LOCALE_LABELS[display.locale]}</span>
                <span className={styles.localeTextRole}>{roleLabel}</span>
            </p>
            <LocaleTextBody
                display={display}
                t={t}
            />
        </li>
    );
}

/**
 * The body of one locale block.
 *
 * Every branch renders something. AC-3: an untranslated locale must read as
 * untranslated, and the two kinds of empty are not interchangeable — "you have
 * not written this in Spanish" is addressed to the host, "this was not translated
 * yet" is addressed to the button below.
 */
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

/**
 * The per-field line under the badges: run state while a generation is in
 * flight or just finished, otherwise an explanation for a field that has no
 * source text to translate from.
 */
function FieldNote({ sourced, outcome, t }: FieldNoteProps) {
    if (outcome) {
        if (outcome.status === 'pending') {
            return (
                <p className={styles.fieldNote}>
                    {t('host.properties.editor.translation.fieldPending', 'Generando...')}
                </p>
            );
        }
        if (outcome.status === 'translated') {
            return (
                <p className={`${styles.fieldNote} ${styles.fieldNoteSuccess}`}>
                    {t('host.properties.editor.translation.fieldTranslated', 'Traducido')}
                </p>
            );
        }
        if (outcome.status === 'failed') {
            // `failedLocales` can be empty even here: a locale the client cannot
            // name is dropped from the list but never cancels the failure itself.
            // Naming no locale beats rendering "... a " with nothing after it.
            const named = outcome.failedLocales.map((locale) => LOCALE_LABELS[locale]).join(', ');
            return (
                <p className={`${styles.fieldNote} ${styles.fieldNoteError}`}>
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
                </p>
            );
        }
        return (
            <p className={styles.fieldNote}>
                {t('host.properties.editor.translation.fieldUntouched', 'Sin cambios')}
            </p>
        );
    }

    if (!sourced) {
        return (
            <p className={styles.fieldNote}>
                {t(
                    'host.properties.editor.translation.fieldNoSource',
                    'Sin contenido para traducir'
                )}
            </p>
        );
    }

    return null;
}

// ---------------------------------------------------------------------------
// Component: TranslationFieldRow
// ---------------------------------------------------------------------------

export interface TranslationFieldRowProps {
    readonly status: TranslatableFieldStatus;
    readonly sourceLocale: SupportedLocale;
    readonly fieldLabel: string;
    readonly outcome?: FieldOutcome;
    readonly t: Translate;
}

/**
 * Renders a single field card: locale presence badges, this field's state during
 * and after a generation run, and the text each locale holds.
 *
 * @param status - The field's i18n values plus its plain column.
 * @param sourceLocale - Locale the content is authored in.
 * @param fieldLabel - Already-translated label for the field.
 * @param outcome - This field's state in the run currently being reported.
 * @param t - The panel's translator.
 */
export function TranslationFieldRow({
    status,
    sourceLocale,
    fieldLabel,
    outcome,
    t
}: TranslationFieldRowProps) {
    const displays = localeDisplaysFor({ status, sourceLocale });
    // Read off the same answer the badges and the text use, so a card cannot
    // offer to translate from a source it just rendered as empty.
    const sourced = displays.some((display) => display.role === 'source' && display.text !== null);

    return (
        <div className={styles.fieldCard}>
            <div className={styles.fieldName}>{fieldLabel}</div>
            <div className={styles.locales}>
                {displays.map((display) => {
                    let badgeClass = styles.localeBadgeMissing;
                    if (display.role === 'source') {
                        badgeClass = styles.localeBadgeSource;
                    } else if (display.role === 'translated') {
                        badgeClass = styles.localeBadgePresent;
                    }

                    return (
                        <span
                            key={display.locale}
                            className={`${styles.localeBadge} ${badgeClass}`}
                        >
                            {display.role === 'source' ? (
                                <SourceIcon />
                            ) : display.role === 'translated' ? (
                                <PresentIcon />
                            ) : (
                                <MissingIcon />
                            )}
                            {LOCALE_LABELS[display.locale]}
                        </span>
                    );
                })}
            </div>
            <FieldNote
                sourced={sourced}
                outcome={outcome}
                t={t}
            />
            <ul className={styles.localeTexts}>
                {displays.map((display) => (
                    <LocaleText
                        key={display.locale}
                        display={display}
                        t={t}
                    />
                ))}
            </ul>
        </div>
    );
}
