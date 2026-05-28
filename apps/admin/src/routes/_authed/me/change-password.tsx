import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/me/change-password')({
    beforeLoad: () => {
        throw redirect({
            to: '/account/security/change-password',
            replace: true
        });
    },
    component: () => null
});
