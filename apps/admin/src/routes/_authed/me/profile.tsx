import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/me/profile')({
    beforeLoad: () => {
        throw redirect({
            to: '/mi-cuenta/perfil',
            replace: true
        });
    },
    component: () => null
});
