/**
 * @file destination-report-link.test.ts
 * @description Source-reading tests for the destination-detail report link
 * (SPEC-191 FR-7, BETA-69) — both placements:
 *   1. A third row in DestinationSidebarCtas.astro (icon+label+hint+arrow)
 *   2. An inline text link after the description section on the detail page
 * Both must deep-link to /colaborar/reportar with ?destino=<slug>.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sidebarSrc = readFileSync(
    resolve(__dirname, '../../../src/components/destination/DestinationSidebarCtas.astro'),
    'utf8'
);

const pageSrc = readFileSync(
    resolve(__dirname, '../../../src/pages/[lang]/destinos/[...path].astro'),
    'utf8'
);

describe('DestinationSidebarCtas.astro — report row (FR-7)', () => {
    it('builds the report href to colaborar/reportar with ?destino=<slug>', () => {
        expect(sidebarSrc).toContain("path: 'colaborar/reportar'");
        expect(sidebarSrc).toMatch(/\?destino=\$\{(encodeURIComponent\()?slug\)?\}/);
    });

    it('renders the report row with the established icon+label+hint+arrow pattern', () => {
        expect(sidebarSrc).toContain('AlertTriangleIcon');
        expect(sidebarSrc).toMatch(/t\(\s*'contributions\.reportLink\.label'/);
        expect(sidebarSrc).toMatch(/t\(\s*'contributions\.reportLink\.hint'/);
        // Three CTA rows now: accommodations, events, report.
        const rowCount = (sidebarSrc.match(/dest-cta-card__row"/g) ?? []).length;
        expect(rowCount).toBe(3);
    });
});

describe('destinos/[...path].astro — inline report link (FR-7)', () => {
    it('links to colaborar/reportar with ?destino=<slug>', () => {
        expect(pageSrc).toContain("path: 'colaborar/reportar'");
        expect(pageSrc).toMatch(/\?destino=\$\{(encodeURIComponent\()?slug\)?\}/);
    });

    it('places the inline link directly after the description section', () => {
        // The report link block must appear between the description section
        // and the photo gallery block.
        const descriptionIdx = pageSrc.indexOf('dest-detail__description');
        const reportIdx = pageSrc.indexOf('dest-detail__report-link');
        const galleryIdx = pageSrc.indexOf('<DestinationGallery');
        expect(descriptionIdx).toBeGreaterThan(-1);
        expect(reportIdx).toBeGreaterThan(descriptionIdx);
        expect(reportIdx).toBeLessThan(galleryIdx);
    });

    it('resolves the link copy from the contributions namespace', () => {
        expect(pageSrc).toMatch(/t\(\s*'contributions\.reportLink\.inline'/);
    });
});
