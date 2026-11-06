import { TanStackDevtools } from '@tanstack/react-devtools';

/** Renders TanStack Devtools only in Vite development builds. */
export function DevtoolsGate() {
    return import.meta.env.DEV ? <TanStackDevtools /> : null;
}
