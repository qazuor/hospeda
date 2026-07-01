// @vitest-environment jsdom
/**
 * @file BasicInfoSection.integration.test.tsx
 * @description End-to-end integration tests for the AI text-improve chain
 * (SPEC-321 T-005): real `useAiTextImprove` hook + real `AiTextImprovePanel`
 * component, mounted through the real `BasicInfoSection`, with `fetch`
 * mocked at the network boundary (the only mock at the SUT-adjacent layer)
 * and `useMyEntitlements` mocked to force the `ai_text_improve` entitlement
 * on (its own fetch-based behavior is out of scope here — see
 * `useMyEntitlements`'s own test suite).
 *
 * ## Why this file exists (the gap it fills)
 *
 * - `use-ai-text-improve.test.ts` (T-001) proves the hook's state machine
 *   in isolation, with a raw `renderHook` and no consumer component.
 * - `AiTextImprovePanel.test.tsx` (T-002) proves the panel renders every
 *   status correctly, but MOCKS `useAiTextImprove` — the panel never talks
 *   to a real hook, let alone a real fetch/SSE stream.
 * - `BasicInfoSection.test.tsx` (T-003/T-004) proves the wiring (entitlement
 *   gating, `onAccept` → `onFieldChange`), but MOCKS `AiTextImprovePanel`
 *   entirely as a stub button.
 *
 * None of the three prove the full chain (section → gate → panel → hook →
 * fetch → SSE) behaves correctly together. This file closes that gap for
 * the error and unmount scenarios called out in the task.
 *
 * ## Field choice
 *
 * Only the `description` field is exercised here. Both `description` and
 * `summary` render the exact same `AiTextImprovePanel` + `useAiTextImprove`
 * code path (see `BasicInfoSection.client.tsx` — the two usages are
 * identical except for `fieldType`/`onFieldChange` key), so a second,
 * duplicated end-to-end suite for `summary` would add maintenance cost
 * with no additional coverage of the integration seam this task targets.
 * `can_use_rich_description` is forced OFF so `description` renders as the
 * plain `<textarea>` branch (the `RichTextEditor`/TipTap branch is
 * orthogonal to the AI-improve wiring and is already exercised, mocked-CSS
 * only, by `BasicInfoSection.test.tsx`).
 *
 * ## SSE mocking strategy
 *
 * Reuses the controllable-`ReadableStream` pattern established in
 * `use-ai-text-improve.test.ts` (`enqueueSse`/`closeSse`), ported here
 * verbatim since it already produces correctly-shaped SSE frames.
 */

import { BasicInfoSection } from '@/components/host/editor/BasicInfoSection.client';
import type { BasicInfoSectionProps } from '@/components/host/editor/BasicInfoSection.client';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/components/host/editor/BasicInfoSection.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

vi.mock('@/components/host/editor/PlanEntitlementGate.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

vi.mock('@/components/host/editor/AiTextImprovePanel.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

// RichTextEditor is statically imported by BasicInfoSection (its CSS module
// is imported at module top-level even when `can_use_rich_description` is
// off and the plain-textarea branch is the one that actually renders).
vi.mock('@/components/host/editor/RichTextEditor.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

// Force the ai_text_improve entitlement ON (and rich-description OFF, so
// `description` renders as the plain textarea branch). This is the one
// mock boundary the task explicitly allows besides `fetch`.
vi.mock('@/hooks/useMyEntitlements', () => ({
    useMyEntitlements: () => ({
        has: (key: string) => key === 'ai_text_improve',
        isLoading: false,
        error: null,
        limit: vi.fn(() => -1),
        plan: null
    })
}));

// ---------------------------------------------------------------------------
// SSE test helpers (ported from use-ai-text-improve.test.ts)
// ---------------------------------------------------------------------------

interface ControllableSseResponse {
    readonly response: Response;
    enqueueSse: (event: string, data: unknown) => void;
    closeSse: () => void;
}

const makeSseResponse = (): ControllableSseResponse => {
    let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            controllerRef = controller;
        }
    });

    const enqueueSse = (event: string, data: unknown) => {
        if (!controllerRef) throw new Error('Stream controller not initialised');
        const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controllerRef.enqueue(encoder.encode(frame));
    };

    const closeSse = () => {
        if (!controllerRef) return;
        controllerRef.close();
        controllerRef = null;
    };

    const response = new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' }
    });

    return { response, enqueueSse, closeSse };
};

