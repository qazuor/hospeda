import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/me/settings')({
    beforeLoad: () => {
        throw redirect({
            to: '/account/preferences',
            replace: true
        });
    },
    component: () => null
});
