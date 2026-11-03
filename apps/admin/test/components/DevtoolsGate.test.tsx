import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-devtools', () => ({
    TanStackDevtools: () => <div data-testid="tanstack-devtools" />
}));

afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
});

describe('DevtoolsGate', () => {
    it('does not render devtools in production when NODE_ENV is undefined', async () => {
        vi.stubEnv('PROD', true);
        vi.stubEnv('DEV', false);
        vi.stubEnv('NODE_ENV', undefined);
        vi.resetModules();
        const { DevtoolsGate } = await import('../../src/components/DevtoolsGate');

        render(<DevtoolsGate />);

        expect(screen.queryByTestId('tanstack-devtools')).not.toBeInTheDocument();
    });

    it('renders devtools in development builds', async () => {
        vi.stubEnv('PROD', false);
        vi.stubEnv('DEV', true);
        vi.resetModules();
        const { DevtoolsGate } = await import('../../src/components/DevtoolsGate');

        render(<DevtoolsGate />);

        expect(screen.getByTestId('tanstack-devtools')).toBeInTheDocument();
    });
});
