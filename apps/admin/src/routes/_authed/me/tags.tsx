import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/me/tags')({
    beforeLoad: () => {
        throw redirect({
            to: '/mi-cuenta/etiquetas',
            replace: true
        });
    },
    component: () => null
});
