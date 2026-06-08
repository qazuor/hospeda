/**
 * @file PropertyCard.test.ts
 * @description Integration tests for PropertyCard.astro — verifies admin-only
 * edit links were removed (SPEC-205 Phase 4) and that web-native actions remain.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const propertyCardSource = readFileSync(
    resolve(__dirname, '../../../src/components/host/PropertyCard.astro'),
    'utf8'
);

describe('PropertyCard.astro — SPEC-205 Phase 4 funnel polish', () => {
    it('should NOT contain an admin-only edit link', () => {
        // The edit link pointed to admin: /accommodations/{id}/edit
        // This was removed because there is no web editor yet (SPEC-208)
        expect(propertyCardSource).not.toContain('editUrl');
        expect(propertyCardSource).not.toMatch(/href=\{editUrl\}/);
    });

    it('should NOT render an "Editar" action button', () => {
        // The edit button text should not appear in the template actions section
        expect(propertyCardSource).not.toMatch(/actions\.edit.*Editar/);
    });

    it('should still contain the publish link for DRAFT properties', () => {
        // Publish action routes to admin for the publish flow (SPEC-205 P1)
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

    it('should reference the admin panel only for publish, not for edit', () => {
        // Only publishUrl should reference adminBase — edit was removed
        // adminBase appears in: the comment, the const declaration, and publishUrl
        // But NOT in an editUrl
        expect(propertyCardSource).not.toContain('editUrl =');
    });
});
