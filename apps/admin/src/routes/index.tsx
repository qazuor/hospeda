import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
    beforeLoad: () => {
        // The admin has no public landing page. Always route to the dashboard;
        // unauthenticated visitors are caught by the _authed guard, which
        // redirects them to the unified web signin (SPEC-182).
        throw redirect({ to: '/dashboard' });
    }
});
