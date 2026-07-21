/**
 * @file PublishPrecheckPanel.test.ts
 * @description Source-string checks for PublishPrecheckPanel.astro (BETA-197).
 * Astro components cannot be rendered in Vitest, so this asserts the
 * component wires the pure content resolver, mounts `DeleteButton` for the
 * delete-draft action, and never uses `client:load` on anything besides
 * that one interactive island (everything else — the panel body, the
 * primary/secondary links — must stay plain SSR markup, no JS).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const panelSource = readFileSync(
    resolve(__dirname, '../../../src/components/host/PublishPrecheckPanel.astro'),
    'utf8'
);

describe('PublishPrecheckPanel.astro', () => {
    it('derives its content from the pure resolvePrecheckPanelContent helper', () => {
        expect(panelSource).toContain('resolvePrecheckPanelContent');
        expect(panelSource).toContain("from '@/lib/host/publish-precheck-panel-content'");
    });

    it('resolves every action label/title through t() with a Spanish fallback', () => {
        expect(panelSource).toContain('createTranslations');
        expect(panelSource).toMatch(/t\(content\.titleKey, content\.titleFallback\)/);
    });

    it('mounts the shared DeleteButton island (not a bespoke component) for the delete-draft action', () => {
        expect(panelSource).toContain('DeleteButton');
        expect(panelSource).toContain("from '@/components/host/DeleteButton.client'");
        expect(panelSource).toMatch(/<DeleteButton[\s\S]*client:load/);
    });

    it('renders plain <a href> links for every non-delete action — no extra client JS', () => {
        expect(panelSource).toContain('action.href');
        expect(panelSource).toContain("action.kind === 'link'");
    });

    it('only ever mounts one client directive (client:load on DeleteButton)', () => {
        const clientDirectiveMatches =
            panelSource.match(/client:(load|visible|idle|media|only)/g) ?? [];
        expect(clientDirectiveMatches).toEqual(['client:load']);
    });

    it('shows the draft context list only when there is more than one draft', () => {
        expect(panelSource).toContain('drafts.length > 1');
    });
});
