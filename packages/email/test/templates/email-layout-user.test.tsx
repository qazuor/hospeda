/**
 * The USER variant of EmailLayout (HOS-2565 PR-4): header, intro, dark mode,
 * footer sections, account links and the text part.
 */
import { BRAND_SOCIAL_PROFILES, BRAND_WHATSAPP_URL } from '@repo/config';
import { emailDarkPalette } from '@repo/design-tokens';
import { afterEach, describe, expect, it } from 'vitest';
import { EmailTitle } from '../../src/components/email-title.js';
import {
    configureEmailAssets,
    EMAIL_PREFERENCES_URL,
    EMAIL_PUBLIC_FAQ_URL,
    resetEmailAssets
} from '../../src/email-assets.js';
import { renderEmailBodies } from '../../src/render.js';
import { type EmailFooterLink, EmailLayout } from '../../src/templates/email-layout.js';
import type { EmailLayoutContextValue } from '../../src/templates/email-layout-context.js';
import { EMAIL_ACCOUNT_LINK_TARGETS } from '../../src/templates/user-layout/account-link.js';
import {
    buildEmailHelpArticleUrl,
    EMAIL_DEFAULT_HELP_ARTICLE_IDS
} from '../../src/templates/user-layout/help-links.js';
import {
    EMAIL_ILLUSTRATION_PATHS,
    EMAIL_USER_ASSET_PATHS
} from '../../src/templates/user-layout/user-assets.js';
import {
    EMAIL_SOCIAL_PLATFORMS,
    EMAIL_USER_PREFERENCES_LABEL
} from '../../src/templates/user-layout/user-footer.js';
import {
    EMAIL_USER_DARK_STYLE_BLOCK,
    EMAIL_USER_STYLE_BLOCK
} from '../../src/templates/user-layout/user-styles.js';

const ATTRIBUTION = {
    medium: 'transactional',
    templateKey: 'test.layout',
    includePixel: false
} as const;

/** Renders the user layout around a fixed body. */
async function renderUser(
    input: { readonly footerLink?: EmailFooterLink; readonly layout?: EmailLayoutContextValue } = {}
): Promise<{ readonly html: string; readonly text: string }> {
    return renderEmailBodies({
        attribution: ATTRIBUTION,
        ...(input.layout ? { layout: input.layout } : {}),
        react: (
            <EmailLayout
                previewText="Vista previa"
                {...(input.footerLink ? { footerLink: input.footerLink } : {})}
            >
                <EmailTitle>Título del correo</EmailTitle>
                <p>Cuerpo del mensaje</p>
                <EmailTitle>Segundo título</EmailTitle>
            </EmailLayout>
        )
    });
}

/** Opening tags of every anchor marked with the given `data-layout-link`. */
/** The visible text of the first anchor in a layout slot, tags stripped. */
function layoutAnchorText(html: string, slot: string): string | undefined {
    const match = html.match(
        new RegExp(`<a\\b[^>]*data-layout-link="${slot}"[^>]*>([\\s\\S]*?)</a>`)
    );
    return match?.[1]?.replace(/<[^>]+>/g, '').trim();
}

function layoutAnchors(html: string, slot: string): string[] {
    return html.match(new RegExp(`<a\\b[^>]*data-layout-link="${slot}"[^>]*>`, 'g')) ?? [];
}

