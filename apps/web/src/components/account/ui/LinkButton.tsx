/**
 * LinkButton — an `<a>` with the Button look (HOS-2413 T-004).
 *
 * Navigation is a link, never a `<button>` with `location.href`. Takes the
 * same variants and sizes as {@link Button}. `external` opens in a new tab and
 * adds the icon, `rel="noopener noreferrer"` and hidden translated text, which
 * needs `locale`.
 *
 * `accent` is reserved for upsell, sumarse and the header «Publicar».
 *
 * @module components/account/ui/LinkButton
 */

import { ExternalLinkIcon } from '@repo/icons';
import type { AnchorHTMLAttributes, ReactNode, Ref } from 'react';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { type ButtonSize, type ButtonVariant, buttonClassName } from './button-class';
import { type HelpAnchor, helpAttr } from './help-anchor';
import styles from './TextLink.module.css';

type NativeAnchorProps = Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    'children' | 'className' | 'target' | 'rel'
>;

/** Props of {@link LinkButton}. */
export type LinkButtonProps = NativeAnchorProps &
    (
        | { readonly external?: false; readonly locale?: SupportedLocale }
        | { readonly external: true; readonly locale: SupportedLocale }
    ) & {
        /** Destination. */
        readonly href: string;
        /** Visual variant. @default 'primary' */
        readonly variant?: ButtonVariant;
        /** Size. @default 'md' */
        readonly size?: ButtonSize;
        /** Stretch to the container width. */
        readonly fullWidth?: boolean;
        /** Extra class from the caller (layout only). */
        readonly className?: string;
        /** Optional help anchor rendered as `data-help`. */
        readonly helpId?: HelpAnchor;
        /** Link content. */
        readonly children: ReactNode;
        /** Ref to the underlying `<a>`. */
        readonly ref?: Ref<HTMLAnchorElement>;
    };

/**
 * The kit link-button.
 *
 * @param props - See {@link LinkButtonProps}.
 * @returns An `<a>` element.
 */
export function LinkButton({
    variant = 'primary',
    size = 'md',
    fullWidth,
    className,
    helpId,
    external,
    locale,
    children,
    ref,
    ...rest
}: LinkButtonProps) {
    const externalProps =
        external === true
            ? { target: '_blank', rel: 'noopener noreferrer' }
            : ({} as Record<string, never>);

    return (
        <a
            {...rest}
            {...externalProps}
            {...helpAttr({ helpId })}
            ref={ref}
            className={buttonClassName({ variant, size, fullWidth, className })}
        >
            {children}
            {external === true && locale ? (
                <>
                    <ExternalLinkIcon
                        size="sm"
                        aria-hidden="true"
                    />
                    <span className={styles.visuallyHidden}>
                        {createT(locale)('account.ui.opensInNewTab')}
                    </span>
                </>
            ) : null}
        </a>
    );
}
