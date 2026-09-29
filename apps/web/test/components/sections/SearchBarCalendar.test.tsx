/**
 * @file SearchBarCalendar.test.tsx
 * @description Regression test for HOS-869: the hero SearchBar calendar captions
 * must read "Agosto de 2026" / "August 2026", not "Agosto De 2026".
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchBarCalendar } from '../../../src/components/sections/SearchBarCalendar.client';

vi.mock('../../../src/lib/ensure-stylesheet', () => ({
    ensureStylesheet: vi.fn()
}));

vi.mock('../../../src/components/sections/SearchBar.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

describe('SearchBarCalendar month captions (HOS-869)', () => {
    it.each([
        ['es', 'Agosto de 2026'],
        ['en', 'August 2026'],
        ['pt', 'Agosto de 2026']
    ] as const)('renders the %s caption with only the first letter capitalized', (locale, expected) => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2026, 7, 15, 12));
        try {
            render(
                <SearchBarCalendar
                    locale={locale}
                    selected={undefined}
                    onSelect={() => {}}
                />
            );
            expect(screen.getByText(expected)).toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });
});