describe('EmailLayout (user variant, HOS-2565 PR-4)', () => {
    describe('document', () => {
        it('should be the default variant, in one Spanish document marked user', async () => {
            // Act
            const { html } = await renderUser();

            // Assert
            expect(html.match(/<html[^>]*lang="es"/g)).toHaveLength(1);
            expect(html).toContain('data-layout-variant="user"');
            expect(html).toContain('Cuerpo del mensaje');
            expect(html).toContain('Vista previa');
        });

        it('should declare light and dark support and keep the ONE dark block in its own style', async () => {
            // Act
            const { html } = await renderUser();
            const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)];

            // Assert
            expect(html).toContain('<meta name="color-scheme" content="light dark"/>');
            expect(html).toContain('<meta name="supported-color-schemes" content="light dark"/>');
            expect(styles.map((match) => match[1])).toEqual([
                EMAIL_USER_STYLE_BLOCK,
                EMAIL_USER_DARK_STYLE_BLOCK
            ]);
            expect(html.match(/prefers-color-scheme:dark/g)).toHaveLength(1);
            expect(EMAIL_USER_STYLE_BLOCK).not.toContain('prefers-color-scheme');
            expect(EMAIL_USER_STYLE_BLOCK).toContain('.hospeda-btn{display:block !important;');
            expect(EMAIL_USER_STYLE_BLOCK).not.toContain('u + .body');
        });

        it('should build the dark block from classes only: no attribute selector, no *', () => {
            // Assert: Gmail drops a whole <style> over selectors like these.
            expect(EMAIL_USER_DARK_STYLE_BLOCK).not.toContain('[');
            expect(EMAIL_USER_DARK_STYLE_BLOCK).not.toContain('*');
            expect(EMAIL_USER_DARK_STYLE_BLOCK).toContain(
                `.hd-card .hd-tint{background-color:${emailDarkPalette.tintedBox} !important;`
            );
        });

        it('should turn the wordmark white in dark mode with the mockup palette', () => {
            // Assert
            expect(EMAIL_USER_DARK_STYLE_BLOCK).toContain(
                `.hd-card .hd-word{color:${emailDarkPalette.wordmark} !important;}`
            );
            expect(emailDarkPalette.wordmark.toLowerCase()).toMatch(/^#f{3}(f{3})?$/);
            expect(EMAIL_USER_DARK_STYLE_BLOCK).toContain(emailDarkPalette.surface);
        });

        it('should use only email-safe markup', async () => {
            // Act
            const { html } = await renderUser({ layout: { illustration: 'plan' } });

            // Assert
            for (const forbidden of [
                'oklch(',
                'var(--',
                'display:flex',
                'display:grid',
                '<svg',
                '{{'
            ]) {
                expect(html).not.toContain(forbidden);
            }
            expect(html).toContain('<!--[if mso]><table role="presentation" width="600"');
            expect(html).toContain('max-width:600px');
        });
    });

    describe('header and intro', () => {
        it('should draw the wave, the isotipo, the live wordmark and the tagline image', async () => {
            // Act
            const { html } = await renderUser();

            // Assert
            expect(html).toContain(EMAIL_USER_ASSET_PATHS.headerWave);
            expect(html).toContain('hospeda-isotipo@2x.png');
            expect(html).toMatch(
                /<span class="hd-word" style="[^"]*color:#003987[^"]*font-weight:700[^"]*">hospeda<\/span>/
            );
            expect(html).toContain('role="img"');
            expect(html).toContain('aria-label="Hospeda"');
            expect(html).toMatch(
                /<img[^>]*alt="Descubrí el Litoral"[^>]*tagline@2x\.png|tagline@2x\.png[^>]*alt="Descubrí el Litoral"/
            );
        });

        it('should render the declared illustration and none when absent', async () => {
            // Act
            const withIllustration = await renderUser({ layout: { illustration: 'payments' } });
            const without = await renderUser();

            // Assert
            expect(withIllustration.html).toContain('data-email-illustration="payments"');
            expect(withIllustration.html).toContain(EMAIL_ILLUSTRATION_PATHS.payments);
            expect(without.html).not.toContain('data-email-illustration');
            expect(without.html).not.toContain('/email/user/ill-');
        });

        it('should put the illustration on the first title row, to its right, centered', async () => {
            // Act
            const { html } = await renderUser({ layout: { illustration: 'payments' } });
            const row = html.slice(
                html.indexOf('data-email-title="true"'),
                html.indexOf('Cuerpo del mensaje')
            );

            // Assert: one title row, bar + heading cell first, illustration cell after.
            expect(html.match(/data-email-title="true"/g)).toHaveLength(1);
            expect(row).toMatch(
                /<td style="vertical-align:middle"><table[^>]*>[\s\S]*width="36"[\s\S]*Título del correo<\/h1><\/td><td[^>]*data-email-illustration="payments"/
            );
            expect(row).toMatch(
                /<td[^>]*style="[^"]*vertical-align:middle[^"]*"[^>]*data-email-illustration="payments"/
            );
            expect(row).not.toContain('Segundo título');
            expect(html).toMatch(/<h1[^>]*>Segundo título<\/h1>/);
        });

        it('should shrink the illustration to 84px on narrow screens', () => {
            // Assert
            expect(EMAIL_USER_STYLE_BLOCK).toContain(
                '.hd-ill{width:84px !important;height:84px !important;}'
            );
            expect(EMAIL_USER_STYLE_BLOCK).toContain('.hd-illcell{width:84px !important;');
        });

        it('should render a plain heading for EmailTitle outside the user layout', async () => {
            // Act
            const { html } = await renderEmailBodies({
                attribution: ATTRIBUTION,
                layout: { illustration: 'payments' },
                react: (
                    <EmailLayout variant="staff">
                        <EmailTitle>Solo título</EmailTitle>
                    </EmailLayout>
                )
            });

            // Assert
            expect(html).not.toContain('data-email-title');
            expect(html).not.toContain('data-email-illustration');
            expect(html).toMatch(/<h1[^>]*>Solo título<\/h1>/);
        });
    });

    describe('footer', () => {
        it('should render the help row with the help center, contact and WhatsApp', async () => {
            // Act
            const { html } = await renderUser();

            // Assert
            expect(html).toContain('¿Necesitás ayuda?');
            expect(layoutAnchors(html, 'help-center')).toHaveLength(1);
            expect(layoutAnchors(html, 'contact')).toHaveLength(1);
            expect(html).toContain(`href="${BRAND_WHATSAPP_URL}"`);
        });

        it('should link the logged-in help center and show the FAQ for account holders', async () => {
            // Act
            const { html } = await renderUser();

            // Assert
            expect(layoutAnchors(html, 'help-center')[0]).toContain(
                'href="https://hospeda.com.ar/es/mi-cuenta/ayuda/?utm_source='
            );
            expect(layoutAnchorText(html, 'help-center')).toBe('Centro de ayuda');
            expect(html).toContain('data-layout-faq="true"');
        });

        it('should hide the FAQ and link the public FAQ page when the reader has no account', async () => {
            // Act: the help articles sit behind the login wall (HOS-2565 §8.3).
            const { html, text } = await renderUser({ footerLink: 'none' });

            // Assert
            expect(html).not.toContain('data-layout-faq');
            expect(layoutAnchors(html, 'faq')).toHaveLength(0);
            expect(html).not.toContain('/mi-cuenta/ayuda/');
            expect(layoutAnchors(html, 'help-center')[0]).toContain(
                `href="${EMAIL_PUBLIC_FAQ_URL}?utm_source=`
            );
            // HOS-2580 §I: the link names the page it opens.
            expect(layoutAnchorText(html, 'help-center')).toBe('Preguntas frecuentes');
            expect(html).not.toContain('Centro de ayuda');
            expect(text).not.toContain('/mi-cuenta/');
        });

        it('should fall back to the default FAQ set when the mail declares none', async () => {
            // Act
            const { html } = await renderUser();

            // Assert
            for (const id of EMAIL_DEFAULT_HELP_ARTICLE_IDS) {
                expect(html).toContain(`href="${buildEmailHelpArticleUrl({ id })}?utm_source=`);
            }
        });

        it('should render the declared FAQ articles and skip unknown ids', async () => {
            // Act
            const { html } = await renderUser({
                layout: { helpArticleIds: ['addons', 'no-such-article', 'calendar'] }
            });

            // Assert
            expect(html).toContain('Comprar o dar de baja un complemento');
            expect(html).toContain(buildEmailHelpArticleUrl({ id: 'calendar' }));
            expect(html).not.toContain('no-such-article');
            expect(html).not.toContain(buildEmailHelpArticleUrl({ id: 'help-center' }));
        });

        it('should render the channel cards and the trust strip', async () => {
            // Act
            const { html } = await renderUser();

            // Assert
            for (const label of [
                'Nuestros canales',
                'Seguridad',
                'Soporte local en español',
                'Pagos seguros',
                'Sin comisiones ocultas'
            ]) {
                expect(html).toContain(label);
            }
        });

        it('should link Instagram, Facebook and X only, from @repo/config', async () => {
            // Act
            const { html } = await renderUser();

            // Assert
            expect(EMAIL_SOCIAL_PLATFORMS).toEqual(['instagram', 'facebook', 'x']);
            for (const profile of BRAND_SOCIAL_PROFILES) {
                const shown = (EMAIL_SOCIAL_PLATFORMS as readonly string[]).includes(
                    profile.platform
                );
                expect(html.includes(`href="${profile.url}"`)).toBe(shown);
            }
        });

        it('should show the preferences and account links by default', async () => {
            // Act
            const { html } = await renderUser();

            // Assert
            expect(html).toContain('Recibís este correo porque tenés una cuenta en Hospeda.');
            const [preferences] = layoutAnchors(html, 'preferences');
            expect(preferences).toContain(`href="${EMAIL_PREFERENCES_URL}?utm_source=email`);
            expect(html).toContain(`>${EMAIL_USER_PREFERENCES_LABEL}</a>`);
            expect(layoutAnchors(html, 'account')).toHaveLength(1);
            expect(html).toContain(`>${EMAIL_ACCOUNT_LINK_TARGETS.account.label}</a>`);
            expect(html).toMatch(
                new RegExp(`© (<!-- -->)?${new Date().getFullYear()}(<!-- -->)? Hospeda`)
            );
        });

        it('should pick "Gestioná tus publicaciones" from the recipient verticals (D16)', async () => {
            // Act
            const owner = await renderUser({ layout: { recipientVerticals: ['accommodation'] } });
            const partner = await renderUser({ layout: { recipientVerticals: ['partner'] } });

            // Assert
            expect(owner.html).toContain(EMAIL_ACCOUNT_LINK_TARGETS.publications.href);
            expect(owner.html).toContain(`>${EMAIL_ACCOUNT_LINK_TARGETS.publications.label}</a>`);
            expect(partner.html).toContain(`>${EMAIL_ACCOUNT_LINK_TARGETS.account.label}</a>`);
        });

        it('should hide the account sentence and links when footerLink is none', async () => {
            // Act
            const { html, text } = await renderUser({ footerLink: 'none' });

            // Assert
            expect(layoutAnchors(html, 'preferences')).toHaveLength(0);
            expect(layoutAnchors(html, 'account')).toHaveLength(0);
            expect(html).not.toContain('tenés una cuenta en Hospeda');
            expect(text).not.toContain(EMAIL_USER_PREFERENCES_LABEL);
            expect(html).toContain('© ');
        });
    });

    describe('text part', () => {
        it('should keep every image and asset URL out, and the links in', async () => {
            // Act
            const { text } = await renderUser({ layout: { illustration: 'plan' } });

            // Assert
            expect(text).toContain('Cuerpo del mensaje');
            expect(text).toContain(EMAIL_USER_PREFERENCES_LABEL);
            expect(text).not.toContain('/email/');
            expect(text).not.toContain('.png');
            expect(text).not.toContain('Descubrí el Litoral');
            expect(text.split('\n').some((line) => line.trim() === 'hospeda')).toBe(false);
            expect(text).not.toContain('@media');
        });
    });
    describe('asset origin (AC-4.3)', () => {
        afterEach(() => {
            resetEmailAssets();
        });

        it('should load every user image from the configured origin, links stay on production', async () => {
            // Arrange
            configureEmailAssets({ siteUrl: 'https://staging.hospeda.com.ar' });

            // Act
            const { html } = await renderUser({ layout: { illustration: 'alerts' } });
            const sources = [...html.matchAll(/<img\b[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);

            // Assert
            expect(sources.length).toBeGreaterThan(10);
            for (const src of sources) {
                expect(src).toMatch(/^https:\/\/staging\.hospeda\.com\.ar\/email\//);
            }
            expect(html).toContain(`href="${EMAIL_PREFERENCES_URL}?utm_source=email`);
        });
    });
});
