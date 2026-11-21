/**
 * Gallery group: feedback, async states, save models, overlays and the
 * account chrome pieces (HOS-2413 T-029).
 *
 * Overlays (Dialog, ConfirmDialog, Drawer) cover the whole viewport, so only
 * ONE can be open at a time: the page reads `?open=<name>` and opens that one
 * in a static state for the screenshot. Without it they are closed and a
 * trigger button opens them by hand.
 *
 * Dev-only fixture copy: exempt from i18n (see `Visual.tsx`).
 *
 * @module components/account/kit-gallery/KitGalleryFeedback
 */

import { useState } from 'react';
import {
    AccountBar,
    AccountFooter,
    AccountSidebar,
    AccountToastRegion,
    Alert,
    AsyncRegion,
    AutoSaveChip,
    Button,
    buildSidebarView,
    ConfirmDialog,
    Dialog,
    Drawer,
    EmptyState,
    ErrorState,
    LockedState,
    PageHeader,
    Skeleton,
    StatusPill,
    StickySaveBar,
    Toast
} from '@/components/account/ui';
import { buildAccountNavModel } from '@/lib/account-nav-model';
import { addToast, type Toast as ToastModel } from '@/store/toast-store';
import styles from './KitGallery.module.css';
import type { GalleryGroupProps } from './KitGalleryActions';
import { Visual } from './Visual';

/** Names accepted by `?open=`. */
type OverlayName = 'dialog' | 'confirm' | 'drawer-bottom' | 'drawer-right';

/** Props of {@link KitGalleryFeedback}. */
export interface KitGalleryFeedbackProps extends GalleryGroupProps {
    /** Overlay opened statically for a screenshot (`?open=`), if any. */
    readonly openOverlay?: string | null;
}

const PLANS = [{ name: 'Plan de ejemplo' }];

const FIXTURE_TOAST = (type: ToastModel['type'], message: string): ToastModel => ({
    id: `gallery-${type}`,
    type,
    message,
    duration: 0,
    version: 0
});

/**
 * Alerts, async states, save models, overlays and chrome pieces.
 *
 * @param props - See {@link KitGalleryFeedbackProps}.
 * @returns The group.
 */
