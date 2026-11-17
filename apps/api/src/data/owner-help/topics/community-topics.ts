/**
 * @file community-topics.ts
 * @description Help topics about guests and the provider community: inquiries,
 * the calendar, the provider directory and benefit usages (HOS-2333).
 *
 * Checked against the web pages and components on 2026-11-17. Declaring a benefit
 * usage from the assistant is out of scope (spec HOS-2335 NG-8), so these
 * topics describe the portal only.
 */

import type { OwnerHelpTopic } from '../owner-help.types';

/** Topics about inquiries, the calendar and providers. */
export const COMMUNITY_HELP_TOPICS: readonly OwnerHelpTopic[] = [
    {
        id: 'inquiries',
        audience: 'host',
        title: 'Responder las consultas de los huéspedes',
        keywords: [
            'consulta',
            'consultas',
            'mensaje',
            'mensajes',
            'responder',
            'contestar',
            'huesped',
            'huespedes',
            'bandeja',
            'inbox',
            'no leidos'
        ],
        steps: [
            'Entrá a «Mensajes de huéspedes». Ahí están las conversaciones de tus alojamientos, con una marca en las que tienen mensajes sin leer.',
            'Abrí la conversación que querés responder.',
            'Escribí tu respuesta en el cuadro (hasta 5000 caracteres) y tocá «Enviar».',
            'También podés pedirle a este asistente que liste tus consultas y redacte una respuesta: te muestra el texto antes de enviarlo y solo se envía si lo confirmás.'
        ],
        destinations: [{ kind: 'inquiry', label: 'Mensajes de huéspedes' }],
        reviewedAt: '2026-11-17'
    },
    {
        id: 'calendar',
        audience: 'host',
        title: 'Bloquear fechas y conectar un calendario externo',
        keywords: [
            'calendario',
            'disponibilidad',
            'bloquear',
            'fechas ocupadas',
            'ocupado',
            'sincronizar',
            'google calendar',
            'airbnb',
            'booking',
            'ical',
            'reservas superpuestas'
        ],
        steps: [
            'Abrí el editor de tu alojamiento («Mis propiedades» → «Editar») y entrá a «Calendario». Es una sección de alojamientos.',
            'En el calendario de ocupación, hacé clic en un día y en otro para elegir un rango, sumá una nota si querés y tocá «Bloquear». Con «Liberar» desbloqueás. Esas fechas no aparecen disponibles en las búsquedas.',
            'Para sincronizar con otro calendario, tocá «Conectar calendarios externos».',
            'Con Google Calendar, tocá «Conectar Google Calendar» y aprobá el acceso de solo lectura. Con Airbnb, Booking.com u otro, pegá la URL de exportación en formato iCal (.ics) y tocá «Conectar».',
            'Una vez conectado ves su estado y podés usar «Sincronizar ahora» o «Desconectar». Lo ya sincronizado queda como está al desconectar.',
            'Los bloqueos que llegan de un calendario conectado no se editan desde Hospeda: para liberar esos días, cambiá el evento en el calendario de origen o desconectalo.',
            'El calendario y la sincronización dependen de tu plan: si no los incluye, el editor lo avisa y te lleva a mejorar el plan.'
        ],
        destinations: [
            {
                kind: 'ownEditorSection',
                vertical: 'accommodation',
                section: 'calendar',
                label: 'Calendario'
            },
            { kind: 'plans', vertical: 'accommodation', label: 'Planes para alojamientos' }
        ],
        reviewedAt: '2026-11-17'
    },
    {
        id: 'provider-directory',
        audience: 'host',
        title: 'Usar el directorio de proveedores',
        keywords: [
            'directorio',
            'proveedor',
            'proveedores',
            'plomero',
            'electricista',
            'cerrajero',
            'oficios',
            'servicio tecnico',
            'beneficio para anfitriones'
        ],
        steps: [
            'Entrá a «Directorio de proveedores»: son proveedores locales de confianza para tu alojamiento. Necesitás tener alojamientos registrados para verlo.',
            'Elegí un proveedor para ver su beneficio para anfitriones, su horario y las valoraciones de otros anfitriones.',
            'Después de usar su servicio, registrá el uso del beneficio (mirá «Registrar y confirmar usos de un beneficio»).',
            'Cuando el proveedor confirma un uso, vas a poder valorarlo. Las valoraciones las escriben anfitriones con un uso confirmado.'
        ],
        destinations: [{ kind: 'providerDirectory', label: 'Directorio de proveedores' }],
        reviewedAt: '2026-11-17'
    },
    {
        id: 'benefit-usage',
        audience: 'host',
        title: 'Registrar y confirmar usos de un beneficio',
        keywords: [
            'beneficio',
            'uso del beneficio',
            'usos',
            'registrar uso',
            'confirmar uso',
            'rechazar uso',
            'descuento de proveedor',
            'qr del proveedor',
            'escanear qr'
        ],
        steps: [
            'Para registrar un uso, abrí el proveedor en el directorio y tocá «Registrar uso del beneficio». Si el proveedor tiene un código QR, escanearlo lleva a la misma página.',
            'Elegí el día del servicio (viene con la fecha de hoy y no puede ser futuro) y, si querés, escribí una nota.',
            'Tocá «Registrar el uso». Queda pendiente hasta que el proveedor lo confirme.',
            'Si el que registró el uso fue el proveedor, aparece en «Usos del beneficio», en «Esperan tu confirmación»: tocá «Confirmar» o «Rechazar» (con un motivo opcional). El rechazo se puede deshacer.',
            'En el historial de esa misma página ves todos los usos y podés filtrarlos por pendientes, confirmados, rechazados o vencidos.'
        ],
        destinations: [
            { kind: 'benefitUsages', label: 'Usos del beneficio' },
            { kind: 'providerDirectory', label: 'Directorio de proveedores' }
        ],
        reviewedAt: '2026-11-17'
    },
    {
        id: 'benefit-usage-provider',
        audience: 'provider',
        title: 'Soy proveedor: registrar usos y compartir mi QR',
        keywords: [
            'proveedor',
            'soy proveedor',
            'mi ficha',
            'registrar uso',
            'confirmar uso',
            'codigo qr',
            'qr',
            'usos pendientes',
            'anfitrion'
        ],
        steps: [
            'Entrá a «Mi ficha de proveedor».',
            'Para registrar un uso, elegí a quién atendiste: un anfitrión que ya te confirmó un uso o alguien nuevo, por su email (tiene que ser el email con el que se registró en Hospeda). Indicá el día del servicio y una nota opcional.',
            'El uso queda pendiente hasta que el anfitrión lo confirme y no suma a tus números hasta entonces.',
            'Descargá tu código QR, imprimilo o mostralo en el celular: el anfitrión lo escanea y registra el uso él mismo.',
            'Los usos que registró un anfitrión aparecen en «Esperan tu confirmación»: confirmalos para que cuenten.',
            'Si ves que no podés registrar usos por ahora, escribinos para revisarlo; tus usos ya confirmados siguen contando.'
        ],
        destinations: [
            { kind: 'providerPanel', label: 'Mi ficha de proveedor' },
            { kind: 'contact' }
        ],
        reviewedAt: '2026-11-17'
    }
];
