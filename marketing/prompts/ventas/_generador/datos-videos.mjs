/**
 * @file datos-videos.mjs
 * @description Data of the sales videos. `hailuo` videos: Hospedín shots from Hailuo +
 * a voice take + real recordings, assembled by Claude Code. `claude` videos:
 * motion-graphics tutorials built end to end by Claude Code in Remotion.
 * Recording codes (P1, A3, ...) are the ones in `marketing/prompts/grabaciones.md`.
 */

const HOME_CAPTURE = 'captura real de la home de hospeda.com.ar en el celular, sacada sin login';

/** Hospedín videos generated in Hailuo. */
export const VIDEOS_HAILUO = [
    {
        id: 'VH1',
        slug: 'sin-comision',
        name: 'Sin comisión, para todos',
        vertical: 'Para todas',
        para: 'Cualquier prospecto, como primer video por WhatsApp',
        mode: 'hailuo',
        badge: true,
        scene: 'escena4',
        sceneDesc: 'riverside promenade (costanera) of the Litoral',
        ambience: 'soft riverside ambience, distant birds and a light breeze',
        lines: [
            { text: '¿Tenés un alojamiento, un local o una salida para turistas?' },
            { text: 'En Hospeda te encuentran sin pagar comisión por reserva.' },
            { text: 'Probalo treinta días gratis, sin tarjeta.' },
            { text: 'Entrá a hospeda.com.ar.' }
        ],
        shots: [
            {
                id: 'T1',
                source: 'hailuo',
                lines: [0],
                screen: HOME_CAPTURE,
                framing:
                    'A closer view than @######ESCENA#######, cropped to a medium shot of the character — chest and head — filling most of the vertical frame. He holds the smartphone at chest height, its screen facing the camera. The promenade and the river are softly out of focus behind him. Warm afternoon light.',
                action: 'He asks the question with a CURIOSO expression as in @######EXPRESIONES#######, head slightly tilted, and points at the camera with his free hand the way SEÑALANDO appears in @######ACCIONES#######. The phone stays still at chest height.'
            },
            {
                id: 'T2',
                source: 'grabacion',
                lines: [1],
                recording: 'P1 · Home, scroll',
                recordingHow:
                    'Scroll lento desde el buscador hasta los destinos, sin detenerse en ningún destino en particular.'
            },
            {
                id: 'T3',
                source: 'hailuo',
                lines: [2],
                screen: HOME_CAPTURE,
                framing:
                    'The literal full-body framing of @######ESCENA#######: the character standing on the promenade, the phone in one hand.',
                action: 'With an ENTUSIASMADO expression he raises his free hand in the ES FÁCIL pose from @######ACCIONES#######, open and relaxed.'
            },
            { id: 'T4', source: 'cierre', lines: [3], use: 4 }
        ],
        onScreen: [
            'T1: «¿Alojamiento, local o salida?»',
            'T2: «Sin comisión por reserva»',
            'T3: «30 días de prueba gratis · Sin tarjeta»'
        ],
        cta: 'Sumate a Hospeda'
    },
    {
        id: 'VH2',
        slug: 'del-depto-al-hotel',
        name: 'Del departamento al hotel',
        vertical: 'Alojamientos',
        para: 'Dueños de departamentos, cabañas, casas, complejos y hoteles',
        mode: 'hailuo',
        badge: true,
        scene: 'escena1',
        sceneDesc: 'wooden Litoral cabin',
        ambience: 'quiet outdoor countryside ambience, birds in the distance',
        lines: [
            { text: '¿Alquilás un departamento, una cabaña o tenés un hotel?' },
            { text: 'Tu ficha con fotos, mapa y calendario, en español, inglés y portugués.' },
            { text: 'Y los turistas te escriben directo a vos.' },
            { text: 'Publicá tu alojamiento en hospeda.com.ar.' }
        ],
        shots: [
            {
                id: 'T1',
                source: 'hailuo',
                lines: [0],
                screen: 'captura real de una ficha de alojamiento publicada, en el celular',
                framing:
                    'A closer view than @######ESCENA#######, cropped to a medium shot — chest and head — with the phone held at chest height, screen to the camera. The cabin softly out of focus. Warm afternoon light.',
                action: 'He asks with an ALEGRE expression, counting the three options on the fingers of his free hand the way ENUMERANDO appears in @######ACCIONES#######.'
            },
            {
                id: 'T2',
                source: 'grabacion',
                lines: [1],
                recording: 'P5 · Ficha de alojamiento completa, sección por sección',
                recordingHow:
                    'Fotos, mapa, calendario y el selector de idioma pasando a inglés y a portugués. Un alojamiento con buenas fotos.'
            },
            {
                id: 'T3',
                source: 'grabacion',
                lines: [2],
                recording: 'P6 · Botón de contacto → WhatsApp abriéndose',
                recordingHow: 'Sin que se lea un número de teléfono real.'
            },
            { id: 'T4', source: 'cierre', lines: [3], use: 4 }
        ],
        onScreen: [
            'T1: «Departamento, cabaña u hotel»',
            'T2: «Fotos · Mapa · Calendario · 3 idiomas»',
            'T3: «Te escriben directo»'
        ],
        cta: 'Publicá tu alojamiento'
    },
    {
        id: 'VH3',
        slug: 'calendario-sincronizado',
        name: 'Basta de bloquear fechas a mano',
        vertical: 'Alojamientos',
        para: 'Quien ya publica en Airbnb o Booking',
        mode: 'hailuo',
        badge: true,
        scene: 'escena25',
        sceneDesc: 'cabin porch (galería) with a lounge chair',
        ambience: 'quiet countryside ambience from a porch, birds in the distance',
        lines: [
            { text: '¿Te cansaste de bloquear fechas a mano en cada plataforma?' },
            { text: 'Conectás tu calendario y las fechas se bloquean solas.' },
            { text: 'Publicá tu alojamiento en hospeda.com.ar.' }
        ],
        shots: [
            {
                id: 'T1',
                source: 'hailuo',
                lines: [0],
                phone: false,
                framing:
                    'A closer view than @######ESCENA#######, a medium shot of the character on the porch, chest and head filling the vertical frame.',
                action: 'He asks with a FASTIDIO expression as in @######EXPRESIONES####### — resigned and tired, never angry — and lets his shoulders drop the way AGOBIADO appears in @######ACCIONES#######.'
            },
            {
                id: 'T2',
                source: 'grabacion',
                lines: [1],
                recording: 'A3 · Calendario: conectar y ver las fechas bloquearse',
                recordingHow:
                    'Pegar el enlace del calendario y ver los días ocupados. Sin el logo de Airbnb ni de Booking en cuadro.'
            },
            {
                id: 'T3',
                source: 'hailuo',
                lines: [],
                use: 2,
                phone: false,
                framing: 'The literal full-body framing of @######ESCENA#######.',
                action: 'Relieved, he leans back with a CONTENTO expression and gives a short ¡VAMOS! gesture from @######ACCIONES#######.'
            },
            { id: 'T4', source: 'cierre', lines: [2], use: 4 }
        ],
        onScreen: ['T1: «¿Bloquear fechas a mano?»', 'T2: «Se bloquean solas»'],
        cta: 'Publicá tu alojamiento',
        notes: [
            {
                label: 'Verificar antes',
                text: 'La sincronización de calendario es del plan Profesional; la prueba gratis la incluye. El video no nombra planes.'
            }
        ]
    },
    {
        id: 'VH4',
        slug: 'tu-local',
        name: 'Que te encuentren para comer o salir',
        vertical: 'Comer y salir',
        para: 'Carritos, rotiserías, restaurantes, cervecerías, bares y boliches',
        mode: 'hailuo',
        badge: true,
        scene: 'escena10',
        sceneDesc: 'restaurant',
        ambience: 'soft restaurant ambience, distant cutlery and murmur',
        lines: [
            { text: '¿Tenés un carrito, una rotisería o un resto bar?' },
            { text: 'Que te encuentren los que buscan dónde comer o salir.' },
            { text: 'Con tus fotos y tus horarios.' },
            { text: 'Sumá tu local en hospeda.com.ar.' }
        ],
        shots: [
            {
                id: 'T1',
                source: 'hailuo',
                lines: [0],
                screen: 'captura real del listado de Comer y salir, en el celular',
                framing:
                    'A closer view than @######ESCENA#######, a medium shot — chest and head — with the phone at chest height, screen to the camera. The restaurant softly out of focus.',
                action: 'He asks with an ALEGRE expression, counting on the fingers of his free hand the way ENUMERANDO appears in @######ACCIONES#######.'
            },
            {
                id: 'T2',
                source: 'grabacion',
                lines: [1, 2],
                recording: 'P8 · Gastronomía: listado y ficha',
                recordingHow:
                    'Del listado a una ficha: fotos y horarios. Un local con buenas fotos.'
            },
            { id: 'T3', source: 'cierre', lines: [3], use: 4 }
        ],
        onScreen: ['T1: «Carrito, rotisería o resto bar»', 'T2: «Fotos · Horarios»'],
        cta: 'Sumá tu local',
        notes: [
            {
                label: 'Regla',
                text: 'La ficha pública de un local no muestra teléfono ni WhatsApp: el video no promete que «te escriben directo».'
            }
        ]
    },
    {
        id: 'VH5',
        slug: 'tu-experiencia',
        name: 'Tu salida, donde el turista ya está mirando',
        vertical: 'Experiencias',
        para: 'Guías, pesca, kayak, cabalgatas y agencias',
        mode: 'hailuo',
        badge: true,
        scene: 'escena12',
        sceneDesc: 'fishing boat on the river',
        ambience: 'gentle water lapping against a boat, distant birds',
        lines: [
            { text: '¿Llevás turistas a pescar, en kayak o a cabalgar?' },
            { text: 'Mostrá tu salida donde el turista ya está buscando qué hacer.' },
            { text: 'Probalo treinta días gratis, sin tarjeta.' },
            { text: 'Publicá tu experiencia en hospeda.com.ar.' }
        ],
        shots: [
            {
                id: 'T1',
                source: 'hailuo',
                lines: [0],
                screen: 'captura real del listado de Experiencias, en el celular',
                framing:
                    'A closer view than @######ESCENA#######, a medium shot of the character on the boat — chest and head — with the phone at chest height, screen to the camera. The river softly out of focus.',
                action: 'He asks with a DIVERTIDO expression and gestures at the river with his free hand the way SEÑALANDO appears in @######ACCIONES#######.'
            },
            {
                id: 'T2',
                source: 'grabacion',
                lines: [1],
                recording: 'P9 · Experiencias: listado y ficha',
                recordingHow: 'Del listado a una ficha con buenas fotos.'
            },
            {
                id: 'T3',
                source: 'hailuo',
                lines: [2],
                screen: 'captura real del listado de Experiencias, en el celular',
                framing: 'The literal full-body framing of @######ESCENA#######.',
                action: 'With an ENTUSIASMADO expression he raises his free hand in the ES FÁCIL pose from @######ACCIONES#######.'
            },
            { id: 'T4', source: 'cierre', lines: [3], use: 4 }
        ],
        onScreen: [
            'T1: «¿Pesca, kayak o cabalgata?»',
            'T3: «30 días de prueba gratis · Sin tarjeta»'
        ],
        cta: 'Publicá tu experiencia',
        notes: [
            {
                label: 'Regla',
                text: 'Hoy no se vende el cupo por Hospeda: el video no habla de reservas.'
            }
        ]
    },
    {
        id: 'VH6',
        slug: 'tu-marca',
        name: 'Tu marca en la portada',
        vertical: 'Aliados',
        para: 'Marcas y comercios que quieren llegar a los que viajan a la zona',
        mode: 'hailuo',
        badge: false,
        scene: 'escena9',
        sceneDesc: 'craft brewery',
        ambience: 'soft brewery ambience, distant murmur',
        lines: [
            { text: '¿Tenés una marca y querés que te vean los que viajan a la zona?' },
            { text: 'Tu logo en la portada de Hospeda.' },
            { text: 'Y con el nivel oro, tu propia página.' },
            { text: 'Hablemos en hospeda.com.ar.' }
        ],
        shots: [
            {
                id: 'T1',
                source: 'hailuo',
                lines: [0],
                screen: HOME_CAPTURE,
                framing:
                    'A closer view than @######ESCENA#######, a medium shot — chest and head — with the phone at chest height, screen to the camera. The brewery softly out of focus.',
                action: 'He asks with a CURIOSO expression and gives the TE EXPLICO gesture from @######ACCIONES####### with his free hand.'
            },
            {
                id: 'T2',
                source: 'grabacion',
                lines: [1, 2],
                recording: 'P1 · Home, hasta el carrusel de aliados',
                recordingHow: 'Detenerse en el carrusel y entrar a la página de un aliado oro.'
            },
            { id: 'T3', source: 'cierre', lines: [3], use: 4 }
        ],
        onScreen: ['T2: «Plata: tu logo en la portada»', 'T2: «Oro: además, tu propia página»'],
        cta: 'Sumá tu marca',
        notes: [
            {
                label: 'Verificar antes',
                text: 'Hace falta un aliado real publicado, con su permiso, para grabar el carrusel y la página oro.'
            }
        ]
    }
];

