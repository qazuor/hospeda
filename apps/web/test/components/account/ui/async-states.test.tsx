/**
 * Tests for Alert, ErrorState and AsyncRegion (HOS-2413 T-024).
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
    Alert,
    AsyncRegion,
    type AsyncResult,
    EmptyState,
    ErrorState,
    Skeleton,
    settleAsync
} from '../../../../src/components/account/ui';

describe('Alert', () => {
    it.each([
        ['info', 'status'],
        ['success', 'status'],
        ['warning', 'status'],
        ['danger', 'alert']
    ] as const)('%s tone uses role %s and says its tone in words', (tone, role) => {
        render(
            <Alert
                tone={tone}
                locale="es"
                title="Titulo"
            >
                Cuerpo
            </Alert>
        );
        const alert = screen.getByRole(role);
        expect(alert).toHaveClass('alert', tone);
        expect(alert).toHaveTextContent('Cuerpo');
        expect(alert.textContent).toMatch(/Información|Listo|Atención|Error/);
    });

    it('has a banner variant and an action slot', () => {
        render(
            <Alert
                variant="banner"
                locale="es"
                action={<button type="button">Ir</button>}
            >
                x
            </Alert>
        );
        expect(screen.getByRole('status')).toHaveClass('banner');
        expect(screen.getByRole('button', { name: 'Ir' })).toBeInTheDocument();
    });
});

describe('ErrorState', () => {
    it('block is role=alert with a translated title and a retry button', async () => {
        const user = userEvent.setup();
        const onRetry = vi.fn();
        render(
            <ErrorState
                locale="es"
                onRetry={onRetry}
            />
        );
        expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar esto');
        await user.click(screen.getByRole('button', { name: 'Reintentar' }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('inline is a danger Alert', () => {
        render(
            <ErrorState
                locale="en"
                variant="inline"
                onRetry={() => {}}
            />
        );
        expect(screen.getByRole('alert')).toHaveClass('alert', 'danger');
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });

    it('shows a retrying state and puts focus back on the retry button when it finishes', async () => {
        const user = userEvent.setup();
        let finish: () => void = () => {};
        render(
            <ErrorState
                locale="es"
                onRetry={() => new Promise<void>((resolve) => (finish = resolve))}
            />
        );
        const button = screen.getByRole('button', { name: 'Reintentar' });
        await user.click(button);
        expect(button).toHaveAttribute('aria-busy', 'true');
        // Focus wanders off while retrying
        (document.activeElement as HTMLElement).blur();
        finish();
        await waitFor(() => expect(button).toHaveFocus());
        expect(button).not.toHaveAttribute('aria-busy');
    });
});

describe('AsyncRegion', () => {
    function Region({ state }: { readonly state: AsyncResult<number[]> }) {
        return (
            <AsyncRegion
                state={state}
                loading={() => (
                    <Skeleton
                        locale="es"
                        shape="block"
                    />
                )}
                error={({ retry }) => (
                    <ErrorState
                        locale="es"
                        onRetry={retry}
                    />
                )}
                empty={() => <EmptyState title="Sin datos" />}
                locked={(reason) => <p>bloqueado {reason.kind}</p>}
                ready={(data) => <p>total {data.length}</p>}
            />
        );
    }

    it('draws each state with its own piece', () => {
        const retry = vi.fn();
        const states: [AsyncResult<number[]>, RegExp][] = [
            [{ status: 'loading' }, /Cargando/],
            [{ status: 'error', retry }, /No pudimos cargar esto/],
            [{ status: 'empty' }, /Sin datos/],
            [
                {
                    status: 'locked',
                    reason: { kind: 'permission', feature: 'x', description: 'y', helpHref: '/h' }
                },
                /bloqueado permission/
            ],
            [{ status: 'ready', data: [1, 2] }, /total 2/]
        ];
        for (const [state, expected] of states) {
            const { container, unmount } = render(<Region state={state} />);
            expect(container).toHaveTextContent(expected);
            unmount();
        }
    });

    it('regression (HOS-2421/2422/2424): a rejected fetch renders ErrorState, never empty and never 0', async () => {
        // Arrange
        const retry = vi.fn();
        const state = await settleAsync<number[]>({
            load: () => Promise.reject(new Error('network down')),
            retry,
            isEmpty: (data) => data.length === 0
        });
        // Act
        const { container } = render(<Region state={state} />);
        // Assert
        expect(state.status).toBe('error');
        expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar esto');
        expect(screen.queryByText('Sin datos')).toBeNull();
        expect(container.textContent).not.toMatch(/total 0|network down/);
    });

    it('settleAsync maps a successful empty result to empty and data to ready', async () => {
        const retry = vi.fn();
        const isEmpty = (data: number[]) => data.length === 0;
        expect(await settleAsync({ load: async () => [], retry, isEmpty })).toEqual({
            status: 'empty'
        });
        expect(await settleAsync({ load: async () => [1], retry, isEmpty })).toEqual({
            status: 'ready',
            data: [1]
        });
    });
});
