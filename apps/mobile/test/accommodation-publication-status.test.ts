/**
 * @file accommodation-publication-status.test.ts
 * @description The host list card shows a listing's publicationStatus (HOS-1641).
 *
 * The badge map is a pure module; the screen is a React Native route file that
 * cannot render in the node environment, so its wiring is asserted on the
 * source (the same technique the admin guards use for route files).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { trans } from '@repo/i18n';
import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { getPublicationStatusBadge } from '../src/lib/accommodation-publication-status';

const SCREEN = readFileSync(join(__dirname, '../app/(host)/accommodations/index.tsx'), 'utf8');

describe('getPublicationStatusBadge', () => {
    it.each(Object.values(PublicationStatusEnum))('%s has its own label key', (status) => {
        expect(getPublicationStatusBadge({ status }).labelKey).toBe(
            `mobile.host.accommodations.status.${status}`
        );
    });

    it('PURGED never reads as published', () => {
        const purged = getPublicationStatusBadge({ status: PublicationStatusEnum.PURGED });
        const published = getPublicationStatusBadge({ status: PublicationStatusEnum.PUBLISHED });
        expect(purged.labelKey).not.toBe(published.labelKey);
        expect(purged.tone).toBe('danger');
        expect(published.tone).toBe('success');
    });

    it.each(['es', 'en', 'pt'] as const)('%s: every state label resolves to a text', (locale) => {
        for (const status of Object.values(PublicationStatusEnum)) {
            const { labelKey } = getPublicationStatusBadge({ status });
            // Read the locale map itself: getTranslation falls back to `es`,
            // which would hide a key missing in `en` or `pt`.
            const label = trans[locale][labelKey];
            expect(label, `${locale} ${labelKey}`).toBeTypeOf('string');
            expect(label?.length).toBeGreaterThan(0);
        }
    });
});

describe('the host accommodations list screen', () => {
    it('badges each card from item.publicationStatus, as is', () => {
        expect(SCREEN).toContain('getPublicationStatusBadge({ status: item.publicationStatus })');
        expect(SCREEN).toContain('t(statusBadge.labelKey)');
    });

    it('no longer reads lifecycleState nor the retired lifecycle labels', () => {
        expect(SCREEN).not.toMatch(/lifecycleState/);
        expect(SCREEN).not.toMatch(/mobile\.host\.accommodations\.lifecycle/);
    });
});
