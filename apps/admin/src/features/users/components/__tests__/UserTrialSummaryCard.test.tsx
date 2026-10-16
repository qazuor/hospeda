// @vitest-environment jsdom
/** TEST:V8a:7 (panel, fila 4) — assertions read the real Spanish admin copy. */
import esPages from '@repo/i18n/locales/es/admin-pages.json';
import { PermissionEnum, SubscribeDestinationVerticalSchema } from '@repo/schemas';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserTrialSummaryCard } from '../UserTrialSummaryCard';

const fetchMock = vi.fn();
const permissionMock = vi.fn<() => PermissionEnum[]>(() => []);
const rowsMock = vi.fn();
let rows: Array<Record<string, unknown>> = [];

function lookup(key: string): unknown {
    let value: unknown = esPages;
    for (const part of key.replace(/^admin-pages\./, '').split('.')) {
        value =
            typeof value === 'object' && value !== null
                ? (value as Record<string, unknown>)[part]
                : undefined;
    }
    return value;
}

function translate(key: string, params?: Record<string, unknown>): string {
    const value = lookup(key);
    if (typeof value !== 'string') return key;
    return Object.entries(params ?? {}).reduce(
        (text, [name, item]) => text.replaceAll(`{{${name}}}`, String(item)),
        value
    );
}

function plural(key: string, count: number, params?: Record<string, unknown>): string {
    return translate(`${key}_${count === 1 ? 'one' : 'other'}`, params);
}

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: translate, tPlural: plural, locale: 'es-AR' })
}));
vi.mock('@/hooks/use-user-permissions', () => ({ useUserPermissions: () => permissionMock() }));
vi.mock('@/features/users/hooks/useUserTrialSummaries', () => ({
    useUserTrialSummaries: (input: unknown) => {
        rowsMock(input);
        return rows;
    }
}));
vi.mock('@/lib/api/client', () => ({ fetchApi: fetchMock }));

const verticals = SubscribeDestinationVerticalSchema.options;
const dates = { startedAt: '2026-01-01T00:00:00.000Z', endsAt: '2026-02-15T00:00:00.000Z' };
const trial = {
    summary: {
        status: 'TRIAL_ACTIVE',
        ...dates,
        totalDays: 45,
        origins: { base: 30, promo: 10, support: 5 }
    },
    ceilingDays: 90
};
const none = { summary: { status: 'NONE' }, ceilingDays: null };

function makeRows(data: unknown = none) {
    return verticals.map((vertical) => ({ vertical, data, isLoading: false, isError: false }));
}
function renderCard() {
    return render(<UserTrialSummaryCard userId="user-1" />);
}

beforeEach(() => {
    permissionMock.mockReset();
    permissionMock.mockReturnValue([PermissionEnum.BILLING_SUBSCRIPTION_INSPECT]);
    rows = makeRows();
    rowsMock.mockClear();
    fetchMock.mockReset();
});

