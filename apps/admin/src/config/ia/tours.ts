/**
 * Admin Guided Tour Catalog — v1 (SPEC-174 T-007 + T-016)
 *
 * Contains the full v1 catalog: 4 welcome tours + 15 contextual mini-tours.
 *
 * ## Welcome tours (4)
 *
 * Each welcome tour:
 * - Has `kind: 'welcome'` (no `route` — fires from any first authenticated route,
 *   redirecting to `/dashboard` when needed per D13).
 * - Has `trigger: 'auto-first-visit'` so it is offered automatically on first login.
 * - Has `showWelcomeModal: true` to display the Radix Dialog warm greeting.
 * - References only targets from {@link KNOWN_DATA_TOUR_IDS} (checked at boot by §T1).
 * - Targets exactly one role (checked by §T2).
 *
 * ## Contextual mini-tours (15)
 *
 * Each contextual tour:
 * - Has `kind: 'contextual'` with a `route` matching a `sections.ts` entry (§T3).
 * - Has `trigger: 'auto-first-visit'` for automatic first-visit triggering.
 * - Has `showWelcomeModal: false` — spotlights without the welcome dialog.
 * - Follows the pattern: opening `center` step explaining the screen's purpose →
 *   1–3 anchored steps on stable layout targets → closing `center` step with a tip.
 * - Uses `main-menu-section-<sectionId>` (camelCase allowed) to spotlight the menu
 *   item for the section, or `sidebar` / other layout targets where available.
 *
 * ## Role assignment (D14)
 *
 * - HOST tours:     `roles: ['HOST']`
 * - EDITOR tours:   `roles: ['EDITOR']`
 * - admin.* shared: `roles: ['ADMIN', 'SUPER_ADMIN']` — SUPER_ADMIN reuses these 4 tours
 * - admin.plataforma / admin.analisis: `roles: ['ADMIN']` — ADMIN-only per D14
 * - superAdmin.*:   `roles: ['SUPER_ADMIN']` — super-specific variants for same routes
 *
 * ## Route confirmation vs sections.ts (T-016)
 *
 * All routes were verified against sections.ts before authoring. No discrepancies found:
 * - /me/accommodations     → sections.misAlojamientos.defaultRoute  ✓
 * - /conversations         → sections.consultas.defaultRoute         ✓
 * - /billing/subscriptions → sections.miFacturacion.defaultRoute     ✓
 * - /account/profile       → sections.miCuenta.defaultRoute          ✓
 * - /posts                 → sections.editorial.defaultRoute         ✓
 * - /analytics/usage       → sections.analisis.defaultRoute          ✓
 * - /accommodations        → sections.catalogo.defaultRoute          ✓
 * - /access/users          → sections.comunidad.defaultRoute         ✓
 * - /billing/plans         → sections.comercial.defaultRoute         ✓
 * - /platform/configuration/seo → sections.plataforma.defaultRoute   ✓
 *
 * @see apps/admin/src/config/ia/tour.schema.ts — ToursRecordSchema + KNOWN_DATA_TOUR_IDS
 * @see apps/admin/src/config/ia/schema.ts       — AdminIAConfigSchema cross-checks §T1–§T3
 * @see apps/admin/src/config/ia/sections.ts     — Section route definitions
 * @see SPEC-174 §9, §5 D7/D13/D14
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
    },

    // =========================================================================
    // HOST contextual mini-tours
    // =========================================================================

    /**
     * Contextual tour for HOST role — Mis alojamientos (/me/accommodations).
     *
     * Teaches the host how to view, create and publish their own listings.
     */
    'host.misAlojamientos': {
        id: 'host.misAlojamientos',
        roles: ['HOST'],
        kind: 'contextual',
        route: '/me/accommodations',
        version: 1,
        trigger: 'auto-first-visit',
        showWelcomeModal: false,
        steps: [
            {
                id: 'intro',
                target: 'center',
                title: {
                    es: 'Tus alojamientos',
                    en: 'Your accommodations',
                    pt: 'Seus alojamentos'
                },
                body: {
                    es: 'Acá encontrás todos tus alojamientos publicados y los que todavía están en borrador. Desde esta pantalla podés crear nuevos, editar los existentes y controlar su visibilidad.',
                    en: 'Here you will find all your published accommodations and any that are still in draft. From this screen you can create new ones, edit existing ones and control their visibility.',
                    pt: 'Aqui você encontra todos os seus alojamentos publicados e os que ainda estão em rascunho. Nesta tela você pode criar novos, editar os existentes e controlar sua visibilidade.'
                }
            },
            {
                id: 'section-menu',
                target: 'data-tour:main-menu-section-misAlojamientos',
                title: {
                    es: 'Mis alojamientos en el menú',
                    en: 'My accommodations in the menu',
                    pt: 'Meus alojamentos no menu'
                },
                body: {
                    es: 'Volvé a esta sección en cualquier momento desde el menú lateral. Es tu punto de entrada principal para gestionar todo lo relacionado con tus propiedades.',
                    en: 'Return to this section at any time from the side menu. It is your main entry point for managing everything related to your properties.',
                    pt: 'Volte a esta seção a qualquer momento pelo menu lateral. É o seu ponto de entrada principal para gerenciar tudo relacionado às suas propriedades.'
                },
                side: 'right'
            },
            {
                id: 'quick-create',
                target: 'data-tour:quick-create',
                title: {
                    es: 'Agregá un alojamiento nuevo',
                    en: 'Add a new accommodation',
                    pt: 'Adicione um novo alojamento'
                },
                body: {
                    es: 'Para publicar una nueva propiedad usá el botón "+" en la barra superior. Te llevará al formulario de alta sin perder la vista de tu lista.',
                    en: 'To publish a new property use the "+" button in the top bar. It will take you to the registration form without losing your list view.',
                    pt: 'Para publicar uma nova propriedade use o botão "+" na barra superior. Ele vai te levar ao formulário de cadastro sem perder a visualização da sua lista.'
                },
                side: 'bottom'
            },
            {
                id: 'tip',
                target: 'center',
                title: {
                    es: 'Consejo: completá el perfil de tu alojamiento',
                    en: 'Tip: complete your accommodation profile',
                    pt: 'Dica: complete o perfil do seu alojamento'
                },
                body: {
                    es: 'Los alojamientos con fotos, descripción completa y amenities detallados reciben hasta 3 veces más consultas. ¡Dedicale unos minutos a cada propiedad!',
                    en: 'Accommodations with photos, a complete description and detailed amenities receive up to 3 times more inquiries. Spend a few minutes on each property!',
                    pt: 'Alojamentos com fotos, descrição completa e amenities detalhados recebem até 3 vezes mais consultas. Dedique alguns minutos a cada propriedade!'
                }
            }
        ]
    },

    /**
     * Contextual tour for HOST role — Consultas (/conversations).
     *
     * Teaches the host how to read and reply to guest inquiries.
     */
    'host.consultas': {
        id: 'host.consultas',
        roles: ['HOST'],
        kind: 'contextual',
        route: '/conversations',
        version: 1,
        trigger: 'auto-first-visit',
        showWelcomeModal: false,
        steps: [
            {
                id: 'intro',
                target: 'center',
                title: {
                    es: 'Tus consultas de huéspedes',
                    en: 'Your guest inquiries',
                    pt: 'Suas consultas de hóspedes'
                },
                body: {
                    es: 'Acá aparecen todas las consultas que los viajeros enviaron sobre tus alojamientos. Podés leer cada mensaje y responder directamente desde esta pantalla.',
                    en: 'Here you will see all the inquiries travelers sent about your accommodations. You can read each message and reply directly from this screen.',
                    pt: 'Aqui aparecem todas as consultas que os viajantes enviaram sobre seus alojamentos. Você pode ler cada mensagem e responder diretamente nesta tela.'
                }
            },
            {
                id: 'notifications',
                target: 'data-tour:notifications',
                title: {
                    es: 'Notificaciones de nuevas consultas',
                    en: 'New inquiry notifications',
                    pt: 'Notificações de novas consultas'
                },
                body: {
                    es: 'Cuando un huésped te escriba, vas a recibir una notificación aquí. Mantené este ícono de campana a la vista para no perder ningún mensaje.',
                    en: "When a guest writes to you, you will receive a notification here. Keep this bell icon in view so you don't miss any messages.",
                    pt: 'Quando um hóspede te escrever, você vai receber uma notificação aqui. Mantenha este ícone de sino à vista para não perder nenhuma mensagem.'
                },
                side: 'bottom'
            },
            {
                id: 'tip',
                target: 'center',
                title: {
                    es: 'Respondé rápido para conectar mejor',
                    en: 'Reply quickly to connect better',
                    pt: 'Responda rápido para conectar melhor'
                },
                body: {
                    es: 'Los anfitriones que responden en menos de 24 horas generan más confianza. Revisá esta sección a diario para mantener una comunicación fluida con tus potenciales huéspedes.',
                    en: 'Hosts who reply within 24 hours build more trust. Check this section daily to keep fluid communication with your potential guests.',
                    pt: 'Anfitriões que respondem em menos de 24 horas geram mais confiança. Verifique esta seção diariamente para manter uma comunicação fluida com seus potenciais hóspedes.'
                }
            }
        ]
    },

    /**
     * Contextual tour for HOST role — Mi facturación (/billing/subscriptions).
     *
     * Teaches the host about their plan, subscription and statuses.
     */
    'host.miFacturacion': {
        id: 'host.miFacturacion',
        roles: ['HOST'],
        kind: 'contextual',
        route: '/billing/subscriptions',
        version: 1,
        trigger: 'auto-first-visit',
        showWelcomeModal: false,
        steps: [
            {
                id: 'intro',
                target: 'center',
                title: {
                    es: 'Tu suscripción y plan',
                    en: 'Your subscription and plan',
                    pt: 'Sua assinatura e plano'
                },
                body: {
                    es: 'Acá podés ver el detalle de tu plan actual: qué incluye, la fecha de renovación y el estado de tu suscripción. También encontrás el historial de pagos.',
                    en: 'Here you can see the details of your current plan: what it includes, the renewal date and the status of your subscription. You will also find the payment history.',
                    pt: 'Aqui você pode ver os detalhes do seu plano atual: o que inclui, a data de renovação e o status da sua assinatura. Você também encontra o histórico de pagamentos.'
                }
            },
            {
                id: 'section-menu',
                target: 'data-tour:main-menu-section-miFacturacion',
                title: {
                    es: 'Mi facturación en el menú',
                    en: 'My billing in the menu',
                    pt: 'Minha cobrança no menu'
                },
                body: {
                    es: 'Volvé a esta sección cuando quieras consultar tu estado de cuenta o actualizar tu plan.',
                    en: 'Return to this section whenever you want to check your account status or update your plan.',
                    pt: 'Volte a esta seção sempre que quiser verificar seu status de conta ou atualizar seu plano.'
                },
                side: 'right'
            },
            {
                id: 'tip',
                target: 'center',
                title: {
                    es: 'Mantené tu plan al día',
                    en: 'Keep your plan up to date',
                    pt: 'Mantenha seu plano em dia'
                },
                body: {
                    es: 'Si tu suscripción vence, tus alojamientos pueden dejar de estar visibles en el sitio. Revisá la fecha de renovación con anticipación para evitar interrupciones.',
                    en: 'If your subscription expires, your accommodations may stop being visible on the site. Check the renewal date in advance to avoid interruptions.',
                    pt: 'Se sua assinatura vencer, seus alojamentos podem deixar de estar visíveis no site. Verifique a data de renovação com antecedência para evitar interrupções.'
                }
            }
        ]
    },

    /**
     * Contextual tour for HOST role — Mi cuenta (/account/profile).
     *
     * Teaches the host about profile, theme/language, notifications and tags.
     */
    'host.miCuenta': {
        id: 'host.miCuenta',
        roles: ['HOST'],
        kind: 'contextual',
        route: '/account/profile',
        version: 1,
        trigger: 'auto-first-visit',
        showWelcomeModal: false,
        steps: [
            {
                id: 'intro',
                target: 'center',
                title: {
                    es: 'Tu perfil personal',
                    en: 'Your personal profile',
                    pt: 'Seu perfil pessoal'
                },
                body: {
                    es: 'Desde acá gestionás tu información personal: nombre, foto, datos de contacto, idioma del panel, tema visual y preferencias de notificaciones.',
                    en: 'From here you manage your personal information: name, photo, contact details, panel language, visual theme and notification preferences.',
                    pt: 'Daqui você gerencia suas informações pessoais: nome, foto, dados de contato, idioma do painel, tema visual e preferências de notificação.'
                }
            },
            {
                id: 'user-menu',
                target: 'data-tour:user-menu',
                title: {
                    es: 'Acceso rápido desde tu avatar',
                    en: 'Quick access from your avatar',
                    pt: 'Acesso rápido do seu avatar'
                },
                body: {
                    es: 'También podés llegar a esta sección haciendo clic en tu foto de perfil en la esquina superior derecha.',
                    en: 'You can also reach this section by clicking on your profile picture in the top right corner.',
                    pt: 'Você também pode acessar esta seção clicando na sua foto de perfil no canto superior direito.'
                },
                side: 'bottom'
            },
            {
                id: 'tip',
                target: 'center',
                title: {
                    es: 'Completá tu perfil para generar confianza',
                    en: 'Complete your profile to build trust',
                    pt: 'Complete seu perfil para gerar confiança'
                },
                body: {
                    es: 'Un perfil con foto y descripción transmite confianza a los huéspedes. Subí una foto real y completá tu información de contacto para que los viajeros puedan conocerte.',
                    en: 'A profile with a photo and description conveys trust to guests. Upload a real photo and complete your contact information so travelers can get to know you.',
                    pt: 'Um perfil com foto e descrição transmite confiança para os hóspedes. Envie uma foto real e complete suas informações de contato para que os viajantes possam te conhecer.'
                }
            }
        ]
    },

    // =========================================================================
    // EDITOR contextual mini-tours
    // =========================================================================

    /**
     * Contextual tour for EDITOR role — Editorial (/posts).
     *
     * Teaches the editor about the editorial hub: posts, events, newsletter, tags.
     */
    'editor.editorial': {
        id: 'editor.editorial',
        roles: ['EDITOR'],
        kind: 'contextual',
        route: '/posts',
        version: 1,
        trigger: 'auto-first-visit',
        showWelcomeModal: false,
        steps: [
            {
                id: 'intro',
                target: 'center',
                title: {
                    es: 'Centro editorial',
                    en: 'Editorial hub',
                    pt: 'Centro editorial'
                },
                body: {
                    es: 'Bienvenido al corazón del contenido. Desde acá gestionás posts, eventos, newsletters y etiquetas. El sidebar izquierdo te lleva a cada subsección.',
                    en: 'Welcome to the heart of content. From here you manage posts, events, newsletters and tags. The left sidebar takes you to each subsection.',
                    pt: 'Bem-vindo ao coração do conteúdo. Daqui você gerencia posts, eventos, newsletters e etiquetas. A barra lateral esquerda te leva a cada subseção.'
                }
            },
            {
                id: 'sidebar',
                target: 'data-tour:sidebar',
                title: {
                    es: 'Navegá por el contenido',
                    en: 'Navigate through content',
                    pt: 'Navegue pelo conteúdo'
                },
                body: {
                    es: 'El sidebar agrupa todo lo que pertenece a Editorial: posts del blog, eventos, envíos de newsletter y tags. Hacé clic en cualquier ítem para ir directo.',
                    en: 'The sidebar groups everything that belongs to Editorial: blog posts, events, newsletter sends and tags. Click any item to go directly there.',
                    pt: 'A barra lateral agrupa tudo que pertence ao Editorial: posts do blog, eventos, envios de newsletter e tags. Clique em qualquer item para ir diretamente.'
                },
                side: 'right'
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
                    es: 'El botón "+" te permite abrir el formulario de creación de un post, evento o newsletter sin salir de la pantalla actual.',
                    en: 'The "+" button lets you open the creation form for a post, event or newsletter without leaving the current screen.',
                    pt: 'O botão "+" permite abrir o formulário de criação de um post, evento ou newsletter sem sair da tela atual.'
                },
                side: 'bottom'
            },
            {
                id: 'tip',
                target: 'center',
                title: {
                    es: 'Usá los borradores a tu favor',
                    en: 'Use drafts to your advantage',
                    pt: 'Use os rascunhos a seu favor'
                },
                body: {
                    es: 'Podés guardar un post como borrador y publicarlo cuando estés listo. También podés programar la publicación para una fecha y hora específicas.',
                    en: 'You can save a post as a draft and publish it when you are ready. You can also schedule publication for a specific date and time.',
                    pt: 'Você pode salvar um post como rascunho e publicá-lo quando estiver pronto. Você também pode agendar a publicação para uma data e hora específicas.'
                }
            }
        ]
    },

    /**
     * Contextual tour for EDITOR role — Análisis (/analytics/usage).
     *
     * Teaches the editor how to read content and usage analytics.
     */
    'editor.analisis': {
        id: 'editor.analisis',
        roles: ['EDITOR'],
        kind: 'contextual',
        route: '/analytics/usage',
        version: 1,
        trigger: 'auto-first-visit',
        showWelcomeModal: false,
        steps: [
            {
                id: 'intro',
                target: 'center',
                title: {
                    es: 'Análisis de contenido',
                    en: 'Content analytics',
                    pt: 'Análise de conteúdo'
                },
                body: {
                    es: 'Acá medís el impacto de tu trabajo editorial: visitas a los posts, rendimiento del newsletter, alcance de los eventos y métricas de uso del sitio.',
                    en: 'Here you measure the impact of your editorial work: post visits, newsletter performance, event reach and site usage metrics.',
                    pt: 'Aqui você mede o impacto do seu trabalho editorial: visitas aos posts, desempenho do newsletter, alcance dos eventos e métricas de uso do site.'
                }
            },
            {
                id: 'sidebar',
                target: 'data-tour:sidebar',
                title: {
                    es: 'Distintas vistas de análisis',
                    en: 'Different analytics views',
                    pt: 'Diferentes visualizações de análise'
                },
                body: {
                    es: 'El sidebar te permite cambiar entre métricas de contenido, uso del sitio y SEO. Cada vista te da una perspectiva diferente del rendimiento.',
                    en: 'The sidebar lets you switch between content metrics, site usage and SEO. Each view gives you a different perspective on performance.',
                    pt: 'A barra lateral permite alternar entre métricas de conteúdo, uso do site e SEO. Cada visualização oferece uma perspectiva diferente do desempenho.'
                },
                side: 'right'
            },
            {
                id: 'tip',
                target: 'center',
                title: {
                    es: 'Revisá los datos semanalmente',
                    en: 'Review the data weekly',
                    pt: 'Revise os dados semanalmente'
                },
                body: {
                    es: 'Dedicar 10 minutos a la semana a revisar las métricas te ayuda a entender qué contenido resuena con la audiencia y dónde enfocar tu energía.',
                    en: 'Spending 10 minutes a week reviewing metrics helps you understand what content resonates with the audience and where to focus your energy.',
                    pt: 'Dedicar 10 minutos por semana para revisar as métricas ajuda você a entender qual conteúdo ressoa com o público e onde focar sua energia.'
                }
            }
        ]
    },

    /**
     * Contextual tour for EDITOR role — Mi cuenta (/account/profile).
     *
     * Teaches the editor about profile and preferences.
     */
    'editor.miCuenta': {
        id: 'editor.miCuenta',
        roles: ['EDITOR'],
        kind: 'contextual',
        route: '/account/profile',
        version: 1,
        trigger: 'auto-first-visit',
        showWelcomeModal: false,
        steps: [
            {
                id: 'intro',
                target: 'center',
                title: {
                    es: 'Tu perfil y preferencias',
                    en: 'Your profile and preferences',
                    pt: 'Seu perfil e preferências'
                },
                body: {
                    es: 'Desde acá actualizás tu información personal, el idioma del panel y las preferencias de notificaciones. También podés gestionar tus etiquetas de autor.',
                    en: 'From here you update your personal information, panel language and notification preferences. You can also manage your author tags.',
                    pt: 'Daqui você atualiza suas informações pessoais, idioma do painel e preferências de notificação. Você também pode gerenciar suas tags de autor.'
                }
            },
            {
                id: 'user-menu',
                target: 'data-tour:user-menu',
                title: {
                    es: 'Acceso rápido desde tu avatar',
                    en: 'Quick access from your avatar',
                    pt: 'Acesso rápido do seu avatar'
                },
                body: {
                    es: 'Podés llegar a tu perfil en cualquier momento haciendo clic en tu avatar en la barra superior.',
                    en: 'You can reach your profile at any time by clicking on your avatar in the top bar.',
                    pt: 'Você pode acessar seu perfil a qualquer momento clicando no seu avatar na barra superior.'
                },
                side: 'bottom'
            },
            {
                id: 'tip',
                target: 'center',
                title: {
                    es: 'Configurá el idioma de tu preferencia',
                    en: 'Set your preferred language',
                    pt: 'Configure o idioma de sua preferência'
                },
                body: {
                    es: 'El panel está disponible en español, inglés y portugués. Podés cambiar el idioma desde esta sección y el cambio se aplica de inmediato.',
                    en: 'The panel is available in Spanish, English and Portuguese. You can change the language from this section and the change applies immediately.',
                    pt: 'O painel está disponível em espanhol, inglês e português. Você pode alterar o idioma nesta seção e a mudança é aplicada imediatamente.'
                }
            }
        ]
    },

    // =========================================================================
    // ADMIN + SUPER_ADMIN shared contextual mini-tours (D14)
    // =========================================================================

    /**
     * Contextual tour for ADMIN and SUPER_ADMIN — Catálogo (/accommodations).
     *
     * Teaches catalog management: accommodations, destinations, attractions, amenities.
     */
    'admin.catalogo': {
        id: 'admin.catalogo',
        roles: ['ADMIN', 'SUPER_ADMIN'],
        kind: 'contextual',
        route: '/accommodations',
        version: 1,
        trigger: 'auto-first-visit',
        showWelcomeModal: false,
        steps: [
            {
                id: 'intro',
                target: 'center',
                title: {
                    es: 'Catálogo de la plataforma',
                    en: 'Platform catalog',
                    pt: 'Catálogo da plataforma'
                },
                body: {
                    es: 'Esta sección centraliza la gestión del catálogo: alojamientos, destinos, atracciones y amenities. Todos los hosts publican aquí sus propiedades para que aparezcan en el sitio público.',
                    en: 'This section centralizes catalog management: accommodations, destinations, attractions and amenities. All hosts publish their properties here to appear on the public site.',
                    pt: 'Esta seção centraliza a gestão do catálogo: alojamentos, destinos, atrações e amenities. Todos os anfitriões publicam suas propriedades aqui para aparecerem no site público.'
                }
            },
            {
                id: 'sidebar',
                target: 'data-tour:sidebar',
                title: {
                    es: 'Subsecciones del catálogo',
                    en: 'Catalog subsections',
                    pt: 'Subseções do catálogo'
                },
                body: {
                    es: 'El sidebar izquierdo te da acceso a alojamientos, destinos, atracciones, amenities y características. Cada entidad tiene su propio listado con filtros y acciones en lote.',
                    en: 'The left sidebar gives you access to accommodations, destinations, attractions, amenities and features. Each entity has its own list with filters and batch actions.',
                    pt: 'A barra lateral esquerda dá acesso a alojamentos, destinos, atrações, amenities e características. Cada entidade tem sua própria lista com filtros e ações em lote.'
                },
                side: 'right'
            },
            {
                id: 'tip',
                target: 'center',
                title: {
                    es: 'Moderación de alojamientos',
                    en: 'Accommodation moderation',
                    pt: 'Moderação de alojamentos'
                },
                body: {
                    es: 'Los alojamientos enviados por los hosts pasan por un flujo de revisión. Podés aprobar, rechazar o solicitar cambios directamente desde el listado o el detalle de cada uno.',
                    en: 'Accommodations submitted by hosts go through a review flow. You can approve, reject or request changes directly from the list or the detail of each one.',
                    pt: 'Os alojamentos enviados pelos anfitriões passam por um fluxo de revisão. Você pode aprovar, rejeitar ou solicitar alterações diretamente da lista ou do detalhe de cada um.'
                }
            }
        ]
    },

    /**
     * Contextual tour for ADMIN and SUPER_ADMIN — Editorial (/posts).
     *
     * Teaches about posts, events, newsletter and tags management.
     */
    'admin.editorial': {
        id: 'admin.editorial',
        roles: ['ADMIN', 'SUPER_ADMIN'],
        kind: 'contextual',
        route: '/posts',
        version: 1,
        trigger: 'auto-first-visit',
        showWelcomeModal: false,
        steps: [
            {
                id: 'intro',
                target: 'center',
                title: {
                    es: 'Gestión editorial',
                    en: 'Editorial management',
                    pt: 'Gestão editorial'
                },
                body: {
                    es: 'Desde acá supervisás todo el contenido de la plataforma: posts del blog, eventos, envíos de newsletter y la taxonomía de etiquetas usada en todo el sitio.',
                    en: 'From here you oversee all platform content: blog posts, events, newsletter sends and the tag taxonomy used across the entire site.',
                    pt: 'Daqui você supervisiona todo o conteúdo da plataforma: posts do blog, eventos, envios de newsletter e a taxonomia de etiquetas usada em todo o site.'
                }
            },
            {
                id: 'sidebar',
                target: 'data-tour:sidebar',
                title: {
                    es: 'Subsecciones de Editorial',
                    en: 'Editorial subsections',
                    pt: 'Subseções do Editorial'
                },
                body: {
                    es: 'El sidebar agrupa posts, eventos, newsletters y tags. Los editores también tienen acceso a esta sección, así que es posible que encuentres contenido ya cargado por tu equipo.',
                    en: 'The sidebar groups posts, events, newsletters and tags. Editors also have access to this section, so you may find content already loaded by your team.',
                    pt: 'A barra lateral agrupa posts, eventos, newsletters e tags. Os editores também têm acesso a esta seção, então você pode encontrar conteúdo já carregado pela sua equipe.'
                },
                side: 'right'
            },
            {
                id: 'tip',
                target: 'center',
                title: {
                    es: 'Revisá el contenido antes de publicar',
                    en: 'Review content before publishing',
                    pt: 'Revise o conteúdo antes de publicar'
                },
                body: {
                    es: 'Como administrador podés editar o despublicar cualquier contenido. Asegurate de revisar los posts en borrador y coordinar con el equipo editorial para mantener la calidad.',
                    en: 'As an administrator you can edit or unpublish any content. Make sure to review draft posts and coordinate with the editorial team to maintain quality.',
                    pt: 'Como administrador você pode editar ou despublicar qualquer conteúdo. Certifique-se de revisar os posts em rascunho e coordenar com a equipe editorial para manter a qualidade.'
                }
            }
        ]
    },

    /**
     * Contextual tour for ADMIN and SUPER_ADMIN — Comunidad (/access/users).
     *
     * Teaches about users, conversations, roles/permissions and moderation.
     */
    'admin.comunidad': {
        id: 'admin.comunidad',
        roles: ['ADMIN', 'SUPER_ADMIN'],
        kind: 'contextual',
        route: '/access/users',
        version: 1,
        trigger: 'auto-first-visit',
        showWelcomeModal: false,
        steps: [
            {
                id: 'intro',
                target: 'center',
                title: {
                    es: 'Gestión de la comunidad',
                    en: 'Community management',
                    pt: 'Gestão da comunidade'
                },
                body: {
                    es: 'Acá gestionás toda la comunidad de la plataforma: usuarios, conversaciones entre huéspedes y anfitriones, roles y permisos, y las tareas de moderación pendientes.',
                    en: 'Here you manage the entire platform community: users, conversations between guests and hosts, roles and permissions, and pending moderation tasks.',
                    pt: 'Aqui você gerencia toda a comunidade da plataforma: usuários, conversas entre hóspedes e anfitriões, funções e permissões, e as tarefas de moderação pendentes.'
                }
            },
            {
                id: 'sidebar',
                target: 'data-tour:sidebar',
                title: {
                    es: 'Subsecciones de Comunidad',
                    en: 'Community subsections',
                    pt: 'Subseções de Comunidade'
                },
                body: {
                    es: 'El sidebar incluye la lista de usuarios, conversaciones, roles y permisos, y moderación. Desde Usuarios podés cambiar el rol de un miembro o desactivar su cuenta.',
                    en: "The sidebar includes the user list, conversations, roles and permissions, and moderation. From Users you can change a member's role or deactivate their account.",
                    pt: 'A barra lateral inclui a lista de usuários, conversas, funções e permissões, e moderação. Em Usuários você pode alterar a função de um membro ou desativar sua conta.'
                },
                side: 'right'
            },
            {
                id: 'tip',
                target: 'center',
                title: {
                    es: 'Moderación proactiva',
                    en: 'Proactive moderation',
                    pt: 'Moderação proativa'
                },
                body: {
                    es: 'Las tareas de moderación pendientes aparecen en tu dashboard. Revisalas regularmente para mantener la calidad del contenido y la confianza de la comunidad.',
                    en: 'Pending moderation tasks appear on your dashboard. Review them regularly to maintain content quality and community trust.',
                    pt: 'As tarefas de moderação pendentes aparecem no seu dashboard. Revise-as regularmente para manter a qualidade do conteúdo e a confiança da comunidade.'
                }
            }
        ]
    },

    /**
     * Contextual tour for ADMIN and SUPER_ADMIN — Comercial (/billing/plans).
     *
     * Teaches about plans, subscriptions, invoices and promos.
     */
    'admin.comercial': {
        id: 'admin.comercial',
        roles: ['ADMIN', 'SUPER_ADMIN'],
        kind: 'contextual',
        route: '/billing/plans',
        version: 1,
        trigger: 'auto-first-visit',
        showWelcomeModal: false,
        steps: [
            {
                id: 'intro',
                target: 'center',
                title: {
                    es: 'Operaciones comerciales',
                    en: 'Commercial operations',
                    pt: 'Operações comerciais'
                },
                body: {
                    es: 'Acá gestionás todo lo relacionado con la monetización: planes disponibles, suscripciones de los hosts, facturas y promociones activas.',
                    en: 'Here you manage everything related to monetization: available plans, host subscriptions, invoices and active promotions.',
                    pt: 'Aqui você gerencia tudo relacionado à monetização: planos disponíveis, assinaturas dos anfitriões, faturas e promoções ativas.'
                }
            },
            {
                id: 'sidebar',
                target: 'data-tour:sidebar',
                title: {
                    es: 'Subsecciones de Comercial',
                    en: 'Commercial subsections',
                    pt: 'Subseções do Comercial'
                },
                body: {
                    es: 'El sidebar agrupa Planes, Suscripciones, Facturas y Promos. Podés crear o editar planes, revisar el estado de cada suscripción y gestionar los descuentos aplicables.',
                    en: 'The sidebar groups Plans, Subscriptions, Invoices and Promos. You can create or edit plans, review the status of each subscription and manage applicable discounts.',
                    pt: 'A barra lateral agrupa Planos, Assinaturas, Faturas e Promos. Você pode criar ou editar planos, revisar o status de cada assinatura e gerenciar os descontos aplicáveis.'
                },
                side: 'right'
            },
            {
                id: 'tip',
                target: 'center',
                title: {
                    es: 'Monitoreo de suscripciones',
                    en: 'Subscription monitoring',
                    pt: 'Monitoramento de assinaturas'
                },
                body: {
                    es: 'Desde la sección Suscripciones podés ver qué hosts tienen su plan activo, vencido o cancelado. Las alertas te avisarán cuando haya problemas de pago que requieran atención.',
                    en: 'From the Subscriptions section you can see which hosts have an active, expired or cancelled plan. Alerts will notify you when there are payment issues that require attention.',
                    pt: 'Na seção Assinaturas você pode ver quais anfitriões têm seu plano ativo, vencido ou cancelado. Os alertas vão notificá-lo quando houver problemas de pagamento que precisam de atenção.'
                }
            }
        ]
    },

    // =========================================================================
    // ADMIN-only contextual mini-tours (D14 — admin.plataforma / admin.analisis)
    // =========================================================================

    /**
     * Contextual tour for ADMIN only — Plataforma (/platform/configuration/seo).
     *
     * Teaches about settings, SEO, cache, crons, webhooks and logs.
     * SUPER_ADMIN gets the superAdmin.plataforma variant instead.
     */
    'admin.plataforma': {
        id: 'admin.plataforma',
        roles: ['ADMIN'],
        kind: 'contextual',
        route: '/platform/configuration/seo',
        version: 1,
        trigger: 'auto-first-visit',
        showWelcomeModal: false,
        steps: [
            {
                id: 'intro',
                target: 'center',
                title: {
                    es: 'Configuración de la plataforma',
                    en: 'Platform configuration',
                    pt: 'Configuração da plataforma'
                },
                body: {
                    es: 'Esta sección te da acceso a la configuración operativa de la plataforma: ajustes de SEO, gestión de caché, programación de tareas automáticas, webhooks y registros del sistema.',
                    en: "This section gives you access to the platform's operational configuration: SEO settings, cache management, automatic task scheduling, webhooks and system logs.",
                    pt: 'Esta seção dá acesso à configuração operacional da plataforma: ajustes de SEO, gestão de cache, programação de tarefas automáticas, webhooks e registros do sistema.'
                }
            },
            {
                id: 'sidebar',
                target: 'data-tour:sidebar',
                title: {
                    es: 'Subsecciones de Plataforma',
                    en: 'Platform subsections',
                    pt: 'Subseções de Plataforma'
                },
                body: {
                    es: 'El sidebar agrupa las configuraciones: SEO global, caché/ISR, cron jobs, webhooks y logs. Algunas subsecciones son exclusivas del super administrador.',
                    en: 'The sidebar groups the configurations: global SEO, cache/ISR, cron jobs, webhooks and logs. Some subsections are exclusive to the super administrator.',
                    pt: 'A barra lateral agrupa as configurações: SEO global, cache/ISR, cron jobs, webhooks e logs. Algumas subseções são exclusivas do super administrador.'
                },
                side: 'right'
            },
            {
                id: 'tip',
                target: 'center',
                title: {
                    es: 'Cambios con impacto en producción',
                    en: 'Changes with production impact',
                    pt: 'Alterações com impacto em produção'
                },
                body: {
                    es: 'Los cambios de configuración de SEO y caché afectan directamente al sitio público. Confirmá siempre antes de guardar y revisá los logs si algo no se comporta como esperás.',
                    en: 'SEO and cache configuration changes directly affect the public site. Always confirm before saving and check the logs if something does not behave as expected.',
                    pt: 'As alterações de configuração de SEO e cache afetam diretamente o site público. Confirme sempre antes de salvar e verifique os logs se algo não se comportar como esperado.'
                }
            }
        ]
    },

    /**
     * Contextual tour for ADMIN only — Análisis (/analytics/usage).
     *
     * Teaches about business, usage and SEO analytics.
     * SUPER_ADMIN gets the superAdmin.analisis variant instead.
     */
    'admin.analisis': {
        id: 'admin.analisis',
        roles: ['ADMIN'],
        kind: 'contextual',
        route: '/analytics/usage',
        version: 1,
        trigger: 'auto-first-visit',
        showWelcomeModal: false,
        steps: [
            {
                id: 'intro',
                target: 'center',
                title: {
                    es: 'Análisis del negocio',
                    en: 'Business analytics',
                    pt: 'Análise do negócio'
                },
                body: {
                    es: 'Acá tenés una vista completa del rendimiento de la plataforma: métricas de uso, analítica de contenido, posicionamiento SEO y comportamiento de los usuarios.',
                    en: 'Here you have a complete view of platform performance: usage metrics, content analytics, SEO positioning and user behavior.',
                    pt: 'Aqui você tem uma visão completa do desempenho da plataforma: métricas de uso, análise de conteúdo, posicionamento SEO e comportamento dos usuários.'
                }
            },
            {
                id: 'sidebar',
                target: 'data-tour:sidebar',
                title: {
                    es: 'Distintas perspectivas de análisis',
                    en: 'Different analytics perspectives',
                    pt: 'Diferentes perspectivas de análise'
                },
                body: {
                    es: 'El sidebar te permite navegar entre las vistas de negocio (KPIs generales), uso (actividad de usuarios), contenido (métricas editoriales) y SEO (tráfico orgánico).',
                    en: 'The sidebar lets you navigate between the business view (general KPIs), usage (user activity), content (editorial metrics) and SEO (organic traffic).',
                    pt: 'A barra lateral permite navegar entre as visualizações de negócio (KPIs gerais), uso (atividade de usuários), conteúdo (métricas editoriais) e SEO (tráfego orgânico).'
                },
                side: 'right'
            },
            {
                id: 'tip',
                target: 'center',
                title: {
                    es: 'Tomá decisiones basadas en datos',
                    en: 'Make data-driven decisions',
                    pt: 'Tome decisões baseadas em dados'
                },
                body: {
                    es: 'Revisá las métricas de uso semanalmente para identificar tendencias, detectar caídas en el tráfico con anticipación y orientar las prioridades del equipo.',
                    en: 'Review usage metrics weekly to identify trends, detect traffic drops in advance and guide team priorities.',
                    pt: 'Revise as métricas de uso semanalmente para identificar tendências, detectar quedas no tráfego com antecedência e orientar as prioridades da equipe.'
                }
            }
        ]
    },

    // =========================================================================
    // SUPER_ADMIN-only contextual mini-tours (D14 — super-specific variants)
    // =========================================================================

    /**
     * Contextual tour for SUPER_ADMIN only — Plataforma (/platform/configuration/seo).
     *
     * Same route as admin.plataforma but with super-specific content including
     * super-only subsections (critical configuration, audit).
     */
    'superAdmin.plataforma': {
        id: 'superAdmin.plataforma',
        roles: ['SUPER_ADMIN'],
        kind: 'contextual',
        route: '/platform/configuration/seo',
        version: 1,
        trigger: 'auto-first-visit',
        showWelcomeModal: false,
        steps: [
            {
                id: 'intro',
                target: 'center',
                title: {
                    es: 'Configuración avanzada de plataforma',
                    en: 'Advanced platform configuration',
                    pt: 'Configuração avançada da plataforma'
                },
                body: {
                    es: 'Como super administrador tenés acceso a todas las secciones de configuración, incluidas las herramientas críticas de sistema y los registros de auditoría que no están disponibles para los administradores estándar.',
                    en: 'As a super administrator you have access to all configuration sections, including critical system tools and audit logs not available to standard administrators.',
                    pt: 'Como super administrador você tem acesso a todas as seções de configuração, incluindo ferramentas críticas de sistema e registros de auditoria não disponíveis para os administradores padrão.'
                }
            },
            {
                id: 'sidebar',
                target: 'data-tour:sidebar',
                title: {
                    es: 'Acceso completo — incluye subsecciones super',
                    en: 'Full access — includes super-only subsections',
                    pt: 'Acesso completo — inclui subseções super'
                },
                body: {
                    es: 'Además de SEO, caché y logs, en el sidebar vas a ver las subsecciones exclusivas de super admin: Configuración crítica (ajustes de infraestructura) y Auditoría (log global de acciones del sistema).',
                    en: 'In addition to SEO, cache and logs, the sidebar shows super-admin-only subsections: Critical configuration (infrastructure settings) and Audit (global system action log).',
                    pt: 'Além de SEO, cache e logs, a barra lateral mostra subseções exclusivas do super admin: Configuração crítica (ajustes de infraestrutura) e Auditoria (log global de ações do sistema).'
                },
                side: 'right'
            },
            {
                id: 'tip',
                target: 'center',
                title: {
                    es: 'Actuá con cuidado en configuración crítica',
                    en: 'Act carefully in critical configuration',
                    pt: 'Aja com cuidado na configuração crítica'
                },
                body: {
                    es: 'Los cambios en la sección de Configuración crítica afectan la infraestructura de la plataforma en producción. Revisá el registro de Auditoría para rastrear cualquier cambio realizado por el equipo.',
                    en: 'Changes in the Critical configuration section affect the production platform infrastructure. Review the Audit log to track any changes made by the team.',
                    pt: 'As alterações na seção de Configuração crítica afetam a infraestrutura da plataforma em produção. Revise o registro de Auditoria para rastrear quaisquer alterações feitas pela equipe.'
                }
            }
        ]
    },

    /**
     * Contextual tour for SUPER_ADMIN only — Análisis (/analytics/usage).
     *
     * Same route as admin.analisis but with super-specific content including
     * super-only debug subsections.
     */
    'superAdmin.analisis': {
        id: 'superAdmin.analisis',
        roles: ['SUPER_ADMIN'],
        kind: 'contextual',
        route: '/analytics/usage',
        version: 1,
        trigger: 'auto-first-visit',
        showWelcomeModal: false,
        steps: [
            {
                id: 'intro',
                target: 'center',
                title: {
                    es: 'Análisis completo de la plataforma',
                    en: 'Complete platform analytics',
                    pt: 'Análise completa da plataforma'
                },
                body: {
                    es: 'Como super administrador tenés acceso a todas las vistas de análisis, incluida la sección de Debug que muestra métricas internas del sistema no visibles para los administradores estándar.',
                    en: 'As a super administrator you have access to all analytics views, including the Debug section that shows internal system metrics not visible to standard administrators.',
                    pt: 'Como super administrador você tem acesso a todas as visualizações de análise, incluindo a seção de Debug que mostra métricas internas do sistema não visíveis para os administradores padrão.'
                }
            },
            {
                id: 'sidebar',
                target: 'data-tour:sidebar',
                title: {
                    es: 'Vistas de análisis — incluyendo Debug',
                    en: 'Analytics views — including Debug',
                    pt: 'Visualizações de análise — incluindo Debug'
                },
                body: {
                    es: 'El sidebar incluye las vistas estándar (negocio, uso, contenido, SEO) más la vista de Debug exclusiva de super admin. Debug te da acceso a métricas de performance de la API, errores del sistema y latencias.',
                    en: 'The sidebar includes the standard views (business, usage, content, SEO) plus the super-admin-only Debug view. Debug gives you access to API performance metrics, system errors and latencies.',
                    pt: 'A barra lateral inclui as visualizações padrão (negócio, uso, conteúdo, SEO) mais a visualização de Debug exclusiva do super admin. Debug dá acesso às métricas de performance da API, erros do sistema e latências.'
                },
                side: 'right'
            },
            {
                id: 'tip',
                target: 'center',
                title: {
                    es: 'Usá Debug para diagnosticar problemas',
                    en: 'Use Debug to diagnose issues',
                    pt: 'Use o Debug para diagnosticar problemas'
                },
                body: {
                    es: 'Cuando reportan problemas de performance o errores inesperados, la vista de Debug es el primer lugar donde buscar. Revisá los tiempos de respuesta y los errores recientes antes de escalar.',
                    en: 'When performance issues or unexpected errors are reported, the Debug view is the first place to look. Review response times and recent errors before escalating.',
                    pt: 'Quando são relatados problemas de performance ou erros inesperados, a visualização de Debug é o primeiro lugar a verificar. Revise os tempos de resposta e os erros recentes antes de escalar.'
                }
            }
        ]
    }
} satisfies z.input<typeof ToursRecordSchema>;
