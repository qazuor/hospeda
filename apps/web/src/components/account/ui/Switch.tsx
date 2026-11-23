/**
 * Switch and SwitchRow — the one on/off control (HOS-2413 T-016, D11
 * «ajustes en Preferencias»).
 *
 * `Switch` is a `<button role="switch" aria-checked>` named through
 * `aria-labelledby` (or `aria-label`), 44x24 with a visible focus ring; the
 * off track uses `control-border` (at least 3:1 on the card).
 *
 * `SwitchRow` is a 64px row with a label and a description. It runs the save
 * itself and saves optimistically: while the promise is pending the switch stays
 * focusable, is `aria-busy` and ignores activation; if it rejects the switch REVERTS to the previous
 * value and shows a translated error. `locked` shows a plan pill and a link to
 * the locked state, and the switch stays off and disabled. Every
 * `aria-describedby` id points at a node that exists.
 *
 * @module components/account/ui/Switch
 */

import { useEffect, useId, useState } from 'react';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import { StatusPill } from './StatusPill';
import styles from './Switch.module.css';
import { TextLink } from './TextLink';

type SwitchNameProps =
    | { readonly 'aria-labelledby': string; readonly 'aria-label'?: undefined }
    | { readonly 'aria-label': string; readonly 'aria-labelledby'?: undefined };

/** Props of {@link Switch}. */
export type SwitchProps = SwitchNameProps & {
    /** Current state. */
    readonly checked: boolean;
    /** Called with the requested next state. */
    readonly onCheckedChange: (checked: boolean) => void;
    /** Native disabled. */
    readonly disabled?: boolean;
    /** Marks the switch busy (an in-flight save): focusable, `aria-busy`, activation ignored. */
    readonly busy?: boolean;
    /** Ids of the nodes that describe the switch. They must exist. */
    readonly 'aria-describedby'?: string;
    /** Marks the switch `aria-invalid` (it carries a group's error). */
    readonly invalid?: boolean;
    /** Optional id of the button. */
    readonly id?: string;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
};

/**
 * The kit switch.
 *
 * @param props - See {@link SwitchProps}.
 * @returns A `<button role="switch">`.
 */
export function Switch({
    checked,
    onCheckedChange,
    disabled,
    busy,
    invalid,
    className,
    helpId,
    ...aria
}: SwitchProps) {
    return (
        <button
            {...aria}
            {...helpAttr({ helpId })}
            type="button"
            role="switch"
            aria-checked={checked}
            aria-busy={busy || undefined}
            aria-disabled={busy || undefined}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            className={cx(styles.switch, className)}
            onClick={() => {
                // Busy keeps focus on the control (no native `disabled`) and just
                // ignores the activation, like Button's `loading`.
                if (busy) return;
                onCheckedChange(!checked);
            }}
        >
            <span
                className={styles.thumb}
                aria-hidden="true"
            />
        </button>
    );
}

/** What a locked SwitchRow points at. */
export interface SwitchRowLock {
    /** Name of the plan that unlocks it (read from the catalog by the caller). */
    readonly planLabel: string;
    /** Where the locked state explains how to unlock it. */
    readonly href: string;
}

/** Props of {@link SwitchRow}. */
export interface SwitchRowProps {
    /** Visible label (names the switch). */
    readonly label: string;
    /** Supporting description. */
    readonly description?: string;
    /** Locale for the error and locked copy. */
    readonly locale: SupportedLocale;
    /** Saved state. */
    readonly checked: boolean;
    /** Saves the requested state. A rejection reverts the switch. */
    readonly onChange: (checked: boolean) => Promise<void>;
    /** Plan lock: shows a plan pill and a link, and disables the switch. */
    readonly locked?: SwitchRowLock;
    /** Disables the switch. */
    readonly disabled?: boolean;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * A labelled, self-saving switch row.
 *
 * @param props - See {@link SwitchRowProps}.
 * @returns A row with the switch, its label, description and error.
 */
export function SwitchRow({
    label,
    description,
    locale,
    checked,
    onChange,
    locked,
    disabled,
    helpId
}: SwitchRowProps) {
    const base = useId();
    const labelId = `${base}-label`;
    const descriptionId = `${base}-description`;
    const errorId = `${base}-error`;
    const t = createT(locale);
    const [value, setValue] = useState(checked);
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setValue(checked);
    }, [checked]);

    const handleChange = async (next: boolean) => {
        const previous = value;
        setValue(next);
        setFailed(false);
        setSaving(true);
        try {
            await onChange(next);
        } catch {
            setValue(previous);
            setFailed(true);
        } finally {
            setSaving(false);
        }
    };

    const describedBy =
        [description ? descriptionId : undefined, failed ? errorId : undefined]
            .filter(Boolean)
            .join(' ') || undefined;

    return (
        <div
            {...helpAttr({ helpId })}
            className={styles.row}
        >
            <div className={styles.text}>
                <span
                    id={labelId}
                    className={styles.label}
                >
                    {label}
                    {locked ? <StatusPill tone="plan">{locked.planLabel}</StatusPill> : null}
                </span>
                {description ? (
                    <p
                        id={descriptionId}
                        className={styles.description}
                    >
                        {description}
                    </p>
                ) : null}
                {failed ? (
                    <p
                        id={errorId}
                        role="alert"
                        className={styles.error}
                    >
                        {t('account.ui.switchSaveError')}
                    </p>
                ) : null}
                {locked ? (
                    <TextLink
                        href={locked.href}
                        className={styles.lockedLink}
                    >
                        {t('account.ui.switchLockedLink')}
                    </TextLink>
                ) : null}
            </div>
            <Switch
                aria-labelledby={labelId}
                aria-describedby={describedBy}
                checked={locked ? false : value}
                busy={saving}
                disabled={Boolean(locked) || disabled}
                onCheckedChange={handleChange}
            />
        </div>
    );
}