export function KitGalleryFeedback({ locale, openOverlay }: KitGalleryFeedbackProps) {
    const [open, setOpen] = useState<OverlayName | null>(
        (['dialog', 'confirm', 'drawer-bottom', 'drawer-right'] as const).find(
            (name) => name === openOverlay
        ) ?? null
    );
    const sidebarView = buildSidebarView({
        locale,
        model: buildAccountNavModel({
            roles: ['USER', 'HOST'],
            ownsHostTradeListing: false,
            mcpEnabled: true,
            activeSection: 'editar'
        })
    });

    return (
        <section className={styles.group}>
            <h2 className={styles.groupTitle}>Feedback, states and chrome</h2>
            <div className={styles.grid}>
                {(['info', 'success', 'warning', 'danger'] as const).map((tone) => (
                    <Visual
                        key={tone}
                        name={`Alert/${tone}`}
                    >
                        <div className={styles.stack}>
                            <Alert
                                tone={tone}
                                locale={locale}
                                title="Título del aviso"
                            >
                                Texto del aviso para el tono {tone}.
                            </Alert>
                        </div>
                    </Visual>
                ))}
                <Visual name="Alert/banner">
                    <div className={styles.stack}>
                        <Alert
                            variant="banner"
                            tone="warning"
                            locale={locale}
                            action={<Button size="sm">Resolver</Button>}
                        >
                            Tu plan vence pronto.
                        </Alert>
                    </div>
                </Visual>
                <Visual name="ErrorState/block">
                    <div className={styles.stack}>
                        <ErrorState
                            locale={locale}
                            onRetry={() => {}}
                        />
                    </div>
                </Visual>
                <Visual name="ErrorState/inline">
                    <div className={styles.stack}>
                        <ErrorState
                            locale={locale}
                            variant="inline"
                            onRetry={() => {}}
                        />
                    </div>
                </Visual>
                <Visual name="Skeleton/shapes">
                    <div className={styles.stack}>
                        <Skeleton
                            shape="title"
                            locale={locale}
                        />
                        <Skeleton
                            lines={3}
                            locale={locale}
                        />
                        <Skeleton
                            shape="block"
                            locale={locale}
                        />
                        <Skeleton.Row locale={locale} />
                        <Skeleton.Stat locale={locale} />
                    </div>
                </Visual>
                <Visual name="EmptyState/default">
                    <div className={styles.stack}>
                        <EmptyState
                            title="Todavía no hay reseñas"
                            description="Cuando recibas una, aparece acá."
                            action={<Button variant="secondary">Pedir reseñas</Button>}
                        />
                    </div>
                </Visual>
                <Visual name="EmptyState/compact">
                    <div className={styles.stack}>
                        <EmptyState
                            variant="compact"
                            title="Sin resultados"
                        />
                    </div>
                </Visual>
                {(['loading', 'error', 'empty', 'ready'] as const).map((status) => (
                    <Visual
                        key={status}
                        name={`AsyncRegion/${status}`}
                    >
                        <div className={styles.stack}>
                            <AsyncRegion
                                state={
                                    status === 'ready'
                                        ? { status, data: ['uno', 'dos'] }
                                        : status === 'error'
                                          ? { status, retry: () => {} }
                                          : { status }
                                }
                                loading={() => (
                                    <Skeleton
                                        lines={2}
                                        locale={locale}
                                    />
                                )}
                                error={({ retry }) => (
                                    <ErrorState
                                        locale={locale}
                                        variant="inline"
                                        onRetry={retry}
                                    />
                                )}
                                empty={() => <EmptyState title="Sin datos" />}
                                locked={() => null}
                                ready={(data) => <p>{data.join(', ')}</p>}
                            />
                        </div>
                    </Visual>
                ))}
                <Visual name="LockedState/plan">
                    <div className={styles.stack}>
                        <LockedState
                            locale={locale}
                            reason={{
                                kind: 'plan',
                                feature: 'Carta digital',
                                description: 'Mostrá tus platos con fotos.',
                                plans: PLANS,
                                plansHref: '#planes',
                                onStartTrial: () => {}
                            }}
                        />
                    </div>
                </Visual>
                <Visual name="LockedState/role">
                    <div className={styles.stack}>
                        <LockedState
                            locale={locale}
                            reason={{
                                kind: 'role',
                                feature: 'Mis locales',
                                description: 'Publicá tu restaurante.',
                                joinHref: '#sumarme'
                            }}
                        />
                    </div>
                </Visual>
                <Visual name="LockedState/permission">
                    <div className={styles.stack}>
                        <LockedState
                            locale={locale}
                            reason={{
                                kind: 'permission',
                                feature: 'Equipo',
                                description: 'Solo el dueño puede invitar.',
                                helpHref: '#ayuda'
                            }}
                        />
                    </div>
                </Visual>
                {(['dirty', 'saving', 'saved', 'error'] as const).map((status) => (
                    <Visual
                        key={status}
                        name={`StickySaveBar/${status}`}
                    >
                        <div className={styles.stack}>
                            <StickySaveBar
                                status={status}
                                locale={locale}
                                onSave={() => {}}
                                onDiscard={() => {}}
                                onGoToFirstError={() => {}}
                            />
                        </div>
                    </Visual>
                ))}
                {(['saving', 'saved', 'error'] as const).map((status) => (
                    <Visual
                        key={status}
                        name={`AutoSaveChip/${status}`}
                    >
                        <AutoSaveChip
                            status={status}
                            savedAt={new Date('2026-11-20T17:32:00Z')}
                            locale={locale}
                            onRetry={() => {}}
                        />
                    </Visual>
                ))}
                <Visual name="PageHeader/full">
                    <div className={styles.stack}>
                        <PageHeader
                            title="La Casona"
                            locale={locale}
                            description="Editá cómo se ve tu local."
                            breadcrumbs={[
                                { label: 'Mi cuenta', href: '#cuenta' },
                                { label: 'Locales', href: '#locales' },
                                { label: 'La Casona' }
                            ]}
                            back={{ label: 'Volver a mis locales', href: '#locales' }}
                            status={
                                <StatusPill
                                    tone="success"
                                    dot
                                >
                                    Publicado
                                </StatusPill>
                            }
                            actions={<Button>Guardar</Button>}
                        />
                    </div>
                </Visual>
                {(['success', 'error', 'info', 'loading'] as const).map((type) => (
                    <Visual
                        key={type}
                        name={`Toast/${type}`}
                    >
                        <Toast
                            toast={FIXTURE_TOAST(type, `Aviso ${type}`)}
                            locale={locale}
                        />
                    </Visual>
                ))}
                <Visual name="AccountToastRegion/live">
                    <Button
                        variant="secondary"
                        onClick={() =>
                            addToast({
                                type: 'success',
                                message: 'Cambios guardados',
                                duration: 4000
                            })
                        }
                    >
                        Mostrar un toast
                    </Button>
                    <AccountToastRegion locale={locale} />
                </Visual>
                <Visual name="AccountSidebar/default">
                    <div className={styles.stack}>
                        <AccountSidebar
                            view={sidebarView}
                            locale={locale}
                        />
                    </div>
                </Visual>
                <Visual name="AccountBar/default">
                    <div className={styles.stack}>
                        <AccountBar
                            view={sidebarView}
                            locale={locale}
                        />
                    </div>
                </Visual>
                <Visual name="AccountFooter/default">
                    <div className={styles.stack}>
                        <AccountFooter
                            locale={locale}
                            year={2026}
                        />
                    </div>
                </Visual>
                <Visual name="Dialog/trigger">
                    <Button
                        variant="secondary"
                        onClick={() => setOpen('dialog')}
                    >
                        Abrir diálogo
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => setOpen('confirm')}
                    >
                        Abrir confirmación
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => setOpen('drawer-bottom')}
                    >
                        Abrir panel inferior
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => setOpen('drawer-right')}
                    >
                        Abrir panel lateral
                    </Button>
                </Visual>
            </div>

            <Dialog
                open={open === 'dialog'}
                onOpenChange={(next) => setOpen(next ? 'dialog' : null)}
                title="Editar datos"
                locale={locale}
                description="Cambiá lo que quieras y guardá."
                footer={<Button>Guardar</Button>}
            >
                <p>Contenido del diálogo.</p>
            </Dialog>
            <ConfirmDialog
                open={open === 'confirm'}
                title="Eliminar carta"
                description="Se pierden las secciones y los platos."
                confirmLabel="Eliminar carta"
                locale={locale}
                onConfirm={() => setOpen(null)}
                onCancel={() => setOpen(null)}
            />
            <Drawer
                open={open === 'drawer-bottom'}
                onOpenChange={(next) => setOpen(next ? 'drawer-bottom' : null)}
                title="Filtros"
                locale={locale}
            >
                <p>Contenido del panel.</p>
            </Drawer>
            <Drawer
                open={open === 'drawer-right'}
                onOpenChange={(next) => setOpen(next ? 'drawer-right' : null)}
                title="Detalle"
                locale={locale}
                side="right"
            >
                <p>Contenido del panel lateral.</p>
            </Drawer>
        </section>
    );
}
