/**
 * @file alliance-applications-section.test.ts
 * @description Tests for the alliance applications section (HOS-278 AC-14,
 * restyled on the account kit by HOS-2502).
 *
 * `.astro` frontmatter cannot render in Vitest, so the section file is asserted
 * on source (the established pattern for Astro components here, see
 * `mi-cuenta-aliados.astro.test.ts`) and the list it renders, a plain React
 * component, is rendered for real.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
    ALLIANCE_STATUS_TONE,
    AllianceApplicationsList,
    type AllianceLeadStatus
} from '../../../src/components/account/AllianceApplicationsList';

const source = readFileSync(
    resolve(__dirname, '../../../src/components/account/AllianceApplicationsSection.astro'),
    'utf8'
);

describe('AllianceApplicationsSection.astro (HOS-278 AC-14)', () => {
    it('renders nothing when the visitor has no applications and the read worked', () => {
        // Never having applied is the common case on a discovery hub; an empty
        // "your applications" panel would be noise on it.
        expect(source).toContain('(leads.length > 0 || loadFailed) &&');
    });

    it('shows an error with a retry, not nothing, when the read failed', () => {
        expect(source).toContain('loadFailed ? (');
        expect(source).toContain('<SectionLoadError');
    });

    it('is a kit Section with a help anchor', () => {
        expect(source).toContain('<Section');
        expect(source).toContain('helpId="section:alliances.applications"');
    });

    it('shows the program, the submission date and the state of each application', () => {
        expect(source).toContain('account.alliances.programs.');
        expect(source).toContain('account.alliances.status.');
        expect(source).toContain('dateFormatter.format(new Date(lead.createdAt))');
    });

    it('resolves every label through i18n, never a hardcoded Spanish string in markup', () => {
        for (const key of ['title', 'submittedOn', 'note']) {
            expect(source).toContain(`account.alliances.applications.${key}`);
        }
    });

    it('promises only what the system does: an email when it is resolved, said in the Section description', () => {
        expect(source).toContain('account.alliances.applications.note');
        const es = JSON.parse(
            readFileSync(
                resolve(__dirname, '../../../../../packages/i18n/src/locales/es/account.json'),
                'utf8'
            )
        ) as { alliances: { applications: { note: string } } };
        expect(es.alliances.applications.note).toContain('te vamos a escribir por correo');
    });
});

describe('AllianceApplicationsList', () => {
    const rows = (['pending', 'reviewing', 'approved', 'rejected'] as const).map((status) => ({
        id: `lead-${status}`,
        program: 'Partner',
        submittedOn: 'Enviada el 3 de noviembre de 2026',
        status,
        statusLabel: `label-${status}`
    }));

    it('renders each application with its translated state word, never the slug', () => {
        render(
            <AllianceApplicationsList
                label="Tus postulaciones"
                rows={rows}
            />
        );
        expect(screen.getByRole('list', { name: 'Tus postulaciones' })).toBeInTheDocument();
        for (const status of ['pending', 'reviewing', 'approved', 'rejected']) {
            expect(screen.getByText(`label-${status}`)).toBeInTheDocument();
            expect(screen.queryByText(status)).not.toBeInTheDocument();
        }
    });

    it('treats pending and reviewing as the same answer to the applicant', () => {
        // "We have it, we have not decided": the distinction is internal.
        expect(ALLIANCE_STATUS_TONE.pending).toBe(ALLIANCE_STATUS_TONE.reviewing);
    });

    it('has a tone for every lead status, so a new one cannot fall through unstyled', () => {
        const statuses: AllianceLeadStatus[] = ['pending', 'reviewing', 'approved', 'rejected'];
        for (const status of statuses) expect(ALLIANCE_STATUS_TONE[status]).toBeDefined();
    });
});
