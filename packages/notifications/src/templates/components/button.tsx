import { Button as EmailButton } from '@react-email/components';
import type React from 'react';

/**
 * Button variant types
 */
export type ButtonVariant = 'primary' | 'secondary';

/**
 * Props for Button component
 */
export interface ButtonProps {
    /** Button link URL */
    href: string;
    /** Button text/content */
    children: React.ReactNode;
    /** Button style variant */
    variant?: ButtonVariant;
    /**
     * Link slot reported as `utm_content` when the link points at our web domain
     * (HOS-2359). Rendered as `data-utm-content` on the anchor. Defaults to `'cta'`;
     * a template with a second CTA can set e.g. `'secondary-cta'`.
     */
    utmContent?: string;
}

/**
 * CTA button component for email templates
 */
export function Button({ href, children, variant = 'primary', utmContent = 'cta' }: ButtonProps) {
    const style = variant === 'primary' ? styles.primary : styles.secondary;

    return (
        <EmailButton
            href={href}
            style={style}
            data-utm-content={utmContent}
        >
            {children}
        </EmailButton>
    );
}

const baseStyle = {
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: '600',
    padding: '12px 24px',
    textDecoration: 'none',
    textAlign: 'center' as const,
    display: 'inline-block',
    lineHeight: '24px',
    cursor: 'pointer'
};

const styles = {
    primary: {
        ...baseStyle,
        backgroundColor: '#3b82f6',
        color: '#ffffff',
        border: 'none'
    },
    secondary: {
        ...baseStyle,
        backgroundColor: 'transparent',
        color: '#3b82f6',
        border: '2px solid #3b82f6'
    }
};
