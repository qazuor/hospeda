/**
 * Admin Guided Tour Catalog — v1 (SPEC-174 T-007)
 *
 * Welcome tour definitions for the four enabled admin roles (HOST, EDITOR,
 * ADMIN, SUPER_ADMIN). Each welcome tour:
 *
 *   - Has `kind: 'welcome'` (no `route` — fires from any first authenticated
 *     route, redirecting to `/dashboard` when needed per D13).
 *   - Has `trigger: 'auto-first-visit'` so it is offered automatically on
 *     first login.
 *   - Has `showWelcomeModal: true` to display the Radix Dialog warm greeting
 *     before the spotlight walkthrough.
 *   - Contains steps that reference only targets from {@link KNOWN_DATA_TOUR_IDS}
 *     (cross-checked at boot by `AdminIAConfigSchema` §T1).
 *   - Targets exactly the role it belongs to (cross-checked by §T2).
 *
 * Step text is inline `I18nLabel` (es/en/pt) — warm, friendly, professional
 * Rioplatense-neutral Spanish with natural English and Portuguese equivalents.
 * No slang, no technical jargon. The audience is non-technical panel users.
 *
 * Contextual mini-tours (15 entries) will be added in a subsequent task
 * alongside the layout `data-tour` attributes they target.
 *
 * @see apps/admin/src/config/ia/tour.schema.ts — ToursRecordSchema + KNOWN_DATA_TOUR_IDS
 * @see apps/admin/src/config/ia/schema.ts       — AdminIAConfigSchema cross-checks §T1–§T3
 * @see SPEC-174 §9 (welcome tours outline), §5 D7/D13
 */

import type { z } from 'zod';
import type { ToursRecordSchema } from './tour.schema';

/**
 * v1 tour catalog. Typed with `satisfies` so TypeScript catches any structural
 * errors at authoring time while still inferring the widest compatible type.
 *
 * Only the 4 welcome tours are included in T-007. Contextual mini-tours are
 * defined separately once the `data-tour` layout attributes are in place.
 */
