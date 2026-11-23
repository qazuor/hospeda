import { Button as ReactEmailButton } from '@react-email/components';
import { emailPalette } from '@repo/design-tokens';
import type { ReactElement, ReactNode } from 'react';

/** Visual variant of a {@link Button}. */
export type ButtonVariant = 'primary' | 'secondary';

/**
 * Class that the layout's single media rule targets (HOS-2565 D4). Exported so the
 * layout and the tests share one spelling.
 */
export const EMAIL_BUTTON_CLASS = 'hospeda-btn';

/**
 * The ONE `<style>` rule the layout emits (HOS-2565 D4, AC-2.6): on screens up to 480px
 * the button becomes a full-width block. Clients that strip `<style>` keep the
 * inline content-width button, so nothing depends on this rule to be correct.
 */
export const EMAIL_BUTTON_MEDIA_RULE = `@media only screen and (max-width:480px){.${EMAIL_BUTTON_CLASS}{display:block !important;width:auto !important;}}`;

/**
 * Props for {@link Button}.
 */
export interface ButtonProps {
    /** Link URL. */
    readonly href: string;
    /** Button label. */
    readonly children: ReactNode;
    /**
     * `'primary'` is a solid brand button, `'secondary'` an outlined one.
     * @default 'primary'
     */
    readonly variant?: ButtonVariant;
    /**
     * Link slot reported as `utm_content` when the link points at our web domain
     * (HOS-2359). Rendered as `data-utm-content` on the anchor. A template with a
     * second CTA can set e.g. `'secondary-cta'`.
     * @default 'cta'
     */
    readonly utmContent?: string;
}

/**
 * Shared CTA button for every Hospeda email (HOS-2565 D4, D5).
 *
 * Content width by default (inline `display: inline-block`). The layout's one
 * `<style>` media rule turns `.hospeda-btn` into a full-width block on narrow
 * screens; where `<style>` is stripped the button simply stays content width.
 * The button wraps itself in a centered block with vertical spacing, so
 * templates do not hand-roll a button container.
 *
 * @param props - Link, label and variant.
 * @returns The button element.
 *
 * @example
 * ```tsx
 * <Button href="https://hospeda.com.ar/es/mi-cuenta/">Ir a mi cuenta</Button>
 * <Button href={url} variant="secondary">Ver detalle</Button>
 * ```
 */
export function Button({
    href,
    children,
    variant = 'primary',
    utmContent = 'cta'
}: ButtonProps): ReactElement {
    return (
        <table
            role="presentation"
            width="100%"
            cellPadding={0}
            cellSpacing={0}
            border={0}
        >
            <tbody>
                <tr>
                    <td
                        align="center"
                        style={wrapperCellStyle}
                    >
                        <ReactEmailButton
                            href={href}
                            className={EMAIL_BUTTON_CLASS}
                            style={variant === 'primary' ? primaryStyle : secondaryStyle}
                            data-utm-content={utmContent}
                        >
                            {children}
                        </ReactEmailButton>
                    </td>
                </tr>
            </tbody>
        </table>
    );
}

const wrapperCellStyle = {
    padding: '24px 0',
    textAlign: 'center' as const
};

const baseStyle = {
    borderRadius: '6px',
    boxSizing: 'border-box' as const,
    cursor: 'pointer',
    display: 'inline-block',
    fontSize: '16px',
    fontWeight: '600',
    lineHeight: '24px',
    padding: '14px 28px',
    textAlign: 'center' as const,
    textDecoration: 'none'
};

const primaryStyle = {
    ...baseStyle,
    backgroundColor: emailPalette.buttonPrimary,
    border: `2px solid ${emailPalette.buttonPrimary}`,
    color: emailPalette.buttonPrimaryText
};

const secondaryStyle = {
    ...baseStyle,
    backgroundColor: emailPalette.surface,
    border: `2px solid ${emailPalette.buttonSecondaryBorder}`,
    color: emailPalette.buttonSecondaryBorder
};
