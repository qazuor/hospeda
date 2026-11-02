/**
 * @file datos-alojamientos.mjs
 * @description Sales pieces for the accommodation vertical (A*). Facts follow
 * /presentacion/alojamientos: plans Básico, Profesional and Premium; calendar
 * sync and featured placement from Profesional; advanced stats in Premium.
 */

const AUD = 'dueños de alojamientos del Litoral';

export const ALOJAMIENTOS = [
    {
        id: 'A1',
        slug: 'publicar-es-facil',
        name: 'Publicar es fácil',
        para: 'Quien alquila un departamento o una casa y no se lleva bien con la tecnología',
        tipo: 'Carrusel (4 placas)',
        formats: ['4:5'],
        sc: '/CAROUSELCOVER + /CAROUSELSLIDE + /GOLDENHOUR + /lifestyle',
        audience: 'personas mayores que alquilan un departamento o una casa a turistas',
        badge: true,
        system: [
            'Letra MUY grande: el título de cada placa nunca baja de 80 px y el cuerpo de 40 px. Es para gente que lee con anteojos.',
            'Máximo 8 palabras de título y 12 de cuerpo por placa.',
            'Fondo cálido #FED9AB muy suave, con Hospedín en cada placa a la derecha.',
            'Barra de contacto #0D2B3E abajo, con el WhatsApp bien grande.'
        ],
        slides: [
            {
                name: 'Portada',
                hospedin: true,
                img: 'Hospedín sentado en un sillón de un living luminoso, con un celular en la mano, sonriendo.',
                comp: 'Título grande a la izquierda, Hospedín a la derecha.',
                texts: {
                    title: '¿Alquilás tu departamento?',
                    subtitle: 'Publicalo en Hospeda desde el celular.',
                    cta: 'Te ayudamos a publicar'
                }
            },
            {
                name: 'Las fotos',
                hospedin: true,
                img: 'Hospedín sacándole una foto con el celular a una habitación prolija.',
                comp: 'Según el SISTEMA VISUAL FIJO.',
                texts: {
                    title: 'Sacás unas fotos.',
                    body: 'Con el celular alcanza.',
                    cta: 'Te ayudamos a publicar'
                }
            },
            {
                name: 'La descripción',
                hospedin: true,
                img: 'Hospedín escribiendo en el celular, con un globo de texto chico.',
                comp: 'Según el SISTEMA VISUAL FIJO.',
                texts: {
                    title: 'Contás cómo es.',
                    body: 'Cuántos entran, qué tiene, dónde queda.',
                    cta: 'Te ayudamos a publicar'
                }
            },
            {
                name: 'El contacto',
                hospedin: true,
                img: 'Hospedín mostrando el celular con una notificación de mensaje nuevo.',
                comp: 'Según el SISTEMA VISUAL FIJO.',
                texts: {
                    title: 'Y el turista te escribe.',
                    body: 'Directo a vos. Sin comisiones.',
                    cta: 'Si te trabás, te ayudamos'
                }
            }
        ]
    },
    {
        id: 'A2',
        slug: 'tu-ficha-asi-se-ve',
        name: 'Tu ficha, así se ve',
        para: 'Todos los alojamientos',
        tipo: 'Placa con captura anotada',
        formats: ['4:5', '9:16'],
        sc: '/FEATURECALLOUTS + /SPLITLAYOUT',
        audience: AUD,
        badge: true,
        capture:
            'una ficha de alojamiento real y completa de hospeda.com.ar, vista en el celular, con fotos, ubicación, la sección «Qué hay cerca», el clima del destino y la reputación externa',
        img: 'Un celular grande y recto en el centro, con la captura. De sus costados salen cinco etiquetas unidas a la pantalla por líneas finas, cada una con un ícono de línea.',
        comp: 'Título arriba. El celular al centro. Las cinco etiquetas alternadas a izquierda y derecha, apuntando a la parte de la pantalla que nombran.',
        texts: {
            tag: 'Tu vidriera',
            title: 'Así ve el turista tu alojamiento.',
            itemsLabel: 'Las cinco etiquetas alrededor del celular',
            items: [
                'Tus fotos, grandes',
                'Ubicación en el mapa',
                'Lugares de interés cerca',
                'El clima del destino',
                'Tu reputación en otros sitios'
            ],
            cta: 'Publicá el tuyo en hospeda.com.ar'
        }
    },
    {
        id: 'A3',
        slug: 'importa-tu-ficha',
        name: 'Importá tu ficha',
        para: 'Quien ya publica en otra plataforma',
        tipo: 'Placa',
        formats: ['4:5', '9:16'],
        sc: '/HEADLINEAD + /SPLITLAYOUT',
        audience: 'dueños de alojamientos que ya publican en otras plataformas',
        badge: true,
        hospedin: true,
        img: 'Hospedín pegando un link en un celular gigante. Del celular sale una ficha que se arma sola: fotos, textos y datos que vuelan y se acomodan en su lugar, con destellos chicos.',
        comp: 'Título arriba. Hospedín y el celular al centro. Tres tarjetas chicas abajo con los beneficios.',
        texts: {
            tag: 'Sin cargar todo de nuevo',
            title: '¿Ya publicás en otro lado? Traé tu ficha.',
            subtitle: 'Pegás el link y la IA la completa por vos.',
            items: [
                'Fotos, textos y datos en minutos',
                'Después corregís lo que quieras',
                'Desde Google, Mercado Libre y otras plataformas'
            ],
            cta: 'Probalo en hospeda.com.ar'
        },
        notes: [
            {
                label: 'Regla',
                text: 'en esta pieza no se nombran Airbnb ni Booking; se dice «Google, Mercado Libre y otras plataformas».'
            }
        ]
    },
    {
        id: 'A4',
        slug: 'calendario-sin-reservas-dobles',
        name: 'Calendario sin reservas dobles',
        para: 'Cabañas, complejos y hoteles que publican en varias plataformas',
        tipo: 'Infografía',
        formats: ['4:5', '9:16'],
        sc: '/SPLITLAYOUT + /FEATURECALLOUTS',
        audience: 'dueños de cabañas, complejos y hoteles que publican en varias plataformas',
        badge: true,
        img: 'Infografía: tres calendarios chicos a la izquierda, con etiquetas "Airbnb", "Booking" y "Google Calendar" escritas en texto simple (sin logos de esas marcas). Flechas que convergen en un calendario grande de Hospeda a la derecha, con algunos días marcados como ocupados en #3AA7D9.',
        comp: 'Título arriba. La infografía al centro, de izquierda a derecha. Debajo, dos beneficios en tarjetas.',
        texts: {
            tag: 'Un solo calendario',
            title: 'Chau reservas dobles.',
            subtitle: 'Se conecta con Airbnb, Booking y Google Calendar.',
            items: ['Las fechas ocupadas se bloquean solas', 'Desde el plan Profesional'],
            cta: 'Conectalo en hospeda.com.ar'
        },
        notes: [
            {
                label: 'Regla',
                text: 'solo en las piezas de calendario se nombran Airbnb, Booking y Google, y siempre como texto, nunca con su logo.'
            }
        ]
    },
    {
        id: 'A5',
        slug: 'tu-reputacion-junta',
        name: 'Tu reputación, junta',
        para: 'Quien ya tiene reseñas en otros sitios',
        tipo: 'Placa',
        formats: ['4:5', '9:16'],
        sc: '/HEADLINEAD + /FEATURECALLOUTS',
        audience: 'dueños de alojamientos que ya tienen reseñas en otras plataformas',
        badge: true,
        capture:
            'el bloque de reputación externa de una ficha real, con los puntajes de Google, Booking y Airbnb',
        img: 'Un celular con la captura, rodeado de tres estrellas grandes en #F5A623 que flotan con suavidad.',
        comp: 'Título arriba. El celular al centro. Dos beneficios abajo.',
        texts: {
            tag: 'No arrancás de cero',
            title: 'Tus reseñas de Google, Booking y Airbnb, en tu ficha.',
            items: ['Cargás los links una vez', 'Los puntajes se actualizan solos'],
            cta: 'Sumalas en hospeda.com.ar'
        }
    },
    {
        id: 'A6',
        slug: 'en-tres-idiomas',
        name: 'En tres idiomas',
        para: 'Hoteles y alojamientos con turismo extranjero',
        tipo: 'Placa',
        formats: ['4:5', '9:16'],
        sc: '/HEADLINEAD + /GOLDENHOUR',
        audience: 'dueños de alojamientos que reciben turistas brasileños y extranjeros',
        badge: true,
        hospedin: true,
        img: 'Hospedín con tres globos de diálogo que dicen "Hola", "Hello" y "Olá", sobre una costanera del río al atardecer, desenfocada.',
        comp: 'Título arriba. Hospedín y los globos al centro. Dos beneficios abajo.',
        texts: {
            tag: 'Para el turista de afuera',
            title: 'Tu ficha en español, inglés y portugués.',
            subtitle: 'Se traduce sola, con inteligencia artificial.',
            items: ['El brasileño te lee en su idioma', 'Vos escribís una sola vez'],
            cta: 'Publicá en hospeda.com.ar'
        }
    },
    {
        id: 'A7',
        slug: 'que-plan-te-conviene',
        name: 'Qué plan te conviene',
        para: 'Quien pregunta qué plan elegir',
        tipo: 'Infografía (árbol de decisión)',
        formats: ['4:5', '9:16'],
        sc: '/FEATURECALLOUTS + /MINIMALPOSTER',
        audience: AUD,
        badge: true,
        img: 'Árbol de decisión simple: una pregunta arriba y tres caminos que bajan, cada uno a una tarjeta de plan. Líneas redondeadas #2493B6. Sin precios.',
        comp: 'Título arriba. La pregunta al centro. Las tres tarjetas de plan abajo, una al lado de la otra (en 9:16, una debajo de la otra).',
        texts: {
            tag: 'Elegí sin vueltas',
            title: '¿Qué plan te conviene?',
            extra: [
                '- Pregunta del árbol: "¿Qué necesitás?"',
                '- Tarjeta 1: "Básico" · "Tenés un lugar y querés estar"',
                '- Tarjeta 2: "Profesional" · "Calendario sincronizado y aparecer destacado"',
                '- Tarjeta 3: "Premium" · "Complejos y hoteles: estadísticas avanzadas y el máximo de fotos"',
                '- Nota chica abajo: "Los 30 días de prueba son con las funciones del Profesional."'
            ],
            cta: 'Te ayudamos a elegir'
        },
        notes: [
            {
                label: 'Verificar antes',
                text: 'contra la tabla de planes de /presentacion/alojamientos: si cambia qué trae cada plan, cambian las tarjetas.'
            }
        ]
    },
    {
        id: 'A8',
        slug: 'complementos',
        name: 'Complementos',
        para: 'Clientes que ya tienen plan y quieren más',
        tipo: 'Listado',
        formats: ['4:5', '9:16'],
        sc: '/FEATURECALLOUTS + /COLLECTIONAD',
        audience: 'dueños de alojamientos que ya publican en Hospeda',
        badge: false,
        img: 'Tres tarjetas tipo "pieza que se encastra", como bloques que se suman a una base. Íconos: estrella, cámara de fotos y casa con un signo más.',
        comp: 'Título arriba. Las tres tarjetas en columna, cada una con su ícono, nombre y una línea. Abajo, una frase chica.',
        texts: {
            tag: 'Para crecer sin cambiar de plan',
            title: 'Sumá lo que necesitás, cuando lo necesitás.',
            items: [
                'Destacar tu alojamiento 7 o 30 días',
                '20 fotos más por alojamiento',
                '5 alojamientos más'
            ],
            body: 'Se agregan desde tu cuenta, en un minuto.',
            cta: 'Mirá los complementos en hospeda.com.ar'
        }
    },
    {
        id: 'A9',
        slug: 'presentacion-para-hoteles',
        name: 'Presentación para hoteles y complejos',
        para: 'Hoteles, apart hoteles y complejos grandes',
        tipo: 'PDF (7 páginas)',
        formats: ['2:3'],
        sc: '/MINIMALPOSTER + /FEATURECALLOUTS + /GOLDENHOUR',
        audience: 'dueños y gerentes de hoteles y complejos del Litoral',
        badge: true,
        system: [
            'Fondo blanco con una banda superior de 180 px en #EEF8FF donde va el logo.',
            'Título de página en Geologica ExtraBold #0D2B3E, a la izquierda, debajo de la banda.',
            'Bloques en tarjetas blancas con borde de 2 px #DFECF8 y esquinas de 24 px.',
            'Íconos de línea estilo Phosphor de 56 px en #2493B6, dentro de círculos #DFECF8.',
            'Barra de contacto #0D2B3E abajo con el sitio, el WhatsApp y el número de página.',
            'Tono sobrio y profesional: menos ilustración, más aire y datos.'
        ],
        pages: [
            {
                name: 'Portada',
                photo: 'el frente o el lobby de un hotel de la región, con permiso del dueño',
                comp: 'Foto a sangre en la mitad superior. Abajo, en blanco, el título y el subtítulo grandes.',
                texts: {
                    tag: 'Propuesta para hoteles',
                    title: 'Tu hotel, donde se planea el viaje al Litoral.',
                    subtitle: 'Visibilidad, herramientas y cero comisión por reserva.',
                    cta: 'Hablemos'
                }
            },
            {
                name: 'Qué es Hospeda',
                img: 'Cuatro íconos en tarjetas: cama, cubiertos, brújula y calendario.',
                comp: 'Un párrafo corto arriba y cuatro tarjetas en grilla de 2x2.',
                texts: {
                    title: 'Qué es Hospeda',
                    body: 'El portal donde el turista arma todo el viaje al Litoral: dónde dormir, comer, salir y qué hacer.',
                    items: ['Alojamientos', 'Comer y salir', 'Experiencias', 'Eventos y destinos'],
                    cta: 'hospeda.com.ar'
                }
            },
            {
                name: 'Visibilidad',
                img: 'Tres tarjetas grandes en columna con íconos de lupa, chispa de IA y globo terráqueo.',
                comp: 'Título y tres tarjetas.',
                texts: {
                    title: 'Que te encuentren',
                    items: [
                        'Escrito para que Google te encuentre',
                        'Preparado para que te recomienden las IA',
                        'Tu ficha en español, inglés y portugués'
                    ],
                    cta: 'hospeda.com.ar'
                }
            },
            {
                name: 'La ficha',
                capture: 'la ficha real de un hotel o complejo en la computadora',
                img: 'Una laptop con la captura, ocupando el centro de la página.',
                comp: 'Título arriba, la laptop al centro y tres etiquetas finas apuntando a fotos, ubicación y reputación.',
                texts: {
                    title: 'Tu ficha, completa',
                    items: [
                        'Galería de fotos',
                        'Ubicación y lugares cercanos',
                        'Reputación de otros sitios'
                    ],
                    cta: 'hospeda.com.ar'
                }
            },
            {
                name: 'Herramientas',
                img: 'Cuatro tarjetas con íconos de calendario, estrella, flecha de importación y gráfico de barras.',
                comp: 'Título y grilla de 2x2.',
                texts: {
                    title: 'Herramientas para tu equipo',
                    items: [
                        'Calendario sincronizado con Airbnb, Booking y Google',
                        'Reputación de Google, Booking y Airbnb en tu ficha',
                        'Importación de tu ficha con IA',
                        'Estadísticas de visitas y consultas'
                    ],
                    cta: 'hospeda.com.ar'
                }
            },
            {
                name: 'Planes y complementos',
                img: 'Tres columnas de plan sin precios y, debajo, una fila de tres complementos.',
                comp: 'Título, las tres columnas y la fila de complementos.',
                texts: {
                    title: 'Planes y complementos',
                    extra: [
                        '- Columna "Básico": "Para empezar"',
                        '- Columna "Profesional": "Calendario sincronizado y destacado"',
                        '- Columna "Premium": "Estadísticas avanzadas y máximo de fotos"',
                        '- Fila de complementos: "Destacar 7 o 30 días" · "20 fotos más" · "5 alojamientos más"',
                        '- Nota: "Los precios vigentes te los pasamos aparte."'
                    ],
                    cta: 'hospeda.com.ar'
                }
            },
            {
                name: 'Próximo paso',
                hospedin: true,
                img: 'Hospedín dando la mano, sobre un fondo #EEF8FF.',
                comp: 'Título grande, tres pasos numerados y Hospedín abajo a la derecha.',
                texts: {
                    title: '¿Seguimos?',
                    items: [
                        'Te armamos la ficha con vos',
                        'Probás 30 días sin tarjeta',
                        'Elegís plan recién al final'
                    ],
                    extra: ['- Firma: "[NOMBRE DEL VENDEDOR] · Asesor comercial"'],
                    cta: 'Escribinos al WhatsApp'
                }
            }
        ],
        notes: [
            {
                label: 'Antes de mandar',
                text: 'cambiá [NOMBRE DEL VENDEDOR] en la página 7. La foto de la portada tiene que ser de un hotel real, con permiso.'
            }
        ]
    },
    {
        id: 'A10',
        slug: 'beneficios-de-ser-anfitrion',
        name: 'Beneficios de ser anfitrión',
        para: 'Todos los alojamientos, para cerrar',
        tipo: 'Placa',
        formats: ['4:5', '9:16'],
        sc: '/HEADLINEAD + /lifestyle + /GOLDENHOUR',
        audience: AUD,
        badge: true,
        hospedin: true,
        img: 'Hospedín con una mochila de viaje y una credencial dorada con la palabra VIP colgada del cuello, caminando por un sendero junto al río.',
        comp: 'Título arriba. Hospedín a la derecha. Dos tarjetas de beneficio a la izquierda.',
        texts: {
            tag: 'Y además',
            title: 'Publicás tu alojamiento y viajás como VIP.',
            items: [
                'Turista VIP incluido en tu plan, sin pagar más',
                'Directorio de proveedores y oficios para tu alojamiento'
            ],
            cta: 'Sumate en hospeda.com.ar'
        }
    }
];