/** Motion-graphics tutorials built by Claude Code in Remotion. */
export const VIDEOS_CLAUDE = [
    {
        id: 'VC1',
        slug: 'publica-en-tres-pasos',
        name: 'Publicá tu alojamiento en tres pasos',
        vertical: 'Alojamientos',
        para: 'Dueños que dudan de «si sabrán cargarlo»',
        mode: 'claude',
        badge: true,
        length: '30 a 35 s',
        idea: 'Mostrar que cargar un alojamiento es corto y guiado. Es el video A1 que ya existe, convertido en pieza de venta.',
        account:
            'una cuenta de anfitrión en staging (su alojamiento se llama «Casa Quinta Las Palmeras»)',
        recording: 'A1/A2 · alta completa de un alojamiento, desde /publicar/ hasta publicado.',
        recordSteps: [
            'Datos básicos: nombre, tipo y capacidad.',
            'Ubicación en el mapa y fotos.',
            'Servicios y contacto; publicar.'
        ],
        intro: '¿Querés publicar tu alojamiento?',
        stages: [
            {
                chip: 'Datos básicos',
                says: 'Primero, lo básico.',
                show: 'Tipeo con jump cut y foco en el campo activo.'
            },
            {
                chip: 'Fotos y mapa',
                says: 'Subís las fotos y marcás dónde está.',
                show: 'Toques en la carga de fotos y el pin del mapa.'
            },
            {
                chip: 'Listo',
                says: '¡Y ya está publicado!',
                show: 'La ficha pública, con un scroll corto.'
            }
        ],
        cta: 'Publicá tu alojamiento',
        extraRules: [
            'Reusá todo lo que sirva de src/a1/; regrabá con el dispositivo de referencia (REGLAS.md, «Pendiente: regrabar A1»).'
        ]
    },
    {
        id: 'VC2',
        slug: 'importa-desde-un-link',
        name: 'Ya lo tenés publicado: importalo',
        vertical: 'Alojamientos',
        para: 'Quien ya tiene su aviso en otra plataforma',
        mode: 'claude',
        badge: true,
        length: '20 a 25 s',
        idea: 'Pegás el link de tu aviso y la ficha se completa sola. Versión motion graphics de V1, sin tiradas de Hailuo.',
        account: 'una cuenta de anfitrión en staging',
        recording: 'A10 · Importar ficha: pegar el link, esperar, la ficha aparece completa.',
        recordSteps: [
            'Abrir el importador desde /publicar/.',
            'Pegar el link de un aviso (sin que se vea el logo de Airbnb ni de Booking).',
            'Esperar la carga y hacer scroll por la ficha completa.'
        ],
        intro: '¿Ya estás publicado en otro lado?',
        stages: [
            {
                chip: 'Pegá el link',
                says: 'Pegás el link de tu aviso.',
                show: 'Foco en el campo del link.'
            },
            {
                chip: 'Se completa',
                says: 'Y tu ficha se completa sola.',
                show: 'La carga tapada con el barrido de marca y la ficha llena.'
            }
        ],
        cta: 'Publicá tu alojamiento',
        extraRules: [
            'En la voz y los textos se dice «Google, Mercado Libre y otras plataformas», nunca Airbnb ni Booking.'
        ]
    },
    {
        id: 'VC3',
        slug: 'suma-tu-local',
        name: 'Sumá tu local',
        vertical: 'Comer y salir',
        para: 'Locales gastronómicos y de noche',
        mode: 'claude',
        badge: true,
        length: '25 a 30 s',
        idea: 'Cargar un local es corto: datos, fotos y dónde encontrarte.',
        account: 'una cuenta de dueño de local en staging',
        recording: 'Alta de un local desde /publicar/comer-y-salir/ hasta publicado.',
        recordSteps: [
            'Datos del local y rubro.',
            'Fotos y ubicación.',
            'Redes y publicar; la ficha pública.'
        ],
        intro: '¿Querés sumar tu local?',
        stages: [
            { chip: 'Tu local', says: 'Contás qué es tu local.', show: 'Tipeo con jump cut.' },
            {
                chip: 'Fotos y mapa',
                says: 'Fotos y dónde encontrarte.',
                show: 'Carga de fotos y pin del mapa.'
            },
            { chip: 'Publicado', says: '¡Listo, ya te encuentran!', show: 'La ficha pública.' }
        ],
        cta: 'Sumá tu local',
        extraRules: [
            'El mapa de locales todavía no existe: la toma del mapa se presta del editor de alojamientos, tapando todo lo que diga alojamiento (decisión del dueño), y se regraba cuando entre. El video no se manda hasta entonces.',
            'En el copy se dice «tu local»; «menú» o «carta» sólo si se muestra esa sección.',
            'La ficha pública de un local no muestra teléfono: no prometas que te escriben directo.'
        ]
    },
    {
        id: 'VC4',
        slug: 'publica-tu-experiencia',
        name: 'Publicá tu experiencia',
        vertical: 'Experiencias',
        para: 'Guías y prestadores de actividades',
        mode: 'claude',
        badge: true,
        length: '25 a 30 s',
        idea: 'Mostrar el alta de una experiencia y cómo la ve el turista.',
        account: 'una cuenta de prestador de experiencias en staging',
        recording: 'Alta de una experiencia desde /publicar/experiencias/ hasta publicada.',
        recordSteps: [
            'Datos de la salida.',
            'Fotos y punto de encuentro.',
            'Publicar; la ficha pública.'
        ],
        intro: '¿Querés mostrar tu salida?',
        stages: [
            { chip: 'Tu salida', says: 'Contás de qué se trata.', show: 'Tipeo con jump cut.' },
            { chip: 'Fotos', says: 'Sumás tus mejores fotos.', show: 'Carga de fotos.' },
            { chip: 'Publicada', says: '¡Y el turista ya la ve!', show: 'La ficha pública.' }
        ],
        cta: 'Publicá tu experiencia',
        extraRules: ['Hoy no se vende el cupo por Hospeda: nada de reservas ni pagos en el video.']
    },
    {
        id: 'VC5',
        slug: 'lo-que-ve-el-turista',
        name: 'Lo que ve el turista',
        vertical: 'Para todas',
        para: 'Cualquier prospecto que pregunta «¿y cómo se ve?»',
        mode: 'claude',
        badge: false,
        length: '20 a 25 s',
        idea: 'Recorrido por una ficha pública: traducción automática, mapa y qué hay cerca. El clima no va: vive en la página del destino, no en la ficha.',
        account: 'ninguna: es la ficha pública, sin login',
        recording: 'P5 · Ficha de alojamiento completa, sección por sección.',
        recordSteps: [
            'Fotos y descripción; cambiar el idioma a inglés y a portugués.',
            'Mapa y «Qué hay cerca», con distancias.'
        ],
        intro: '¿Cómo te ve el turista?',
        stages: [
            { chip: 'En su idioma', says: 'Tu ficha, en su idioma.', show: 'El cambio de idioma.' },
            {
                chip: 'Qué hay cerca',
                says: 'Mapa y qué hay cerca.',
                show: 'Mapa y lugares con distancia.'
            }
        ],
        cta: 'Sumate a Hospeda',
        extraRules: [
            'Elegí una ficha de un destino cualquiera de la lista aprobada, sin destacarlo en el texto.'
        ]
    }
];
