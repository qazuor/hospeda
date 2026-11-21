/**
 * Button — the one button recipe of the Mi Cuenta kit (HOS-2413 T-004).
 *
 * Variants `primary`, `secondary`, `ghost`, `quiet`, `danger`, `danger-ghost`
 * and `accent`; sizes `sm` 36, `md` 40, `lg` 44.
 *
 * - `loading` sets `aria-busy`, keeps the button's width (the label stays in
 *   flow, hidden) and blocks a second activation. The button stays focusable.
 * - `disabled` uses the native attribute.
 * - `iconOnly` REQUIRES `aria-label` (a TypeScript error otherwise).
 * - `type` defaults to `button`, never `submit`.
 *
 * `accent` is reserved for upsell, sumarse and the header «Publicar». Do not
 * use it for ordinary actions.
 *
 * @module components/account/ui/Button
 */

import { LoaderIcon } from '@repo/icons';
import type { ButtonHTMLAttributes, MouseEvent, ReactNode, Ref } from 'react';
import { type ButtonSize, type ButtonVariant, buttonClassName, buttonParts } from './button-class';
import { type HelpAnchor, helpAttr } from './help-anchor';

type NativeButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'>;

/** Content props: visible children, or an icon with a mandatory accessible name. */
export type ButtonContentProps =
    | {
          readonly iconOnly?: false;
          readonly children: ReactNode;
      }
    | {
          readonly iconOnly: true;
          /** Mandatory: an icon-only button has no visible text. */
          readonly 'aria-label': string;
          readonly children: ReactNode;
      };

/** Props of {@link Button}. */
export type ButtonProps = NativeButtonProps &
    ButtonContentProps & {
        /** Visual variant. @default 'primary' */
        readonly variant?: ButtonVariant;
        /** Size. @default 'md' */
        readonly size?: ButtonSize;
        /** Busy state: `aria-busy`, width kept, activation blocked. */
        readonly loading?: boolean;
        /** Stretch to the container width. */
        readonly fullWidth?: boolean;
        /** Extra class from the caller (layout only). */
        readonly className?: string;
        /** Optional help anchor rendered as `data-help`. */
        readonly helpId?: HelpAnchor;
        /** Ref to the underlying `<button>`. */
        readonly ref?: Ref<HTMLButtonElement>;
    };

/**
 * The kit button.
 *
 * @param props - See {@link ButtonProps}.
 * @returns A `<button>` element.
 */
export function Button({
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth,
    iconOnly,
    className,
    helpId,
    type = 'button',
    onClick,
    children,
    ref,
    ...rest
}: ButtonProps) {
    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
        if (loading) {
            event.preventDefault();
            return;
        }
        onClick?.(event);
    };

    return (
        <button
            {...rest}
            {...helpAttr({ helpId })}
            ref={ref}
            type={type}
            className={buttonClassName({ variant, size, fullWidth, iconOnly, loading, className })}
            aria-busy={loading || undefined}
            onClick={handleClick}
        >
            <span className={buttonParts.content}>{children}</span>
            {loading ? (
                <span
                    className={buttonParts.spinner}
                    aria-hidden="true"
                >
                    <LoaderIcon size="sm" />
                </span>
            ) : null}
        </button>
    );
}