/** JSON error response for pre-stream HTTP error tests (403 gates). */
const makeJsonErrorResponse = (status: number, code: string, message: string): Response => {
    return new Response(JSON.stringify({ error: { code, message } }), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
};

/**
 * Installs a `fetch` mock that delegates to the supplied factory. Only the
 * AI text-improve endpoint is ever hit in these tests (entitlements are
 * mocked at the hook level), so no URL branching is needed.
 */
const installFetchMock = (factory: () => Promise<Response> | Response) => {
    const spy = vi.fn(async () => factory());
    vi.stubGlobal('fetch', spy);
    return spy;
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_DATA = {
    id: 'acc-1',
    name: 'Test Hotel',
    summary: 'Test summary for accommodation',
    description: 'Test description with content',
    type: 'HOTEL',
    destinationId: 'dest-1',
    latitude: null,
    longitude: null,
    maxGuests: 2,
    bedrooms: 1,
    bathrooms: 1,
    beds: 1,
    basePrice: 1000,
    currency: 'ARS',
    isAvailable: true,
    isFeatured: false,
    amenityIds: [],
    featureIds: [],
    phone: '',
    email: '',
    website: '',
    facebookUrl: '',
    instagramUrl: '',
    twitterUrl: '',
    linkedinUrl: '',
    tiktokUrl: '',
    youtubeUrl: ''
};

const MOCK_DESTINATIONS = [{ id: 'dest-1', name: 'Concepción del Uruguay' }];

const buildProps = (overrides: Partial<BasicInfoSectionProps> = {}): BasicInfoSectionProps => ({
    locale: 'es',
    data: MOCK_DATA,
    destinations: MOCK_DESTINATIONS,
    errors: {},
    onFieldChange: vi.fn(),
    ...overrides
});

/**
 * `AiTextImprovePanel` uses the same static `data-testid` regardless of
 * `fieldType` (it has no knowledge of which form field it's attached to).
 * `BasicInfoSection` mounts one panel for `summary` and one for
 * `description`, in that DOM order — so the SECOND trigger button is
 * always the `description` one. Once that trigger is clicked, only the
 * `description` panel opens (the `summary` panel stays idle/hidden), so
 * every other `ai-text-improve-*` testid becomes unambiguous again.
 */
const getDescriptionTrigger = (): HTMLElement =>
    screen.getAllByTestId('ai-text-improve-trigger')[1];

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BasicInfoSection integration — description field, real hook + real panel (SPEC-321 T-005)', () => {
    it('shows a dismissible error when the server returns 403 ENTITLEMENT_REQUIRED (pre-stream)', async () => {
        installFetchMock(() =>
            makeJsonErrorResponse(403, 'ENTITLEMENT_REQUIRED', 'Plan lacks entitlement')
        );

        render(<BasicInfoSection {...buildProps()} />);

        fireEvent.click(getDescriptionTrigger());

        const errorMessage = await screen.findByTestId('ai-text-improve-error-message');
        expect(errorMessage).toHaveAttribute('role', 'alert');
        expect(errorMessage).toHaveTextContent(
            'Tu plan no incluye mejora de texto con IA. Actualizá tu plan para acceder.'
        );

        // Dismissible: clicking dismiss returns the panel to idle (no crash,
        // no residual error UI).
        fireEvent.click(screen.getByTestId('ai-text-improve-dismiss'));
        await waitFor(() =>
            expect(screen.queryByTestId('ai-text-improve-panel')).not.toBeInTheDocument()
        );
    });

    it('shows a dismissible error when the server returns 403 LIMIT_REACHED (pre-stream)', async () => {
        installFetchMock(() =>
            makeJsonErrorResponse(403, 'LIMIT_REACHED', 'Monthly limit reached')
        );

        render(<BasicInfoSection {...buildProps()} />);

        fireEvent.click(getDescriptionTrigger());

        const errorMessage = await screen.findByTestId('ai-text-improve-error-message');
        expect(errorMessage).toHaveAttribute('role', 'alert');
        expect(errorMessage).toHaveTextContent(
            'Alcanzaste el límite mensual de mejoras con IA. Actualizá tu plan o esperá el próximo mes.'
        );

        fireEvent.click(screen.getByTestId('ai-text-improve-dismiss'));
        await waitFor(() =>
            expect(screen.queryByTestId('ai-text-improve-panel')).not.toBeInTheDocument()
        );
    });

    it('shows an error state instead of throwing/hanging when fetch rejects (network failure)', async () => {
        installFetchMock(() => Promise.reject(new TypeError('Failed to fetch')));

        render(<BasicInfoSection {...buildProps()} />);

        fireEvent.click(getDescriptionTrigger());

        const errorMessage = await screen.findByTestId('ai-text-improve-error-message');
        expect(errorMessage).toHaveAttribute('role', 'alert');
        // NETWORK_INTERRUPTED maps to this fallback copy in the panel.
        expect(errorMessage).toHaveTextContent('Se cortó la conexión. Reintentá.');
    });

    it('shows an error state instead of throwing/hanging when the SSE stream closes without a done event', async () => {
        const sse = makeSseResponse();
        installFetchMock(() => sse.response);

        render(<BasicInfoSection {...buildProps()} />);

        fireEvent.click(getDescriptionTrigger());

        await screen.findByTestId('ai-text-improve-loading');

        await act(async () => {
            sse.enqueueSse('token', { delta: 'Parcial ' });
            sse.enqueueSse('token', { delta: 'sin terminar' });
        });

        await waitFor(() =>
            expect(screen.getByTestId('ai-text-improve-streaming')).toHaveTextContent(
                'Parcial sin terminar'
            )
        );

        // Close the stream WITHOUT a `done` event — simulates a network drop
        // mid-stream (R-3). Must surface an error, not throw or hang.
        await act(async () => {
            sse.closeSse();
        });

        const errorMessage = await screen.findByTestId('ai-text-improve-error-message');
        expect(errorMessage).toHaveAttribute('role', 'alert');
        expect(errorMessage).toHaveTextContent('Se cortó la conexión. Reintentá.');

        // Safety invariant: no partial suggestion text survives the error.
        const panel = screen.getByTestId('ai-text-improve-panel');
        expect(panel).not.toHaveTextContent('Parcial sin terminar');
    });

    it('unmounts cleanly mid-stream (tokens already accumulated) with no React "unmounted component" warning', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const sse = makeSseResponse();
        installFetchMock(() => sse.response);

        const { unmount } = render(<BasicInfoSection {...buildProps()} />);

        fireEvent.click(getDescriptionTrigger());

        await screen.findByTestId('ai-text-improve-loading');

        await act(async () => {
            sse.enqueueSse('token', { delta: 'Texto en curso' });
        });

        await waitFor(() =>
            expect(screen.getByTestId('ai-text-improve-streaming')).toHaveTextContent(
                'Texto en curso'
            )
        );

        // Unmount while the SSE stream is still open (no `done`/`closeSse`
        // call) — the hook's cleanup effect must abort the in-flight fetch
        // and suppress any further state updates.
        unmount();

        const stateUpdateWarnings = consoleSpy.mock.calls.filter(
            (call) => typeof call[0] === 'string' && call[0].includes('unmounted')
        );
        expect(stateUpdateWarnings).toHaveLength(0);

        consoleSpy.mockRestore();
    });
});
