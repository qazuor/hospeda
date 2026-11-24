/**
 * Gallery group: listing management and billing pieces (HOS-2483, HOS-2485):
 * Menu, ListingCard, PlanSummary, Stepper and OptionCard.
 *
 * Dev-only fixture copy: exempt from i18n (see `Visual.tsx`).
 *
 * @module components/account/kit-gallery/KitGalleryListings
 */

import {
    Button,
    KeyValueList,
    LinkButton,
    ListingCard,
    ListingCardGrid,
    Menu,
    OptionCard,
    OptionCardGrid,
    PlanSummary,
    StatusPill,
    Stepper
} from '@/components/account/ui';
import styles from './KitGallery.module.css';
import type { GalleryGroupProps } from './KitGalleryActions';
import { Visual } from './Visual';

const noop = () => undefined;

const STEPS = [
    { id: 'offer', label: 'Elegí el complemento' },
    { id: 'target', label: 'Elegí la ficha' },
    { id: 'confirm', label: 'Confirmá' }
];

/**
 * Listing cards with their menu, a plan summary, the stepper and option cards.
 *
 * @param props - See {@link GalleryGroupProps}.
 * @returns The group.
 */
export function KitGalleryListings({ locale }: GalleryGroupProps) {
    const menu = (name: string) => (
        <Menu
            label={`Más acciones para ${name}`}
            locale={locale}
            items={[
                { id: 'view', label: 'Ver en el sitio', href: '#kit', external: true },
                { id: 'unpublish', label: 'Despublicar', onSelect: noop },
                { id: 'delete', label: 'Eliminar', onSelect: noop, tone: 'danger' }
            ]}
        />
    );
    return (
        <section className={styles.group}>
            <h2 className={styles.groupTitle}>Listings and billing</h2>
            <div className={styles.grid}>
                <Visual name="Menu/closed">{menu('Casa del Río')}</Visual>
                <Visual name="ListingCardGrid/cards">
                    <div className={styles.stack}>
                        <ListingCardGrid label="Mis propiedades">
                            <ListingCard
                                vertical="accommodation"
                                title="Casa del Río"
                                href="#kit"
                                status={<StatusPill tone="success">Publicada</StatusPill>}
                                meta={['Colón', 'Precio a consultar']}
                                primaryAction={
                                    <LinkButton
                                        href="#kit"
                                        variant="secondary"
                                    >
                                        Editar
                                    </LinkButton>
                                }
                                menu={menu('Casa del Río')}
                            />
                            <ListingCard
                                vertical="venue"
                                title="Bar La Esquina"
                                href="#kit"
                                status={<StatusPill tone="neutral">Borrador</StatusPill>}
                                meta={['Bar']}
                                primaryAction={<Button>Publicar</Button>}
                                menu={menu('Bar La Esquina')}
                            >
                                <p>Falta completar: foto principal.</p>
                            </ListingCard>
                        </ListingCardGrid>
                    </div>
                </Visual>
                <Visual name="PlanSummary/active">
                    <div className={styles.stack}>
                        <PlanSummary
                            name="Plan de ejemplo"
                            status={<StatusPill tone="success">Activa</StatusPill>}
                            scope="Alojamientos"
                            price="Precio del catálogo por mes"
                            renewal="Próximo cobro: 1 de diciembre"
                        >
                            <KeyValueList
                                items={[
                                    {
                                        key: 'method',
                                        label: 'Medio de pago',
                                        value: 'Mercado Pago'
                                    },
                                    { key: 'since', label: 'Desde', value: '1 de noviembre' }
                                ]}
                            />
                        </PlanSummary>
                    </div>
                </Visual>
                <Visual name="Stepper/second">
                    <div className={styles.stack}>
                        <Stepper
                            steps={STEPS}
                            current={1}
                            label="Compra de complemento"
                            locale={locale}
                        />
                    </div>
                </Visual>
                <Visual name="Stepper/with-back">
                    <div className={styles.stack}>
                        <Stepper
                            steps={STEPS}
                            current={2}
                            label="Compra de complemento"
                            locale={locale}
                            action={
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={noop}
                                >
                                    Volver
                                </Button>
                            }
                        />
                    </div>
                </Visual>
                <Visual name="OptionCard/states">
                    <div className={styles.stack}>
                        <OptionCardGrid>
                            <OptionCard
                                title="Destacado"
                                description="Tu ficha aparece primero en la búsqueda."
                                onClick={noop}
                            />
                            <OptionCard
                                title="Video"
                                description="Sumá un video a tu ficha."
                                badge={<StatusPill tone="success">Activo</StatusPill>}
                                disabled
                            />
                        </OptionCardGrid>
                    </div>
                </Visual>
            </div>
        </section>
    );
}
