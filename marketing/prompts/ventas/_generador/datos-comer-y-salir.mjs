/**
 * @file datos-comer-y-salir.mjs
 * @description Sales pieces for the «Comer y salir» vertical (C*). Facts follow
 * /presentacion/comer-y-salir: three plans by number of venues (1, 3 or 5),
 * rubros Gastronomía and Noche at no extra cost, the «De noche» section.
 * Copy says «tu local»; «restaurante», «platos» and «menú» only on the kitchen side.
 */

const AUD = 'dueños de locales para comer y salir del Litoral';

export const COMER_Y_SALIR = [
    {
        id: 'C1',
        slug: 'que-el-turista-te-encuentre',
        name: 'Que el turista te encuentre',
        para: 'Todos los locales, como primer mensaje',
        tipo: 'Placa',
        formats: ['4:5', '9:16'],
        sc: '/HEADLINEAD + /GOLDENHOUR + /bokeh',
        audience: AUD,
        badge: true,
        hospedin: true,
        img: 'Hospedín en una vereda del Litoral al atardecer, mirando un celular con un mapa, frente a la puerta de un local con mesas afuera y luces cálidas encendidas, desenfocadas.',
        comp: 'Título arriba a la izquierda. Hospedín a la derecha. Tres beneficios en tarjetas a la izquierda.',
        texts: {
            tag: 'Comer y salir',
            title: 'Tu local, donde se planea el viaje.',
            items: [
                'Tus fotos, horarios y cómo encontrarte',
                'Sin comisión: una cuota fija',
                'Lo cargás y lo cambiás vos'
            ],
            cta: 'Publicá tu local en hospeda.com.ar'
        }
    },
    {
        id: 'C2',
        slug: 'tu-local-asi-se-ve',
        name: 'Tu local, así se ve',
        para: 'Todos los locales',
        tipo: 'Placa con captura anotada',
        formats: ['4:5', '9:16'],
        sc: '/FEATURECALLOUTS + /SPLITLAYOUT',
        audience: AUD,
        badge: true,
        capture:
            'la ficha real de un local de la sección «Comer y salir» de hospeda.com.ar en el celular, con fotos, horarios, mapa, redes, la carta y los rubros',
        img: 'Un celular grande y recto al centro con la captura. De sus costados salen seis etiquetas unidas a la pantalla por líneas finas.',
        comp: 'Título arriba. El celular al centro. Las etiquetas alternadas a los costados, apuntando a lo que nombran.',
        texts: {
            tag: 'Tu vidriera',
            title: 'Así ve el turista tu local.',
            itemsLabel: 'Las seis etiquetas alrededor del celular',
            items: [
                'Fotos del local',
                'Horarios de cada día',
                'Cómo llegar en el mapa',
                'Tus redes',
                'La carta, si tenés cocina',
                'Tus rubros: comer, salir o los dos'
            ],
            cta: 'Publicá el tuyo en hospeda.com.ar'
        }
    },
    {
        id: 'C3',
        slug: 'kit-para-locales-chicos',
        name: 'Para locales chicos',
        para: 'Carritos, rotiserías, cafés, heladerías',
        tipo: 'Placa',
        formats: ['4:5', '9:16'],
        sc: '/HEADLINEAD + /lifestyle + /softlighting',
        audience: 'dueños de carritos, rotiserías, cafés y heladerías del Litoral',
        badge: true,
        hospedin: true,
        img: 'Hospedín frente a un carrito de comida callejero con luces de guirnalda, sosteniendo un cucurucho de helado y un celular. Escena cálida de noche de verano junto a una costanera.',
        comp: 'Título grande arriba. Hospedín y el carrito a la derecha. Tres beneficios a la izquierda.',
        texts: {
            tag: 'Chico o grande',
            title: 'Tu local también tiene que aparecer.',
            items: [
                'Se carga desde el celular',
                'Delivery, take away y lo que ofrecés, tildado',
                'Vos lo cambiás cuando quieras'
            ],
            cta: 'Sumalo en hospeda.com.ar'
        }
    },
    {
        id: 'C4',
        slug: 'presentacion-para-restaurantes-y-resto-bars',
        name: 'Presentación para restaurantes y resto bars',
        para: 'Restaurantes, parrillas, resto bars y cervecerías grandes',
        tipo: 'PDF (4 páginas)',
        formats: ['2:3'],
        sc: '/MINIMALPOSTER + /FEATURECALLOUTS + /bokeh',
        audience: 'dueños de restaurantes, parrillas, resto bars y cervecerías del Litoral',
        badge: true,
        system: [
            'Fondo blanco con una banda superior de 180 px en #FED9AB suave donde va el logo.',
            'Título de página en Geologica ExtraBold #0D2B3E, a la izquierda, debajo de la banda.',
            'Bloques en tarjetas blancas con borde de 2 px #DFECF8 y esquinas de 24 px.',
            'Íconos de línea estilo Phosphor de 56 px en #FC8102, dentro de círculos #FED9AB.',
            'Barra de contacto #0D2B3E abajo con el sitio, el WhatsApp y el número de página.'
        ],
        pages: [
            {
                name: 'Portada',
                photo: 'el salón o la vereda de un local real de la región, de noche, con permiso del dueño',
                comp: 'Foto a sangre en la mitad superior. Abajo, título y subtítulo grandes.',
                texts: {
                    tag: 'Comer y salir',
                    title: 'Tu local, donde el turista decide adónde ir.',
                    subtitle: 'Sin comisión, sin pedidos, sin intermediarios.',
                    cta: 'Hablemos'
                }
            },
            {
                name: 'Tu página',
                capture:
                    'la ficha real de un resto bar en la computadora, con la carta y la agenda',
                img: 'Una laptop con la captura al centro.',
                comp: 'Título, la laptop y cuatro etiquetas finas.',
                texts: {
                    title: 'Tu página, completa',
                    items: [
                        'La carta y el menú del día',
                        'Los aptos: sin TACC, vegano, vegetariano',
                        'La agenda: música en vivo, happy hour, shows',
                        'Tu ficha en PDF con QR, para imprimir'
                    ],
                    cta: 'hospeda.com.ar'
                }
            },
            {
                name: 'Rubros y noche',
                img: 'Dos tarjetas grandes lado a lado: una con un ícono de cubiertos (Gastronomía) y otra con una luna y una nota musical (Noche), unidas por un signo más.',
                comp: 'Título, las dos tarjetas y tres líneas abajo.',
                texts: {
                    title: 'Para comer, para salir o las dos',
                    items: [
                        'Los rubros no cambian el precio',
                        'De noche: entrada, edad mínima y dress code a la vista',
                        'La carta también en inglés y portugués'
                    ],
                    cta: 'hospeda.com.ar'
                }
            },
            {
                name: 'Planes y próximo paso',
                hospedin: true,
                img: 'Tres tarjetas de plan sin precios y Hospedín chico abajo a la derecha, brindando con un vaso.',
                comp: 'Título, tres tarjetas y la firma.',
                texts: {
                    title: 'Tres planes, según cuántos locales tengas',
                    extra: [
                        '- Tarjeta 1: "1 local"',
                        '- Tarjeta 2: "Hasta 3 locales"',
                        '- Tarjeta 3: "Hasta 5 locales"',
                        '- Nota: "Pagando el año, pagás 10 meses y tenés 12. Los precios te los pasamos aparte."',
                        '- Firma: "[NOMBRE DEL VENDEDOR] · Asesor comercial"'
                    ],
                    cta: 'Escribinos al WhatsApp'
                }
            }
        ],
        notes: [
            {
                label: 'Antes de mandar',
                text: 'cambiá [NOMBRE DEL VENDEDOR]. La foto de portada tiene que ser de un local real, con permiso.'
            }
        ]
    },
    {
        id: 'C5',
        slug: 'de-noche',
        name: 'De noche',
        para: 'Pubs, boliches y resto bars que abren de noche',
        tipo: 'Carrusel (4 placas)',
        formats: ['4:5'],
        sc: '/CAROUSELCOVER + /CAROUSELSLIDE + /neon + /bokeh',
        audience: 'dueños de pubs, boliches y bares nocturnos del Litoral',
        badge: true,
        system: [
            'Fondo #0D2B3E de noche, con luces de colores de la marca desenfocadas (bokeh).',
            'Títulos en blanco; detalles en #F5A623.',
            'Barra de contacto #0D2B3E abajo, separada del fondo por una línea fina #3AA7D9.'
        ],
        slides: [
            {
                name: 'Portada',
                hospedin: true,
                img: 'Hospedín en la puerta de un bar con luces cálidas, de noche, con una pulsera de entrada.',
                comp: 'Título grande a la izquierda, Hospedín a la derecha.',
                texts: {
                    tag: 'De noche',
                    title: 'Lo que todos preguntan antes de salir.',
                    cta: 'Sumá tu local en hospeda.com.ar'
                }
            },
            {
                name: 'La entrada',
                img: 'Un ícono grande de ticket en línea #F5A623.',
                comp: 'Ícono arriba, título y cuerpo debajo.',
                texts: {
                    title: '¿Cuánto sale entrar?',
                    body: 'Gratis, paga o «depende», con tu nota.',
                    cta: 'Sumá tu local en hospeda.com.ar'
                }
            },
            {
                name: 'La edad',
                img: 'Una insignia grande "+18" en línea #F5A623.',
                comp: 'Ícono arriba, título y cuerpo debajo.',
                texts: {
                    title: '¿Desde qué edad?',
                    body: 'Bien visible en tu ficha.',
                    cta: 'Sumá tu local en hospeda.com.ar'
                }
            },
            {
                name: 'El dress code',
                img: 'Un ícono grande de camisa en línea #F5A623.',
                comp: 'Ícono arriba, título y cuerpo debajo.',
                texts: {
                    title: '¿Cómo hay que ir?',
                    body: 'Respondido antes de que te escriban.',
                    cta: 'Sumá tu local en hospeda.com.ar'
                }
            }
        ],
        notes: [
            {
                label: 'Verificar antes',
                text: 'que la sección «De noche» esté en producción. Si todavía no está, esta pieza no se manda.'
            }
        ]
    },
    {
        id: 'C6',
        slug: 'planes-y-complementos',
        name: 'Planes y complementos',
        para: 'Quien pregunta qué plan elegir',
        tipo: 'Infografía',
        formats: ['4:5', '9:16'],
        sc: '/FEATURECALLOUTS + /MINIMALPOSTER',
        audience: AUD,
        badge: true,
        img: 'Tres tarjetas de plan con íconos de una, tres y cinco tiendas. Debajo, una fila de dos complementos como piezas que se encastran. Sin precios.',
        comp: 'Título arriba, las tres tarjetas al centro y los complementos abajo.',
        texts: {
            tag: 'Elegí sin vueltas',
            title: 'Tres planes, según cuántos locales tengas.',
            extra: [
                '- Tarjeta 1: "1 local"',
                '- Tarjeta 2: "Hasta 3 locales"',
                '- Tarjeta 3: "Hasta 5 locales"',
                '- Encabezado de los complementos: "Y si necesitás más:"',
                '- Complemento 1: "Destacar tu local 7 o 30 días"',
                '- Complemento 2: "1 local más"'
            ],
            cta: 'Te ayudamos a elegir'
        }
    },
    {
        id: 'C7',
        slug: 'lo-que-se-viene',
        name: 'Lo que se viene',
        para: 'Clientes que ya publican o que dudan',
        tipo: 'Listado',
        formats: ['4:5', '9:16'],
        sc: '/FEATURECALLOUTS + /PRODUCTLAUNCH',
        audience: 'dueños de locales para comer y salir',
        badge: false,
        hospedin: true,
        img: 'Hospedín espiando por un telescopio chico hacia el horizonte del río. Fondo claro #EEF8FF.',
        comp: 'Título arriba con la palabra «Próximamente» como tag. Cuatro ítems en tarjetas. Hospedín abajo a la derecha.',
        texts: {
            tag: 'Próximamente',
            title: 'Lo que se viene para tu local.',
            items: [
                'Cuántos te contactaron',
                'Recomendado en el camino',
                'Destacar tu evento en la agenda',
                'Sesión de fotos profesional'
            ],
            cta: 'Seguinos en hospeda.com.ar'
        },
        notes: [
            {
                label: 'Regla',
                text: 'todo lo de esta pieza todavía no existe: va siempre con «Próximamente» y nunca se vende como si funcionara.'
            }
        ]
    }
];
