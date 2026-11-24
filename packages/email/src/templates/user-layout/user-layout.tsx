/**
 * The USER variant of `EmailLayout` (HOS-2565 PR-4), the owner-approved design of
 * 2026-11-23: wave header with the live wordmark and the Caveat tagline, a section
 * bar and optional illustration above the body, more vertical space, and the rich
 * footer.
 *
 * Email-client-safe as the staff layout: table layout, inline styles, hex colors
 * from `emailPalette`, images as `<img>` (never SVG or CSS backgrounds), spacing in
 * cell padding for Outlook desktop, and the 600px MSO ghost table. The one `<style>`
 * block (`user-styles.ts`) only enhances: narrow screens and dark mode.
 *
 * @module templates/user-layout/user-layout
 */

import { Body, Column, Container, Head, Html, Preview, Row } from '@react-email/components';
import { emailPalette } from '@repo/design-tokens';
import { type ReactElement, type ReactNode, useContext } from 'react';
import { EmailLayoutContext } from '../email-layout-context.js';
import { UserFooter } from './user-footer.js';
import { USER_FONT_STACK, UserHeader, UserIntro } from './user-header.js';
import { EMAIL_USER_CLASSES, EMAIL_USER_STYLE_BLOCK } from './user-styles.js';

/** Props of {@link UserEmailLayout}. */
export interface UserEmailLayoutProps {
    readonly previewText?: string;
    readonly children: ReactNode;
    /** `'none'` for readers without an account: no preferences or account link. */
    readonly footerLink: 'preferences' | 'none';
}

/** Card width Outlook desktop gets through the ghost table. */
const CARD_WIDTH = 600;
const MSO_OPEN = `<!--[if mso]><table role="presentation" width="${CARD_WIDTH}" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->`;
const MSO_CLOSE = '<!--[if mso]></td></tr></table><![endif]-->';

/**
 * Renders the user layout. Per-send data (illustration, help articles, recipient
 * verticals) comes from {@link EmailLayoutContext}.
 *
 * @param props - Preheader, body and footer mode.
 * @returns The full email document.
 */
export function UserEmailLayout({
    previewText,
    children,
    footerLink
}: UserEmailLayoutProps): ReactElement {
    const { illustration, helpArticleIds, recipientVerticals } = useContext(EmailLayoutContext);

    return (
        <Html
            lang="es"
            dir="ltr"
        >
            <Head>
                <meta
                    name="color-scheme"
                    content="light dark"
                />
                <meta
                    name="supported-color-schemes"
                    content="light dark"
                />
                {/* The ONE <style> element: button rule, narrow screens, dark mode (HOS-2565 PR-4). */}
                <style>{EMAIL_USER_STYLE_BLOCK}</style>
            </Head>
            {previewText ? <Preview>{previewText}</Preview> : null}
            <Body
                className={EMAIL_USER_CLASSES.page}
                style={bodyStyle}
                data-layout-variant="user"
            >
                <div
                    style={msoHostStyle}
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: module constant (an MSO conditional comment), never user input; React has no other way to emit a comment.
                    dangerouslySetInnerHTML={{ __html: MSO_OPEN }}
                />
                <Container
                    width="100%"
                    className={EMAIL_USER_CLASSES.card}
                    style={containerStyle}
                >
                    <UserHeader />
                    <UserIntro illustration={illustration} />
                    <Row>
                        <Column
                            className={`${EMAIL_USER_CLASSES.padded} ${EMAIL_USER_CLASSES.surface}`}
                            style={contentStyle}
                        >
                            {children}
                        </Column>
                    </Row>
                    <UserFooter
                        showAccountLinks={footerLink === 'preferences'}
                        helpArticleIds={helpArticleIds}
                        recipientVerticals={recipientVerticals}
                    />
                </Container>
                <div
                    style={msoHostStyle}
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: module constant (an MSO conditional comment), never user input; React has no other way to emit a comment.
                    dangerouslySetInnerHTML={{ __html: MSO_CLOSE }}
                />
            </Body>
        </Html>
    );
}

const bodyStyle = {
    backgroundColor: emailPalette.userPageBackground,
    fontFamily: USER_FONT_STACK,
    margin: '0',
    padding: '24px 0'
};

const msoHostStyle = {
    margin: '0',
    padding: '0'
};

const containerStyle = {
    backgroundColor: emailPalette.surface,
    color: emailPalette.text,
    fontFamily: USER_FONT_STACK,
    margin: '0 auto',
    maxWidth: '600px',
    padding: '0'
};

const contentStyle = {
    backgroundColor: emailPalette.surface,
    padding: '8px 40px 44px 40px'
};
