/**
 * @file account-layout-owner-nav.test.ts
 * @description Source-level tests for the AccountLayout navigation update
 * (SPEC-206 PR2). Verifies that the owner conversations link is added
 * under the "Anfitrión" nav group.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, '../../src/layouts/AccountLayout.astro'), 'utf8');

describe('AccountLayout — owner conversations nav (SPEC-206)', () => {
    it('has a "Anfitrión" nav group', () => {
        expect(source).toContain('groupHost');
    });

    it('includes a "Consultas" entry in the Anfitrión group', () => {
        // The entry should link to consultas-propietario
        expect(source).toContain('consultas-propietario');
    });

    it('uses ChatIcon for the owner conversations nav entry', () => {
        // Check that ChatIcon is imported and used in the host group
        expect(source).toContain('ChatIcon');
    });

    it('the owner conversations entry has section "owner-messages"', () => {
        expect(source).toContain("section: 'owner-messages'");
    });

    it('uses i18n key for the nav label', () => {
        // The label should come from i18n, not be hardcoded
        expect(source).toMatch(/conversations\.inbox\.ownerInboxTitle|account\.nav\.ownerMessages/);
    });

    it('the entry is only shown for users with accommodation access', () => {
        // The host group is conditionally shown based on showPropertiesNav
        expect(source).toContain('showPropertiesNav');
    });
});
