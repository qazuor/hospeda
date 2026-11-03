/**
 * @file trigger-outcome.test.tsx
 * @description HOS-1999: the manual cron trigger answers 201 (ran in the
 * request), 202 (exclusive job accepted, running in the background) or 409
 * (another run holds the cron lock). The hooks normalise those answers and
 * the card renders each one, reading a 202's result from the run history.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';

const fetchApiMock = vi.fn();

vi.mock('@/lib/api/client', () => ({
    fetchApi: (...args: unknown[]) => fetchApiMock(...args)
}));

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string, params?: Record<string, unknown>) =>
            params ? `${key} ${JSON.stringify(params)}` : key
    })
}));

import { CronJobCard } from '@/features/cron-jobs/components/CronJobCard';
import { triggerCronJob, useAcceptedCronRunQuery } from '@/features/cron-jobs/hooks';
import type { CronJobAdmin } from '@/features/cron-jobs/types';

const JOB = {
    name: 'billing-reconciliation-sweep',
    displayName: 'Reconciliation sweep',
    description: 'Sweeps billing',
    schedule: '10 2 * * *',
    scheduleHuman: 'At 02:10',
    enabled: true,
    category: 'billing',
    lastRun: null,
    nextRunAt: null
} as unknown as CronJobAdmin;

const COMPLETED = {
    success: true,
    message: 'done',
    processed: 3,
    errors: 0,
    durationMs: 120,
    jobName: JOB.name,
    dryRun: false,
    executedAt: '2026-11-03T12:00:00.000Z'
};

const ACCEPTED = {
    accepted: true,
    runId: 'run-accepted-1',
    jobName: JOB.name,
    dryRun: false,
    executedAt: '2026-11-03T12:00:00.000Z'
};

function recordedRun(runId: string) {
    return {
        id: '00000000-0000-4000-8000-000000000001',
        jobName: JOB.name,
        status: 'success',
        startedAt: '2026-11-03T12:00:00.000Z',
        finishedAt: '2026-11-03T12:00:05.000Z',
        durationMs: 5000,
        processed: 7,
        errors: 0,
        executionMode: 'manual',
        dryRun: false,
        errorMessage: null,
        details: { runId },
        createdAt: '2026-11-03T12:00:05.000Z'
    };
}

function conflict(holderRunId?: string): ApiError {
    return new ApiError('Cron job is already running', {
        status: 409,
        body: {
            success: false,
            error: {
                code: 'CONFLICT',
                message: 'Cron job is already running',
                ...(holderRunId ? { details: { holderRunId } } : {})
            }
        }
    });
}

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } }
    });
    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
}

beforeEach(() => {
    fetchApiMock.mockReset();
});

describe('triggerCronJob', () => {
    it('returns completed for a 201 body', async () => {
        fetchApiMock.mockResolvedValue({ data: { success: true, data: COMPLETED }, status: 201 });

        const outcome = await triggerCronJob({ jobName: JOB.name });

        expect(outcome).toEqual({ kind: 'completed', result: COMPLETED });
    });

    it('returns accepted for a 202 body', async () => {
        fetchApiMock.mockResolvedValue({ data: { success: true, data: ACCEPTED }, status: 202 });

        const outcome = await triggerCronJob({ jobName: JOB.name });

        expect(outcome).toEqual({ kind: 'accepted', accepted: ACCEPTED });
    });

    it('returns busy with the holder run id for a 409', async () => {
        fetchApiMock.mockRejectedValue(conflict('run-holder-9'));

        const outcome = await triggerCronJob({ jobName: JOB.name });

        expect(outcome).toEqual({ kind: 'busy', holderRunId: 'run-holder-9' });
    });

    it('returns busy with an unknown holder when the 409 carries no details', async () => {
        fetchApiMock.mockRejectedValue(conflict());

        const outcome = await triggerCronJob({ jobName: JOB.name });

        expect(outcome).toEqual({ kind: 'busy', holderRunId: null });
    });

    it('rethrows any other error', async () => {
        fetchApiMock.mockRejectedValue(new ApiError('boom', { status: 500 }));

        await expect(triggerCronJob({ jobName: JOB.name })).rejects.toThrow('boom');
    });
});

describe('useAcceptedCronRunQuery', () => {
    it('reads the run history and maps the run matched by details.runId', async () => {
        fetchApiMock.mockResolvedValue({
            data: {
                success: true,
                data: { items: [recordedRun('other-run'), recordedRun('run-accepted-1')] }
            },
            status: 200
        });

        const { result } = renderHook(
            () => useAcceptedCronRunQuery({ jobName: JOB.name, runId: 'run-accepted-1' }),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => expect(result.current.data).toBeTruthy());
        expect(result.current.data).toMatchObject({
            success: true,
            processed: 7,
            durationMs: 5000,
            details: { runId: 'run-accepted-1' }
        });
        const [arg] = fetchApiMock.mock.calls[0] as [{ path: string }];
        expect(arg.path).toContain('/api/v1/admin/cron/runs?');
        expect(arg.path).toContain(`jobName=${JOB.name}`);
        expect(arg.path).toContain('executionMode=manual');
    });

    it('does not query without a run id', () => {
        renderHook(() => useAcceptedCronRunQuery({ jobName: JOB.name, runId: null }), {
            wrapper: makeWrapper()
        });

        expect(fetchApiMock).not.toHaveBeenCalled();
    });
});

describe('CronJobCard trigger outcomes', () => {
    function clickRun() {
        fireEvent.click(screen.getByRole('button', { name: /admin-billing.cron.card.runButton/ }));
    }

    it('renders the 201 result inline', async () => {
        fetchApiMock.mockResolvedValue({ data: { success: true, data: COMPLETED }, status: 201 });
        render(<CronJobCard job={JOB} />, { wrapper: makeWrapper() });

        clickRun();

        expect(await screen.findByText('admin-billing.cron.card.successTitle')).toBeTruthy();
        expect(screen.getByText('120ms')).toBeTruthy();
        expect(screen.queryByTestId('cron-trigger-accepted')).toBeNull();
    });

    it('renders a 202 as accepted, not as an error, then shows the recorded run', async () => {
        fetchApiMock.mockImplementation(async ({ path }: { path: string }) => {
            if (path.includes('/runs?')) {
                return {
                    data: { success: true, data: { items: [recordedRun('run-accepted-1')] } },
                    status: 200
                };
            }
            return { data: { success: true, data: ACCEPTED }, status: 202 };
        });
        render(<CronJobCard job={JOB} />, { wrapper: makeWrapper() });

        clickRun();

        expect(await screen.findByText('admin-billing.cron.card.successTitle')).toBeTruthy();
        expect(screen.getByText('5000ms')).toBeTruthy();
        expect(screen.queryByText('admin-billing.cron.card.errorTitle')).toBeNull();
        expect(screen.queryByText(/undefinedms/)).toBeNull();
    });

    it('keeps the accepted panel while the run is not recorded yet', async () => {
        fetchApiMock.mockImplementation(async ({ path }: { path: string }) => {
            if (path.includes('/runs?')) {
                return { data: { success: true, data: { items: [] } }, status: 200 };
            }
            return { data: { success: true, data: ACCEPTED }, status: 202 };
        });
        render(<CronJobCard job={JOB} />, { wrapper: makeWrapper() });

        clickRun();

        const panel = await screen.findByTestId('cron-trigger-accepted');
        expect(panel.textContent).toContain('admin-billing.cron.card.acceptedTitle');
        expect(panel.textContent).toContain('run-accepted-1');
        expect(screen.queryByText('admin-billing.cron.card.errorTitle')).toBeNull();
    });

    it('renders a 409 as already running with the holder run id', async () => {
        fetchApiMock.mockRejectedValue(conflict('run-holder-9'));
        render(<CronJobCard job={JOB} />, { wrapper: makeWrapper() });

        clickRun();

        const panel = await screen.findByTestId('cron-trigger-busy');
        expect(panel.textContent).toContain('admin-billing.cron.card.busyTitle');
        expect(panel.textContent).toContain('run-holder-9');
        expect(screen.queryByText('admin-billing.cron.card.runErrorTitle')).toBeNull();
    });
});
