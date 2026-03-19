import { ToastProvider } from '@/components/ui/ToastProvider';
import { QueryClientProvider } from '@tanstack/react-query';
import { type RenderOptions, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createTestQueryClient } from './create-test-query-client';

interface WrapperProps {
    readonly children: ReactNode;
}

/**
 * Renders a component wrapped in QueryClientProvider and ToastProvider.
 * Returns the render result plus the queryClient instance for test assertions.
 *
 * The ToastProvider uses Flashy.js under the hood. If it causes issues in jsdom,
 * mock `@pablotheblink/flashyjs` in the test setup file.
 */
export function renderWithProviders(
    ui: React.ReactElement,
    options?: Omit<RenderOptions, 'wrapper'>
) {
    const queryClient = createTestQueryClient();

    function Wrapper({ children }: WrapperProps) {
        return (
            <QueryClientProvider client={queryClient}>
                <ToastProvider>{children}</ToastProvider>
            </QueryClientProvider>
        );
    }

    return {
        ...render(ui, { wrapper: Wrapper, ...options }),
        queryClient
    };
}
