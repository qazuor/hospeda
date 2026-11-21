/**
 * Skeleton — loading placeholders for the Mi Cuenta kit (HOS-2413 T-023).
 *
 * Shapes `text`, `title`, `circle` and `block`, plus the composed
 * `Skeleton.Row` (avatar + two lines) and `Skeleton.Stat` (label + number).
 * Every Skeleton is a busy container: `aria-busy="true"` plus a hidden,
 * translated «Cargando…» so a screen reader hears one message, not a silent
 * gap. The shimmer is off under `prefers-reduced-motion`.
 *
 * @module components/account/ui/Skeleton
 */

import { createT, type SupportedLocale } from '@/lib/i18n';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import styles from './Skeleton.module.css';

/** The four primitive shapes. */
export type SkeletonShape = 'text' | 'title' | 'circle' | 'block';

interface SkeletonBaseProps {
    /** Locale for the hidden «Cargando…». */
    readonly locale: SupportedLocale;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/** Props of {@link Skeleton}. */
export interface SkeletonProps extends SkeletonBaseProps {
    /** Shape to draw. @default 'text' */
    readonly shape?: SkeletonShape;
    /** For `text`: how many lines (the last one is shorter). @default 1 */
    readonly lines?: number;
}

/** Busy container: `aria-busy` plus the hidden translated «Cargando…». */
function Busy({
    locale,
    className,
    helpId,
    children
}: SkeletonBaseProps & { readonly children: React.ReactNode }) {
    return (
        <div
            {...helpAttr({ helpId })}
            aria-busy="true"
            className={cx(styles.skeleton, className)}
        >
            <span className={styles.visuallyHidden}>{createT(locale)('account.ui.loading')}</span>
            {children}
        </div>
    );
}

/** One painted shape. */
function Shape({ shape, short }: { readonly shape: SkeletonShape; readonly short?: boolean }) {
    return (
        <span
            aria-hidden="true"
            className={cx(styles.shape, styles[shape], short && styles.textShort)}
        />
    );
}

/**
 * A loading placeholder.
 *
 * @param props - See {@link SkeletonProps}.
 * @returns A busy container with the shape(s).
 */
export function Skeleton({ shape = 'text', lines = 1, locale, className, helpId }: SkeletonProps) {
    const count = shape === 'text' ? Math.max(lines, 1) : 1;
    return (
        <Busy
            locale={locale}
            className={className}
            helpId={helpId}
        >
            {Array.from({ length: count }, (_, index) => (
                <Shape
                    // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder lines have no identity
                    key={index}
                    shape={shape}
                    short={shape === 'text' && count > 1 && index === count - 1}
                />
            ))}
        </Busy>
    );
}

/** A list row: avatar circle and two text lines. */
Skeleton.Row = function SkeletonRow({ locale, className, helpId }: SkeletonBaseProps) {
    return (
        <Busy
            locale={locale}
            className={className}
            helpId={helpId}
        >
            <div className={styles.row}>
                <Shape shape="circle" />
                <div className={styles.rowText}>
                    <Shape shape="text" />
                    <Shape
                        shape="text"
                        short
                    />
                </div>
            </div>
        </Busy>
    );
};

/** A stat tile: a short label and a big number. */
Skeleton.Stat = function SkeletonStat({ locale, className, helpId }: SkeletonBaseProps) {
    return (
        <Busy
            locale={locale}
            className={cx(styles.stat, className)}
            helpId={helpId}
        >
            <Shape
                shape="text"
                short
            />
            <span
                aria-hidden="true"
                className={cx(styles.shape, styles.statNumber)}
            />
        </Busy>
    );
};