export const tours = {
    // =========================================================================
    // HOST welcome tour
    // =========================================================================

    /**
     * Welcome tour for HOST role.
     *
     * Guides the host through: greeting → main menu → dashboard cards
     * (Mis alojamientos / Mi plan / Consultas / Próximos pasos) →
     * quick-create "+" button → help / replay hint.
     */
    'host.welcome': {
        id: 'host.welcome',
        roles: ['HOST'],
        kind: 'welcome',
        version: 1,
        trigger: 'auto-first-visit',
        showWelcomeModal: true,
        steps: [
            {
                id: 'greeting',
                target: 'center',
                title: {
                    es: '¡Bienvenido al panel de Hospeda!',
                    en: 'Welcome to the Hospeda panel!',
                    pt: 'Bem-vindo ao painel do Hospeda!'
                },
                body: {
                    es: 'Este es tu espacio de trabajo como anfitrión. En unos pasos cortos te mostramos todo lo que podés hacer desde acá.',
                    en: 'This is your workspace as a host. In a few short steps we will show you everything you can do from here.',
                    pt: 'Este é o seu espaço de trabalho como anfitrião. Em alguns passos rápidos vamos te mostrar tudo o que você pode fazer daqui.'
                }
            },
            {
                id: 'main-nav',
                target: 'data-tour:main-menu',
                title: {
                    es: 'Tu menú principal',
                    en: 'Your main menu',
                    pt: 'Seu menu principal'
                },
                body: {
                    es: 'Desde aquí navegás entre las secciones del panel: tus alojamientos, consultas de huéspedes, facturación y tu cuenta personal.',
                    en: 'From here you navigate between panel sections: your accommodations, guest inquiries, billing and your personal account.',
                    pt: 'Daqui você navega entre as seções do painel: seus alojamentos, consultas de hóspedes, faturamento e sua conta pessoal.'
                },
                side: 'bottom'
            },
            {
                id: 'dashboard-region',
                target: 'data-tour:dashboard-region',
                title: {
                    es: 'Tu tablero personal',
                    en: 'Your personal dashboard',
                    pt: 'Seu painel pessoal'
                },
                body: {
                    es: 'Acá encontrás un resumen de tus alojamientos, el estado de tu plan, las consultas pendientes y los próximos pasos para potenciar tu presencia.',
                    en: 'Here you will find a summary of your accommodations, your plan status, pending inquiries and the next steps to boost your presence.',
                    pt: 'Aqui você encontra um resumo dos seus alojamentos, o status do seu plano, as consultas pendentes e os próximos passos para potencializar sua presença.'
                },
                side: 'top'
            },
            {
                id: 'quick-create',
                target: 'data-tour:quick-create',
                title: {
                    es: 'Creá rápido con "+"',
                    en: 'Create quickly with "+"',
                    pt: 'Crie rapidamente com "+"'
                },
                body: {
                    es: 'Con este botón podés dar de alta un nuevo alojamiento en cualquier momento, sin perder el lugar en el que estás.',
                    en: 'With this button you can register a new accommodation at any time, without losing your place in the panel.',
                    pt: 'Com este botão você pode cadastrar um novo alojamento a qualquer momento, sem perder seu lugar no painel.'
                },
                side: 'bottom'
            },
            {
                id: 'help-replay',
                target: 'center',
                title: {
                    es: '¿Necesitás repasar algo?',
                    en: 'Need to review something?',
                    pt: 'Precisa revisar algo?'
                },
                body: {
                    es: 'Podés volver a ver esta guía cuando quieras desde "Ver guía" en el menú de tu avatar. ¡Explorá el panel con confianza!',
                    en: 'You can revisit this guide any time from "View guide" in your avatar menu. Explore the panel with confidence!',
                    pt: 'Você pode rever este guia a qualquer momento em "Ver guia" no menu do seu avatar. Explore o painel com confiança!'
                }
            }
        ]
    },

    // =========================================================================
    // EDITOR welcome tour
    // =========================================================================

    /**
     * Welcome tour for EDITOR role.
     *
     * Guides the editor through: greeting → main menu → dashboard cards
     * (posts / events / newsletter / campaigns) → quick-create + search →
     * help / replay hint.
     */
    'editor.welcome': {
        id: 'editor.welcome',
        roles: ['EDITOR'],
        kind: 'welcome',
        version: 1,
        trigger: 'auto-first-visit',
        showWelcomeModal: true,
        steps: [
            {
                id: 'greeting',
                target: 'center',
                title: {
                    es: '¡Bienvenido al panel editorial!',
                    en: 'Welcome to the editorial panel!',
                    pt: 'Bem-vindo ao painel editorial!'
                },
                body: {
                    es: 'Este es tu centro de trabajo para crear y gestionar contenido en Hospeda. En unos pasos cortos te mostramos las secciones clave.',
                    en: 'This is your work hub for creating and managing content on Hospeda. In a few short steps we will walk you through the key sections.',
                    pt: 'Este é o seu centro de trabalho para criar e gerenciar conteúdo no Hospeda. Em alguns passos rápidos vamos te mostrar as seções principais.'
                }
            },
            {
                id: 'main-nav',
                target: 'data-tour:main-menu',
                title: {
                    es: 'Tu menú de secciones',
                    en: 'Your sections menu',
                    pt: 'Seu menu de seções'
                },
                body: {
                    es: 'Aquí accedés a la sección Editorial (posts, eventos, newsletter, tags) y a Análisis para medir el impacto de tu contenido.',
                    en: 'Here you access the Editorial section (posts, events, newsletter, tags) and Analytics to measure the impact of your content.',
                    pt: 'Aqui você acessa a seção Editorial (posts, eventos, newsletter, tags) e Análise para medir o impacto do seu conteúdo.'
                },
                side: 'bottom'
            },
            {
                id: 'dashboard-region',
                target: 'data-tour:dashboard-region',
                title: {
                    es: 'Tu tablero editorial',
                    en: 'Your editorial dashboard',
                    pt: 'Seu painel editorial'
                },
                body: {
                    es: 'Acá tenés un vistazo rápido de tus posts recientes, eventos programados, suscriptores activos y el rendimiento de tus campañas.',
                    en: 'Here you have a quick overview of your recent posts, scheduled events, active subscribers and the performance of your campaigns.',
                    pt: 'Aqui você tem uma visão rápida dos seus posts recentes, eventos programados, assinantes ativos e o desempenho das suas campanhas.'
                },
                side: 'top'
            },
            {
                id: 'quick-create',
                target: 'data-tour:quick-create',
                title: {
                    es: 'Publicá en segundos',
                    en: 'Publish in seconds',
                    pt: 'Publique em segundos'
                },
                body: {
                    es: 'El botón "+" te permite crear un post, evento o newsletter sin salir de la pantalla en la que estás.',
                    en: 'The "+" button lets you create a post, event or newsletter without leaving the screen you are on.',
                    pt: 'O botão "+" permite que você crie um post, evento ou newsletter sem sair da tela em que está.'
                },
                side: 'bottom'
            },
            {
                id: 'command-palette',
                target: 'data-tour:command-palette',
                title: {
                    es: 'Búsqueda rápida (Cmd+K)',
                    en: 'Quick search (Cmd+K)',
                    pt: 'Busca rápida (Cmd+K)'
                },
                body: {
                    es: 'Desde aquí encontrás cualquier post, evento o página del panel al instante. Muy útil cuando manejás mucho contenido.',
                    en: 'From here you can find any post, event or panel page instantly. Very useful when managing a lot of content.',
                    pt: 'Daqui você encontra qualquer post, evento ou página do painel instantaneamente. Muito útil quando você gerencia muito conteúdo.'
                },
                side: 'bottom'
            },
            {
                id: 'help-replay',
                target: 'center',
                title: {
                    es: '¿Querés repasar esta guía?',
                    en: 'Want to revisit this guide?',
                    pt: 'Quer rever este guia?'
                },
                body: {
                    es: 'Podés volver a verla desde "Ver guía" en el menú de tu avatar. También encontrás una guía específica en cada sección.',
                    en: 'You can revisit it from "View guide" in your avatar menu. You will also find a specific guide in each section.',
                    pt: 'Você pode revê-la em "Ver guia" no menu do seu avatar. Você também encontrará um guia específico em cada seção.'
                }
            }
        ]
    },

    // =========================================================================
    // ADMIN welcome tour
    // =========================================================================

    /**
     * Welcome tour for ADMIN role.
     *
     * Guides the admin through: greeting → 7 sections (main menu) →
     * dashboard cards (entities / crons / system-health / moderation) →
     * quick-create + search → help / replay hint.
     */
    'admin.welcome': {
        id: 'admin.welcome',
        roles: ['ADMIN'],
        kind: 'welcome',
        version: 1,
        trigger: 'auto-first-visit',
        showWelcomeModal: true,
        steps: [
            {
                id: 'greeting',
                target: 'center',
                title: {
                    es: '¡Bienvenido al panel de administración!',
                    en: 'Welcome to the administration panel!',
                    pt: 'Bem-vindo ao painel de administração!'
                },
                body: {
                    es: 'Desde acá gestionás la plataforma Hospeda. En unos pasos te presentamos las secciones principales para que te orientes rápido.',
                    en: 'From here you manage the Hospeda platform. In a few steps we will walk you through the main sections so you can get oriented quickly.',
                    pt: 'Daqui você gerencia a plataforma Hospeda. Em alguns passos vamos te apresentar as seções principais para que você se oriente rapidamente.'
                }
            },
            {
                id: 'main-nav',
                target: 'data-tour:main-menu',
                title: {
                    es: 'Las 7 secciones del panel',
                    en: 'The 7 panel sections',
                    pt: 'As 7 seções do painel'
                },
                body: {
                    es: 'Tenés acceso a Catálogo, Editorial, Comunidad, Comercial, Plataforma y Análisis. Cada sección agrupa las herramientas relacionadas.',
                    en: 'You have access to Catalog, Editorial, Community, Commercial, Platform and Analytics. Each section groups related tools.',
                    pt: 'Você tem acesso a Catálogo, Editorial, Comunidade, Comercial, Plataforma e Análise. Cada seção agrupa as ferramentas relacionadas.'
                },
                side: 'bottom'
            },
            {
                id: 'dashboard-region',
                target: 'data-tour:dashboard-region',
                title: {
                    es: 'Tablero de operaciones',
                    en: 'Operations dashboard',
                    pt: 'Painel de operações'
                },
                body: {
                    es: 'Acá ves en tiempo real el estado de las entidades del catálogo, el resultado de los crons, la salud del sistema y las tareas de moderación pendientes.',
                    en: 'Here you see in real time the status of catalog entities, cron results, system health and pending moderation tasks.',
                    pt: 'Aqui você vê em tempo real o status das entidades do catálogo, o resultado dos crons, a saúde do sistema e as tarefas de moderação pendentes.'
                },
                side: 'top'
            },
            {
                id: 'quick-create',
                target: 'data-tour:quick-create',
                title: {
                    es: 'Creación rápida (+)',
                    en: 'Quick create (+)',
                    pt: 'Criação rápida (+)'
                },
                body: {
                    es: 'Creá alojamientos, posts, eventos y más con un solo clic desde cualquier pantalla del panel.',
                    en: 'Create accommodations, posts, events and more with a single click from any panel screen.',
                    pt: 'Crie alojamentos, posts, eventos e mais com um único clique em qualquer tela do painel.'
                },
                side: 'bottom'
            },
            {
                id: 'command-palette',
                target: 'data-tour:command-palette',
                title: {
                    es: 'Búsqueda global (Cmd+K)',
                    en: 'Global search (Cmd+K)',
                    pt: 'Busca global (Cmd+K)'
                },
                body: {
                    es: 'Encontrá cualquier entidad, usuario o sección del panel al instante. Indispensable cuando gestionás grandes volúmenes de datos.',
                    en: 'Find any entity, user or panel section instantly. Indispensable when managing large volumes of data.',
                    pt: 'Encontre qualquer entidade, usuário ou seção do painel instantaneamente. Indispensável quando você gerencia grandes volumes de dados.'
                },
                side: 'bottom'
            },
            {
                id: 'notifications',
                target: 'data-tour:notifications',
                title: {
                    es: 'Centro de notificaciones',
                    en: 'Notification center',
                    pt: 'Central de notificações'
                },
                body: {
                    es: 'Aquí recibís alertas sobre publicaciones nuevas, solicitudes de moderación y eventos importantes de la plataforma.',
                    en: 'Here you receive alerts about new publications, moderation requests and important platform events.',
                    pt: 'Aqui você recebe alertas sobre novas publicações, solicitações de moderação e eventos importantes da plataforma.'
                },
                side: 'bottom'
            },
            {
                id: 'help-replay',
                target: 'center',
                title: {
                    es: '¿Necesitás repasar esta guía?',
                    en: 'Need to review this guide?',
                    pt: 'Precisa revisar este guia?'
                },
                body: {
                    es: 'Podés volver a verla desde "Ver guía" en el menú de tu avatar. Cada sección también tiene su propia guía contextual.',
                    en: 'You can revisit it from "View guide" in your avatar menu. Each section also has its own contextual guide.',
                    pt: 'Você pode revê-la em "Ver guia" no menu do seu avatar. Cada seção também tem seu próprio guia contextual.'
                }
            }
        ]
    },

    // =========================================================================
    // SUPER_ADMIN welcome tour
    // =========================================================================

    /**
     * Welcome tour for SUPER_ADMIN role.
     *
     * Extends the admin welcome with super-specific content:
     * greeting → 7 sections → base dashboard cards + Audit Logs + Billing stats →
     * help / replay hint.
     */
    'superAdmin.welcome': {
        id: 'superAdmin.welcome',
        roles: ['SUPER_ADMIN'],
        kind: 'welcome',
        version: 1,
        trigger: 'auto-first-visit',
        showWelcomeModal: true,
        steps: [
            {
                id: 'greeting',
                target: 'center',
                title: {
                    es: '¡Bienvenido, super administrador!',
                    en: 'Welcome, super administrator!',
                    pt: 'Bem-vindo, super administrador!'
                },
                body: {
                    es: 'Tenés acceso completo a la plataforma Hospeda, incluyendo secciones exclusivas como Auditoría y estadísticas de facturación global.',
                    en: 'You have full access to the Hospeda platform, including exclusive sections like Audit and global billing statistics.',
                    pt: 'Você tem acesso completo à plataforma Hospeda, incluindo seções exclusivas como Auditoria e estatísticas de faturamento global.'
                }
            },
            {
                id: 'main-nav',
                target: 'data-tour:main-menu',
                title: {
                    es: 'Acceso completo a las 7 secciones',
                    en: 'Full access to all 7 sections',
                    pt: 'Acesso completo às 7 seções'
                },
                body: {
                    es: 'Como super administrador podés acceder a todas las secciones del panel, incluidas las configuraciones críticas y las herramientas de auditoría.',
                    en: 'As a super administrator you can access all panel sections, including critical configurations and audit tools.',
                    pt: 'Como super administrador você pode acessar todas as seções do painel, incluindo configurações críticas e ferramentas de auditoria.'
                },
                side: 'bottom'
            },
            {
                id: 'dashboard-region',
                target: 'data-tour:dashboard-region',
                title: {
                    es: 'Tablero con visión global',
                    en: 'Dashboard with global view',
                    pt: 'Painel com visão global'
                },
                body: {
                    es: 'Además de las métricas operativas, tenés acceso a los registros de auditoría y a las estadísticas de facturación de toda la plataforma.',
                    en: 'In addition to operational metrics, you have access to audit logs and billing statistics for the entire platform.',
                    pt: 'Além das métricas operacionais, você tem acesso aos registros de auditoria e às estatísticas de faturamento de toda a plataforma.'
                },
                side: 'top'
            },
            {
                id: 'quick-create',
                target: 'data-tour:quick-create',
                title: {
                    es: 'Creación rápida (+)',
                    en: 'Quick create (+)',
                    pt: 'Criação rápida (+)'
                },
                body: {
                    es: 'Creá cualquier tipo de entidad con un solo clic. Como super admin, el menú incluye opciones de gestión avanzada.',
                    en: 'Create any type of entity with a single click. As a super admin, the menu includes advanced management options.',
                    pt: 'Crie qualquer tipo de entidade com um único clique. Como super admin, o menu inclui opções de gerenciamento avançado.'
                },
                side: 'bottom'
            },
            {
                id: 'command-palette',
                target: 'data-tour:command-palette',
                title: {
                    es: 'Búsqueda global (Cmd+K)',
                    en: 'Global search (Cmd+K)',
                    pt: 'Busca global (Cmd+K)'
                },
                body: {
                    es: 'Acceso instantáneo a cualquier entidad, usuario, configuración o sección. Esencial para la gestión eficiente de la plataforma.',
                    en: 'Instant access to any entity, user, configuration or section. Essential for efficient platform management.',
                    pt: 'Acesso instantâneo a qualquer entidade, usuário, configuração ou seção. Essencial para o gerenciamento eficiente da plataforma.'
                },
                side: 'bottom'
            },
            {
                id: 'notifications',
                target: 'data-tour:notifications',
                title: {
                    es: 'Notificaciones de plataforma',
                    en: 'Platform notifications',
                    pt: 'Notificações da plataforma'
                },
                body: {
                    es: 'Recibís alertas sobre eventos críticos del sistema, solicitudes de escalamiento y cambios en la configuración de la plataforma.',
                    en: 'You receive alerts about critical system events, escalation requests and platform configuration changes.',
                    pt: 'Você recebe alertas sobre eventos críticos do sistema, solicitações de escalamento e alterações na configuração da plataforma.'
                },
                side: 'bottom'
            },
            {
                id: 'help-replay',
                target: 'center',
                title: {
                    es: '¿Querés repasar esta guía?',
                    en: 'Want to revisit this guide?',
                    pt: 'Quer rever este guia?'
                },
                body: {
                    es: 'Podés volver a verla desde "Ver guía" en el menú de tu avatar. También hay guías específicas en las secciones de Plataforma y Análisis.',
                    en: 'You can revisit it from "View guide" in your avatar menu. There are also specific guides in the Platform and Analytics sections.',
                    pt: 'Você pode revê-la em "Ver guia" no menu do seu avatar. Também há guias específicos nas seções de Plataforma e Análise.'
                }
            }
        ]
    }
} satisfies z.input<typeof ToursRecordSchema>;
