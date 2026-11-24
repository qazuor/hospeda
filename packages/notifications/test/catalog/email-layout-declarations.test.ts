/**
 * HOS-2565 PR-4: the user layout declarations of the email catalog. A declared help
 * id must have an article, an override must name a real entry, and the context the
 * preview and the transport build must carry exactly what was declared.
 */
import { EMAIL_ILLUSTRATIONS, resolveEmailHelpLinks } from '@repo/email';
import { describe, expect, it } from 'vitest';
import { EMAIL_CATALOG } from '../../src/catalog/catalog.js';
import {
    buildEmailCatalogLayout,
    EMAIL_DOMAIN_LAYOUT,
    EMAIL_KEY_LAYOUT,
    type EmailLayoutDeclaration
} from '../../src/catalog/layout-declarations.js';

const ALL_DECLARATIONS: ReadonlyArray<readonly [string, EmailLayoutDeclaration]> = [
    ...Object.entries(EMAIL_DOMAIN_LAYOUT).map(
        ([domain, declaration]) => [`domain:${domain}`, declaration] as const
    ),
    ...Object.entries(EMAIL_KEY_LAYOUT).map(([key, declaration]) => [key, declaration] as const)
];

const DECLARED_HELP_IDS = [
    ...new Set(ALL_DECLARATIONS.flatMap(([, declaration]) => declaration.helpArticleIds ?? []))
];

describe('email catalog layout declarations (HOS-2565 PR-4)', () => {
    it.each(DECLARED_HELP_IDS)('should point help id "%s" at an existing article', (id) => {
        // Act
        const { links } = resolveEmailHelpLinks({ ids: [id] });

        // Assert
        expect(links[0]?.id).toBe(id);
    });

    it.each(
        ALL_DECLARATIONS
    )('should declare 3 to 4 help ids, or none, for %s', (_, declaration) => {
        // Assert
        if (declaration.helpArticleIds) {
            expect(declaration.helpArticleIds.length).toBeGreaterThanOrEqual(3);
            expect(declaration.helpArticleIds.length).toBeLessThanOrEqual(4);
            expect(new Set(declaration.helpArticleIds).size).toBe(
                declaration.helpArticleIds.length
            );
        }
    });

    it.each(
        ALL_DECLARATIONS
    )('should declare a known illustration, or none, for %s', (_, declaration) => {
        // Assert
        if (declaration.illustration) {
            expect(EMAIL_ILLUSTRATIONS).toContain(declaration.illustration);
        }
    });

    it('should override only entries that exist and read user', () => {
        // Arrange
        const entries = new Map(EMAIL_CATALOG.map((entry) => [entry.key, entry]));

        // Assert
        for (const key of Object.keys(EMAIL_KEY_LAYOUT)) {
            expect(entries.get(key as never)?.audience, key).toBe('user');
        }
    });

    it('should give every user entry help articles, its own or the default set', () => {
        // Arrange
        const userEntries = EMAIL_CATALOG.filter((entry) => entry.audience === 'user');

        // Act & Assert
        for (const entry of userEntries) {
            const layout = buildEmailCatalogLayout({ entry });
            const { links } = resolveEmailHelpLinks(
                layout.helpArticleIds ? { ids: layout.helpArticleIds } : {}
            );
            expect(links.length, entry.key).toBeGreaterThanOrEqual(3);
        }
    });

    it('HOS-2580 gives every auth and security mail the account illustration', () => {
        // Act
        const auth = EMAIL_CATALOG.filter((entry) => entry.domain === 'auth');

        // Assert: reset password and verify email today; a new auth mail inherits it.
        expect(auth.map((entry) => entry.key)).toEqual(
            expect.arrayContaining(['auth.reset-password', 'auth.verify-email'])
        );
        for (const entry of auth) {
            expect(buildEmailCatalogLayout({ entry }).illustration, entry.key).toBe('account');
        }
    });

    it('should prefer the key override over the domain default', () => {
        // Act
        const downgrade = buildEmailCatalogLayout({
            entry: { key: 'notification.plan_downgrade_limit_warning', domain: 'billing' }
        });
        const payment = buildEmailCatalogLayout({
            entry: { key: 'notification.payment_success', domain: 'billing' }
        });

        // Assert
        expect(downgrade.illustration).toBe('plan');
        expect(payment.illustration).toBe('payments');
        expect(payment.helpArticleIds).toEqual(EMAIL_DOMAIN_LAYOUT.billing.helpArticleIds);
    });

    it('should carry the recipient verticals only when given, and nothing for an unknown key', () => {
        // Act
        const withVerticals = buildEmailCatalogLayout({
            entry: { key: 'notification.payment_success', domain: 'billing' },
            recipientVerticals: ['accommodation']
        });
        const unknown = buildEmailCatalogLayout({});

        // Assert
        expect(withVerticals.recipientVerticals).toEqual(['accommodation']);
        expect(unknown).toEqual({});
    });

    it('should declare one D16 scenario per account-link case', () => {
        // Arrange
        const payment = EMAIL_CATALOG.find((entry) => entry.key === 'notification.payment_success');

        // Act
        const verticals = payment?.scenarios.map((scenario) => scenario.recipientVerticals);

        // Assert
        expect(verticals).toEqual(
            expect.arrayContaining([['accommodation'], ['partner'], ['tourist']])
        );
    });
});
