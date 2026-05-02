/**
 * @file CollectionPickers.tsx
 * @description Color picker and icon picker sub-components used inside
 * CreateEditCollectionModal. Extracted to keep the modal under 500 lines.
 *
 * Both pickers follow the ARIA radiogroup / radio pattern for keyboard
 * accessibility and honour `prefers-reduced-motion` via CSS.
 *
 * Note: `role="radio"` on `<button>` is intentional — the visual design requires
 * fully custom-styled swatches/icon buttons that cannot be achieved with a native
 * `<input type="radio">` without hiding it. `useSemanticElements` is disabled for
 * this file via the Biome override in `apps/web/biome.json`.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';
import styles from './CreateEditCollectionModal.module.css';
import { COLOR_PALETTE, ICON_OPTIONS } from './collection-picker-config';

// ─── Color picker ─────────────────────────────────────────────────────────────

/**
 * Props for the CollectionColorPicker component.
 */
export interface CollectionColorPickerProps {
    /** Currently selected hex color string, or empty string for "none". */
    readonly value: string;
    /** Called with the new hex color, or empty string to clear. */
    readonly onChange: (color: string) => void;
    /** Locale for i18n labels. */
    readonly locale: SupportedLocale;
    /** `id` for the visible label element (used as `aria-labelledby`). */
    readonly labelId: string;
}

/**
 * Horizontal row of 32×32 circle swatches.
 * First item is always "Sin color" (transparent + diagonal-line indicator).
 * Selected swatch shows a primary-colored ring via CSS.
 *
 * ARIA: `role="radiogroup"` / `role="radio"` / `aria-checked`.
 */
export function CollectionColorPicker({
    value,
    onChange,
    locale,
    labelId
}: CollectionColorPickerProps) {
    const t = createT(locale);

    return (
        <div
            className={styles.colorPickerRow}
            role="radiogroup"
            aria-labelledby={labelId}
        >
            {/* "Sin color" option */}
            <button
                type="button"
                role="radio"
                aria-checked={value === ''}
                aria-label={t('account.favorites.collections.fields.colorNone', 'Sin color')}
                className={[
                    styles.colorSwatch,
                    styles.colorSwatchNone,
                    value === '' ? styles.colorSwatchNoneSelected : ''
                ]
                    .filter(Boolean)
                    .join(' ')}
                onClick={() => onChange('')}
            />

            {/* Palette swatches */}
            {COLOR_PALETTE.map((entry) => (
                <button
                    key={entry.hex}
                    type="button"
                    role="radio"
                    aria-checked={value === entry.hex}
                    aria-label={entry.label}
                    className={[
                        styles.colorSwatch,
                        value === entry.hex ? styles.colorSwatchSelected : ''
                    ]
                        .filter(Boolean)
                        .join(' ')}
                    style={{ backgroundColor: entry.hex }}
                    onClick={() => onChange(entry.hex)}
                />
            ))}
        </div>
    );
}

// ─── Icon picker ──────────────────────────────────────────────────────────────

/**
 * Props for the CollectionIconPicker component.
 */
export interface CollectionIconPickerProps {
    /** Currently selected icon key string, or empty string for "none". */
    readonly value: string;
    /** Called with the new icon key, or empty string to clear. */
    readonly onChange: (icon: string) => void;
    /** Locale for i18n labels. */
    readonly locale: SupportedLocale;
    /** `id` for the visible label element (used as `aria-labelledby`). */
    readonly labelId: string;
}

/**
 * Flex-wrap grid of 40×40 icon buttons.
 * First item is always "Sin ícono" (clears the selection).
 * Selected icon shows a primary-colored border and background tint.
 *
 * ARIA: `role="radiogroup"` / `role="radio"` / `aria-checked`.
 */
export function CollectionIconPicker({
    value,
    onChange,
    locale,
    labelId
}: CollectionIconPickerProps) {
    const t = createT(locale);

    return (
        <div
            className={styles.iconPickerGrid}
            role="radiogroup"
            aria-labelledby={labelId}
        >
            {/* "Sin ícono" option */}
            <button
                type="button"
                // biome-ignore lint/a11y/useSemanticElements: button[role=radio] is the canonical pattern for icon swatch pickers (cannot use native <input type=radio> with custom icon visuals).
                role="radio"
                aria-checked={value === ''}
                aria-label={t('account.favorites.collections.fields.iconNone', 'Sin ícono')}
                className={[
                    styles.iconBtn,
                    styles.iconBtnNone,
                    value === '' ? styles.iconBtnSelected : ''
                ]
                    .filter(Boolean)
                    .join(' ')}
                onClick={() => onChange('')}
            >
                {t('account.favorites.collections.fields.iconNoneLabel', 'Ninguno')}
            </button>

            {/* Icon buttons */}
            {ICON_OPTIONS.map(({ key, label, Component }) => (
                <button
                    key={key}
                    type="button"
                    // biome-ignore lint/a11y/useSemanticElements: button[role=radio] is the canonical pattern for icon swatch pickers (cannot use native <input type=radio> with custom icon visuals).
                    role="radio"
                    aria-checked={value === key}
                    aria-label={label}
                    className={[styles.iconBtn, value === key ? styles.iconBtnSelected : '']
                        .filter(Boolean)
                        .join(' ')}
                    onClick={() => onChange(key)}
                >
                    <Component
                        size={20}
                        weight="regular"
                        aria-hidden="true"
                    />
                </button>
            ))}
        </div>
    );
}
