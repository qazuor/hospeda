/**
 * @file ReportFixedButton.test.tsx
 * @description TEST:V8a:7 row 30 (HOS-1492): the "Ya lo corregí" button under
 * a fix request calls `publishApi.reportFixed` with the listing's vertical and
 * id, then says when the owner reported it — also when the read already
 * carried the report. On failure it says so and keeps the button.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReportFixedButton } from '../../../src/components/listing/ReportFixedButton.client';

vi.mock('../../../src/components/listing/ReportFixedButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, p) => String(p) })
}));

const reportFixedMock = vi.fn();
vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    publishApi: {
        reportFixed: (args: { vertical: string; id: string }) => reportFixedMock(args)
    }
}));

describe('TEST:V8a:7 ReportFixedButton — row 30 "I fixed it"', () => {
    afterEach(() => vi.clearAllMocks());

    it('reports the fix for the listing and then says when', async () => {
        // Arrange: 2026-10-13T02:00Z is still October 12 in Argentina.
        reportFixedMock.mockResolvedValue({
            ok: true,
            data: { ownerReportedFixedAt: '2026-10-13T02:00:00.000Z' }
        });
        render(
            <ReportFixedButton
                vertical="venue"
                listingId="listing-1"
                locale="es"
                reportedAt={null}
            />
        );

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Ya lo corregí' }));

        // Assert
        await waitFor(() =>
            expect(
                screen.getByText('Avisaste que lo corregiste el 12 de octubre de 2026.')
            ).toBeInTheDocument()
        );
        expect(reportFixedMock).toHaveBeenCalledWith({ vertical: 'venue', id: 'listing-1' });
        expect(screen.queryByRole('button', { name: 'Ya lo corregí' })).not.toBeInTheDocument();
    });

    it('starts by saying when when the read already carries the report', () => {
        // Act
        render(
            <ReportFixedButton
                vertical="accommodation"
                listingId="listing-1"
                locale="es"
                reportedAt="2026-10-11T15:00:00.000Z"
            />
        );

        // Assert
        expect(
            screen.getByText('Avisaste que lo corregiste el 11 de octubre de 2026.')
        ).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(reportFixedMock).not.toHaveBeenCalled();
    });

    it('keeps the button and says it failed when the report is rejected', async () => {
        // Arrange
        reportFixedMock.mockResolvedValue({
            ok: false,
            error: { status: 409, message: 'NO_OPEN_FIX_REQUEST' }
        });
        render(
            <ReportFixedButton
                vertical="accommodation"
                listingId="listing-1"
                locale="es"
                reportedAt={null}
            />
        );

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Ya lo corregí' }));

        // Assert
        await waitFor(() =>
            expect(screen.getByRole('alert')).toHaveTextContent(
                'No pudimos registrar tu aviso. Intentá de nuevo.'
            )
        );
        expect(screen.getByRole('button', { name: 'Ya lo corregí' })).toBeInTheDocument();
        expect(screen.queryByText(/Avisaste que lo corregiste/)).not.toBeInTheDocument();
    });
});
