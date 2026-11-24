import type { ReactElement, ReactNode } from 'react';
import { EMAIL_ISOTIPO_PATH, EMAIL_PUBLIC_SITE_URL } from '../email-assets.js';
import {
    EMAIL_ISOTIPO_HEIGHT,
    EMAIL_ISOTIPO_WIDTH,
    EMAIL_PREFERENCES_URL,
    StaffEmailLayout
} from './staff-layout.js';
import { UserEmailLayout } from './user-layout/user-layout.js';

export { EMAIL_ISOTIPO_HEIGHT, EMAIL_ISOTIPO_WIDTH, EMAIL_PREFERENCES_URL, EMAIL_PUBLIC_SITE_URL };

/**
 * Hosted PNG isotipo (the drawing only, transparent background) shown in the header.
 *
 * Served from `apps/web/public/email/hospeda-isotipo@2x.png`. The word "hospeda"
 * next to it is live text, so dark-mode clients that recolor text keep it legible
 * and nobody sees a baked-in white rectangle.
 *
 * This constant is the PRODUCTION default only. The layouts render
 * `resolveEmailIsotipoUrl()`, which follows the origin the host app configured with
 * `configureEmailAssets` (HOS-2540), so staging emails load it from staging.
 */
export const EMAIL_ISOTIPO_URL = `${EMAIL_PUBLIC_SITE_URL}${EMAIL_ISOTIPO_PATH}`;

/** Which extra link the footer renders. */
export type EmailFooterLink = 'preferences' | 'none';

/** Who reads the mail: drives the layout (HOS-2565 D10). */
export type EmailLayoutVariant = 'user' | 'staff';

/**
 * Props for {@link EmailLayout}.
 */
export interface EmailLayoutProps {
    /** Preheader shown by the inbox next to the subject. Omitted: no `<Preview>`. */
    readonly previewText?: string;
    /** Email body content. */
    readonly children: ReactNode;
    /**
     * `'user'` (default) renders the branded customer layout; `'staff'` the plain
     * pre-HOS-2565 layout, unchanged. The email catalog asserts each render's
     * variant equals its entry's `audience`.
     * @default 'user'
     */
    readonly variant?: EmailLayoutVariant;
    /**
     * Account links in the footer. User: `'preferences'` (default) shows "Elegí qué
     * correos recibís" and the account link; pass `'none'` when the reader has no
     * account. Staff: `'none'` (default); `'preferences'` keeps the old link.
     */
    readonly footerLink?: EmailFooterLink;
}

/**
 * The single layout every Hospeda email renders inside (HOS-2519 D1/D2, HOS-2565 D10).
 *
 * Email-client-safe by construction: inline styles, table layout, hex colors from
 * `emailPalette`, fluid widths up to 600px, no flexbox, grid, CSS variables, web
 * fonts or SVG. Decorative parts carry `data-skip-in-text` so the text/plain part
 * holds only words and links.
 *
 * @param props - Layout configuration.
 * @returns The full email document.
 *
 * @example
 * ```tsx
 * import { EmailLayout } from '@repo/email';
 *
 * export function MyEmail() {
 *     return (
 *         <EmailLayout previewText="Tu reserva fue confirmada">
 *             <Text>Contenido</Text>
 *         </EmailLayout>
 *     );
 * }
 * ```
 */
export function EmailLayout({
    previewText,
    children,
    variant = 'user',
    footerLink
}: EmailLayoutProps): ReactElement {
    if (variant === 'staff') {
        return (
            <StaffEmailLayout
                previewText={previewText}
                footerLink={footerLink ?? 'none'}
            >
                {children}
            </StaffEmailLayout>
        );
    }
    return (
        <UserEmailLayout
            previewText={previewText}
            footerLink={footerLink ?? 'preferences'}
        >
            {children}
        </UserEmailLayout>
    );
}
