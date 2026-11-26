/** Shared accommodation FAQ transport fixtures for the migrated regression suites. */
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { FaqSection } from '@/components/account/editor/FaqSection.client';
import type { AccommodationFaqItem } from '@/lib/api/endpoints-protected';
import { createT } from '@/lib/i18n';

/** Existing API mocks, shared by accommodation CRUD and validation tests. */
const { mockAdd, mockUpdate, mockRemove, mockReorder, mockToast } = vi.hoisted(() => ({
    mockToast: vi.fn(),
    mockAdd: vi.fn(),
    mockUpdate: vi.fn(),
    mockRemove: vi.fn(),
    mockReorder: vi.fn()
}));

export { mockAdd, mockRemove, mockReorder, mockToast as addToast, mockUpdate };

vi.mock('@/hooks/use-faq-ai-draft', () => ({
    useFaqAiDraft: () => ({ isLoading: false, feedback: null, suggest: vi.fn() })
}));
vi.mock('@/components/host/editor/PlanEntitlementGate.client', () => ({
    PlanEntitlementGate: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));
vi.mock('@/lib/i18n', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/i18n')>()),
    createTranslations: () => ({
        t: (key: string, fallback?: string, params?: Record<string, unknown>) => {
            const raw = fallback ?? createT('es')(key);
            if (!params) return raw;
            return Object.keys(params).reduce(
                (acc, k) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(params[k])),
                raw
            );
        },
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));
vi.mock('@/lib/logger', () => ({ webLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/store/toast-store', () => ({ addToast: mockToast }));
vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationFaqApi: {
        add: mockAdd,
        update: mockUpdate,
        remove: mockRemove,
        reorder: mockReorder
    }
}));

/** First sorted accommodation FAQ. */
export const FAQ_1: AccommodationFaqItem = {
    id: 'faq-1',
    question: '¿Cuándo es el check-in?',
    answer: 'A partir de las 14hs.',
    category: null,
    displayOrder: 0,
    isVisibleOnListing: true,
    isUsableByAi: true
};
/** Second sorted accommodation FAQ. */
export const FAQ_2: AccommodationFaqItem = {
    id: 'faq-2',
    question: '¿Aceptan mascotas?',
    answer: 'Sí, previa consulta.',
    category: null,
    displayOrder: 1,
    isVisibleOnListing: true,
    isUsableByAi: true
};

/** Renders the shared controller using the accommodation route's exact policy. */
export function renderSection(initialFaqs: readonly AccommodationFaqItem[] = []) {
    return render(
        <FaqSection
            vertical="accommodation"
            namespace="host.properties.editor.faq"
            showCategory={false}
            errorSurface="toast"
            validationMode="schema"
            locale="es"
            listingId="acc-1"
            initialFaqs={initialFaqs}
        />
    );
}
