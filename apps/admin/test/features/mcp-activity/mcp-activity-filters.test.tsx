// @vitest-environment jsdom
/**
 * HOS-2349 review M2: no filter of the assistant activity log fires a 400
 * while the admin types.
 *
 * - `tool` is a select over `MCP_TOOL_NAMES`: no free text reaches the API.
 * - `userId` reaches the query only as a complete UUID. While the typed value
 *   is partial the param is omitted and a hint is shown; the typed text stays.
 */

import enFilters from '@repo/i18n/locales/en/admin-filters.json';
import esFilters from '@repo/i18n/locales/es/admin-filters.json';
import ptFilters from '@repo/i18n/locales/pt/admin-filters.json';
import { MCP_TOOL_NAMES } from '@repo/schemas';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TextFilterConfig } from '@/components/entity-list/filters/filter-types';

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key, locale: 'es' })
}));
vi.mock('@/components/entity-list', () => ({
    createEntityListPage: () => ({ component: () => null, route: { options: {} } })
}));

const { FilterText } = await import('../../../src/components/entity-list/filters/FilterText');
const { mcpActivityConfig } = await import(
    '../../../src/features/mcp-activity/config/mcp-activity.config'
);

const USER_ID = '2f6e1c3a-8b9d-4a7e-b5c4-d3e2f1a0b9c8';
const filters = mcpActivityConfig.filterBarConfig?.filters ?? [];
const filterFor = (paramKey: string) => filters.find((filter) => filter.paramKey === paramKey);

/** The real userId filter config of the screen. */
function userIdConfig(): TextFilterConfig {
    const filter = filterFor('userId');
    if (filter?.type !== 'text') throw new Error('userId is not a text filter');
    return { ...filter, debounceMs: 100 };
}

describe('tool filter', () => {
    it('is a select whose options are exactly MCP_TOOL_NAMES', () => {
        const tool = filterFor('tool');
        expect(tool?.type).toBe('select');
        const values = tool?.type === 'select' ? tool.options.map((option) => option.value) : [];
        expect(values).toEqual([...MCP_TOOL_NAMES]);
    });

    it.each([
        ['es', esFilters],
        ['en', enFilters],
        ['pt', ptFilters]
    ])('has a %s label for every tool, the raw tool name', (_locale, copy) => {
        expect(copy.mcpActivity.tool.options).toEqual(
            Object.fromEntries(MCP_TOOL_NAMES.map((name) => [name, name]))
        );
    });
});

describe('userId filter', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const type = (value: string) => {
        fireEvent.change(screen.getByRole('textbox'), { target: { value } });
        vi.advanceTimersByTime(150);
    };

    it('omits a partial UUID from the query and shows the hint', () => {
        const onChange = vi.fn();
        render(
            <FilterText
                config={userIdConfig()}
                value={undefined}
                onChange={onChange}
            />
        );

        type(USER_ID.slice(0, 12));

        // The param stays removed: nothing but `undefined` is ever emitted.
        expect(onChange.mock.calls.every(([value]) => value === undefined)).toBe(true);
        expect(screen.getByTestId('filter-text-hint-userId').textContent).toBe(
            'admin-filters.mcpActivity.userId.invalidHint'
        );
        expect(screen.getByRole('textbox')).toHaveValue(USER_ID.slice(0, 12));
    });

    it('sends a complete UUID and hides the hint', () => {
        const onChange = vi.fn();
        render(
            <FilterText
                config={userIdConfig()}
                value={undefined}
                onChange={onChange}
            />
        );

        type(USER_ID);

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(USER_ID);
        expect(screen.queryByTestId('filter-text-hint-userId')).toBeNull();
    });

    it('drops an applied UUID once it is edited into a partial one, keeping the text', () => {
        const onChange = vi.fn();
        const { rerender } = render(
            <FilterText
                config={userIdConfig()}
                value={USER_ID}
                onChange={onChange}
            />
        );

        type(USER_ID.slice(0, 30));
        expect(onChange).toHaveBeenCalledWith(undefined);
        // The parent echoes the removal back; the typed text must survive it.
        rerender(
            <FilterText
                config={userIdConfig()}
                value={undefined}
                onChange={onChange}
            />
        );

        expect(screen.getByRole('textbox')).toHaveValue(USER_ID.slice(0, 30));
        expect(screen.getByTestId('filter-text-hint-userId')).toBeTruthy();
    });

    it('still clears on an external reset', () => {
        const onChange = vi.fn();
        const { rerender } = render(
            <FilterText
                config={userIdConfig()}
                value={USER_ID}
                onChange={onChange}
            />
        );

        rerender(
            <FilterText
                config={userIdConfig()}
                value={undefined}
                onChange={onChange}
            />
        );

        expect(screen.getByRole('textbox')).toHaveValue('');
    });
});
