/**
 * Gallery group: buttons, links, status and navigation pieces (HOS-2413 T-029).
 *
 * Dev-only fixture copy: exempt from i18n (see `Visual.tsx`).
 *
 * @module components/account/kit-gallery/KitGalleryActions
 */

import {
    Button,
    type ButtonVariant,
    CountPill,
    KeyValueList,
    LinkButton,
    NavTabs,
    Pagination,
    StatusPill,
    Stepper,
    Switch,
    SwitchRow,
    Tabs,
    TextLink
} from '@/components/account/ui';
import type { SupportedLocale } from '@/lib/i18n';
import styles from './KitGallery.module.css';
import { Visual } from './Visual';

const VARIANTS: readonly ButtonVariant[] = [
    'primary',
    'secondary',
    'ghost',
    'quiet',
    'danger',
    'danger-ghost',
    'accent'
];

/** Props shared by every gallery group. */
export interface GalleryGroupProps {
    /** Locale of the gallery. */
    readonly locale: SupportedLocale;
}

/**
 * Buttons, links, status pills, pagination, tabs and switches.
 *
 * @param props - See {@link GalleryGroupProps}.
 * @returns The group.
 */
export function KitGalleryActions({ locale }: GalleryGroupProps) {
    return (
        <section className={styles.group}>
            <h2 className={styles.groupTitle}>Actions, status and navigation</h2>
            <div className={styles.grid}>
                {VARIANTS.map((variant) => (
                    <Visual
                        key={variant}
                        name={`Button/${variant}`}
                    >
                        <Button variant={variant}>Guardar</Button>
                        <Button
                            variant={variant}
                            loading
                        >
                            Guardando
                        </Button>
                        <Button
                            variant={variant}
                            disabled
                        >
                            Deshabilitado
                        </Button>
                    </Visual>
                ))}
                <Visual name="Button/sizes">
                    <Button size="sm">sm 36</Button>
                    <Button size="md">md 40</Button>
                    <Button size="lg">lg 44</Button>
                </Visual>
                <Visual name="LinkButton/default">
                    <LinkButton href="#kit">Ver planes</LinkButton>
                    <LinkButton
                        href="https://example.com"
                        variant="secondary"
                        external
                        locale={locale}
                    >
                        Sitio externo
                    </LinkButton>
                </Visual>
                <Visual name="KeyValueList/default">
                    <KeyValueList
                        items={[
                            { key: 'schedule', label: 'Horario', value: 'Lunes a viernes, 9 a 18' },
                            {
                                key: 'status',
                                label: 'Estado',
                                value: <StatusPill tone="success">Activo</StatusPill>
                            },
                            { key: 'contact', label: 'Contacto', value: 'proveedor@example.com' }
                        ]}
                    />
                </Visual>
                <Visual name="TextLink/tones">
                    <TextLink href="#kit">Por defecto</TextLink>
                    <TextLink
                        href="#kit"
                        tone="quiet"
                    >
                        Quieto
                    </TextLink>
                    <TextLink
                        href="#kit"
                        tone="muted"
                    >
                        Apagado
                    </TextLink>
                    <TextLink
                        href="https://example.com"
                        external
                        locale={locale}
                    >
                        Externo
                    </TextLink>
                </Visual>
                <Visual name="StatusPill/tones">
                    <StatusPill tone="success">Publicado</StatusPill>
                    <StatusPill tone="warning">En revisión</StatusPill>
                    <StatusPill tone="danger">Rechazado</StatusPill>
                    <StatusPill tone="info">Programada</StatusPill>
                    <StatusPill tone="neutral">Borrador</StatusPill>
                    <StatusPill tone="plan">Plan</StatusPill>
                </Visual>
                <Visual name="Stepper/states">
                    <Stepper
                        locale={locale}
                        label="Progreso"
                        steps={[
                            { id: 'a', label: 'Tus datos', state: 'done' },
                            { id: 'b', label: 'Preferencias', state: 'current' },
                            { id: 'c', label: 'Confirmar', state: 'upcoming' }
                        ]}
                    />
                </Visual>
                <Visual name="StatusPill/domain">
                    <StatusPill
                        domain="subscription"
                        status="GRACE_PERIOD"
                        locale={locale}
                        dot
                    />
                    <StatusPill
                        domain="moderation"
                        status="APPROVED"
                        locale={locale}
                    />
                </Visual>
                <Visual name="CountPill/variants">
                    <CountPill
                        count={3}
                        label="3 sin leer"
                        variant="solid"
                    />
                    <CountPill
                        count={120}
                        label="120 sin leer"
                    />
                </Visual>
                <Visual name="Pagination/numbered">
                    <Pagination
                        page={5}
                        pageCount={12}
                        locale={locale}
                        hrefFor={(page) => `#page-${page}`}
                    />
                </Visual>
                <Visual name="Pagination/prevNext">
                    <Pagination
                        variant="prevNext"
                        page={1}
                        pageCount={3}
                        locale={locale}
                        onPageChange={() => {}}
                    />
                </Visual>
                <Visual name="Pagination/loadMore">
                    <Pagination
                        variant="loadMore"
                        locale={locale}
                        onLoadMore={async () => undefined}
                    />
                </Visual>
                <Visual name="Tabs/underline">
                    <div className={styles.stack}>
                        <Tabs
                            ariaLabel="Secciones"
                            items={[
                                { id: 'a', label: 'General', panel: <p>Panel general</p> },
                                {
                                    id: 'b',
                                    label: 'Reseñas',
                                    count: 4,
                                    countLabel: '4 reseñas',
                                    panel: <p>Panel reseñas</p>
                                }
                            ]}
                        />
                    </div>
                </Visual>
                <Visual name="Tabs/segmented">
                    <div className={styles.stack}>
                        <Tabs
                            ariaLabel="Vista"
                            variant="segmented"
                            items={[
                                { id: 'a', label: 'Lista', panel: <p>Lista</p> },
                                { id: 'b', label: 'Mapa', panel: <p>Mapa</p> }
                            ]}
                        />
                    </div>
                </Visual>
                <Visual name="NavTabs/default">
                    <div className={styles.stack}>
                        <NavTabs
                            ariaLabel="Mi cuenta"
                            items={[
                                { href: '#perfil', label: 'Perfil', current: true },
                                { href: '#seguridad', label: 'Seguridad' }
                            ]}
                        />
                    </div>
                </Visual>
                <Visual name="Switch/states">
                    <Switch
                        aria-label="Apagado"
                        checked={false}
                        onCheckedChange={() => {}}
                    />
                    <Switch
                        aria-label="Encendido"
                        checked
                        onCheckedChange={() => {}}
                    />
                    <Switch
                        aria-label="Deshabilitado"
                        checked
                        disabled
                        onCheckedChange={() => {}}
                    />
                </Visual>
                <Visual name="SwitchRow/default">
                    <div className={styles.stack}>
                        <SwitchRow
                            label="Recibir avisos por mail"
                            description="Te escribimos cuando hay una novedad."
                            locale={locale}
                            checked
                            onChange={async () => {}}
                        />
                    </div>
                </Visual>
                <Visual name="SwitchRow/locked">
                    <div className={styles.stack}>
                        <SwitchRow
                            label="Destacar mi ficha"
                            locale={locale}
                            checked={false}
                            locked={{ planLabel: 'Plan', href: '#planes' }}
                            onChange={async () => {}}
                        />
                    </div>
                </Visual>
            </div>
        </section>
    );
}
