/** Source contracts for the Astro shells and lane D's responsive layouts. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(__dirname, '../../src', file), 'utf8');

describe('short account pages', () => {
    it.each([
        ['AccountShell', 'account-shell'],
        ['FocusShell', 'focus-content']
    ])('%s fills the viewport and lets main grow before the footer', (shell, marker) => {
        const css = read(`layouts/${shell}.module.css`);
        expect(css).toContain('@import "./AccountPageFrame.module.css"');
        const frame = read('layouts/AccountPageFrame.module.css');
        expect(frame).toContain(`[data-${marker}]`);
        expect(frame).toMatch(/flex-direction: column;\s*min-block-size: 100dvh/);
        expect(frame).toMatch(/> main\s*\{\s*flex: 1/);
    });

    it('keeps add-password in FocusShell and the password rule in the hint only', () => {
        expect(read('pages/[lang]/mi-cuenta/agregar-contrasena/index.astro')).toContain(
            '<FocusShell'
        );
        const form = read('components/account/SetPassword.client.tsx');
        expect(form).toContain('account.setPassword.fields.passwordHint');
        expect(form).not.toContain('account.setPassword.fields.passwordPlaceholder');
    });

    it('uses kit links for password and editor navigation and AI history', () => {
        expect(read('components/auth/ChangePasswordForm.client.tsx')).toMatch(
            /actions=\{\s*forced[\s\S]*?<LinkButton/
        );
        expect(read('layouts/EditorShellLayout.astro')).toMatch(
            /slot="actions"[\s\S]*?<LinkButton/
        );
        const activity = read('components/account/AiActivityItem.tsx');
        expect(activity).toContain('<TextLink');
        expect(activity).not.toMatch(/<a\s/);
    });

    it('uses an actionable partner empty state and regular-sized discovery CTAs', () => {
        const partner = read('pages/[lang]/mi-cuenta/partner/index.astro');
        expect(partner).toMatch(/<EmptyState[\s\S]*?action=\{\s*<LinkButton/);
        expect(read('components/account/DiscoveryDoorHub.astro')).not.toContain('size="sm"');
    });
});

describe('inbox and provider presentation', () => {
    it.each(['consultas', 'consultas-propietario', 'resenas'])('%s has a page subtitle', (page) => {
        expect(read(`pages/[lang]/mi-cuenta/${page}/index.astro`)).toMatch(
            /<PageHeader[^>]+description=/
        );
    });

    it('keeps the composer in the messages Section and aligns send with the counter', () => {
        const panel = read('components/account/conversations/ConversationPanel.client.tsx');
        expect(panel).toMatch(/<Section[\s\S]*?<Composer[\s\S]*?<\/Section>/);
        const css = read('components/account/conversations/ConversationPanel.module.css');
        expect(css).toMatch(/\.panel \.composer\s*\{\s*position: static/);
        expect(css).toMatch(/\.composer > div:last-child\s*\{\s*align-items: flex-end/);
    });

    it('uses subheadings without nested card surfaces in the provider form', () => {
        const form = read('components/account/HostTradeEditForm.client.tsx');
        expect(form.match(/<h3\b/g)).toHaveLength(3);
        expect(read('components/account/HostTradeEditForm.module.css')).not.toContain(
            'composes: card'
        );
    });

    it('provides a back action, key/value summary and compact usage submit', () => {
        const page = read(
            'pages/[lang]/mi-cuenta/directorio-proveedores/[slug]/registrar-uso/index.astro'
        );
        expect(page).toContain('<KeyValueList');
        expect(page).toContain('<LinkButton slot="actions"');
        expect(read('components/host/host-trades/RegisterUsageForm.module.css')).toContain(
            'align-self: flex-start'
        );
    });

    it('keeps reviews in a Section, mobile filters scrollable and card schedules aligned', () => {
        expect(read('pages/[lang]/mi-cuenta/directorio-proveedores/[slug]/index.astro')).toMatch(
            /<Section[^>]+helpId="section:hosttrade.reviews"[\s\S]*?<DirectoryReviewsList/
        );
        const css = read('components/host/host-trades/TradesDirectory.module.css');
        expect(css).toMatch(
            /@container \(width < 40rem\)[\s\S]*?flex-wrap: nowrap;[\s\S]*?overflow-x: auto/
        );
        expect(read('components/host/host-trades/TradeCard.module.css')).toContain(
            'min-block-size: 1lh'
        );
    });
});
