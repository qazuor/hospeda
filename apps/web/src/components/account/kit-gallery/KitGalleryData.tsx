/**
 * Gallery group: data display pieces added in phase 3 (HOS-2414): StatCard /
 * StatGrid in each async state, ListRow and Avatar.
 *
 * Dev-only fixture copy: exempt from i18n (see `Visual.tsx`).
 *
 * @module components/account/kit-gallery/KitGalleryData
 */

import { Avatar, Button, ListRow, StatCard, StatGrid } from '@/components/account/ui';
import styles from './KitGallery.module.css';
import type { GalleryGroupProps } from './KitGalleryActions';
import { Visual } from './Visual';

const PLANS = [{ name: 'Plan de ejemplo' }];
const noop = () => undefined;

/**
 * StatCard, StatGrid, ListRow and Avatar.
 *
 * @param props - See {@link GalleryGroupProps}.
 * @returns The group.
 */
export function KitGalleryData({ locale }: GalleryGroupProps) {
    return (
        <section className={styles.group}>
            <h2 className={styles.groupTitle}>Data display</h2>
            <div className={styles.grid}>
                <Visual name="StatGrid/states">
                    <StatGrid>
                        <StatCard
                            id="gallery-ready"
                            label="Propiedades"
                            locale={locale}
                            state={{ status: 'ready', data: { value: 5, hint: '3 publicadas' } }}
                            link={{ href: '#kit', label: 'Gestionar' }}
                        />
                        <StatCard
                            id="gallery-loading"
                            label="Mensajes"
                            locale={locale}
                            state={{ status: 'loading' }}
                        />
                        <StatCard
                            id="gallery-error"
                            label="Visitas"
                            locale={locale}
                            state={{ status: 'error', retry: noop }}
                        />
                        <StatCard
                            id="gallery-empty"
                            label="Reseñas"
                            locale={locale}
                            state={{ status: 'empty' }}
                        />
                    </StatGrid>
                </Visual>
                <Visual name="StatCard/locked">
                    <StatCard
                        id="gallery-locked"
                        label="Visitas"
                        locale={locale}
                        state={{
                            status: 'locked',
                            reason: {
                                kind: 'plan',
                                feature: 'Estadísticas',
                                description: 'Vienen con estos planes.',
                                plans: PLANS,
                                plansHref: '#kit'
                            }
                        }}
                    />
                </Visual>
                <Visual name="ListRow/variants">
                    <ul className={styles.stack}>
                        <ListRow
                            title="Editar perfil"
                            description="Nombre, foto y datos de contacto"
                            href="#kit"
                        />
                        <ListRow
                            title="Casa del río"
                            description="Publicada"
                            media={
                                <Avatar
                                    name="Casa del río"
                                    size="sm"
                                    decorative
                                />
                            }
                            meta="hace 2 días"
                            actions={[
                                <Button
                                    key="edit"
                                    variant="secondary"
                                    size="sm"
                                >
                                    Editar
                                </Button>
                            ]}
                        />
                    </ul>
                </Visual>
                <Visual name="Avatar/sizes">
                    <Avatar
                        name="Ana Pérez"
                        size="sm"
                    />
                    <Avatar
                        name="Bruno Díaz"
                        size="md"
                    />
                    <Avatar
                        name="Carla Ruiz"
                        size="lg"
                    />
                </Visual>
            </div>
        </section>
    );
}
