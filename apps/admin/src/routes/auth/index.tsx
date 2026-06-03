import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/auth/')({
    beforeLoad: () => {
        // SPEC-182: the admin no longer hosts its own signin page. Bounce the
        // bare /auth/ path to the admin root, which routes through the _authed
        // guard and on to the unified web signin for unauthenticated users.
        throw redirect({ to: '/' });
    }
});
