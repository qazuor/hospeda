/**
 * @file PropertyCard.test.ts
 * @description Integration tests for PropertyCard.astro — verifies admin-only
 * edit links were removed (SPEC-205 Phase 4) and that web-native edit link
 * was added (SPEC-208 PR2).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const propertyCardSource = readFileSync(
    resolve(__dirname, '../../../src/components/host/PropertyCard.astro'),
    'utf8'
);

describe('PropertyCard.astro — SPEC-205 Phase 4 + SPEC-208 PR2', () => {
    it('should NOT contain an admin-only edit link', () => {
        // The old edit link pointed to admin: /accommodations/{id}/edit
        // SPEC-208 PR2 replaced it with a web editor link using buildUrl
        // publishUrl still uses adminBase, but editUrl must use buildUrl
        expect(propertyCardSource).not.toMatch(/editUrl.*adminBase/);
    });

    it('should contain a web editor link using buildUrl', () => {
        // SPEC-208 PR2: edit link routes to the web editor page
        expect(propertyCardSource).toContain('editUrl');
        expect(propertyCardSource).toContain('mi-cuenta/propiedades/');
        expect(propertyCardSource).toContain('/editar');
    });

    it('should render an "Editar" action button', () => {
        // The edit button text should appear in the template actions section
        expect(propertyCardSource).toContain('host.properties.card.actions.edit');
    });

    it('should still contain the publish link for DRAFT properties', () => {
        expect(propertyCardSource).toContain('publishUrl');
        expect(propertyCardSource).toContain('host.properties.card.actions.publish');
    });

    it('should still contain the view-on-site link for ACTIVE properties', () => {
        expect(propertyCardSource).toContain('viewOnSiteUrl');
        expect(propertyCardSource).toContain('host.properties.card.actions.viewOnSite');
    });

    it('should still contain the unpublish link for ACTIVE properties', () => {
        expect(propertyCardSource).toContain('unpublishUrl');
        expect(propertyCardSource).toContain('host.properties.card.actions.unpublish');
    });
});
