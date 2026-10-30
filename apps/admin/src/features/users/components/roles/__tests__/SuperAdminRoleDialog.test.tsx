// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SuperAdminRoleDialog } from '../SuperAdminRoleDialog';

const identity = { displayName: 'Ada Admin', email: 'ada@example.test' };
const confirmSpy = vi.fn();
vi.mock('@/features/users/hooks/useUserQuery', () => ({
    useUserQuery: () => ({ data: identity, isLoading: false })
}));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string, values?: Record<string, string>) => {
            const labels: Record<string, string> = {
                'admin-pages.access.users.roles.superAdmin.title.assign': 'Dar el rol SUPER_ADMIN',
                'admin-pages.access.users.roles.superAdmin.title.remove':
                    'Quitar el rol SUPER_ADMIN',
                'admin-pages.access.users.roles.superAdmin.description.assign': `Le vas a dar el rol SUPER_ADMIN a ${values?.name} (${values?.email}). Con el rol va a poder ejecutar estas acciones:`,
                'admin-pages.access.users.roles.superAdmin.description.remove': `Le vas a quitar el rol SUPER_ADMIN a ${values?.name} (${values?.email}). Va a dejar de poder ejecutar estas acciones:`,
                'admin-pages.access.users.roles.superAdmin.reasonLabel': 'Motivo (obligatorio)',
                'admin-pages.access.users.roles.superAdmin.reasonPlaceholder': 'Motivo',
                'admin-pages.access.users.roles.superAdmin.confirm.assign': 'Dar el rol',
                'admin-pages.access.users.roles.superAdmin.confirm.remove': 'Quitar el rol',
                'admin-pages.access.users.roles.superAdmin.cancel': 'Cancelar',
                'admin-pages.access.users.roles.superAdmin.rows.ACC_17':
                    'Migrar a los clientes de un plan retirado',
                'admin-pages.access.users.roles.superAdmin.rows.ACC_18':
                    'Publicar una versión de plan',
                'admin-pages.access.users.roles.superAdmin.rows.ACC_19':
                    'Fijar el precio de un ciclo',
                'admin-pages.access.users.roles.superAdmin.rows.ACC_20':
                    'Publicar una versión de complemento',
                'admin-pages.access.users.roles.superAdmin.rows.ACC_21':
                    'Crear o cerrar un código promocional',
                'admin-pages.access.users.roles.superAdmin.rows.ACC_22': 'Cambiar un plazo',
                'admin-pages.access.users.roles.superAdmin.rows.ACC_26':
                    'Asignar o quitar el rol SUPER_ADMIN'
            };
            return labels[key] ?? key;
        }
    })
}));

function Harness({ change }: { readonly change: 'ASSIGN' | 'REMOVE' }) {
    const [open, setOpen] = useState(true);
    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(!open)}
            >
                Toggle
            </button>
            <SuperAdminRoleDialog
                userId="user-1"
                change={change}
                open={open}
                onOpenChange={setOpen}
                pending={false}
                onConfirm={confirmSpy}
            />
        </>
    );
}

describe('SuperAdminRoleDialog', () => {
    it('shows the account identity, assign wording, and exactly seven action rows', () => {
        render(<Harness change="ASSIGN" />);
        expect(screen.getByTestId('super-admin-role-dialog').textContent).toContain('Ada Admin');
        expect(screen.getByTestId('super-admin-role-dialog').textContent).toContain(
            'ada@example.test'
        );
        expect(screen.getByTestId('super-admin-role-dialog').textContent).toContain(
            'va a poder ejecutar'
        );
        expect(
            Array.from(screen.getByTestId('super-admin-role-rows').children).map(
                (row) => row.textContent
            )
        ).toEqual([
            'Migrar a los clientes de un plan retirado',
            'Publicar una versión de plan',
            'Fijar el precio de un ciclo',
            'Publicar una versión de complemento',
            'Crear o cerrar un código promocional',
            'Cambiar un plazo',
            'Asignar o quitar el rol SUPER_ADMIN'
        ]);
    });

    it('uses remove wording and requires a non-blank reason, then sends it trimmed', () => {
        render(<Harness change="REMOVE" />);
        expect(screen.getByTestId('super-admin-role-dialog').textContent).toContain(
            'dejar de poder ejecutar'
        );
        const confirm = screen.getByTestId('super-admin-role-confirm') as HTMLButtonElement;
        expect(confirm.disabled).toBe(true);
        const reason = screen.getByTestId('super-admin-role-reason');
        fireEvent.change(reason, { target: { value: '   ' } });
        expect(confirm.disabled).toBe(true);
        fireEvent.change(reason, { target: { value: '  approved by owner  ' } });
        expect(confirm.disabled).toBe(false);
        confirmSpy.mockClear();
        fireEvent.click(confirm);
        expect(confirmSpy).toHaveBeenCalledWith({ reason: 'approved by owner' });
    });

    it('clears the reason after closing and reopening', () => {
        render(<Harness change="ASSIGN" />);
        fireEvent.change(screen.getByTestId('super-admin-role-reason'), {
            target: { value: 'sensitive reason' }
        });
        fireEvent.click(screen.getByText('Toggle'));
        fireEvent.click(screen.getByText('Toggle'));
        expect((screen.getByTestId('super-admin-role-reason') as HTMLTextAreaElement).value).toBe(
            ''
        );
    });
});
