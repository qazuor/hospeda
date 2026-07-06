/**
 * @file destinos-attractions-filter-chip.test.ts
 * @description Source-based assertions for the destinos attraction quick-filter
 * chip row (BETA-113 visual unification).
 *
 * BETA-113 unifies the visual treatment of the quick-filter chip row that sits
 * above each listing grid (alojamientos / destinos / eventos-publicaciones)
 * into ONE canonical look: neutral --core-card surface at rest, solid
 * --brand-accent surface (active/hover), pill shape, optional leading icon.
 * This file guards the destinos surface specifically — behavior (client-side,
 * additive, multi-select AND filtering; no page reload) is explicitly OUT of
 * scope and must remain fully intact.
 *
 * Astro components cannot be rendered in Vitest — we assert against source text.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../src/pages/[lang]/destinos/index.astro'), 'utf8');

describe('destinos/index.astro — attraction quick-filter chip', () => {
    describe('BETA-113 canonical visual treatment', () => {
        it('uses the canonical neutral --core-card surface at rest', () => {
            expect(src).toMatch(
                /\.dest-attractions-filter__badge\s*\{[^}]*background-color:\s*var\(--core-card\)/
            );
        });

        it('uses a subtle --border token at rest (not the previous --surface-warm tint)', () => {
            expect(src).toMatch(
                /\.dest-attractions-filter__badge\s*\{[^}]*border:\s*1px solid var\(--border/
            );
        });

        it('uses the canonical solid --brand-accent surface on hover', () => {
            expect(src).toMatch(
                /\.dest-attractions-filter__badge:hover\s*\{[^}]*background-color:\s*var\(--brand-accent\)/
            );
            expect(src).toMatch(
                /\.dest-attractions-filter__badge:hover\s*\{[^}]*color:\s*var\(--accent-foreground\)/
            );
        });

        it('uses the canonical solid --brand-accent surface when active', () => {
            expect(src).toMatch(
                /\.dest-attractions-filter__badge--active,\s*\n?\s*\.dest-attractions-filter__badge--active:hover\s*\{[^}]*background-color:\s*var\(--brand-accent\)/
            );
        });

        it('uses --radius-pill for the chip shape', () => {
            expect(src).toMatch(
                /\.dest-attractions-filter__badge,\s*\n?\s*\.dest-attractions-filter__more-toggle\s*\{[^}]*border-radius:\s*var\(--radius-pill\)/
            );
        });

        it('uses the same font-size token as the other two unified chip surfaces (--text-body-sm)', () => {
            expect(src).toMatch(
                /\.dest-attractions-filter__badge,\s*\n?\s*\.dest-attractions-filter__more-toggle\s*\{[^}]*font-size:\s*var\(--text-body-sm\)/
            );
        });

        it('keeps the optional leading icon slot (destinos is the one surface that keeps its icon)', () => {
            expect(src).toContain('dest-attractions-filter__badge-icon');
            expect(src).toContain('getAttractionIcon');
        });

        it('references BETA-113 in the unification comment', () => {
            expect(src).toContain('BETA-113');
        });
    });

    describe('regression guard — behavior unchanged', () => {
        it('still renders chips as anchors with a real href (no-JS fallback intact)', () => {
            expect(src).toContain('buildBadgeHref(attr.id)');
        });

        it('still drives the multi-select AND filtering via inline client-side script (no reload)', () => {
            expect(src).toContain('<script is:inline');
            expect(src).toContain('AND semantics');
            expect(src).toContain('window.history.pushState');
        });

        it('still keeps the client-side reconcile function additive/multi-select (no single-select collapse)', () => {
            expect(src).toContain('nextActive.add(id)');
            expect(src).toContain('nextActive.delete(id)');
        });

        it('still marks the active state via aria-current for accessibility', () => {
            expect(src).toContain("aria-current={active ? 'true' : undefined}");
        });

        it('still carries data-attraction-id on every chip for the inline script selector', () => {
            expect(src).toContain('data-attraction-id={attr.id}');
        });
    });
});
