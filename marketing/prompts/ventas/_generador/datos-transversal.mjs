/**
 * @file datos-transversal.mjs
 * @description Pieces of the sales kit shared by every vertical (T*).
 */

const PDF_SYSTEM = [
    'Fondo blanco con una banda superior de 180 px en #EEF8FF donde va el logo.',
    'Título de cada página en Geologica ExtraBold #0D2B3E, alineado a la izquierda, debajo de la banda.',
    'Bloques de contenido en tarjetas blancas con borde de 2 px #DFECF8 y esquinas de 24 px de radio.',
    'Íconos de línea estilo Phosphor, de 56 px, en #2493B6 dentro de círculos #DFECF8.',
    'Barra de contacto #0D2B3E abajo, con "hospeda.com.ar", el WhatsApp y el número de página.',
    'Un detalle de onda de río fino, en #3AA7D9 al 30%, arriba a la derecha de la banda.'
];

/** @type {object[]} */
export const TRANSVERSAL = [
    {
        id: 'T1',
        slug: 'que-es-hospeda',
        name: 'Qué es Hospeda',
        para: 'Todos los clientes, como primer mensaje',
        tipo: 'Placa',
        formats: ['4:5', '9:16'],
        sc: '/CAMPAIGNKEYVISUAL + /GOLDENHOUR + /FEATURECALLOUTS',
        audience:
            'dueños de alojamientos, locales gastronómicos, experiencias y marcas del Litoral',
        hospedin: true,
        img: 'Hospedín parado en una costanera del río Uruguay al atardecer, saludando con una mano, con una mochila chica. Atrás, el río ancho y calmo con árboles nativos en la orilla, levemente desenfocado.',
        comp: 'Título grande arriba a la izquierda, debajo del logo. Los cuatro ítems en una columna de tarjetas a la izquierda. Hospedín a la derecha, de cuerpo entero, ocupando la mitad derecha. Mucho aire.',
        texts: {
            tag: 'Turismo del Litoral',
            title: 'Todo el viaje, en un solo lugar.',
            subtitle: 'Dónde dormir, comer, salir y qué hacer en el Litoral.',
            items: [
                'Sin comisión por reserva',
                'El turista te contacta directo',
                'Info, clima y mapas de cada destino',
                'En español, inglés y portugués'
            ],
            cta: 'Conocé Hospeda en hospeda.com.ar'
        }
    },
    {
        id: 'T2',
        slug: 'como-funciona',
        name: 'Cómo funciona',
        para: 'Todos los clientes, después del primer contacto',
        tipo: 'Infografía',
        formats: ['4:5', '9:16'],
        sc: '/FEATURECALLOUTS + /MINIMALPOSTER',
        audience: 'dueños de alojamientos, locales y experiencias del Litoral',
        hospedin: true,
        img: 'Infografía limpia sobre fondo #EEF8FF: un camino de cinco pasos unidos por una línea punteada naranja #F5A623 que baja en zigzag suave. Cada paso es un círculo con un ícono de línea. Hospedín chico al final del camino, festejando con el puño arriba.',
        comp: 'Título arriba. Los cinco pasos en columna, numerados del 1 al 5, cada uno con su ícono a la izquierda y el texto a la derecha. Hospedín abajo a la derecha, sobre el último paso, sin tapar texto.',
        texts: {
            tag: 'Así de simple',
            title: 'De tu celular al turista, en 5 pasos.',
            itemsLabel: 'Los cinco pasos, en este orden, cada uno con su número y su ícono',
            items: [
                'Creás tu cuenta gratis',
                'Cargás tu ficha con fotos',
                'La publicás vos, cuando quieras',
                'El turista te encuentra',
                'Te contacta directo, sin intermediarios'
            ],
            cta: 'Empezá hoy en hospeda.com.ar'
        },
        badge: true
    },
    {
        id: 'T3',
        slug: 'prueba-gratis',
        name: 'La prueba gratis',
        para: 'Indecisos que preguntan cuánto cuesta',
        tipo: 'Placa',
        formats: ['4:5', '9:16'],
        sc: '/HEADLINEAD + /FEATURECALLOUTS + /softlighting',
        audience: 'dueños de negocios turísticos que todavía no se decidieron',
        hospedin: true,
        img: 'Hospedín con un celular en la mano, mostrando la pantalla hacia el frente, guiñando un ojo. Fondo liso #CCE7C3 con una onda de río suave.',
        comp: 'Título enorme arriba. Debajo, tres tarjetas en fila vertical con íconos de check. Hospedín abajo a la derecha. La insignia arriba a la derecha.',
        texts: {
            tag: 'Sin riesgo',
            title: 'Probalo gratis. Sin tarjeta.',
            subtitle: 'La prueba arranca sola cuando publicás.',
            items: [
                'No te pedimos tarjeta para empezar',
                'Te avisamos antes del primer cobro',
                'Si no te sirve, no pagás nada'
            ],
            cta: 'Publicá gratis en hospeda.com.ar'
        },
        badge: true
    },
    {
        id: 'T4',
        slug: 'sin-comision',
        name: 'Sin comisión',
        para: 'Quien ya publica en portales que cobran comisión',
        tipo: 'Infografía comparativa',
        formats: ['4:5', '9:16'],
        sc: '/COMPARISONLAYOUT + /SPLITLAYOUT',
        audience: 'dueños de alojamientos que hoy pagan comisión por reserva en otros portales',
        hospedin: false,
        img: 'Comparación en dos columnas. Izquierda, gris apagado #E5E9EC: un ícono de porcentaje y una moneda que se va, con flechas hacia afuera. Derecha, en colores de Hospeda: un ícono de casa con un corazón y una flecha que vuelve al dueño. Sin números ni montos.',
        comp: 'Título arriba, a todo el ancho. Debajo, dos columnas iguales con su encabezado: la izquierda apagada, la derecha brillante y apenas más grande. Una línea vertical fina las separa.',
        texts: {
            tag: 'Lo tuyo es tuyo',
            title: 'Cero comisión por reserva.',
            extra: [
                '- Encabezado de la columna izquierda: "Portales de comisión"',
                '- Texto de la columna izquierda: "Se quedan con un porcentaje de cada reserva."',
                '- Encabezado de la columna derecha: "Hospeda"',
                '- Texto de la columna derecha: "Una cuota fija. Lo que cobrás es tuyo, entero."'
            ],
            cta: 'Sumate en hospeda.com.ar'
        },
        badge: true,
        notes: [
            {
                label: 'Regla',
                text: 'no se nombra ningún portal ni se pone ningún porcentaje: la comparación es conceptual.'
            }
        ]
    },
    {
        id: 'T5',
        slug: 'mapa-de-cobertura',
        name: 'Mapa de cobertura',
        para: 'Todos los clientes',
        tipo: 'Imagen',
        formats: ['4:5', '9:16'],
        sc: '/MINIMALPOSTER + /COLLECTIONAD',
        audience: 'dueños de negocios turísticos de Entre Ríos',
        hospedin: false,
        img: 'Mapa ilustrado y simplificado de la provincia de Entre Ríos, en verde claro #CCE7C3, con el río Uruguay como una franja azul #3AA7D9 en el borde este. Sobre la costa del río, puntos naranjas #F5A623 todos del mismo tamaño, más puntos de los que se nombran. Estética de ilustración plana de la marca, no una captura de mapa real ni un mapa satelital.',
        comp: 'Título arriba. El mapa ocupa el centro. Al lado de siete de los puntos, su nombre en chico. Abajo del mapa, "y muchos más". Ningún punto ni nombre más grande que otro.',
        texts: {
            tag: 'Dónde estamos',
            title: 'Arrancamos por la costa del río Uruguay.',
            subtitle: 'Y vamos sumando destinos.',
            extra: [
                '- Nombres al lado de los puntos, todos del mismo tamaño: "Concepción del Uruguay", "Colón", "San José", "Gualeguaychú", "Villa Elisa", "Federación", "Concordia"',
                '- Debajo del mapa: "y muchos más"'
            ],
            cta: 'Mirá tu destino en hospeda.com.ar'
        },
        notes: [
            {
                label: 'Ojo',
                text: 'ChatGPT no ubica bien las ciudades en un mapa. Revisá que el orden de norte a sur sea Federación, Concordia, Colón, San José, Villa Elisa, Concepción del Uruguay y Gualeguaychú; si sale mal, pedile que lo corrija o pasale un mapa de base.'
            }
        ]
    },
    {
        id: 'T6',
        slug: 'hoja-de-precios',
        name: 'Hoja de precios',
        para: 'Quien ya pidió el precio',
        tipo: 'PDF (4 páginas)',
        formats: ['2:3'],
        sc: '/MINIMALPOSTER + /FEATURECALLOUTS',
        audience: 'dueños de negocios turísticos que pidieron los precios',
        system: PDF_SYSTEM,
        attach: [
            'Los precios vigentes copiados del catálogo de planes y complementos del admin, con la fecha de hoy.'
        ],
        badge: false,
        pages: [
            {
                name: 'Planes de alojamientos',
                img: 'Sin foto. Tres tarjetas de plan en columna, una por plan, cada una con su nombre, su precio mensual, su precio anual y tres líneas de lo que incluye. La del medio con un borde #3AA7D9 un poco más grueso.',
                comp: 'Título arriba. Las tres tarjetas una debajo de la otra. Abajo, una nota chica con la fecha de vigencia.',
                texts: {
                    title: 'Planes para alojamientos',
                    extra: [
                        '- Tarjeta 1: "Básico" · "[PRECIO MENSUAL] por mes" · "[PRECIO ANUAL] por año" · "Para un alojamiento"',
                        '- Tarjeta 2: "Profesional" · "[PRECIO MENSUAL] por mes" · "[PRECIO ANUAL] por año" · "Calendario sincronizado y aparecer destacado"',
                        '- Tarjeta 3: "Premium" · "[PRECIO MENSUAL] por mes" · "[PRECIO ANUAL] por año" · "Estadísticas avanzadas y el máximo de fotos"',
                        '- Nota al pie: "Pagando el año, pagás 10 meses y tenés 12. Precios vigentes desde [FECHA]."'
                    ],
                    cta: 'Consultá tus dudas al WhatsApp'
                }
            },
            {
                name: 'Planes de Comer y salir',
                img: 'Igual que la página 1: tres tarjetas de plan en columna.',
                comp: 'Igual que la página 1.',
                texts: {
                    title: 'Planes para Comer y salir',
                    extra: [
                        '- Tarjeta 1: "Para 1 local" · "[PRECIO MENSUAL] por mes" · "[PRECIO ANUAL] por año"',
                        '- Tarjeta 2: "Hasta 3 locales" · "[PRECIO MENSUAL] por mes" · "[PRECIO ANUAL] por año"',
                        '- Tarjeta 3: "Hasta 5 locales" · "[PRECIO MENSUAL] por mes" · "[PRECIO ANUAL] por año"',
                        '- Nota al pie: "Los rubros Gastronomía y Noche no cambian el precio. Precios vigentes desde [FECHA]."'
                    ],
                    cta: 'Consultá tus dudas al WhatsApp'
                }
            },
            {
                name: 'Planes de Experiencias',
                img: 'Igual que la página 1: tres tarjetas de plan en columna.',
                comp: 'Igual que la página 1.',
                texts: {
                    title: 'Planes para Experiencias',
                    extra: [
                        '- Tarjeta 1: "Básico" · "[PRECIO MENSUAL] por mes" · "[PRECIO ANUAL] por año"',
                        '- Tarjeta 2: "Profesional" · "[PRECIO MENSUAL] por mes" · "[PRECIO ANUAL] por año" · "Mapa y cómo llegar"',
                        '- Tarjeta 3: "Premium" · "[PRECIO MENSUAL] por mes" · "[PRECIO ANUAL] por año" · "Galerías de fotos por fecha"',
                        '- Nota al pie: "Precios vigentes desde [FECHA]."'
                    ],
                    cta: 'Consultá tus dudas al WhatsApp'
                }
            },
            {
                name: 'Complementos',
                img: 'Una tabla limpia de tres columnas: complemento, para qué sirve y precio. Filas separadas por líneas finas #DFECF8.',
                comp: 'Título arriba. La tabla ocupa el resto de la página.',
                texts: {
                    title: 'Complementos',
                    subtitle: 'Se suman a cualquier plan, sin cambiar de plan.',
                    extra: [
                        '- Fila: "Destacar 7 días" · "Aparecés destacado una semana" · "[PRECIO] por única vez"',
                        '- Fila: "Destacar 30 días" · "Aparecés destacado un mes" · "[PRECIO] por única vez"',
                        '- Fila: "20 fotos más (alojamientos)" · "Más fotos en cada alojamiento" · "[PRECIO] por mes"',
                        '- Fila: "5 alojamientos más" · "Más alojamientos que tu plan" · "[PRECIO] por mes"',
                        '- Fila: "1 local o experiencia más" · "Uno más que tu plan" · "[PRECIO] por mes"',
                        '- Nota al pie: "Precios vigentes desde [FECHA]."'
                    ],
                    cta: 'Sumalos desde tu cuenta o escribinos'
                }
            }
        ],
        structure:
            'Antes de generar la página 1, pedime los precios vigentes y la fecha, y esperá. Reemplazá cada [PRECIO …] y cada [FECHA] por el valor que te pase, copiado exactamente. Si te falta un valor, no lo inventes: preguntámelo.',
        notes: [
            {
                label: 'Regla',
                text: 'es la ÚNICA pieza del kit con precios. Se rehace cada vez que cambia el catálogo; los valores se copian del admin, nunca de memoria.'
            },
            {
                label: 'Verificar antes',
                text: 'que los planes y complementos de cada página sigan existiendo en el catálogo con esos nombres.'
            }
        ]
    },
    {
        id: 'T7',
        slug: 'paso-a-paso-del-alta',
        name: 'Paso a paso del alta',
        para: 'Quien ya dijo que sí y tiene que cargar',
        tipo: 'Carrusel (6 placas)',
        formats: ['4:5'],
        sc: '/CAROUSELCOVER + /CAROUSELSLIDE + /SPLITLAYOUT',
        audience: 'dueños de negocios turísticos que van a publicar por primera vez',
        badge: true,
        system: [
            'Fondo #EEF8FF con un celular grande inclinado 6° a la derecha, ocupando la mitad derecha.',
            'Número de paso enorme en Geologica ExtraBold #F5A623, arriba a la izquierda, debajo del logo.',
            'Título y cuerpo a la izquierda del celular.',
            'Barra de contacto #0D2B3E abajo.'
        ],
        slides: [
            {
                name: 'Portada',
                hospedin: true,
                img: 'Hospedín sosteniendo un celular gigante, como presentándolo.',
                comp: 'Hospedín a la derecha en lugar del celular. Título grande a la izquierda.',
                texts: {
                    tag: 'Paso a paso',
                    title: 'Publicar en Hospeda, paso a paso.',
                    subtitle: 'Desde el celular y en tus tiempos.',
                    cta: 'Si te trabás, escribinos'
                }
            },
            {
                name: 'Paso 1',
                capture: 'la pantalla de registro de hospeda.com.ar',
                img: 'El celular con la captura.',
                comp: 'Según el SISTEMA VISUAL FIJO.',
                texts: {
                    title: 'Creá tu cuenta.',
                    body: 'Con tu mail o con Google.',
                    cta: 'Si te trabás, escribinos'
                }
            },
            {
                name: 'Paso 2',
                capture:
                    'la pantalla donde se elige qué se va a publicar (alojamiento, local o experiencia)',
                img: 'El celular con la captura.',
                comp: 'Según el SISTEMA VISUAL FIJO.',
                texts: {
                    title: 'Elegí qué vas a publicar.',
                    body: 'Alojamiento, local o experiencia.',
                    cta: 'Si te trabás, escribinos'
                }
            },
            {
                name: 'Paso 3',
                capture:
                    'el formulario de la ficha con algunos datos cargados, o la opción de importar desde un link',
                img: 'El celular con la captura.',
                comp: 'Según el SISTEMA VISUAL FIJO.',
                texts: {
                    title: 'Completá tu ficha.',
                    body: 'O traela de otra plataforma pegando el link.',
                    cta: 'Si te trabás, escribinos'
                }
            },
            {
                name: 'Paso 4',
                capture:
                    'la pantalla de carga de fotos, con varias fotos subidas y una marcada como principal',
                img: 'El celular con la captura.',
                comp: 'Según el SISTEMA VISUAL FIJO.',
                texts: {
                    title: 'Subí tus fotos.',
                    body: 'Elegí la principal: es la que se ve primero.',
                    cta: 'Si te trabás, escribinos'
                }
            },
            {
                name: 'Paso 5',
                capture: 'el botón de publicar y el aviso de ficha publicada',
                img: 'El celular con la captura, con un pequeño estallido de confeti en colores de la marca.',
                comp: 'Según el SISTEMA VISUAL FIJO.',
                texts: {
                    title: 'Publicá.',
                    body: 'Ahí arranca tu prueba gratis.',
                    cta: 'Si te trabás, escribinos'
                }
            }
        ],
        notes: [
            {
                label: 'Verificar antes',
                text: 'que cada captura coincida con el alta real del día en que se grabe: si el flujo cambió, cambiá el texto del paso.'
            }
        ]
    },
    {
        id: 'T8',
        slug: 'preguntas-frecuentes',
        name: 'Preguntas frecuentes',
        para: 'Todos los clientes, para despejar dudas',
        tipo: 'PDF (2 páginas)',
        formats: ['2:3'],
        sc: '/MINIMALPOSTER + /FEATURECALLOUTS',
        audience: 'dueños de negocios turísticos que tienen dudas antes de publicar',
        system: PDF_SYSTEM,
        badge: false,
        pages: [
            {
                name: 'Preguntas 1 a 4',
                hospedin: true,
                img: 'Cuatro tarjetas de pregunta y respuesta en columna. Hospedín chico, con cara pensativa y una mano en el mentón, arriba a la derecha junto al título.',
                comp: 'Título arriba. Cada tarjeta con la pregunta en Geologica SemiBold y la respuesta en Roboto debajo.',
                texts: {
                    title: 'Lo que siempre nos preguntan',
                    extra: [
                        '- Pregunta: "¿Cobran comisión por reserva?" Respuesta: "No. Pagás una cuota fija y lo que cobrás es tuyo, entero."',
                        '- Pregunta: "¿Necesito tarjeta para probar?" Respuesta: "No. La prueba arranca sola cuando publicás y te avisamos antes del primer cobro."',
                        '- Pregunta: "¿Cómo se paga?" Respuesta: "Con Mercado Pago, con tarjeta o con dinero en cuenta. Por mes o por año."',
                        '- Pregunta: "¿Hospeda me cobra las reservas?" Respuesta: "No. El turista te encuentra y te contacta directo: el precio y el pago los arreglás vos."'
                    ],
                    cta: '¿Otra duda? Escribinos'
                }
            },
            {
                name: 'Preguntas 5 a 8',
                img: 'Igual que la página 1, sin Hospedín.',
                comp: 'Igual que la página 1.',
                texts: {
                    title: 'Lo que siempre nos preguntan',
                    extra: [
                        '- Pregunta: "¿Tengo que saber de computación?" Respuesta: "No. Se hace desde el celular y, si te trabás, te ayudamos."',
                        '- Pregunta: "¿Puedo dar de baja cuando quiera?" Respuesta: "Sí. Cambiás de plan, pausás o cancelás vos mismo, desde tu cuenta."',
                        '- Pregunta: "¿Qué pasa si dejo de pagar?" Respuesta: "Tu ficha deja de verse, pero no se borra. Vuelve como estaba cuando reactivás."',
                        '- Pregunta: "¿Dónde están?" Respuesta: "Arrancamos por la costa del río Uruguay, en Entre Ríos, y vamos sumando destinos."'
                    ],
                    cta: '¿Otra duda? Escribinos'
                }
            }
        ]
    },
    {
        id: 'T11',
        slug: 'tarjeta-con-qr',
        name: 'Tarjeta con QR',
        para: 'Visitas en persona',
        tipo: 'Tarjeta imprimible (frente y dorso)',
        formats: ['3:2'],
        sc: '/MINIMALPOSTER + /BRANDPALETTE',
        audience: 'dueños de negocios que el vendedor visita en persona',
        badge: false,
        system: [
            'Tarjeta horizontal 3:2, esquinas rectas (se recorta en la imprenta), con 80 px de margen de seguridad.',
            'Sin barra de contacto: el contacto va dentro de la tarjeta.',
            'Un detalle de onda de río fino en #3AA7D9 al 30% en el borde inferior.'
        ],
        slides: [
            {
                name: 'Frente',
                img: 'Fondo #0D2B3E liso con la onda de río en el borde inferior.',
                comp: 'El logo grande y centrado, en su versión blanca. Debajo, el lema. Nada más.',
                texts: { title: 'Todo tu viaje, en un solo lugar.' }
            },
            {
                name: 'Dorso',
                img: 'Fondo blanco. A la derecha, un cuadrado blanco de 520 px con borde punteado gris y la palabra QR en el centro, para pegar el código real después.',
                comp: 'A la izquierda, de arriba hacia abajo: el logo chico, el nombre del vendedor, su rol, el WhatsApp y el sitio. A la derecha, el cuadrado del QR.',
                texts: {
                    extra: [
                        '- Nombre: "[NOMBRE DEL VENDEDOR]"',
                        '- Rol: "Asesor comercial"',
                        `- WhatsApp: "3442 47-0650"`,
                        '- Sitio: "hospeda.com.ar"',
                        '- Debajo del QR, chico: "Escaneá y conocé Hospeda"'
                    ]
                }
            }
        ],
        measures:
            'Formato 3:2: lienzo de 1620x1080 px. Márgenes de seguridad de 80 px en los cuatro lados.',
        notes: [
            {
                label: 'Ojo',
                text: 'ChatGPT no genera un QR que funcione: el cuadrado queda vacío a propósito y el QR real se pega después. Antes de imprimir, cambiá [NOMBRE DEL VENDEDOR].'
            }
        ]
    }
];
