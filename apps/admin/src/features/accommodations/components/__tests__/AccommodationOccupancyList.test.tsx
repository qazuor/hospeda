// @vitest-environment jsdom
/**
 * Component tests for AccommodationOccupancyList (HOS-43 Phase 1).
 *
 * Mocking strategy mirrors GalleryManager.test.tsx: `useAccommodationOccupancyQuery`
 * is mocked at the module level so loading/empty/error/data states are driven
 * directly, without any network calls. `useTranslations` is NOT mocked — the
 * real @repo/i18n translator resolves keys against the actual locale JSON, so
 * these tests also guard against raw-key leakage (SPEC-117 precedent).
 */

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockQueryResult: {
    data: unknown;
    isLoading: boolean;
    isError: boolean;
} = {
    data: [],
    isLoading: false,
    isError: false
};

vi.mock('@/features/accommodations/hooks/useAccommodationOccupancyQuery', () => ({
    useAccommodationOccupancyQuery: () => mockQueryResult
}));

import { AccommodationOccupancyList } from '../AccommodationOccupancyList';

function resetMock() {
    mockQueryResult.data = [];
    mockQueryResult.isLoading = false;
    mockQueryResult.isError = false;
}

afterEach(() => {
    vi.clearAllMocks();
    resetMock();
});

const MANUAL_ROW = {
    id: 'occ-1',
    accommodationId: 'acc-1',
    date: '2026-07-10',
    isBlocked: true,
    source: 'MANUAL',
    externalEventId: null,
    note: 'Reserved for maintenance',
    createdById: 'user-1',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z'
};

const GOOGLE_ROW = {
    id: 'occ-2',
    accommodationId: 'acc-1',
    date: '2026-07-15',
    isBlocked: true,
    source: 'GOOGLE_CALENDAR',
    externalEventId: 'gcal-evt-1',
    note: null,
    createdById: 'system',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z'
};

describe('AccommodationOccupancyList — loading state', () => {
    it('renders a skeleton while loading', () => {
        mockQueryResult.isLoading = true;

        render(<AccommodationOccupancyList accommodationId="acc-1" />);

        expect(screen.getByTestId('occupancy-loading')).toBeInTheDocument();
    });
});

describe('AccommodationOccupancyList — empty state', () => {
    it('renders the empty-state message when there is no occupancy data', () => {
        mockQueryResult.data = [];

        render(<AccommodationOccupancyList accommodationId="acc-1" />);

        expect(
            screen.getByText('Este alojamiento no tiene fechas ocupadas registradas.')
        ).toBeInTheDocument();
        // No raw i18n key should ever leak to the DOM.
        expect(screen.queryByText(/MISSING:/)).not.toBeInTheDocument();
    });
});

describe('AccommodationOccupancyList — error state', () => {
    it('renders an alert with the load-error message', () => {
        mockQueryResult.isError = true;

        render(<AccommodationOccupancyList accommodationId="acc-1" />);

        expect(screen.getByRole('alert')).toHaveTextContent(
            'No se pudo cargar el calendario de ocupación.'
        );
    });
});

describe('AccommodationOccupancyList — populated state', () => {
    it('renders one row per occupied date, sorted ascending', () => {
        mockQueryResult.data = [GOOGLE_ROW, MANUAL_ROW];

        render(<AccommodationOccupancyList accommodationId="acc-1" />);

        const rows = screen.getAllByRole('row').slice(1); // drop header row
        expect(rows).toHaveLength(2);
        // MANUAL_ROW (2026-07-10) sorts before GOOGLE_ROW (2026-07-15).
        expect(rows[0]).toHaveTextContent('Manual');
        expect(rows[1]).toHaveTextContent('Google Calendar');
    });

    it('renders the source label as a badge for MANUAL and GOOGLE_CALENDAR rows', () => {
        mockQueryResult.data = [MANUAL_ROW, GOOGLE_ROW];

        render(<AccommodationOccupancyList accommodationId="acc-1" />);

        expect(screen.getByText('Manual')).toBeInTheDocument();
        expect(screen.getByText('Google Calendar')).toBeInTheDocument();
    });

    it('renders the note when present, and a placeholder when absent', () => {
        mockQueryResult.data = [MANUAL_ROW, GOOGLE_ROW];

        render(<AccommodationOccupancyList accommodationId="acc-1" />);

        expect(screen.getByText('Reserved for maintenance')).toBeInTheDocument();
        expect(screen.getByText('Sin nota')).toBeInTheDocument();
    });

    it('formats the occupancy date without shifting the day (UTC-pinned)', () => {
        mockQueryResult.data = [MANUAL_ROW];

        render(<AccommodationOccupancyList accommodationId="acc-1" />);

        // es locale, dateStyle: 'medium', timeZone: 'UTC' → "10 jul 2026"
        expect(screen.getByText(/10 jul\.? 2026/)).toBeInTheDocument();
    });
});
