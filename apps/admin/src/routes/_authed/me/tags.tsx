import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/me/tags')({
    beforeLoad: () => {
        throw redirect({
            to: '/account/tags',
            replace: true
        });
    },
    component: () => null
});
