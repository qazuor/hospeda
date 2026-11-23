/**
 * Gallery group: data display (StatCard, StatGrid, Avatar), data lists, entity cards
 * (HOS-2480) and conversations (HOS-2481).
 *
 * Dev-only fixture copy: exempt from i18n (see `Visual.tsx`).
 *
 * @module components/account/kit-gallery/KitGalleryData
 */

import {
    Avatar,
    Button,
    Composer,
    ConversationThread,
    CountPill,
    DataList,
    EntityCard,
    EntityCardGrid,
    ListRow,
    MessageBubble,
    StatCard,
    StatGrid,
    type ThreadMessage
} from '@/components/account/ui';
import styles from './KitGallery.module.css';
import type { GalleryGroupProps } from './KitGalleryActions';
import { Visual } from './Visual';

const PLANS = [{ name: 'Plan de ejemplo' }];
const noop = () => undefined;

const MESSAGES: readonly ThreadMessage[] = [
    {
        id: 'm1',
        senderType: 'guest',
        body: 'Hola, ¿tienen lugar del 12 al 15 de enero para dos personas?',
        createdAt: '2026-11-20T14:05:00.000Z'
    },
    {
        id: 'm2',
        senderType: 'owner',
        body: 'Hola. Sí, tenemos la cabaña chica libre esas noches.',
        createdAt: '2026-11-20T15:30:00.000Z'
    },
    {
        id: 'm3',
        senderType: 'system',
        body: 'La conversación se reabrió.',
        createdAt: '2026-11-20T15:31:00.000Z'
    },
    {
        id: 'm4',
        senderType: 'guest',
        body: 'Genial, ¿aceptan mascotas?',
        createdAt: '2026-11-20T16:00:00.000Z',
        delivery: 'failed'
    }
];

/**
 * StatCard and StatGrid states, Avatar, a DataList with ListRows, the thread from both
 * viewers, a bubble, entity cards and the composer.
 *
 * @param props - See {@link GalleryGroupProps}.
 * @returns The group.
 */
export function KitGalleryData({ locale }: GalleryGroupProps) {
    return (
        <section className={styles.group}>
            <h2 className={styles.groupTitle}>Data display, lists and conversations</h2>
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
                <Visual name="DataList/rows">
                    <DataList label="Consultas">
                        <ListRow
                            href="#kit"
                            title="Cabañas del Río"
                            meta="Cabaña chica"
                            description="Hola, ¿tienen lugar del 12 al 15 de enero?"
                            trailing={
                                <>
                                    <span>20 nov</span>
                                    <CountPill
                                        count={2}
                                        label="2 sin leer"
                                        variant="solid"
                                    />
                                </>
                            }
                            emphasis
                        />
                        <ListRow
                            href="#kit"
                            title="Hostel Centro"
                            description="Gracias por la respuesta."
                            trailing={<span>18 nov</span>}
                        />
                        <ListRow
                            title="Casa de campo"
                            meta="Sin enlace, con dos acciones"
                            actions={[
                                <Button
                                    key="open"
                                    size="sm"
                                    variant="secondary"
                                >
                                    Abrir
                                </Button>,
                                <Button
                                    key="archive"
                                    size="sm"
                                    variant="ghost"
                                >
                                    Archivar
                                </Button>
                            ]}
                        />
                    </DataList>
                </Visual>
                <Visual name="ConversationThread/guest">
                    <ConversationThread
                        viewer="guest"
                        messages={MESSAGES}
                        locale={locale}
                        onRetry={() => undefined}
                    />
                </Visual>
                <Visual name="ConversationThread/owner">
                    <ConversationThread
                        viewer="owner"
                        messages={MESSAGES.slice(0, 3)}
                        locale={locale}
                    />
                </Visual>
                <Visual name="MessageBubble/sending">
                    <ol className={styles.stack}>
                        <MessageBubble
                            side="mine"
                            body="Mensaje en camino"
                            senderLabel="Vos"
                            sentAt="2026-11-20T16:00:00.000Z"
                            sentAtLabel="20 nov 13:00"
                            locale={locale}
                            delivery="sending"
                        />
                    </ol>
                </Visual>
                <Visual name="EntityCardGrid/cards">
                    <EntityCardGrid label="Favoritos">
                        <EntityCard
                            locale={locale}
                            title="Cabaña del río"
                            href="#cabana"
                            meta="Alojamiento"
                            actions={
                                <Button
                                    variant="danger-ghost"
                                    size="sm"
                                >
                                    Quitar
                                </Button>
                            }
                        >
                            <p>Para el finde largo de marzo.</p>
                        </EntityCard>
                        <EntityCard
                            locale={locale}
                            title="Verano en familia"
                            href="#verano"
                            media={<span>★</span>}
                            meta="4 favoritos"
                        />
                    </EntityCardGrid>
                </Visual>
                <Visual name="EntityCard/no-image">
                    <EntityCard
                        as="div"
                        locale={locale}
                        title="Museo histórico"
                        meta="Atracción"
                    />
                </Visual>
                <Visual name="Composer/default">
                    <Composer
                        locale={locale}
                        onSend={() => undefined}
                    />
                </Visual>
                <Visual name="Composer/error">
                    <Composer
                        locale={locale}
                        onSend={() => undefined}
                        error="Enviaste demasiados mensajes. Esperá un momento."
                    />
                </Visual>
            </div>
        </section>
    );
}
