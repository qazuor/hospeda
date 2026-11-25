/**
 * Avatar — a person's picture, or their initials when there is none
 * (HOS-2414, first consumer HOS-2473).
 *
 * The initials fallback replaces the hand-written copies scattered across the
 * account pages. The background is one of the four `--avatar-n` gradients,
 * picked from the name so the same person always gets the same color.
 *
 * `decorative` renders it hidden from assistive technology, for when the name
 * is already written right next to it (a page header, a list row).
 *
 * @module components/account/ui/Avatar
 */

import { getInitials } from '@/lib/avatar-utils';
import styles from './Avatar.module.css';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';

/** Avatar sizes: `sm` 32px, `md` 40px, `lg` 64px. */
export type AvatarSize = 'sm' | 'md' | 'lg';

/** Props of {@link Avatar}. */
export interface AvatarProps {
    /** The person's display name: alt text and source of the initials. */
    readonly name: string;
    /** Picture URL, when the person has one. */
    readonly src?: string | null;
    /** @default 'md' */
    readonly size?: AvatarSize;
    /** Hide it from assistive technology (the name is written next to it). */
    readonly decorative?: boolean;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * Compatibility export delegating to the shared significant-word helper.
 *
 * @param input - Options object.
 * @param input.name - The display name.
 * @returns Uppercase initials, or an empty string for a blank name.
 */
export function avatarInitials({ name }: { readonly name: string }): string {
    return getInitials({ name, placeholder: '' });
}

/**
 * Which of the four avatar gradients a name gets (1-4), stable per name.
 *
 * @param input - Options object.
 * @param input.name - The display name.
 * @returns A palette index from 1 to 4.
 */
export function avatarPalette({ name }: { readonly name: string }): 1 | 2 | 3 | 4 {
    let hash = 0;
    for (const char of name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
    return ((hash % 4) + 1) as 1 | 2 | 3 | 4;
}

/**
 * The kit avatar.
 *
 * @param props - See {@link AvatarProps}.
 * @returns A `<span>` with the picture or the initials.
 */
export function Avatar({
    name,
    src,
    size = 'md',
    decorative = false,
    className,
    helpId
}: AvatarProps) {
    const palette = avatarPalette({ name });
    return (
        <span
            {...helpAttr({ helpId })}
            {...(decorative ? { 'aria-hidden': true } : {})}
            data-palette={palette}
            className={cx(styles.root, styles[size], styles[`p${palette}`], className)}
        >
            {src ? (
                <img
                    src={src}
                    alt={decorative ? '' : name}
                    className={styles.image}
                    loading="lazy"
                    decoding="async"
                />
            ) : (
                <>
                    <span aria-hidden="true">{avatarInitials({ name })}</span>
                    {decorative ? null : <span className={styles.visuallyHidden}>{name}</span>}
                </>
            )}
        </span>
    );
}
