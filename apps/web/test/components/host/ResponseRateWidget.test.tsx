/**
 * @file ResponseRateWidget.test.tsx
 * @description TDD tests for ResponseRateWidget — KPI card showing response
 * rate percentage and average response time.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResponseRateWidget } from '../../../src/components/host/ResponseRateWidget.client';

describe('ResponseRateWidget', () => {
    it('renders loading skeleton when loading', () => {
        render(
            <ResponseRateWidget
                locale="es"
                data={undefined}
                isLoading={true}
                error={null}
            />
        );
        expect(screen.getByTestId('response-rate-skeleton')).toBeInTheDocument();
    });

    it('renders error state with message', () => {
        render(
            <ResponseRateWidget
                locale="es"
                data={undefined}
                isLoading={false}
                error="Timeout"
            />
        );
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Timeout')).toBeInTheDocument();
    });

    it('renders empty state when data is null', () => {
        render(
            <ResponseRateWidget
                locale="es"
                data={undefined}
                isLoading={false}
                error={null}
            />
        );
        expect(screen.getByText(/Sin datos/i)).toBeInTheDocument();
    });

    it('displays response rate percentage', () => {
        render(
            <ResponseRateWidget
                locale="es"
                data={{ responseRatePct: 92, avgResponseTimeMinutes: 25 }}
                isLoading={false}
                error={null}
            />
        );
        expect(screen.getByText('92%')).toBeInTheDocument();
    });

    it('displays average response time in minutes', () => {
        render(
            <ResponseRateWidget
                locale="es"
                data={{ responseRatePct: 92, avgResponseTimeMinutes: 25 }}
                isLoading={false}
                error={null}
            />
        );
        expect(screen.getByText(/25 min/i)).toBeInTheDocument();
    });

    it('shows "N/A" when avgResponseTimeMinutes is null', () => {
        render(
            <ResponseRateWidget
                locale="es"
                data={{ responseRatePct: 85, avgResponseTimeMinutes: null }}
                isLoading={false}
                error={null}
            />
        );
        expect(screen.getByText('85%')).toBeInTheDocument();
        expect(screen.getByText(/N\/A/i)).toBeInTheDocument();
    });
});
