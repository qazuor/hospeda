/**
 * @file Badge.tsx
 * @description React equivalent of `Badge.astro` for use inside React islands.
 * Renders a pill-shaped badge as an `<a>` when `href` is provided, else a
 * `<span>`. Visual output mirrors the Astro implementation 1:1 by sharing the
 * same style/class builders from `badge.utils.ts`.
 *
 * Icon support, variants, sizes and the hover-lift affordance all match
 * Badge.astro — see that file for the complete spec.
 */

import { resolveWebIcon } from '@/lib/icon-map';
import type { ReactElement } from 'react';
import styles from './Badge.module.css';
import type { BadgeBaseProps } from './badge.types';
import type { BadgeStylesMap } from './badge.utils';
import { buildBadgeClassList, buildBadgeStyleObject, getBadgeIconSize } from './badge.utils';

/** Props for the React Badge component. */
export interface BadgeProps extends BadgeBaseProps {
    /** Optional extra class appended to the root element's class list. */
    readonly className?: string;
}

/**
 * Pill-shaped badge component for React islands.
 *
 * @param props - See {@link BadgeProps}.
 * @returns A rendered `<a>` (when `href` is provided) or `<span>` element.
 *
 * @example
 * ```tsx
 * <Badge label="Featured" colorScheme={scheme} size="sm" variant="default" />
 * <Badge label="Hotel" href="/hoteles" colorScheme={scheme} icon="HomeIcon" />
 * ```
 */
export function Badge({
    label,
    href,
    colorScheme,
    size = 'sm',
    variant = 'default',
    icon,
    ariaLabel,
    className
}: BadgeProps): ReactElement {
    const hasHref = Boolean(href);
    // TYPE-WORKAROUND: CSS Modules import is typed as a generic Record<string, string>; cast narrows to BadgeStylesMap to enable typed access to known class keys.
    const stylesMap = styles as unknown as BadgeStylesMap;

    const classList = buildBadgeClassList({
        styles: stylesMap,
        variant,
        size,
        hasHref,
        extraClassName: className
    });
    const styleObject = buildBadgeStyleObject({ variant, colorScheme, size, hasHref });

    const IconComponent = icon ? resolveWebIcon({ iconName: icon }) : undefined;
    if (icon && !IconComponent && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(`Badge: icon "${icon}" not found in WEB_ICON_MAP (icon-map.ts)`);
    }

    const iconPixelSize = getBadgeIconSize({ size });

    const content = (
        <>
            {variant === 'dot' && (
                <span
                    className={stylesMap.badgeDot}
                    aria-hidden="true"
                    style={{ backgroundColor: colorScheme.text }}
                />
            )}
            {IconComponent && (
                <IconComponent
                    size={iconPixelSize}
                    weight="regular"
                    aria-hidden="true"
                />
            )}
            <span>{label}</span>
        </>
    );

    if (hasHref) {
        return (
            <a
                href={href}
                className={classList}
                style={styleObject}
                aria-label={ariaLabel}
            >
                {content}
            </a>
        );
    }

    return (
        <span
            className={classList}
            style={styleObject}
            aria-label={ariaLabel}
        >
            {content}
        </span>
    );
}
