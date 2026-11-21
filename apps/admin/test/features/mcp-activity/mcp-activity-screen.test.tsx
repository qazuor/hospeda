// @vitest-environment jsdom
/**
 * HOS-2349: the admin assistant activity screen renders what the spec lists
 * for a staff row (§6.10): time, user (name, email, id), tool, read/write,
 * outcome, the raw errorCode, the assistant and the target. Every filter of
 * the bar is a query param the API accepts (AC-C52), and the API item parses.
 */

import esEntities from '@repo/i18n/locales/es/admin-entities.json';
import esFilters from '@repo/i18n/locales/es/admin-filters.json';
import { McpActivityAdminQuerySchema } from '@repo/schemas';
import { render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key, locale: 'es' })
}));
vi.mock('@/components/entity-list', () => ({
    createEntityListPage: () => ({ component: () => null, route: { options: {} } })
}));

const { createMcpActivityColumns } = await import(
    '../../../src/features/mcp-activity/config/mcp-activity.columns'
);
const { McpActivityListItemSchema, mcpActivityConfig } = await import(
    '../../../src/features/mcp-activity/config/mcp-activity.config'
);
const { McpActivityCoverageNote } = await import(
    '../../../src/features/mcp-activity/components/McpActivityCoverageNote'
);

const USER_ID = '2f6e1c3a-8b9d-4a7e-b5c4-d3e2f1a0b9c8';
const LISTING_ID = '7d3c2b1a-0f9e-4d8c-b7a6-958473625140';

/** A row as the API serialises it. */
const API_ITEM = {
    id: '00000000-0000-4000-8000-000000000001',
    loggedAt: '2026-11-10T12:00:00.000Z',
    tool: 'reply_inquiry',
    isWrite: true,
    outcome: 'error',
    errorCode: 'CONFIRMATION_EXPIRED',
    client: { id: 'https://claude.ai/oauth/mcp-client-metadata', name: 'Claude' },
    target: { type: 'accommodation', id: LISTING_ID, label: 'Cabaña del río' },
    actorId: USER_ID,
    actorName: 'Ana Host',
    actorEmail: 'ana@local.test'
};

const t = (key: string) => key;

/** Renders every column cell of one row. */
function renderRow(item: unknown) {
    const row = McpActivityListItemSchema.parse(item);
    const cells: ReactNode[] = createMcpActivityColumns(t).map((column) =>
        createElement('div', { key: column.id }, column.widgetRenderer?.(row))
    );
    return render(createElement('div', null, cells));
}

describe('admin assistant activity screen', () => {
    it('renders time, user, tool, access, outcome, errorCode, assistant and target', () => {
        renderRow(API_ITEM);

        expect(screen.getByTestId('mcp-activity-cell-timestamp').textContent).toMatch(/2026/);
        const user = screen.getByTestId('mcp-activity-cell-user');
        expect(user.textContent).toContain('Ana Host');
        expect(user.textContent).toContain('ana@local.test');
        expect(user.getAttribute('title')).toContain(USER_ID);
        expect(screen.getByTestId('mcp-activity-cell-tool').textContent).toBe('reply_inquiry');
        expect(screen.getByTestId('mcp-activity-cell-access').textContent).toBe(
            'admin-filters.mcpActivity.access.write'
        );
        expect(screen.getByTestId('mcp-activity-cell-outcome').textContent).toBe(
            'admin-filters.mcpActivity.outcome.error'
        );
        expect(screen.getByTestId('mcp-activity-cell-error-code').textContent).toBe(
            'CONFIRMATION_EXPIRED'
        );
        expect(screen.getByTestId('mcp-activity-cell-client').textContent).toBe('Claude');
        expect(screen.getByTestId('mcp-activity-cell-target').textContent).toBe('Cabaña del río');
    });

    it('falls back to the short id, the client id and the bare target when unresolved', () => {
        renderRow({
            ...API_ITEM,
            isWrite: false,
            outcome: 'success',
            errorCode: undefined,
            actorName: undefined,
            actorEmail: undefined,
            client: { id: 'chatgpt-dcr-client' },
            target: { type: 'accommodation', id: LISTING_ID }
        });

        expect(screen.getByTestId('mcp-activity-cell-user').textContent).toBe(USER_ID.slice(0, 8));
        expect(screen.getByTestId('mcp-activity-cell-access').textContent).toBe(
            'admin-filters.mcpActivity.access.read'
        );
        expect(screen.getByTestId('mcp-activity-cell-error-code').textContent).toBe('—');
        expect(screen.getByTestId('mcp-activity-cell-client').textContent).toBe(
            'chatgpt-dcr-client'
        );
        expect(screen.getByTestId('mcp-activity-cell-target').textContent).toBe(
            `accommodation:${LISTING_ID.slice(0, 8)}`
        );
    });

    it('renders the client-declared name as text, never as markup', () => {
        renderRow({ ...API_ITEM, client: { id: 'x', name: '<img src=x onerror=alert(1)>' } });

        const client = screen.getByTestId('mcp-activity-cell-client');
        expect(client.querySelector('img')).toBeNull();
        expect(client.textContent).toBe('<img src=x onerror=alert(1)>');
    });

    it('states that not every call is recorded (R-16)', () => {
        render(createElement(McpActivityCoverageNote));
        expect(screen.getByTestId('mcp-activity-coverage-note').textContent).toBe(
            'admin-entities.entities.mcpActivity.coverageNote'
        );
    });

    it('sorts only by loggedAt, newest first by default', () => {
        const sortable = createMcpActivityColumns(t)
            .filter((column) => column.enableSorting)
            .map((column) => column.id);
        expect(sortable).toEqual(['loggedAt']);
        expect(mcpActivityConfig.defaultSort).toEqual({ id: 'loggedAt', desc: true });
    });

    it('offers exactly the filters the API accepts (AC-C52)', () => {
        const params = (mcpActivityConfig.filterBarConfig?.filters ?? []).flatMap((filter) =>
            filter.type === 'date-range'
                ? [filter.paramKeyFrom, filter.paramKeyTo]
                : [filter.paramKey]
        );
        const accepted = Object.keys(McpActivityAdminQuerySchema.shape).filter(
            (key) => key !== 'sort'
        );
        expect(params.sort()).toEqual(accepted.sort());
        expect(mcpActivityConfig.apiEndpoint).toBe('/api/v1/admin/mcp-activity');
    });

    it('has es copy for every key the screen uses', () => {
        expect(Object.keys(esEntities.columns.mcpActivity).sort()).toEqual(
            createMcpActivityColumns(t)
                .map((column) => column.id)
                .sort()
        );
        expect(esEntities.entities.mcpActivity.coverageNote.length).toBeGreaterThan(0);
        expect(Object.keys(esFilters.mcpActivity.outcome)).toEqual([
            'label',
            'success',
            'denied',
            'error'
        ]);
        expect(Object.keys(esFilters.mcpActivity.access)).toEqual(['label', 'read', 'write']);
    });
});
