/**
 * @file datos-experiencias-aliados.mjs
 * @description Sales pieces for experiences (E*) and partners (P*). Facts follow
 * /presentacion/experiencias (no bookings today; reservations will be an
 * optional add-on) and /presentacion/aliados (plata: logo on the home carousel;
 * oro: own page; no directory; no audience guarantee).
 */

const AUD_E = 'guías, prestadores y organizadores de experiencias turísticas del Litoral';
const AUD_P = 'comercios, marcas, empresas e instituciones de la región';

export const EXPERIENCIAS = [
    {
        id: 'E1',
        slug: 'mostra-tu-experiencia',
        name: 'Mostrá tu experiencia',
        para: 'Todas las experiencias, como primer mensaje',
        tipo: 'Placa',
        formats: ['4:5', '9:16'],
        sc: '/HEADLINEAD + /GOLDENHOUR + /freezeaction',
        audience: AUD_E,
        badge: true,
        hospedin: true,
        img: 'Hospedín remando en un kayak en el río Uruguay al atardecer, con salpicaduras congeladas en el aire y la costa verde atrás.',
        comp: 'Título arriba. Hospedín y el kayak en la mitad inferior. Tres beneficios en tarjetas a la izquierda.',
        texts: {
            tag: 'Experiencias',
            title: 'El turista decide qué hacer antes de llegar.',
            subtitle: 'Que te encuentre a vos.',
            items: [
                'Kayak, pesca, cabalgatas, visitas guiadas',
                'Sin comisión: una cuota fija',
                'El interesado te contacta directo'
            ],
            cta: 'Publicá tu experiencia en hospeda.com.ar'
        }
    },
    {
        id: 'E2',
        slug: 'tu-experiencia-asi-se-ve',
        name: 'Tu experiencia, así se ve',
        para: 'Todas las experiencias',
        tipo: 'Placa con captura anotada',
        formats: ['4:5', '9:16'],
        sc: '/FEATURECALLOUTS + /SPLITLAYOUT',
        audience: AUD_E,
        badge: true,
        capture:
            'la ficha real de una experiencia de hospeda.com.ar en el celular, con fotos, precio «desde», qué incluye, qué llevar, dónde arranca y qué pasa si no sale',
        img: 'Un celular grande y recto al centro con la captura. De sus costados salen cinco etiquetas unidas a la pantalla por líneas finas.',
        comp: 'Título arriba. El celular al centro. Las etiquetas alternadas a los costados.',
        texts: {
            tag: 'Tu vidriera',
            title: 'Todo lo que el turista pregunta, respondido.',
            itemsLabel: 'Las cinco etiquetas alrededor del celular',
            items: [
                'Fotos y video',
                'Qué incluye y qué llevar',
                'Requisitos: edad, saber nadar',
                'Dónde arranca',
                'Qué pasa si llueve'
            ],
            cta: 'Publicá la tuya en hospeda.com.ar'
        }
    },
    {
        id: 'E3',
        slug: 'turista-internacional',
        name: 'Turista internacional',
        para: 'Pesca, naturaleza, avistaje de aves',
        tipo: 'Placa',
        formats: ['4:5', '9:16'],
        sc: '/HEADLINEAD + /godrays',
        audience:
            'prestadores de pesca, naturaleza y avistaje de aves que reciben turistas extranjeros',
        badge: true,
        hospedin: true,
        img: 'Hospedín en una lancha de pesca en el río, con caña, al amanecer con rayos de luz entre la bruma. Tres globos de diálogo con "Hola", "Hello" y "Olá".',
        comp: 'Título arriba. Hospedín y la lancha al centro. Dos beneficios abajo.',
        texts: {
            tag: 'Para el que viene de afuera',
            title: 'Tu experiencia en español, inglés y portugués.',
            items: [
                'Se traduce sola con inteligencia artificial',
                'El brasileño y el extranjero te leen en su idioma'
            ],
            cta: 'Publicá en hospeda.com.ar'
        }
    },
    {
        id: 'E4',
        slug: 'cerca-de-los-alojamientos',
        name: 'Cerca de los alojamientos',
        para: 'Todas las experiencias',
        tipo: 'Infografía',
        formats: ['4:5', '9:16'],
        sc: '/FEATURECALLOUTS + /MINIMALPOSTER',
        audience: AUD_E,
        badge: true,
        img: 'Mapa ilustrado y simple de un tramo de río con tres íconos de casa (alojamientos) y un ícono de brújula (la experiencia), unidos por líneas punteadas naranjas con la distancia escrita en cada una.',
        comp: 'Título arriba. El mapa al centro. Dos beneficios abajo.',
        texts: {
            tag: 'Donde está el turista',
            title: 'El que se aloja cerca, te ve.',
            subtitle: 'Hospeda conecta cada lugar con lo que tiene alrededor.',
            extra: ['- Distancias en las líneas del mapa: "2 km", "5 km", "8 km"'],
            items: [
                'Tu experiencia en la página de tu destino',
                'Junto al clima y la agenda de la zona'
            ],
            cta: 'Sumate en hospeda.com.ar'
        },
        notes: [
            {
                label: 'Verificar antes',
                text: 'que las experiencias aparezcan en la página del destino y en «Qué hay cerca» de los alojamientos. Si todavía no, sacá el subtítulo y el primer ítem.'
            }
        ]
    },
    {
        id: 'E5',
        slug: 'hoy-y-lo-que-viene',
        name: 'Hoy, y lo que viene',
        para: 'Quien pregunta si se puede reservar o cobrar por Hospeda',
        tipo: 'Placa',
        formats: ['4:5', '9:16'],
        sc: '/SPLITLAYOUT + /MINIMALPOSTER',
        audience: AUD_E,
        badge: false,
        img: 'Dos mitades: arriba "Hoy", con un ícono de teléfono y un sobre; abajo "Próximamente", con un ícono de calendario con un tilde, en tono más claro.',
        comp: 'Título arriba. Dos bloques horizontales: "Hoy" arriba, "Próximamente" abajo.',
        texts: {
            title: 'Hoy no se vende el cupo por acá.',
            extra: [
                '- Bloque "Hoy": "El interesado te llama o te escribe. El cupo, la seña y el pago, los arreglás vos."',
                '- Bloque "Próximamente": "Reservas o turnos, como complemento opcional. Si no lo activás, todo sigue igual."'
            ],
            cta: 'Consultanos al WhatsApp'
        },
        notes: [
            {
                label: 'Regla',
                text: 'las reservas todavía no existen: el bloque de abajo siempre dice «Próximamente».'
            }
        ]
    },
    {
        id: 'E6',
        slug: 'planes-y-complementos',
        name: 'Planes y complementos',
        para: 'Quien pregunta qué plan elegir',
        tipo: 'Infografía',
        formats: ['4:5', '9:16'],
        sc: '/FEATURECALLOUTS + /MINIMALPOSTER',
        audience: AUD_E,
        badge: true,
        img: 'Tres tarjetas de plan con íconos de brújula de distinto tamaño. Debajo, dos complementos como piezas que se encastran. Sin precios.',
        comp: 'Título arriba, las tres tarjetas al centro y los complementos abajo.',
        texts: {
            tag: 'Elegí sin vueltas',
            title: 'Tres planes, según cuántas salidas tengas.',
            extra: [
                '- Tarjeta 1: "Básico" · "Para empezar"',
                '- Tarjeta 2: "Profesional" · "Mapa y cómo llegar"',
                '- Tarjeta 3: "Premium" · "Galerías de fotos por fecha y el máximo de fotos"',
                '- Encabezado de los complementos: "Y si necesitás más:"',
                '- Complemento 1: "Destacar tu experiencia 7 o 30 días"',
                '- Complemento 2: "1 experiencia más"'
            ],
            cta: 'Te ayudamos a elegir'
        }
    }
];