describe('TEST:V8a:7 (panel, fila 4) UserTrialSummaryCard', () => {
    it('with inspection permission reads three verticals and renders all rows', () => {
        renderCard();
        expect(rowsMock).toHaveBeenCalledWith({ userId: 'user-1', enabled: true });
        expect(screen.getByTestId('user-trial-summary')).toBeInTheDocument();
        for (const vertical of verticals)
            expect(screen.getByTestId(`user-trial-summary-${vertical}`)).toBeInTheDocument();
        expect(screen.getAllByText('Sin prueba gratis en esta vertical.')).toHaveLength(3);
    });

    it('shows the received total, ceiling, positive origins, and dates', () => {
        rows = makeRows(trial);
        renderCard();
        expect(screen.getByTestId('user-trial-summary-accommodation')).toHaveTextContent(
            '45 de 90 días máx.'
        );
        expect(screen.getByTestId('user-trial-summary-accommodation')).toHaveTextContent(
            '30 del plan, 10 por promociones, 5 regalados por soporte'
        );
        expect(screen.queryByText(/Llegó al techo/)).not.toBeInTheDocument();
        expect(screen.getByTestId('user-trial-summary-accommodation')).toHaveTextContent(
            /Del .* al .*/
        );
    });

    it('omits zero origins and renders support only', () => {
        rows = makeRows({
            ...trial,
            summary: { ...trial.summary, origins: { base: 0, promo: 0, support: 1 }, totalDays: 1 }
        });
        renderCard();
        expect(screen.getAllByText('1 regalado por soporte')).toHaveLength(3);
        expect(screen.queryByText(/del plan|por promociones/)).not.toBeInTheDocument();
    });

    it('uses singular total copy and supports singular with ceiling', () => {
        rows = makeRows({
            ...trial,
            summary: { ...trial.summary, totalDays: 1 },
            ceilingDays: null
        });
        const { rerender } = renderCard();
        expect(screen.getByTestId('user-trial-summary-accommodation')).toHaveTextContent(
            '1 día de prueba en total'
        );
        rows = makeRows({ ...trial, summary: { ...trial.summary, totalDays: 1 }, ceilingDays: 1 });
        rerender(<UserTrialSummaryCard userId="user-1" />);
        expect(screen.getByTestId('user-trial-summary-accommodation')).toHaveTextContent(
            '1 de 1 día máx.'
        );
    });

    it('says NONE and consumed without a clock without rendering dates', () => {
        rows = makeRows(none);
        const { rerender } = renderCard();
        expect(screen.getAllByText('Sin prueba gratis en esta vertical.')).toHaveLength(3);
        rows = makeRows({
            summary: {
                status: 'TRIAL_ACTIVE',
                startedAt: null,
                endsAt: null,
                totalDays: 0,
                origins: { base: 0, promo: 0, support: 0 }
            },
            ceilingDays: null
        });
        rerender(<UserTrialSummaryCard userId="user-1" />);
        expect(
            screen.getAllByText('La prueba ya se consumió; no tiene reloj ni días.')
        ).toHaveLength(3);
        expect(screen.queryByText(/Del /)).not.toBeInTheDocument();
    });

    it('renders expired status and isolates a failed row', () => {
        rows = makeRows({ ...trial, summary: { ...trial.summary, status: 'TRIAL_EXPIRED' } });
        rows[1] = { vertical: verticals[1], data: undefined, isLoading: false, isError: true };
        renderCard();
        expect(screen.getByTestId('user-trial-summary-accommodation')).toHaveTextContent('Vencida');
        expect(screen.getByTestId('user-trial-summary-experience')).toHaveTextContent('Vencida');
        expect(screen.getByText('No pudimos leer la prueba de esta vertical.')).toBeInTheDocument();
        expect(screen.getByTestId('user-trial-summary-accommodation')).toHaveTextContent(
            '45 de 90 días máx.'
        );
        expect(screen.getByTestId('user-trial-summary-experience')).toHaveTextContent(
            '45 de 90 días máx.'
        );
    });

    it('does not render or query without the inspection permission', () => {
        permissionMock.mockReturnValue([
            PermissionEnum.USER_READ_ALL,
            PermissionEnum.USER_CLOSE_ON_REQUEST,
            PermissionEnum.TRIAL_EXTEND
        ]);
        renderCard();
        expect(screen.queryByTestId('user-trial-summary')).not.toBeInTheDocument();
        expect(rowsMock).toHaveBeenCalledWith({ userId: 'user-1', enabled: false });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('shows server totals and ceiling and only warns at or above the ceiling', () => {
        rows = makeRows({
            ...trial,
            summary: {
                ...trial.summary,
                totalDays: 44,
                startedAt: '2000-01-01T00:00:00Z',
                endsAt: '2000-01-02T00:00:00Z'
            }
        });
        const { rerender } = renderCard();
        expect(screen.getByTestId('user-trial-summary-accommodation')).toHaveTextContent(
            '44 de 90 días máx.'
        );
        expect(screen.queryByText(/Llegó al techo/)).not.toBeInTheDocument();
        rows = makeRows({ ...trial, summary: { ...trial.summary, totalDays: 90 } });
        rerender(<UserTrialSummaryCard userId="user-1" />);
        expect(screen.getAllByText(/Llegó al techo de días de prueba/)).toHaveLength(3);
        rows = makeRows({ ...trial, summary: { ...trial.summary, totalDays: 100 } });
        rerender(<UserTrialSummaryCard userId="user-1" />);
        expect(screen.getAllByText(/Llegó al techo de días de prueba/)).toHaveLength(3);
        rows = makeRows({ ...trial, ceilingDays: null });
        rerender(<UserTrialSummaryCard userId="user-1" />);
        expect(screen.getByTestId('user-trial-summary-accommodation')).toHaveTextContent(
            '45 días de prueba en total'
        );
        expect(screen.queryByText(/días máx\./)).not.toBeInTheDocument();
    });
});
