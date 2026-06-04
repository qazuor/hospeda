/**
 * @file contributions-i18n.test.ts
 * @description Key-presence test for the `contributions` namespace
 * (SPEC-191 FR-10).
 *
 * Guards that every contributions.* key referenced by apps/web actually
 * exists in the authoritative es file, so no raw key (or stale inline
 * fallback) ever surfaces. en/pt key parity + placeholder preservation is
 * covered automatically by key-coverage.test.ts once the namespace files
 * exist.
 */

import { describe, expect, it } from 'vitest';
import { namespaces } from '../src/config';
import esContributions from '../src/locales/es/contributions.json';

/**
 * Every contributions.* key referenced in apps/web source (grep-collected,
 * SPEC-191 T-014). The namespace prefix is stripped — these are paths inside
 * contributions.json.
 */
const USED_KEYS = [
    'back',
    'banner.editors.cta',
    'banner.editors.description',
    'banner.editors.title',
    'banner.editorsEvents.description',
    'banner.photos.cta',
    'banner.photos.description',
    'banner.photos.title',
    'banner.photosListing.description',
    'banner.photosListing.title',
    'editors.description',
    'editors.form.heading',
    'editors.form.hint',
    'editors.heading',
    'editors.role.heading',
    'editors.role.item1',
    'editors.role.item2',
    'editors.role.item3',
    'editors.subtitle',
    'editors.tagline',
    'editors.title',
    'form.ariaLabel',
    'form.email',
    'form.emailError',
    'form.errorGeneral',
    'form.errorRateLimit',
    'form.firstName',
    'form.firstNameError',
    'form.lastName',
    'form.lastNameError',
    'form.message',
    'form.messageError',
    'form.messagePlaceholder',
    'form.reportSeedPrefix',
    'form.sending',
    'form.submit',
    'form.successMsg',
    'form.successTitle',
    'hub.description',
    'hub.editors.cta',
    'hub.editors.description',
    'hub.editors.title',
    'hub.heading',
    'hub.photos.cta',
    'hub.photos.description',
    'hub.photos.title',
    'hub.report.cta',
    'hub.report.description',
    'hub.report.title',
    'hub.subtitle',
    'hub.tagline',
    'hub.title',
    'photos.description',
    'photos.form.heading',
    'photos.form.termsNoteLink',
    'photos.form.termsNotePrefix',
    'photos.heading',
    'photos.how.heading',
    'photos.how.step1',
    'photos.how.step2',
    'photos.how.step3',
    'photos.subtitle',
    'photos.tagline',
    'photos.terms.heading',
    'photos.terms.intro',
    'photos.terms.item1',
    'photos.terms.item2',
    'photos.terms.item3',
    'photos.terms.item4',
    'photos.title',
    'report.description',
    'report.heading',
    'report.subtitle',
    'report.tagline',
    'report.title',
    'reportLink.hint',
    'reportLink.inline',
    'reportLink.label'
] as const;

/** Resolves a dot-notation key against a nested object. */
function resolveKey(obj: Record<string, unknown>, key: string): unknown {
    return key.split('.').reduce<unknown>((current, part) => {
        if (current && typeof current === 'object' && !Array.isArray(current)) {
            return (current as Record<string, unknown>)[part];
        }
        return undefined;
    }, obj);
}

describe('contributions namespace (SPEC-191 FR-10)', () => {
    it('is registered in the namespaces catalog', () => {
        expect(namespaces).toContain('contributions');
    });

    it('has a non-empty es value for every key used by apps/web', () => {
        const missing = USED_KEYS.filter((key) => {
            const value = resolveKey(esContributions as Record<string, unknown>, key);
            return typeof value !== 'string' || value.length === 0;
        });

        expect(missing, 'Keys used in apps/web but missing in es/contributions.json').toEqual([]);
    });
});
