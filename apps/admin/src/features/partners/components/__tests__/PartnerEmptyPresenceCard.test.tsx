import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import { PartnerEmptyPresenceCard } from '../PartnerEmptyPresenceCard';

const mocks = vi.hoisted(() => ({
    hasPermission: true,
    addToast: vi.fn(),
    mutateAsync: vi.fn(),
    pending: false
}));
vi.mock('@/components/auth/PermissionGate', () => ({
    PermissionGate: ({ children }: { children: ReactNode }) =>
        mocks.hasPermission ? children : null
}));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string, values?: { name?: string }) => {
            const messages: Record<string, string> = {
                'admin-entities.partnerEmptyPresence.title': 'Vaciar la presencia del Partner',
                'admin-entities.partnerEmptyPresence.description': 'Descripción',
                'admin-entities.partnerEmptyPresence.action': 'Vaciar presencia',
                'admin-entities.partnerEmptyPresence.dialog.title': `Vaciar la presencia de ${values?.name ?? '{name}'}`,
                'admin-entities.partnerEmptyPresence.dialog.deletes': `Contenido de ${values?.name ?? '{name}'}. Este contenido se borra y no vuelve.`,
                'admin-entities.partnerEmptyPresence.dialog.pending': 'Pendiente',
                'admin-entities.partnerEmptyPresence.dialog.untouched':
                    'El Partner, su cobro y su postulación no se tocan.',
                'admin-entities.partnerEmptyPresence.dialog.reasonLabel': 'Por qué',
                'admin-entities.partnerEmptyPresence.dialog.reasonHelp': 'Ayuda',
                'admin-entities.partnerEmptyPresence.dialog.cancel': 'Cancelar',
                'admin-entities.partnerEmptyPresence.dialog.confirm': 'Vaciar la presencia',
                'admin-entities.partnerEmptyPresence.dialog.confirming': 'Vaciando…',
                'admin-entities.partnerEmptyPresence.successTitle': 'Presencia vaciada',
                'admin-entities.partnerEmptyPresence.successMessage': `El contenido de ${values?.name ?? '{name}'} se borró y no vuelve.`,
                'admin-entities.partnerEmptyPresence.errors.title':
                    'No se pudo vaciar la presencia',
                'admin-entities.partnerEmptyPresence.errors.alreadyEmpty':
                    'La presencia ya no tiene contenido.',
                'admin-entities.partnerEmptyPresence.errors.stateChanged': 'El contenido cambió.',
                'admin-entities.partnerEmptyPresence.errors.storage':
                    'No pudimos borrar los archivos.',
                'admin-entities.partnerEmptyPresence.errors.forbidden':
                    'No podés vaciar esta presencia.'
            };
            return messages[key] ?? key;
        }
    })
}));
vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ addToast: mocks.addToast })
}));
vi.mock('@/features/partners/hooks/usePartnerEmptyPresenceMutation', () => ({
    usePartnerEmptyPresenceMutation: () => ({
        mutateAsync: mocks.mutateAsync,
        isPending: mocks.pending
    })
}));
vi.mock('@/components/ui/alert-dialog', () => {
    let closeDialog = () => {};
    return {
        AlertDialog: ({
            open,
            children,
            onOpenChange
        }: {
            open: boolean;
            children: ReactNode;
            onOpenChange: (open: boolean) => void;
        }) => {
            closeDialog = () => onOpenChange(false);
            return open ? <div data-testid="dialog-root">{children}</div> : null;
        },
        AlertDialogCancel: ({
            children,
            ...props
        }: {
            children: ReactNode;
            [key: string]: unknown;
        }) => (
            <button
                type="button"
                {...props}
                onClick={() => closeDialog()}
            >
                {children}
            </button>
        ),
        AlertDialogContent: ({
            children,
            ...props
        }: {
            children: ReactNode;
            [key: string]: unknown;
        }) => <div {...props}>{children}</div>,
        AlertDialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
        AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
        AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
        AlertDialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>
    };
});
vi.mock('@/components/ui/button', () => ({
    Button: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
        <button {...props}>{children}</button>
    )
}));
vi.mock('@/components/ui/card', () => ({
    Card: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
        <section {...props}>{children}</section>
    ),
    CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>
}));
vi.mock('@/components/ui/label', () => ({
    Label: ({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) => (
        <label htmlFor={htmlFor}>{children}</label>
    )
}));
vi.mock('@/components/ui/textarea', () => ({
    Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />
}));
vi.mock('@repo/icons', () => ({ DeleteIcon: () => <span aria-hidden="true" /> }));

const partnerName = 'Partner de prueba R3';

function setup() {
    const result = render(
        <PartnerEmptyPresenceCard
            partnerId="partner-id"
            partnerName={partnerName}
        />
    );
    return result;
}

function openDialog() {
    fireEvent.click(screen.getByTestId('partner-empty-presence-open'));
}

beforeEach(() => {
    mocks.hasPermission = true;
    mocks.pending = false;
    mocks.addToast.mockReset();
    mocks.mutateAsync.mockReset();
});

describe('PartnerEmptyPresenceCard', () => {
    it('renders nothing without its dedicated permission', () => {
        mocks.hasPermission = false;
        setup();
        expect(screen.queryByTestId('partner-empty-presence')).not.toBeInTheDocument();
        expect(screen.queryByText('Vaciar la presencia del Partner')).not.toBeInTheDocument();
    });

    it('opens the destructive confirmation naming the Partner and explaining the effect', () => {
        setup();
        openDialog();
        const dialog = screen.getByTestId('partner-empty-presence-dialog');
        expect(dialog).toHaveTextContent(partnerName);
        expect(dialog).toHaveTextContent('Este contenido se borra y no vuelve.');
        expect(dialog).toHaveTextContent('El Partner, su cobro y su postulación no se tocan.');
    });

    it('requires a non-blank reason', () => {
        setup();
        openDialog();
        const confirm = screen.getByTestId('partner-empty-presence-confirm');
        expect(confirm).toBeDisabled();
        fireEvent.change(screen.getByTestId('partner-empty-presence-reason'), {
            target: { value: '   ' }
        });
        expect(confirm).toBeDisabled();
        fireEvent.change(screen.getByTestId('partner-empty-presence-reason'), {
            target: { value: ' reason ' }
        });
        expect(confirm).toBeEnabled();
    });

    it('submits the trimmed reason, closes and shows a success toast', async () => {
        mocks.mutateAsync.mockResolvedValue(undefined);
        setup();
        openDialog();
        fireEvent.change(screen.getByTestId('partner-empty-presence-reason'), {
            target: { value: '  owner request  ' }
        });
        fireEvent.click(screen.getByTestId('partner-empty-presence-confirm'));
        await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
        expect(mocks.mutateAsync).toHaveBeenCalledWith({ reason: 'owner request' });
        await waitFor(() =>
            expect(screen.queryByTestId('partner-empty-presence-dialog')).not.toBeInTheDocument()
        );
        expect(mocks.addToast).toHaveBeenCalledWith({
            title: 'Presencia vaciada',
            message: `El contenido de ${partnerName} se borró y no vuelve.`,
            variant: 'success'
        });
    });

    it.each([
        [409, 'PRESENCE_ALREADY_EMPTY', 'La presencia ya no tiene contenido.'],
        [409, 'PRESENCE_STATE_CHANGED', 'El contenido cambió.'],
        [503, undefined, 'No pudimos borrar los archivos.'],
        [403, undefined, 'No podés vaciar esta presencia.'],
        [500, undefined, 'No se pudo vaciar la presencia']
    ])('keeps the dialog and reason after API error %s %s', async (status, reason, message) => {
        mocks.mutateAsync.mockRejectedValue(
            new ApiError('rejected', {
                status,
                body: { error: { reason } }
            })
        );
        setup();
        openDialog();
        const textarea = screen.getByTestId('partner-empty-presence-reason');
        fireEvent.change(textarea, { target: { value: 'keep this reason' } });
        fireEvent.click(screen.getByTestId('partner-empty-presence-confirm'));
        expect(await screen.findByTestId('partner-empty-presence-error')).toHaveTextContent(
            message
        );
        expect(screen.getByTestId('partner-empty-presence-dialog')).toBeInTheDocument();
        expect(textarea).toHaveValue('keep this reason');
    });

    it('does not mutate when cancelled', () => {
        setup();
        openDialog();
        fireEvent.click(screen.getByTestId('partner-empty-presence-cancel'));
        expect(mocks.mutateAsync).not.toHaveBeenCalled();
    });

    it('disables confirmation and shows the pending label while the mutation is pending', () => {
        mocks.pending = true;
        setup();
        openDialog();
        fireEvent.change(screen.getByTestId('partner-empty-presence-reason'), {
            target: { value: 'reason' }
        });
        expect(screen.getByTestId('partner-empty-presence-confirm')).toBeDisabled();
        expect(screen.getByTestId('partner-empty-presence-confirm')).toHaveTextContent('Vaciando…');
    });
});
