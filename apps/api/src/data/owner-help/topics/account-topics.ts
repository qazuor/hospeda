/**
 * @file account-topics.ts
 * @description Help topics about the owner's account: changing plan, add-ons and
 * connected AI assistants (HOS-2333).
 *
 * Billing topics never state a price, a plan name or a limit: those are DB rows
 * and change without a deploy. They point to the plans page and to the
 * subscription page, which show the live values. Checked against the web pages
 * and components on 2026-11-17.
 */

import type { OwnerHelpTopic } from '../owner-help.types';

/** Topics about the account. */
export const ACCOUNT_HELP_TOPICS: readonly OwnerHelpTopic[] = [
    {
        id: 'change-plan',
        audience: 'any',
        title: 'Cambiar de plan',
        keywords: [
            'plan',
            'planes',
            'cambiar de plan',
            'cambiar plan',
            'suscripcion',
            'upgrade',
            'mejorar plan',
            'bajar de plan',
            'cancelar suscripcion',
            'dar de baja la suscripcion'
        ],
        steps: [
            'Entrá a «Suscripción». Ahí ves tus suscripciones, el estado de cada una y el resumen de tu prueba gratis.',
            'En la suscripción activa, tocá «Cambiar de plan».',
            'Elegí otro plan u otra frecuencia de cobro entre las opciones que se listan. Los importes los ves en esa lista y en la página de planes.',
            'Leé cómo funciona el cambio: si requiere autorización, vas al checkout de Mercado Pago y tu plan actual sigue hasta que autorices; si se programa, ves la fecha exacta desde la que rige el plan nuevo.',
            'Ingresá el correo con el que vas a pagar en Mercado Pago y tocá «Confirmar cambio».',
            'Si «Cambiar de plan» no aparece o el sitio dice que no se puede, te explica el motivo: un pago pendiente, la suscripción pausada, un cambio ya programado o que todavía no llegó la fecha en que podés cambiar.',
            'Para dejar de pagar, usá «Dar de baja» en la misma suscripción: se corta el cobro automático y seguís con el servicio hasta el final del período pago.'
        ],
        destinations: [
            { kind: 'subscription', label: 'Suscripción' },
            { kind: 'plans', vertical: 'accommodation', label: 'Planes para alojamientos' },
            { kind: 'plans', vertical: 'venue', label: 'Planes para comercios' },
            { kind: 'plans', vertical: 'experience', label: 'Planes para experiencias' }
        ],
        reviewedAt: '2026-11-17'
    },
    {
        id: 'addons',
        audience: 'any',
        title: 'Comprar o dar de baja un complemento',
        keywords: [
            'complemento',
            'complementos',
            'addon',
            'add-on',
            'destaque',
            'destacar',
            'destacado',
            'promocionar',
            'comprar complemento'
        ],
        steps: [
            'Entrá a «Comprar complementos».',
            'Elegí un complemento de la lista.',
            'Elegí la ficha (o la suscripción) a la que se aplica.',
            'Revisá el resumen: muestra el importe y la frecuencia. Si tu beneficio lo incluye, aparece «Gratis por tu beneficio» y podés elegirlo sin pagar.',
            'Ingresá el correo con el que pagás en Mercado Pago y tocá «Confirmar compra».',
            'Los complementos recurrentes (destaques) se dan de baja en la misma página, en «Tus destaques recurrentes»: al confirmar, se corta el cobro y el destaque se apaga hoy, sin reembolso.',
            'Si ves «Compras pausadas», por ahora no se pueden comprar complementos: probá más tarde.'
        ],
        destinations: [{ kind: 'addons', label: 'Comprar complementos' }],
        faqKey: 'owners.featured',
        reviewedAt: '2026-11-17'
    },
    {
        id: 'ai-assistants',
        audience: 'any',
        title: 'Conectar o desconectar un asistente de IA',
        keywords: [
            'asistente',
            'asistentes',
            'asistente de ia',
            'conectar asistente',
            'desconectar asistente',
            'claude',
            'chatgpt',
            'gemini',
            'mcp',
            'conector',
            'inteligencia artificial'
        ],
        steps: [
            'Entrá a «Asistentes de IA» en tu cuenta.',
            'En «Cómo conectar un asistente», copiá la dirección del servidor MCP.',
            'En Claude, ChatGPT, Gemini u otro asistente compatible con MCP, agregá un conector personalizado y pegá esa dirección.',
            'Iniciá sesión en Hospeda y aprobá el acceso. La pantalla te muestra qué puede hacer el asistente.',
            'Para desconectar uno, buscalo en «Asistentes conectados», tocá «Desconectar» y confirmá: pierde el acceso de inmediato y podés volver a conectarlo cuando quieras.',
            'Si cambiás la contraseña, el sitio te pregunta si querés desconectar también los asistentes conectados.',
            'Si ves el aviso de que la conexión de nuevos asistentes está pausada, por ahora no se pueden conectar más, pero sí desconectar los que ya tenés.'
        ],
        destinations: [{ kind: 'aiAssistants', label: 'Asistentes de IA' }],
        reviewedAt: '2026-11-17'
    }
];