export const ALIADOS = [
    {
        id: 'P1',
        slug: 'por-que-aliarse',
        name: 'Por qué aliarse',
        para: 'Marcas, empresas e instituciones',
        tipo: 'PDF (5 páginas)',
        formats: ['2:3'],
        sc: '/MINIMALPOSTER + /CAMPAIGNKEYVISUAL',
        audience: AUD_P,
        badge: false,
        system: [
            'Fondo blanco con una banda superior de 180 px en #0D2B3E donde va el logo en blanco.',
            'Título de página en Geologica ExtraBold #0D2B3E, a la izquierda, debajo de la banda.',
            'Bloques en tarjetas blancas con borde de 2 px #DFECF8 y esquinas de 24 px.',
            'Íconos de línea estilo Phosphor de 56 px en #2493B6.',
            'Tono institucional y sobrio, sin Hospedín salvo en la última página.',
            'Barra de contacto #0D2B3E abajo con el sitio, el WhatsApp y el número de página.'
        ],
        pages: [
            {
                name: 'Portada',
                photo: 'el río Uruguay y su costa, sin ninguna ciudad reconocible',
                comp: 'Foto a sangre en la mitad superior. Abajo, título y subtítulo grandes.',
                texts: {
                    tag: 'Aliados de Hospeda',
                    title: 'Acompañá al turismo del Litoral.',
                    subtitle: 'Tu marca donde se planifican los viajes a la región.',
                    cta: 'Hablemos'
                }
            },
            {
                name: 'Qué es Hospeda',
                img: 'Cuatro íconos en tarjetas: cama, cubiertos, brújula y calendario.',
                comp: 'Un párrafo corto arriba y cuatro tarjetas en grilla de 2x2.',
                texts: {
                    title: 'Dónde aparecés',
                    body: 'El portal donde el turista arma el viaje al Litoral: dónde dormir, comer, salir y qué hacer.',
                    items: ['Alojamientos', 'Comer y salir', 'Experiencias', 'Eventos y destinos'],
                    cta: 'hospeda.com.ar'
                }
            },
            {
                name: 'Plata y oro',
                img: 'Dos columnas: plata con un borde gris #C0C7CC y oro con un borde #F5A623.',
                comp: 'Título y las dos columnas lado a lado.',
                texts: {
                    title: 'Dos niveles',
                    extra: [
                        '- Columna "Plata": "Tu logo en el carrusel de la portada" · "Apariciones en la difusión"',
                        '- Columna "Oro": "Todo lo de plata" · "Tu página propia en Hospeda, con logo, textos, contacto y redes" · "Tu logo lleva a tu página o a tu sitio"'
                    ],
                    cta: 'hospeda.com.ar'
                }
            },
            {
                name: 'Lo que medimos',
                img: 'Un panel con un gráfico de barras simple y una lista de apariciones con fecha.',
                comp: 'Título, el panel y dos líneas de aclaración.',
                texts: {
                    title: 'Tus números, sin humo',
                    items: [
                        'Visitas a tu página y clics en tu logo',
                        'Cada aparición en la difusión, con fecha y enlace'
                    ],
                    body: 'Medimos lo que pasa dentro de Hospeda. No prometemos resultados de audiencia.',
                    cta: 'hospeda.com.ar'
                }
            },
            {
                name: 'Próximo paso',
                hospedin: true,
                img: 'Hospedín dando la mano, sobre fondo #EEF8FF.',
                comp: 'Título grande, tres pasos numerados y Hospedín abajo a la derecha.',
                texts: {
                    title: '¿Lo charlamos?',
                    items: [
                        'Elegimos juntos el nivel',
                        'Armamos tu presencia',
                        'Te sumás al lanzamiento'
                    ],
                    extra: ['- Firma: "[NOMBRE DEL VENDEDOR] · Asesor comercial"'],
                    cta: 'Escribinos al WhatsApp'
                }
            }
        ],
        notes: [
            {
                label: 'Regla',
                text: 'no se ponen métricas de audiencia: todavía no hay datos reales. Cambiá [NOMBRE DEL VENDEDOR] antes de mandar.'
            }
        ]
    },
    {
        id: 'P2',
        slug: 'oro-vs-plata',
        name: 'Oro vs. plata',
        para: 'Quien duda entre los dos niveles',
        tipo: 'Infografía comparativa',
        formats: ['4:5', '9:16'],
        sc: '/COMPARISONLAYOUT + /MINIMALPOSTER',
        audience: AUD_P,
        badge: false,
        img: 'Dos columnas de comparación: plata con borde gris #C0C7CC y oro con borde #F5A623, apenas más grande. Filas con tildes y guiones. Sin precios.',
        comp: 'Título arriba. La tabla de dos columnas al centro.',
        texts: {
            tag: 'Aliados',
            title: 'Plata u oro: la diferencia es tu página.',
            extra: [
                '- Fila "Logo en el carrusel de la portada": plata ✓ · oro ✓',
                '- Fila "Apariciones en la difusión": plata ✓ · oro ✓',
                '- Fila "Página propia en Hospeda": plata — · oro ✓',
                '- Fila "Tu logo lleva a tu página o a tu sitio": plata — · oro ✓'
            ],
            cta: 'Hablemos al WhatsApp'
        },
        notes: [
            {
                label: 'Verificar antes',
                text: 'contra la tabla de /presentacion/aliados: en plata el logo no lleva a ningún lado.'
            }
        ]
    },
    {
        id: 'P3',
        slug: 'donde-aparece-tu-marca',
        name: 'Dónde aparece tu marca',
        para: 'Quien quiere ver la presencia antes de decidir',
        tipo: 'Carrusel (3 placas)',
        formats: ['4:5'],
        sc: '/CAROUSELCOVER + /CAROUSELSLIDE + /SPLITLAYOUT',
        audience: AUD_P,
        badge: false,
        system: [
            'Fondo #EEF8FF con una laptop grande inclinada 4° ocupando el centro.',
            'Título arriba y una etiqueta fina apuntando a la marca en la pantalla.',
            'Barra de contacto #0D2B3E abajo.'
        ],
        slides: [
            {
                name: 'La portada',
                capture: 'la portada de hospeda.com.ar con el carrusel de aliados visible',
                img: 'La laptop con la captura.',
                comp: 'Según el SISTEMA VISUAL FIJO.',
                texts: {
                    title: 'En la portada.',
                    body: 'Tu logo en el carrusel de aliados.',
                    cta: 'Hablemos al WhatsApp'
                }
            },
            {
                name: 'La página oro',
                capture: 'una página de aliado oro real',
                img: 'La laptop con la captura.',
                comp: 'Según el SISTEMA VISUAL FIJO.',
                texts: {
                    tag: 'Nivel oro',
                    title: 'Tu página propia.',
                    body: 'Con logo, textos, contacto y redes.',
                    cta: 'Hablemos al WhatsApp'
                }
            },
            {
                name: 'Tu panel',
                capture: 'el panel del aliado con visitas y registro de difusión',
                img: 'La laptop con la captura.',
                comp: 'Según el SISTEMA VISUAL FIJO.',
                texts: {
                    title: 'Y tus números.',
                    body: 'Visitas, clics y cada aparición, con fecha.',
                    cta: 'Hablemos al WhatsApp'
                }
            }
        ],
        notes: [
            {
                label: 'Verificar antes',
                text: 'que haya un aliado real publicado con permiso para mostrarlo; sin eso, esta pieza espera.'
            }
        ]
    },
    {
        id: 'P4',
        slug: 'aliado-fundador',
        name: 'Aliado fundador',
        para: 'Marcas que pueden entrar en el lanzamiento',
        tipo: 'Placa',
        formats: ['4:5', '9:16'],
        sc: '/HEADLINEAD + /PRODUCTLAUNCH + /GOLDENHOUR',
        audience: AUD_P,
        badge: false,
        hospedin: true,
        img: 'Hospedín cortando una cinta de inauguración junto al río al atardecer, con un pequeño estallido de confeti en colores de la marca.',
        comp: 'Título arriba. Hospedín al centro. Dos beneficios abajo.',
        texts: {
            tag: 'Estamos arrancando',
            title: 'Sumate desde el primer día.',
            items: ['Tu marca acompaña el lanzamiento', 'Crecemos juntos destino por destino'],
            cta: 'Hablemos al WhatsApp'
        },
        notes: [
            {
                label: 'Regla',
                text: 'sin métricas, sin precios y sin promesas de audiencia: el argumento es entrar temprano.'
            }
        ]
    },
    {
        id: 'P5',
        slug: 'kit-de-medios',
        name: 'Kit de medios',
        para: 'Marcas grandes que piden números',
        tipo: 'PDF (3 páginas, plantilla)',
        formats: ['2:3'],
        sc: '/MINIMALPOSTER + /FEATURECALLOUTS',
        audience: AUD_P,
        badge: false,
        prioridad5: true,
        system: [
            'Fondo blanco con una banda superior de 180 px en #0D2B3E donde va el logo en blanco.',
            'Números grandes en Geologica ExtraBold #2493B6, con su etiqueta debajo en Roboto.',
            'Barra de contacto #0D2B3E abajo con el sitio, el WhatsApp y el número de página.'
        ],
        attach: ['Los números reales de audiencia del período, sacados de las estadísticas.'],
        pages: [
            {
                name: 'Portada',
                comp: 'Título y subtítulo grandes centrados.',
                texts: {
                    tag: 'Kit de medios',
                    title: 'Hospeda en números.',
                    subtitle: 'Período: [PERÍODO]',
                    cta: 'hospeda.com.ar'
                }
            },
            {
                name: 'Audiencia',
                img: 'Cuatro tarjetas con un número grande cada una.',
                comp: 'Grilla de 2x2.',
                texts: {
                    title: 'Audiencia',
                    extra: [
                        '- Tarjeta: "[VISITAS]" · "visitas por mes"',
                        '- Tarjeta: "[USUARIOS]" · "personas distintas por mes"',
                        '- Tarjeta: "[SUSCRIPTORES]" · "suscriptores del newsletter"',
                        '- Tarjeta: "[DESTINOS]" · "destinos publicados"'
                    ],
                    cta: 'hospeda.com.ar'
                }
            },
            {
                name: 'Formatos',
                img: 'Tres tarjetas: carrusel de portada, página propia y newsletter.',
                comp: 'Tres tarjetas en columna.',
                texts: {
                    title: 'Cómo aparecés',
                    items: [
                        'Carrusel de aliados en la portada',
                        'Página propia (nivel oro)',
                        'Apariciones en el newsletter'
                    ],
                    cta: 'Hablemos al WhatsApp'
                }
            }
        ],
        structure:
            'Antes de generar, pedime los números reales y esperá. Reemplazá cada [DATO] por el que te pase, copiado exactamente. Si falta uno, no lo inventes: preguntámelo.',
        notes: [
            {
                label: 'Prioridad 5',
                text: 'no se genera hasta tener datos reales de audiencia. Es una plantilla guardada.'
            }
        ]
    }
];
