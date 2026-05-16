/**
 * @file ProfileCompletion.layout.test.ts
 * @description Source-level assertions for the ProfileCompletion orchestrator
 * layout introduced by the SPEC-113 polish round:
 *   1. Render order is BasicFields → ContactFields → MoreDetails → ConsentFields
 *   2. Newsletter checkbox defaults to TRUE
 *   3. ContactFields no longer receives newsletter / acceptedTerms props
 *   4. ConsentFields component is imported and rendered exactly once
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const orchestrator = readFileSync(
    resolve(__dirname, '../../../src/components/account/ProfileCompletion.client.tsx'),
    'utf8'
);

const contactFields = readFileSync(
    resolve(__dirname, '../../../src/components/account/ProfileCompletionContactFields.tsx'),
    'utf8'
);

const consentFields = readFileSync(
    resolve(__dirname, '../../../src/components/account/ProfileCompletionConsentFields.tsx'),
    'utf8'
);

describe('ProfileCompletion orchestrator layout (SPEC-113 polish)', () => {
    describe('imports', () => {
        it('imports the new ConsentFields subcomponent', () => {
            expect(orchestrator).toContain(
                "import { ProfileCompletionConsentFields } from './ProfileCompletionConsentFields'"
            );
        });

        it('still imports BasicFields, ContactFields, and MoreDetails', () => {
            expect(orchestrator).toContain(
                "import { ProfileCompletionBasicFields } from './ProfileCompletionBasicFields'"
            );
            expect(orchestrator).toContain(
                "import { ProfileCompletionContactFields } from './ProfileCompletionContactFields'"
            );
            expect(orchestrator).toContain(
                "import { ProfileCompletionMoreDetails } from './ProfileCompletionMoreDetails'"
            );
        });
    });

    describe('newsletter default', () => {
        it('defaults newsletter state to TRUE (opt-out pattern)', () => {
            expect(orchestrator).toMatch(
                /const\s+\[\s*newsletter\s*,\s*setNewsletter\s*\]\s*=\s*useState\(\s*true\s*\)/
            );
        });

        it('keeps acceptedTerms default at FALSE', () => {
            expect(orchestrator).toMatch(
                /const\s+\[\s*acceptedTerms\s*,\s*setAcceptedTerms\s*\]\s*=\s*useState\(\s*false\s*\)/
            );
        });
    });

    describe('render order', () => {
        it('renders subcomponents in the order Basic → Contact → MoreDetails → Consent', () => {
            const basicIdx = orchestrator.indexOf('<ProfileCompletionBasicFields');
            const contactIdx = orchestrator.indexOf('<ProfileCompletionContactFields');
            const moreIdx = orchestrator.indexOf('<ProfileCompletionMoreDetails');
            const consentIdx = orchestrator.indexOf('<ProfileCompletionConsentFields');

            expect(basicIdx).toBeGreaterThan(-1);
            expect(contactIdx).toBeGreaterThan(-1);
            expect(moreIdx).toBeGreaterThan(-1);
            expect(consentIdx).toBeGreaterThan(-1);

            expect(basicIdx).toBeLessThan(contactIdx);
            expect(contactIdx).toBeLessThan(moreIdx);
            expect(moreIdx).toBeLessThan(consentIdx);
        });
    });

    describe('consent props routing', () => {
        it('passes newsletter / acceptedTerms handlers to ConsentFields', () => {
            const consentBlockMatch = orchestrator.match(
                /<ProfileCompletionConsentFields[\s\S]*?\/>/
            );
            expect(consentBlockMatch).not.toBeNull();
            const block = consentBlockMatch?.[0] ?? '';
            expect(block).toContain('newsletter={newsletter}');
            expect(block).toContain('acceptedTerms={acceptedTerms}');
            expect(block).toContain('onNewsletterChange={setNewsletter}');
            expect(block).toContain('onAcceptedTermsChange={setAcceptedTerms}');
        });

        it('does NOT pass newsletter / acceptedTerms handlers to ContactFields', () => {
            const contactBlockMatch = orchestrator.match(
                /<ProfileCompletionContactFields[\s\S]*?\/>/
            );
            expect(contactBlockMatch).not.toBeNull();
            const block = contactBlockMatch?.[0] ?? '';
            expect(block).not.toContain('newsletter=');
            expect(block).not.toContain('acceptedTerms=');
            expect(block).not.toContain('onNewsletterChange=');
            expect(block).not.toContain('onAcceptedTermsChange=');
        });
    });
});

describe('ProfileCompletionContactFields (SPEC-113 polish)', () => {
    it('no longer references newsletter or acceptedTerms', () => {
        expect(contactFields).not.toContain('newsletter');
        expect(contactFields).not.toContain('acceptedTerms');
    });

    it('still renders phone and locale inputs', () => {
        expect(contactFields).toContain('id="pc-phone"');
        expect(contactFields).toContain('id="pc-locale"');
    });
});

describe('ProfileCompletionConsentFields (SPEC-113 polish)', () => {
    it('renders a newsletter checkbox bound to newsletter prop', () => {
        expect(consentFields).toContain('checked={newsletter}');
        expect(consentFields).toContain('onNewsletterChange');
    });

    it('renders a terms checkbox bound to acceptedTerms prop', () => {
        expect(consentFields).toContain('checked={acceptedTerms}');
        expect(consentFields).toContain('onAcceptedTermsChange');
    });

    it('links to the locale-aware terms page', () => {
        expect(consentFields).toContain('/${locale}/legal/terminos/');
    });

    it('shows the terms error message when present', () => {
        expect(consentFields).toContain('errors.terms');
        expect(consentFields).toContain('id="pc-terms-error"');
    });
});
