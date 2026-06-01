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
    'admin-billing.plans.descriptions.owner-basico': 'Plan básico (traducido por i18n)',
    'admin-billing.plans.actionActivate': 'Activar',
    'admin-billing.plans.actionDeactivate': 'Desactivar',
    'admin-billing.plans.actionEdit': 'Editar',
    'admin-billing.plans.actionDelete': 'Eliminar',
    'admin-billing.plans.actionRestore': 'Restaurar',
    'admin-billing.plans.actionHardDelete': 'Eliminar permanentemente',
    'admin-billing.plans.columns.actions': 'Acciones'
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
        isDeleted: false,
        activeSubscriptionCount: 0,
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

/** Renders the `actions` column cell for a given plan row, wiring all callbacks. */
function renderActionsCell(plan: ParsedPlanRecord): void {
    const columns = getPlanColumns({
        t,
        onEdit: () => {},
        onToggleActive: () => {},
        onDelete: () => {},
        onRestore: () => {},
        onHardDelete: () => {}
    });
    const actionsColumn = columns.find((col) => col.id === 'actions');
    if (!actionsColumn?.cell) {
        throw new Error('actions column with a cell renderer not found');
    }
    render(actionsColumn.cell({ row: plan } as never) as ReactElement);
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

describe('getPlanColumns — actions per row state (SPEC-168)', () => {
    it('renders Restaurar + Eliminar permanentemente for a soft-deleted row, NOT toggle/edit/soft-delete', () => {
        // Arrange — a soft-deleted plan
        const plan = makePlan({ isDeleted: true });

        // Act
        renderActionsCell(plan);

        // Assert — restore + permanent-delete present
        expect(screen.getByText('Restaurar')).toBeInTheDocument();
        expect(screen.getByText('Eliminar permanentemente')).toBeInTheDocument();
        // Toggle / edit / soft-delete absent for deleted rows
        expect(screen.queryByText('Activar')).not.toBeInTheDocument();
        expect(screen.queryByText('Desactivar')).not.toBeInTheDocument();
        expect(screen.queryByText('Editar')).not.toBeInTheDocument();
        // The plain "Eliminar" (soft-delete) must NOT render; only the hard-delete label.
        expect(screen.queryByText('Eliminar')).not.toBeInTheDocument();
    });

    it('renders toggle/edit/soft-delete for a non-deleted row, NOT restore/hard-delete', () => {
        // Arrange — a live plan (active)
        const plan = makePlan({ isDeleted: false, isActive: true });

        // Act
        renderActionsCell(plan);

        // Assert — standard actions present
        expect(screen.getByText('Desactivar')).toBeInTheDocument();
        expect(screen.getByText('Editar')).toBeInTheDocument();
        expect(screen.getByText('Eliminar')).toBeInTheDocument();
        // Deleted-row actions absent
        expect(screen.queryByText('Restaurar')).not.toBeInTheDocument();
        expect(screen.queryByText('Eliminar permanentemente')).not.toBeInTheDocument();
    });
});
