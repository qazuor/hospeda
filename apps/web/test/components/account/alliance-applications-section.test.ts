/**
 * @file alliance-applications-section.test.ts
 * @description Source-level assertions for `AllianceApplicationsSection.astro`
 * (HOS-278 AC-14).
 *
 * `.astro` frontmatter cannot render in Vitest, so these are source-based —
 * the established pattern for Astro components here (see
 * `mi-cuenta-aliados.astro.test.ts`).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../../src/components/account/AllianceApplicationsSection.astro'),
    'utf8'
);

describe('AllianceApplicationsSection.astro (HOS-278 AC-14)', () => {
    it('renders nothing when the visitor has no applications', () => {
        // Never having applied is the common case on a discovery hub; an empty
        // "your applications" panel would be noise on it.
        expect(source).toContain('leads.length > 0 &&');
    });

    it('shows the program, the submission date and the state of each application', () => {
        expect(source).toContain('account.alliances.programs.');
        expect(source).toContain('account.alliances.status.');
        expect(source).toContain('dateFormatter.format(new Date(lead.createdAt))');
    });

    it('resolves every label through i18n, never a hardcoded Spanish string in markup', () => {
        // Keys only, not the `t(` prefix: the longer calls wrap across lines,
        // so anchoring on the call would assert formatting rather than i18n.
        for (const key of ['title', 'submittedOn', 'note']) {
            expect(source).toContain(`account.alliances.applications.${key}`);
        }
    });

    it('never renders the raw status slug as the visible label', () => {
        // The slug is only the i18n key and a data attribute for styling.
        expect(source).toContain('data-status={lead.status}');
        expect(source).not.toMatch(/>\s*\{lead\.status\}\s*</);
    });

    it('treats pending and reviewing as the same answer to the applicant', () => {
        // "We have it, we have not decided" — the distinction is internal.
        expect(source).toMatch(/pending:\s*'is-open'/);
        expect(source).toMatch(/reviewing:\s*'is-open'/);
    });

    it('covers every lead status, so a new one cannot fall through unstyled', () => {
        for (const status of ['pending', 'reviewing', 'approved', 'rejected']) {
            expect(source).toContain(`${status}:`);
        }
        expect(source).toContain("Record<MyAllianceLeadItem['status'], string>");
    });

    it('promises only what the system does — an email when it is resolved', () => {
        expect(source).toContain('te vamos a escribir por correo');
    });
});
