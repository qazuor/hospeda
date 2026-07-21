/**
 * @file publicar-nueva.test.ts
 * @description Source-string checks for pages/[lang]/publicar/nueva.astro
 * (BETA-197). Astro pages cannot be rendered in Vitest, so this asserts the
 * precheck-driven branching: the page calls the precheck endpoint BEFORE
 * rendering anything, fails open to `create_direct` on error, only bypasses
 * the panel via `?create=1` for the two decisions that actually offer a
 * "create new" choice, and renders the onboarding form or the precheck
 * panel — never both, never neither.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/publicar/nueva.astro'),
    'utf8'
);

describe('pages/[lang]/publicar/nueva.astro — BETA-197 precheck gate', () => {
    it('calls hostOnboardingApi.precheck before deciding what to render', () => {
        expect(pageSource).toContain('hostOnboardingApi.precheck');
    });

    it('fails open to create_direct when the precheck fetch is unavailable', () => {
        expect(pageSource).toMatch(
            /decision:\s*HostOnboardingPrecheckDecision\s*=\s*'create_direct'/
        );
    });

    it('only honors ?create=1 for resume_or_create and pick_draft_or_create', () => {
        expect(pageSource).toContain("Astro.url.searchParams.get('create') === '1'");
        expect(pageSource).toContain("decision === 'resume_or_create'");
        expect(pageSource).toContain("decision === 'pick_draft_or_create'");
    });

    it('renders CreatePropertyMiniForm when showForm is true, PublishPrecheckPanel otherwise', () => {
        expect(pageSource).toMatch(/\{showForm \? \(/);
        expect(pageSource).toContain('<CreatePropertyMiniForm');
        expect(pageSource).toContain('<PublishPrecheckPanel');
    });

    it('no longer contains the retired ad-hoc F4 at-limit-panel markup', () => {
        expect(pageSource).not.toContain('at-limit-panel');
        expect(pageSource).not.toContain('isAtAccommodationLimit');
    });

    it('builds the single-draft edit URL under mi-cuenta/propiedades/:id/editar (the FULL edit page, not the onboarding wizard)', () => {
        expect(pageSource).toMatch(/mi-cuenta\/propiedades\/\$\{firstDraft\.id\}\/editar/);
    });
});
