import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BugReportForm } from './BugReportForm';

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const DEFAULT_PROPS = {
    apiBaseUrl: 'http://localhost:3001',
    reporterName: 'Test User',
    reporterEmail: 'test@example.com'
};

describe('BugReportForm', () => {
    beforeEach(() => {
        mockFetch.mockReset();

        // Default: labels endpoint returns empty
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ labels: [] })
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should render all required form fields', async () => {
        render(<BugReportForm {...DEFAULT_PROPS} />);

        expect(screen.getByLabelText(/titulo/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/descripcion/i)).toBeInTheDocument();
        expect(screen.getByText(/prioridad/i)).toBeInTheDocument();
        expect(screen.getByText(/severidad/i)).toBeInTheDocument();
        expect(screen.getByText(/enviar reporte/i)).toBeInTheDocument();
    });

    it('should display reporter info as read-only', () => {
        render(<BugReportForm {...DEFAULT_PROPS} />);

        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('should show validation errors for empty required fields', async () => {
        const user = userEvent.setup();
        render(<BugReportForm {...DEFAULT_PROPS} />);

        // Submit with empty title and description
        const submitButton = screen.getByText(/enviar reporte/i);
        await user.click(submitButton);

        await waitFor(() => {
            expect(
                screen.getByText(/titulo debe tener al menos 5 caracteres/i)
            ).toBeInTheDocument();
            expect(
                screen.getByText(/descripcion debe tener al menos 10 caracteres/i)
            ).toBeInTheDocument();
        });
    });

    it('should show character count for title and description', () => {
        render(<BugReportForm {...DEFAULT_PROPS} />);

        expect(screen.getByText('0/200')).toBeInTheDocument();
        expect(screen.getByText('0/5000')).toBeInTheDocument();
    });

    it('should fetch labels on mount', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                labels: [
                    { id: '1', name: 'Bug', color: '#ff0000', parentName: null },
                    { id: '2', name: 'UI', color: '#00ff00', parentName: 'Area' }
                ]
            })
        });

        render(<BugReportForm {...DEFAULT_PROPS} />);

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/v1/reports/labels', {
                credentials: 'include'
            });
        });
    });

    it('should show success message after successful submission', async () => {
        const user = userEvent.setup();

        // First call: labels fetch
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ labels: [] })
        });

        render(<BugReportForm {...DEFAULT_PROPS} />);

        // Fill required fields
        const titleInput = screen.getByLabelText(/titulo/i);
        const descriptionInput = screen.getByLabelText(/descripcion/i);

        await user.type(titleInput, 'Test bug report title');
        await user.type(descriptionInput, 'This is a detailed description of the bug report');

        // Mock successful submission
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                data: {
                    issueId: 'issue-123',
                    issueUrl: 'https://linear.app/team/issue-123',
                    identifier: 'TEAM-123'
                }
            })
        });

        // Submit
        const submitButton = screen.getByText(/enviar reporte/i);
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText(/gracias por tu reporte/i)).toBeInTheDocument();
            expect(screen.getByText('TEAM-123')).toBeInTheDocument();
        });
    });

    it('should show error message on submission failure', async () => {
        const user = userEvent.setup();

        // First call: labels fetch
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ labels: [] })
        });

        render(<BugReportForm {...DEFAULT_PROPS} />);

        // Fill required fields
        await user.type(screen.getByLabelText(/titulo/i), 'Test bug report title');
        await user.type(
            screen.getByLabelText(/descripcion/i),
            'This is a detailed description of the bug report'
        );

        // Mock failed submission
        mockFetch.mockResolvedValueOnce({
            ok: false,
            json: async () => ({
                success: false,
                error: { message: 'Linear integration not configured' }
            })
        });

        await user.click(screen.getByText(/enviar reporte/i));

        await waitFor(() => {
            expect(screen.getByText(/error al enviar el reporte/i)).toBeInTheDocument();
            expect(screen.getByText(/linear integration not configured/i)).toBeInTheDocument();
        });
    });

    it('should allow reporting another bug after success', async () => {
        const user = userEvent.setup();

        // Labels fetch
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ labels: [] })
        });

        render(<BugReportForm {...DEFAULT_PROPS} />);

        // Fill and submit
        await user.type(screen.getByLabelText(/titulo/i), 'Test bug report title');
        await user.type(
            screen.getByLabelText(/descripcion/i),
            'This is a detailed description of the bug report'
        );

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                data: {
                    issueId: 'issue-123',
                    issueUrl: 'https://linear.app/team/issue-123',
                    identifier: 'TEAM-123'
                }
            })
        });

        await user.click(screen.getByText(/enviar reporte/i));

        await waitFor(() => {
            expect(screen.getByText(/gracias por tu reporte/i)).toBeInTheDocument();
        });

        // Click "report another"
        // Labels fetch for new form
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ labels: [] })
        });

        await user.click(screen.getByText(/reportar otro bug/i));

        await waitFor(() => {
            expect(screen.getByLabelText(/titulo/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/titulo/i)).toHaveValue('');
        });
    });
});
