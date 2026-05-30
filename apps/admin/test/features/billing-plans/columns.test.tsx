/**
 * Regression tests for billing plans list columns — SPEC-168
 *
 * Guards the description cell fallback. Plan descriptions are translated via
 * i18n keyed by slug, but admin-created plans have no static i18n entry. The
 * `@repo/i18n` `t()` helper returns `[MISSING: <key>]` (NOT the bare key) for
 * unknown keys, so the cell must fall back to the DB-stored `row.description`
 * instead of rendering the raw `[MISSING: ...]` marker to the admin.
 *
 * Bug: a previous `translated === i18nKey` check never matched (real return is
 * `[MISSING: <key>]`), leaving every admin-created plan showing the marker.
 */

import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { getPlanColumns } from '../../../src/features/billing-plans/columns';
import type { ParsedPlanRecord } from '../../../src/features/billing-plans/types';

/**
 * Mock translator mirroring `@repo/i18n` useTranslations: returns the registered
 * string for known keys and `[MISSING: <key>]` for everything else.
 */
const KNOWN_TRANSLATIONS: Record<string, string> = {
    'admin-billing.plans.descriptions.owner-basico': 'Plan básico (traducido por i18n)'
};
const t = (key: string): string => KNOWN_TRANSLATIONS[key] ?? `[MISSING: ${key}]`;

/** Builds a valid ParsedPlanRecord with sensible defaults. */
function makePlan(overrides: Partial<ParsedPlanRecord>): ParsedPlanRecord {
    return {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        slug: 'owner-basico',
        name: 'Básico Propietario',
        description: 'Descripción almacenada en la base de datos.',
        category: 'owner',
        monthlyPriceArs: 150000,
        annualPriceArs: null,
        monthlyPriceUsdRef: 12,
        hasTrial: false,
        trialDays: 0,
        isDefault: false,
        sortOrder: 1,
        entitlements: [],
        limits: [{ key: 'max_accommodations', value: 5 }],
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-15T00:00:00.000Z',
        ...overrides
    };
}

/** Renders the `name` column cell for a given plan row. */
function renderNameCell(plan: ParsedPlanRecord): void {
    const columns = getPlanColumns({ t });
    const nameColumn = columns.find((col) => col.id === 'name');
    if (!nameColumn?.cell) {
        throw new Error('name column with a cell renderer not found');
    }
    // The cell renderer receives the record directly as `row`.
    render(nameColumn.cell({ row: plan } as never) as ReactElement);
}

describe('getPlanColumns — description cell fallback (SPEC-168)', () => {
    it('falls back to row.description when the slug has no i18n entry (admin-created plan)', () => {
        // Arrange — a slug with no registered translation (admin-created)
        const plan = makePlan({
            slug: 'smoke-168-test',
            description: 'Plan creado desde el admin.'
        });

        // Act
        renderNameCell(plan);

        // Assert — the real description is shown, never the [MISSING: ...] marker
        expect(screen.getByText('Plan creado desde el admin.')).toBeInTheDocument();
        expect(screen.queryByText(/\[MISSING:/)).not.toBeInTheDocument();
    });

    it('uses the i18n translation when the slug has a registered entry (seeded plan)', () => {
        // Arrange — owner-basico has a registered translation
        const plan = makePlan({
            slug: 'owner-basico',
            description: 'Descripción cruda en inglés del config.'
        });

        // Act
        renderNameCell(plan);

        // Assert — the translated copy wins over the raw description
        expect(screen.getByText('Plan básico (traducido por i18n)')).toBeInTheDocument();
    });
});
