// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import type { AdminCatalogPlan } from '@repo/schemas';
import { ENTITLEMENT_KEY_DEFINITIONS } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlanVersionForm } from '../PlanVersionForm';

const fetchApi = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/client', () => ({ fetchApi }));
vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => ['MAINTENANCE_MODE_WRITE']
}));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        locale: 'es-AR',
        t: (key: string, values?: Record<string, unknown>) => {
            const text =
                key
                    .split('.')
                    .slice(1)
                    .reduce((node: any, part) => node?.[part], es) ?? key;
            return Object.entries(values ?? {}).reduce(
                (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
                text
            );
        },
        tPlural: (key: string, count: number) => {
            const parts = key.split('.').slice(1);
            const leaf = parts.pop();
            const parent = parts.reduce((node: any, part) => node?.[part], es);
            return (parent?.[`${leaf}_${count === 1 ? 'one' : 'other'}`] ?? key).replaceAll(
                '{{count}}',
                String(count)
            );
        }
    })
}));
const plan: AdminCatalogPlan = {
    planId: '11111111-1111-4111-8111-111111111111',
    slug: 'plus',
    name: 'Plus',
    description: null,
    pricingOrder: 1,
    role: null,
    currentVersion: {
        versionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        rank: 4,
        sellable: true,
        trialDays: 14,
        graceDays: 2,
        allowsPause: true,
        inheritsTouristVip: true,
        cycles: ['monthly', 'annual'],
        entitlements: [{ key: 'ai_search', planQuota: 50, trialQuota: 5 }],
        limits: [{ key: 'max_accommodations', value: 8 }]
    }
} as const;
function renderForm(data: AdminCatalogPlan = plan) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <PlanVersionForm
                plan={data}
                onCancel={vi.fn()}
                onPublished={vi.fn()}
            />
        </QueryClientProvider>
    );
}

describe('TEST:1704:14 PlanVersionForm', () => {
    it('preloads the current version fields, cycles, keys and quotas', () => {
        renderForm();
        expect(screen.getByLabelText(es.planCatalogEditor.columns.rank)).toHaveValue(4);
        expect(screen.getByLabelText(es.planCatalogEditor.columns.trialDays)).toHaveValue(14);
        expect(screen.getByLabelText(es.planCatalogEditor.form.planQuota)).toHaveValue('50');
        expect(screen.getByLabelText(es.planCatalogEditor.form.trialQuota)).toHaveValue('5');
        expect(screen.getByLabelText(es.planCatalogEditor.cycles.monthly)).toBeChecked();
        expect(screen.getByLabelText(es.planCatalogEditor.cycles.annual)).toBeChecked();
        expect(screen.getByTestId(`plan-version-form-${plan.planId}`)).toHaveTextContent(
            'ai_search (50 / 5)'
        );
    });
    it('uses the base draft and supports adding and removing a limit row', () => {
        renderForm({ ...plan, currentVersion: null });
        expect(screen.getByLabelText(es.planCatalogEditor.columns.rank)).toHaveValue(0);
        expect(screen.getByText(es.planCatalogEditor.noCurrentVersion)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: es.planCatalogEditor.form.addLimit }));
        const fieldset = screen
            .getByText(es.planCatalogEditor.form.limitsLegend)
            .closest('fieldset');
        expect(fieldset).not.toBeNull();
        const selects = within(fieldset as HTMLElement).getAllByRole('combobox');
        expect(selects).toHaveLength(1);
        fireEvent.click(
            within(fieldset as HTMLElement).getByRole('button', {
                name: es.planCatalogEditor.form.remove
            })
        );
        expect(
            within(fieldset as HTMLElement).getByRole('button', {
                name: es.planCatalogEditor.form.addLimit
            })
        ).toBeInTheDocument();
    });
    it('locks entitlement additions on trial plans and offers sorted catalog keys', () => {
        const trial = renderForm({ ...plan, role: 'trial', currentVersion: null });
        expect(screen.getByText(es.planCatalogEditor.form.trialNote)).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: es.planCatalogEditor.form.addEntitlement })
        ).toBeDisabled();
        trial.unmount();
        renderForm();
        fireEvent.click(
            screen.getByRole('button', { name: es.planCatalogEditor.form.addEntitlement })
        );
        const select = screen.getAllByLabelText(
            es.planCatalogEditor.form.key
        )[0] as HTMLSelectElement;
        expect(
            Array.from(select.options)
                .slice(1)
                .map((option) => option.value)
        ).toEqual(
            [...ENTITLEMENT_KEY_DEFINITIONS]
                .map(({ key }) => key)
                .sort((a, b) => a.localeCompare(b))
        );
    });
});
