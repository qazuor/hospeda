/**
 * @file breadcrumbs-coverage.test.ts
 * @description Integration test asserting that all sub-routes and detail pages
 * declared in SPEC-096 REQ-096-19 (T-029, T-030, T-031) have a Breadcrumbs
 * import and usage in their source.
 *
 * These are source-based assertions (read file, check content) — no DOM
 * renderer is used because Astro components cannot be rendered in Vitest.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES_DIR = resolve(__dirname, '../../src/pages/[lang]');

/**
 * Reads an Astro page source file relative to the [lang] pages directory.
 */
function readPage(relativePath: string): string {
    return readFileSync(resolve(PAGES_DIR, relativePath), 'utf8');
}

/**
 * Checks that a page source imports Breadcrumbs from the shared navigation
 * component and uses it.
 */
function assertHasBreadcrumbs(src: string, pageDescription: string): void {
    expect(src, `${pageDescription}: must import Breadcrumbs`).toContain('Breadcrumbs.astro');
    expect(src, `${pageDescription}: must use <Breadcrumbs`).toContain('<Breadcrumbs');
}

// ─── T-029: Accommodation pages ─────────────────────────────────────────────

describe('T-029 — Accommodation sub-routes and detail pages', () => {
    it('alojamientos/[slug] has Breadcrumbs with accommodation name', () => {
        const src = readPage('alojamientos/[slug].astro');
        assertHasBreadcrumbs(src, 'alojamientos/[slug]');
        // Items must include accommodations and the entity name
        expect(src).toContain('accommodation.name');
    });

    it('alojamientos/tipo/[type] has Breadcrumbs with type label', () => {
        const src = readPage('alojamientos/tipo/[type]/index.astro');
        assertHasBreadcrumbs(src, 'alojamientos/tipo/[type]');
        expect(src).toContain('typeLabel');
    });

    it('alojamientos/comodidades/[slug] has Breadcrumbs with amenities level and amenity name', () => {
        const src = readPage('alojamientos/comodidades/[slug]/index.astro');
        assertHasBreadcrumbs(src, 'alojamientos/comodidades/[slug]');
        // Must include the intermediate "Comodidades" level
        expect(src).toContain("t('accommodations.amenities'");
        expect(src).toContain('amenityName');
    });

    it('alojamientos/caracteristicas/[slug] has Breadcrumbs with features level and feature name', () => {
        const src = readPage('alojamientos/caracteristicas/[slug]/index.astro');
        assertHasBreadcrumbs(src, 'alojamientos/caracteristicas/[slug]');
        // Must include the intermediate "Características" level
        expect(src).toContain("t('accommodations.features'");
        expect(src).toContain('featureName');
    });
});

// ─── T-030: Destination and attraction pages ────────────────────────────────

describe('T-030 — Destination and attraction pages', () => {
    it('destinos/[...path] has Breadcrumbs with path segments', () => {
        const src = readPage('destinos/[...path].astro');
        assertHasBreadcrumbs(src, 'destinos/[...path]');
        expect(src).toContain('breadcrumbItems');
    });

    it('destinos/[slug]/alojamientos has Breadcrumbs with destination name', () => {
        const src = readPage('destinos/[slug]/alojamientos/index.astro');
        assertHasBreadcrumbs(src, 'destinos/[slug]/alojamientos');
        expect(src).toContain('destName');
    });

    it('destinos/[slug]/eventos has Breadcrumbs with destination name', () => {
        const src = readPage('destinos/[slug]/eventos/index.astro');
        assertHasBreadcrumbs(src, 'destinos/[slug]/eventos');
        expect(src).toContain('destName');
    });

    it('destinos/atraccion/[slug] has Breadcrumbs with attraction name', () => {
        const src = readPage('destinos/atraccion/[slug]/index.astro');
        assertHasBreadcrumbs(src, 'destinos/atraccion/[slug]');
        expect(src).toContain('name');
    });
});

// ─── T-031: Events, posts, and author pages ──────────────────────────────────

describe('T-031 — Events, posts, and author pages', () => {
    it('eventos/[slug] has Breadcrumbs with event title', () => {
        const src = readPage('eventos/[slug].astro');
        assertHasBreadcrumbs(src, 'eventos/[slug]');
        // Event name/title is stored in `name`
        expect(src).toContain('{ label: name }');
    });

    // eventos/categoria/[category] was retired to a 301 redirect (U7) — it no
    // longer renders breadcrumbs (or any UI). Category filtering lives on the
    // unified /eventos/ listing.

    it('publicaciones/[slug] has Breadcrumbs with post title', () => {
        const src = readPage('publicaciones/[slug].astro');
        assertHasBreadcrumbs(src, 'publicaciones/[slug]');
        expect(src).toContain('{ label: title }');
    });

    it('publicaciones/categoria/[category] has Breadcrumbs with category label', () => {
        const src = readPage('publicaciones/categoria/[category]/index.astro');
        assertHasBreadcrumbs(src, 'publicaciones/categoria/[category]');
        expect(src).toContain('catLabel');
    });

    it('publicaciones/etiqueta/[tag] has Breadcrumbs with tags level and tag label', () => {
        const src = readPage('publicaciones/etiqueta/[tag]/index.astro');
        assertHasBreadcrumbs(src, 'publicaciones/etiqueta/[tag]');
        // Must include the intermediate "Etiquetas" level
        expect(src).toContain("t('blog.detail.tags'");
        expect(src).toContain('tagName');
    });

    it('publicaciones/autor/[slug] has Breadcrumbs with author level and author name', () => {
        const src = readPage('publicaciones/autor/[slug]/index.astro');
        assertHasBreadcrumbs(src, 'publicaciones/autor/[slug]');
        // Must include the intermediate "Autor" level
        expect(src).toContain("t('blog.details.author'");
        expect(src).toContain('authorName');
    });
});

// ─── Structural contract ─────────────────────────────────────────────────────

describe('Breadcrumbs component contract', () => {
    it('shared/navigation/Breadcrumbs.astro uses locale-aware home label', () => {
        const breadcrumbsSrc = readFileSync(
            resolve(__dirname, '../../src/components/shared/navigation/Breadcrumbs.astro'),
            'utf8'
        );
        // Must auto-prepend Inicio item
        expect(breadcrumbsSrc).toContain('homeItem');
        // Must accept locale prop
        expect(breadcrumbsSrc).toContain('locale');
        // Must render nav with breadcrumb role
        expect(breadcrumbsSrc).toContain('aria-label');
    });
});
