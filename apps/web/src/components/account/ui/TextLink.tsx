/**
 * TextLink — the one inline link recipe of the Mi Cuenta kit (HOS-2413 T-004).
 *
 * Tones `default` (AA link blue), `quiet` and `muted`. `external` opens in a
 * new tab and adds the icon, `rel="noopener noreferrer"` and hidden translated
 * text, which needs `locale`.
 *
 * @module components/account/ui/TextLink
 */

import { ExternalLinkIcon } from '@repo/icons';
import type { AnchorHTMLAttributes, ReactNode, Ref } from 'react';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import styles from './TextLink.module.css';

/** Tone of a {@link TextLink}. */
export type TextLinkTone = 'default' | 'quiet' | 'muted';

type NativeAnchorProps = Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    'children' | 'className' | 'target' | 'rel'
>;

/** Props of {@link TextLink}. */
export type TextLinkProps = NativeAnchorProps &
    (
        | { readonly external?: false; readonly locale?: SupportedLocale }
        | { readonly external: true; readonly locale: SupportedLocale }
    ) & {
        /** Destination. */
        readonly href: string;
        /** Tone. @default 'default' */
        readonly tone?: TextLinkTone;
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
 * The kit inline link.
 *
 * @param props - See {@link TextLinkProps}.
 * @returns An `<a>` element.
 */
export function TextLink({
    tone = 'default',
    className,
    helpId,
    external,
    locale,
    children,
    ref,
    ...rest
}: TextLinkProps) {
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
            className={cx(styles.root, styles[tone], className)}
        >
            {children}
            {external === true && locale ? (
                <>
                    <ExternalLinkIcon
                        size="sm"
                        className={styles.icon}
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
