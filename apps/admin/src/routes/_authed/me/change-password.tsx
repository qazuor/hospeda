import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/me/change-password')({
    beforeLoad: () => {
        throw redirect({
            to: '/mi-cuenta/seguridad/cambiar-password',
            replace: true
        });
    },
    component: () => null
});
