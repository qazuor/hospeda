/**
 * @file listing-topics.ts
 * @description Help topics about an owner's listings: photos, creating,
 * publishing, pausing, deleting, services, fix requests and reviews (HOS-2333).
 *
 * Every step was checked against the web pages and components on 2026-11-17.
 * The button and section names are the ones the portal shows. Nothing here names
 * a price or a plan: those live in the plan catalog, and the topics point to
 * the plans page instead.
 */

import type { OwnerHelpTopic } from '../owner-help.types';

/** Label of the accommodation list page, as the portal titles it. */
const ACCOMMODATION_LIST_LABEL = 'Mis propiedades';

/** Label of the venue and experience list page, as the portal titles it. */
const VENUE_AND_EXPERIENCE_LIST_LABEL = 'Mi comercio';

/** Topics about listings. */
export const LISTING_HELP_TOPICS: readonly OwnerHelpTopic[] = [
    {
        id: 'photos',
        audience: 'any',
        title: 'Subir o cambiar las fotos de una publicación',
        keywords: [
            'foto',
            'fotos',
            'imagen',
            'imagenes',
            'subir foto',
            'subo',
            'portada',
            'imagen principal',
            'galeria'
        ],
        steps: [
            `Abrí el editor de la publicación: desde «${ACCOMMODATION_LIST_LABEL}» (alojamientos) o «${VENUE_AND_EXPERIENCE_LIST_LABEL}» (comercios y experiencias), tocá «Editar» en su tarjeta.`,
            'Entrá a la sección «Fotos».',
            'Cargá la imagen principal: arrastrá una imagen o hacé clic para elegirla. Es obligatoria para poder publicar.',
            'Sumá más fotos a la galería. Cada archivo puede ser JPG, PNG, WebP o HEIC y pesar hasta 10 MB.',
            'El editor te avisa cuántas fotos entran en la galería. En alojamientos ese tope depende de tu plan.',
            'No hace falta guardar: cada foto que agregás, quitás o cambiás se guarda al instante.',
            'En alojamientos también podés reordenar la galería y elegir cuál es la portada.'
        ],
        destinations: [
            {
                kind: 'ownEditorSection',
                vertical: 'accommodation',
                section: 'photos',
                label: 'Fotos'
            },
            { kind: 'ownEditorSection', vertical: 'venue', section: 'media', label: 'Fotos' },
            { kind: 'ownEditorSection', vertical: 'experience', section: 'media', label: 'Fotos' }
        ],
        reviewedAt: '2026-11-17'
    },
    {
        id: 'create-listing',
        audience: 'any',
        title: 'Crear una publicación nueva',
        keywords: [
            'crear publicacion',
            'crear alojamiento',
            'nueva publicacion',
            'publicar',
            'dar de alta',
            'agregar alojamiento',
            'agregar comercio',
            'agregar experiencia',
            'empezar a publicar',
            'borrador'
        ],
        steps: [
            'Entrá a la página de publicar del rubro que querés: alojamiento, comer y salir o experiencias.',
            'Completá el formulario de alta con los datos básicos. Si ya tenés un borrador, el sitio te ofrece retomarlo antes de crear otro.',
            'La publicación se crea como borrador: todavía no se ve en el sitio.',
            `Abrila desde «${ACCOMMODATION_LIST_LABEL}» o «${VENUE_AND_EXPERIENCE_LIST_LABEL}» con «Editar» y completá sus secciones. El editor marca lo que falta.`,
            'Cuando cumpla los requisitos, tocá «Publicar» en su tarjeta.'
        ],
        destinations: [
            { kind: 'createListing', vertical: 'accommodation', label: 'Publicar un alojamiento' },
            { kind: 'createListing', vertical: 'venue', label: 'Publicar un comercio' },
            { kind: 'createListing', vertical: 'experience', label: 'Publicar una experiencia' }
        ],
        faqKey: 'owners.ready',
        reviewedAt: '2026-11-17'
    },
    {
        id: 'publish-requirements',
        audience: 'any',
        title: 'Qué hace falta para publicar y por qué no me deja',
        keywords: [
            'requisitos',
            'no puedo publicar',
            'no me deja publicar',
            'faltan datos',
            'falta completar',
            'publicar',
            'incompleta',
            'incompleto',
            'excepcion',
            'misma direccion'
        ],
        steps: [
            'Alojamientos: hace falta la descripción, la cantidad de huéspedes, las noches mínimas, las habitaciones, los baños y la foto principal.',
            'Comercios y experiencias: nombre, resumen (mínimo 10 caracteres), descripción (mínimo 20), ciudad o destino, categoría, foto principal y un canal de contacto. En comercios cuenta cualquier teléfono, WhatsApp o email; en experiencias solo el teléfono de trabajo, el celular o el email de trabajo (el WhatsApp no cuenta).',
            'Los comercios además necesitan horarios (al menos un día con un turno) y un rango de precios. Las experiencias, un precio «desde» mayor a cero o marcar «Precio a consultar».',
            'Lo que falta se ve en el editor, que marca cada sección, y en la tarjeta de la publicación. Si publicás con datos faltantes, el sitio te lista cuáles y el botón «Completar en el editor» te lleva a arreglarlos.',
            'Publicar también requiere un plan activo. Si te corresponde la prueba gratis, arranca al publicar; si no, el botón te lleva a elegir un plan.',
            'Una dirección por publicación (alojamientos y comercios): si ya tenés otra publicada en la misma dirección, el sitio no te deja publicar. Podés pedir una excepción desde la sección «Ubicación» del editor o desde el botón de publicar; el pedido lo revisa Hospeda y te responde por email.',
            'Cuando esté lista, tocá «Publicar» en la tarjeta y confirmá.'
        ],
        destinations: [
            { kind: 'ownerListings', vertical: 'accommodation', label: ACCOMMODATION_LIST_LABEL },
            { kind: 'ownerListings', vertical: 'venue', label: VENUE_AND_EXPERIENCE_LIST_LABEL },
            {
                kind: 'ownEditorSection',
                vertical: 'accommodation',
                section: 'location',
                label: 'Ubicación'
            },
            {
                kind: 'ownEditorSection',
                vertical: 'venue',
                section: 'location',
                label: 'Ubicación'
            },
            { kind: 'plans', vertical: 'accommodation', label: 'Planes para alojamientos' },
            { kind: 'plans', vertical: 'venue', label: 'Planes para comercios' },
            { kind: 'plans', vertical: 'experience', label: 'Planes para experiencias' }
        ],
        reviewedAt: '2026-11-17'
    },
    {
        id: 'pause-resume',
        audience: 'any',
        title: 'Pausar y volver a publicar una publicación',
        keywords: [
            'pausar',
            'pausa',
            'despublicar',
            'sacar del sitio',
            'ocultar',
            'reanudar',
            'volver a publicar',
            'publicar de nuevo',
            'pausar por temporada'
        ],
        steps: [
            `Entrá a «${ACCOMMODATION_LIST_LABEL}» y buscá la tarjeta de la propiedad publicada.`,
            'Tocá «Despublicar» y confirmá: la propiedad deja de aparecer en el sitio.',
            'Despublicar no frena la prueba gratis si la tenés en curso, y los destaques recurrentes se siguen cobrando hasta que los des de baja en «Complementos».',
            'Para volver a publicarla, tocá «Publicar» en la misma tarjeta (queda como borrador) y confirmá. Tiene que cumplir los requisitos de publicación.',
            'Si el sitio la despublicó por tu plan, la tarjeta dice «Sin publicar por tu plan» y el botón es «Publicar de nuevo»; puede llevarte a elegir un plan.',
            'En comercios y experiencias el portal no tiene botón de pausa: podés pedirle a este asistente que pause o reanude la publicación.'
        ],
        destinations: [
            { kind: 'ownerListings', vertical: 'accommodation', label: ACCOMMODATION_LIST_LABEL },
            { kind: 'ownerListings', vertical: 'venue', label: VENUE_AND_EXPERIENCE_LIST_LABEL },
            {
                kind: 'ownerListings',
                vertical: 'experience',
                label: VENUE_AND_EXPERIENCE_LIST_LABEL
            },
            { kind: 'addons', label: 'Complementos' }
        ],
        faqKey: 'owners.pause',
        reviewedAt: '2026-11-17'
    },
    {
        id: 'delete-listing',
        audience: 'any',
        title: 'Eliminar una publicación',
        keywords: [
            'eliminar',
            'borrar',
            'dar de baja una publicacion',
            'quitar publicacion',
            'eliminar propiedad',
            'eliminar alojamiento'
        ],
        steps: [
            `Entrá a «${ACCOMMODATION_LIST_LABEL}» y buscá la tarjeta de la propiedad.`,
            'Tocá «Eliminar». El sitio te pide confirmar y, si la publicación tiene complementos, te muestra cuáles se pierden con ella, sin devolución.',
            'Confirmá con «Sí, eliminar». El borrado es definitivo: el contenido se borra y la publicación no vuelve.',
            'Si lo que querés es sacarla del sitio por un tiempo, es mejor despublicarla (mirá «Pausar y volver a publicar»).',
            'En comercios y experiencias el portal no ofrece el botón «Eliminar»: contactanos y lo vemos.'
        ],
        destinations: [
            { kind: 'ownerListings', vertical: 'accommodation', label: ACCOMMODATION_LIST_LABEL },
            { kind: 'ownerListings', vertical: 'venue', label: VENUE_AND_EXPERIENCE_LIST_LABEL },
            {
                kind: 'ownerListings',
                vertical: 'experience',
                label: VENUE_AND_EXPERIENCE_LIST_LABEL
            },
            { kind: 'contact' }
        ],
        reviewedAt: '2026-11-17'
    },
    {
        id: 'amenities',
        audience: 'any',
        title: 'Editar los servicios y comodidades',
        keywords: [
            'servicios y comodidades',
            'comodidades',
            'comodidad',
            'amenities',
            'wifi',
            'pileta',
            'caracteristicas',
            'agregar servicio',
            'quitar servicio'
        ],
        steps: [
            'Abrí el editor de la publicación con «Editar» en su tarjeta.',
            'Entrá a «Servicios y comodidades» (en comercios y experiencias, «Servicios»).',
            'Tildá los que ofrecés y destildá los que no. En alojamientos el catálogo está agrupado por categorías.',
            'En alojamientos podés abrir el detalle de cada comodidad para indicar si es de uso privado o compartido y si está disponible todo el año.',
            'Tocá «Guardar».',
            'También podés pedirle a este asistente que agregue o quite servicios de una categoría.'
        ],
        destinations: [
            {
                kind: 'ownEditorSection',
                vertical: 'accommodation',
                section: 'amenities',
                label: 'Servicios y comodidades'
            },
            {
                kind: 'ownEditorSection',
                vertical: 'venue',
                section: 'amenities',
                label: 'Servicios'
            },
            {
                kind: 'ownEditorSection',
                vertical: 'experience',
                section: 'amenities',
                label: 'Servicios'
            }
        ],
        reviewedAt: '2026-11-17'
    },
    {
        id: 'fix-request',
        audience: 'any',
        title: 'Me pidieron un arreglo o moderaron mi publicación',
        keywords: [
            'arreglo',
            'pedido de arreglo',
            'corregir',
            'ya lo corregi',
            'moderada',
            'moderacion',
            'moderaron',
            'no se ve',
            'rechazada'
        ],
        steps: [
            `Si Hospeda te pidió un arreglo, vas a ver el aviso «Te pidieron un arreglo en esta ficha» en «${ACCOMMODATION_LIST_LABEL}» o «${VENUE_AND_EXPERIENCE_LIST_LABEL}» y en el editor de esa publicación.`,
            'El aviso puede traer una fecha sugerida para corregirlo. Tu publicación sigue a la vista mientras tanto.',
            'Corregí lo que se pidió desde el editor.',
            'Tocá «Ya lo corregí» para avisar a Hospeda. Eso no cierra el pedido ni publica nada: lo revisa el equipo.',
            'Si la publicación quedó moderada («Ficha moderada»), no se ve en el sitio hasta que un administrador levante la moderación. Mientras tanto podés verla, exportarla y editarla, pero no publicarla. En alojamientos también podés borrarla; en comercios y experiencias el portal no tiene el botón «Eliminar».'
        ],
        destinations: [
            { kind: 'ownerListings', vertical: 'accommodation', label: ACCOMMODATION_LIST_LABEL },
            { kind: 'ownerListings', vertical: 'venue', label: VENUE_AND_EXPERIENCE_LIST_LABEL },
            {
                kind: 'ownerListings',
                vertical: 'experience',
                label: VENUE_AND_EXPERIENCE_LIST_LABEL
            },
            { kind: 'contact' }
        ],
        reviewedAt: '2026-11-17'
    },
    {
        id: 'reviews',
        audience: 'any',
        title: 'Ver las reseñas de mis publicaciones',
        keywords: [
            'reseña',
            'reseñas',
            'resena',
            'resenas',
            'opinion',
            'opiniones',
            'valoracion',
            'calificacion',
            'responder reseña',
            'comentarios de huespedes'
        ],
        steps: [
            'El portal no tiene una pantalla con las reseñas que recibieron tus publicaciones: «Mis reseñas» muestra las que escribiste vos como usuario.',
            'Pedile a este asistente que te muestre las reseñas de tus publicaciones. Puede filtrar por publicación, rubro, puntaje, fecha y estado.',
            'Cada reseña indica su estado: publicada, pendiente de aprobación o rechazada. Solo las aprobadas se ven en el sitio.',
            'Hospeda no permite que el propietario responda las reseñas de sus publicaciones, ni desde el portal ni desde el asistente.'
        ],
        destinations: [],
        reviewedAt: '2026-11-17'
    }
];
