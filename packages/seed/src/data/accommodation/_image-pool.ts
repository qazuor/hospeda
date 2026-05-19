import { AccommodationTypeEnum } from '@repo/schemas';

/**
 * A single image entry for the accommodation type pool.
 *
 * Used by seed JSON files (URL inlined) and by the lint script that verifies
 * every accommodation-seed image URL belongs to its type pool.
 */
export type ImageVariant = {
    readonly url: string;
    readonly caption: string;
    readonly description: string;
};

/**
 * Accommodation types that have a curated image pool.
 *
 * Excludes `MOTEL` and `RESORT` — no example seeds exist for those types yet.
 * If a future seed introduces them, extend the pool here and update the type.
 */
export type PooledAccommodationType =
    | AccommodationTypeEnum.APARTMENT
    | AccommodationTypeEnum.HOUSE
    | AccommodationTypeEnum.COUNTRY_HOUSE
    | AccommodationTypeEnum.CABIN
    | AccommodationTypeEnum.HOTEL
    | AccommodationTypeEnum.HOSTEL
    | AccommodationTypeEnum.CAMPING
    | AccommodationTypeEnum.ROOM;

/**
 * Curated Pexels image URLs grouped by accommodation type.
 *
 * 10 URLs per type × 8 types = 80 curated URLs total.
 *
 * Sourced and verified during SPEC-119 — see
 * `packages/seed/docs/spec-119-image-pool-curation.md` for selection methodology,
 * content verification, and per-URL provenance.
 *
 * Every URL is a Pexels CDN image (`https://images.pexels.com/photos/<id>/...`)
 * and was content-verified (the photo actually matches its caption) and
 * availability-verified (HTTP 200) at the time of curation.
 *
 * Seed JSON files inline these URLs (they cannot import TS). The companion
 * lint script `scripts/check-image-pool-coverage.ts` enforces that every URL
 * in every accommodation JSON appears in this pool, catching drift on PR.
 */
export const IMAGE_POOL_BY_TYPE: Record<PooledAccommodationType, readonly ImageVariant[]> = {
    [AccommodationTypeEnum.APARTMENT]: [
        {
            url: 'https://images.pexels.com/photos/2062431/pexels-photo-2062431.jpeg',
            caption: 'Cocina del departamento',
            description: 'Cocina blanca modular con detalles en madera y luz natural'
        },
        {
            url: 'https://images.pexels.com/photos/8089172/pexels-photo-8089172.jpeg',
            caption: 'Living integrado con cocina',
            description: 'Diseño minimalista con living y cocina abierta del apartamento'
        },
        {
            url: 'https://images.pexels.com/photos/11296215/pexels-photo-11296215.jpeg',
            caption: 'Living con iluminación cálida',
            description: 'Sala de estar amplia con sillones, mesa baja y lámparas de pie'
        },
        {
            url: 'https://images.pexels.com/photos/11296222/pexels-photo-11296222.jpeg',
            caption: 'Living del apartamento',
            description: 'Ambiente principal con sillón gris, plantas y decoración contemporánea'
        },
        {
            url: 'https://images.pexels.com/photos/7614615/pexels-photo-7614615.jpeg',
            caption: 'Sala con ventanal',
            description: 'Living moderno con grandes ventanas y mucha luz natural'
        },
        {
            url: 'https://images.pexels.com/photos/29003510/pexels-photo-29003510.jpeg',
            caption: 'Ambiente principal luminoso',
            description: 'Sala elegante con luz natural entrando por los ventanales'
        },
        {
            url: 'https://images.pexels.com/photos/7214732/pexels-photo-7214732.jpeg',
            caption: 'Living con pared de ladrillo',
            description: 'Sala contemporánea con pared de ladrillo a la vista y zona de TV'
        },
        {
            url: 'https://images.pexels.com/photos/17832175/pexels-photo-17832175.jpeg',
            caption: 'Loft con escalera',
            description: 'Apartamento tipo loft con escalera interior y mobiliario moderno'
        },
        {
            url: 'https://images.pexels.com/photos/7511701/pexels-photo-7511701.jpeg',
            caption: 'Living acogedor',
            description: 'Sala cálida con sillón, plantas de interior y luz natural suave'
        },
        {
            url: 'https://images.pexels.com/photos/32750273/pexels-photo-32750273.jpeg',
            caption: 'Apartamento con vista a la ciudad',
            description: 'Piso alto con ventanal panorámico y vista urbana del Litoral'
        },
        {
            url: 'https://images.pexels.com/photos/19899060/pexels-photo-19899060.jpeg',
            caption: 'Sala con sillón y mesas',
            description: 'Living con sillón, mesas auxiliares y butaca en ambiente acogedor'
        },
        {
            url: 'https://images.pexels.com/photos/14505912/pexels-photo-14505912.jpeg',
            caption: 'Living totalmente equipado',
            description: 'Sala completa con sofá, mesas y decoración lista para los huéspedes'
        },
        {
            url: 'https://images.pexels.com/photos/36887747/pexels-photo-36887747.jpeg',
            caption: 'Sala con sillón beige',
            description:
                'Living moderno con sillón color beige y detalles de decoración contemporáneos'
        },
        {
            url: 'https://images.pexels.com/photos/19916700/pexels-photo-19916700.jpeg',
            caption: 'Vista del apartamento',
            description: 'Vista aérea del living del apartamento con sillones y mesa baja'
        },
        {
            url: 'https://images.pexels.com/photos/37252339/pexels-photo-37252339.jpeg',
            caption: 'Living minimalista',
            description: 'Sala de diseño minimalista con líneas limpias y luz natural abundante'
        },
        {
            url: 'https://images.pexels.com/photos/34933264/pexels-photo-34933264.jpeg',
            caption: 'Apartamento moderno',
            description: 'Living del apartamento con diseño contemporáneo y mobiliario sobrio'
        },
        {
            url: 'https://images.pexels.com/photos/34818757/pexels-photo-34818757.jpeg',
            caption: 'Sala elegante',
            description: 'Living de diseño elegante con detalles modernos y luz cálida'
        },
        {
            url: 'https://images.pexels.com/photos/19674451/pexels-photo-19674451.jpeg',
            caption: 'Living en piso alto',
            description: 'Sala de apartamento en piso alto con vista despejada y mobiliario moderno'
        },
        {
            url: 'https://images.pexels.com/photos/6077368/pexels-photo-6077368.jpeg',
            caption: 'Ambiente luminoso',
            description: 'Sala amplia con grandes ventanas y mucha luz natural durante el día'
        },
        {
            url: 'https://images.pexels.com/photos/5417293/pexels-photo-5417293.jpeg',
            caption: 'Living con alfombra',
            description: 'Sala contemporánea con mobiliario, alfombra y decoración cuidada'
        },
        {
            url: 'https://images.pexels.com/photos/30765736/pexels-photo-30765736.jpeg',
            caption: 'Living con balcón ajardinado',
            description: 'Apartamento moderno con balcón con plantas y vista al exterior'
        },
        {
            url: 'https://images.pexels.com/photos/6681824/pexels-photo-6681824.jpeg',
            caption: 'Rincón junto a la ventana',
            description: 'Sillón cómodo con muebles de madera junto a la ventana del living'
        },
        {
            url: 'https://images.pexels.com/photos/7031708/pexels-photo-7031708.jpeg',
            caption: 'Living con TV',
            description: 'Sala acogedora con sillón mullido y TV en pared del apartamento'
        },
        {
            url: 'https://images.pexels.com/photos/9494898/pexels-photo-9494898.jpeg',
            caption: 'Living amplio',
            description: 'Sala espaciosa del apartamento con sillón grande y mobiliario actual'
        },
        {
            url: 'https://images.pexels.com/photos/33636640/pexels-photo-33636640.jpeg',
            caption: 'Sala con cocina abierta',
            description: 'Living del apartamento integrado con cocina en diseño minimalista'
        }
    ],
    [AccommodationTypeEnum.HOUSE]: [
        {
            url: 'https://images.pexels.com/photos/1115804/pexels-photo-1115804.jpeg',
            caption: 'Casa con luces encendidas',
            description: 'Casa de dos plantas iluminada al anochecer con garage doble'
        },
        {
            url: 'https://images.pexels.com/photos/4832503/pexels-photo-4832503.jpeg',
            caption: 'Casa suburbana',
            description: 'Casa moderna de dos plantas con jardín delantero prolijo'
        },
        {
            url: 'https://images.pexels.com/photos/4290722/pexels-photo-4290722.jpeg',
            caption: 'Frente con jardín',
            description: 'Casa con jardín cuidado y entrada para auto'
        },
        {
            url: 'https://images.pexels.com/photos/4469137/pexels-photo-4469137.jpeg',
            caption: 'Casa familiar',
            description: 'Casa amplia con frente de ladrillo y jardín de pasto verde'
        },
        {
            url: 'https://images.pexels.com/photos/4469146/pexels-photo-4469146.jpeg',
            caption: 'Casa de dos plantas',
            description: 'Casa de ladrillo de dos plantas con jardín y árboles maduros'
        },
        {
            url: 'https://images.pexels.com/photos/4832522/pexels-photo-4832522.jpeg',
            caption: 'Casa moderna',
            description: 'Vivienda moderna con frente prolijo y entrada para vehículo'
        },
        {
            url: 'https://images.pexels.com/photos/6510949/pexels-photo-6510949.jpeg',
            caption: 'Casa con frente azul',
            description: 'Casa familiar con fachada azul y jardín delantero'
        },
        {
            url: 'https://images.pexels.com/photos/10486072/pexels-photo-10486072.jpeg',
            caption: 'Casa en barrio tranquilo',
            description: 'Casa de dos plantas en barrio residencial bajo cielo despejado'
        },
        {
            url: 'https://images.pexels.com/photos/6952009/pexels-photo-6952009.jpeg',
            caption: 'Casa amarilla con árboles',
            description: 'Casa amarilla rodeada de árboles verdes ideal para descanso'
        },
        {
            url: 'https://images.pexels.com/photos/5563473/pexels-photo-5563473.jpeg',
            caption: 'Casa contemporánea',
            description: 'Casa moderna con ventanales amplios y terraza al frente'
        },
        {
            url: 'https://images.pexels.com/photos/32802992/pexels-photo-32802992.jpeg',
            caption: 'Casa suburbana con jardín',
            description: 'Casa suburbana elegante con jardín cuidado y entrada delantera'
        },
        {
            url: 'https://images.pexels.com/photos/5587965/pexels-photo-5587965.jpeg',
            caption: 'Barrio residencial',
            description: 'Vista aérea de casas suburbanas en barrio residencial tranquilo'
        },
        {
            url: 'https://images.pexels.com/photos/5353883/pexels-photo-5353883.jpeg',
            caption: 'Frente de casa familiar',
            description:
                'Vista frontal de casa familiar con entrada para vehículo y jardín delantero'
        },
        {
            url: 'https://images.pexels.com/photos/209274/pexels-photo-209274.jpeg',
            caption: 'Casa pintada en dos tonos',
            description: 'Casa familiar con frente pintado en blanco y marrón en barrio tranquilo'
        },
        {
            url: 'https://images.pexels.com/photos/33327061/pexels-photo-33327061.jpeg',
            caption: 'Casa con follaje otoñal',
            description: 'Casa suburbana con árboles otoñales y luz cálida en horario de tarde'
        },
        {
            url: 'https://images.pexels.com/photos/33350028/pexels-photo-33350028.jpeg',
            caption: 'Casa moderna con auto',
            description: 'Casa suburbana moderna con auto estacionado en la entrada para vehículo'
        },
        {
            url: 'https://images.pexels.com/photos/31602311/pexels-photo-31602311.jpeg',
            caption: 'Casa de ladrillo rojo',
            description: 'Casa suburbana de ladrillo rojo con jardín delantero en día soleado'
        },
        {
            url: 'https://images.pexels.com/photos/30707539/pexels-photo-30707539.jpeg',
            caption: 'Casa rojiza con encanto',
            description: 'Casa de ladrillo rojo en barrio suburbano con árboles maduros alrededor'
        },
        {
            url: 'https://images.pexels.com/photos/209315/pexels-photo-209315.jpeg',
            caption: 'Casa con jardín cuidado',
            description: 'Casa de paredes marrones con jardín cuidado y vegetación delantera'
        },
        {
            url: 'https://images.pexels.com/photos/4469136/pexels-photo-4469136.jpeg',
            caption: 'Casa estilo americano',
            description: 'Casa familiar amplia con estilo americano y entrada para auto'
        },
        {
            url: 'https://images.pexels.com/photos/33253271/pexels-photo-33253271.jpeg',
            caption: 'Casa vintage verde',
            description: 'Casa vintage de ladrillo verde con autos al frente en barrio tranquilo'
        },
        {
            url: 'https://images.pexels.com/photos/35705942/pexels-photo-35705942.jpeg',
            caption: 'Casa moderna entre pinos',
            description: 'Casa moderna rodeada de pinos con arquitectura contemporánea cuidada'
        },
        {
            url: 'https://images.pexels.com/photos/7031408/pexels-photo-7031408.jpeg',
            caption: 'Casa con piedra y madera',
            description: 'Casa suburbana privada con fachada de piedra y madera en barrio tranquilo'
        },
        {
            url: 'https://images.pexels.com/photos/8134846/pexels-photo-8134846.jpeg',
            caption: 'Casa con entrada amplia',
            description: 'Casa contemporánea con entrada amplia, jardín cuidado y diseño actual'
        },
        {
            url: 'https://images.pexels.com/photos/30278097/pexels-photo-30278097.jpeg',
            caption: 'Casa minimalista',
            description: 'Casa de diseño minimalista con detalles de madera y jardín cuidado'
        }
    ],
    [AccommodationTypeEnum.COUNTRY_HOUSE]: [
        {
            url: 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg',
            caption: 'Casa de campo con jardín',
            description: 'Frente de la casa quinta con galería y arboleda al fondo'
        },
        {
            url: 'https://images.pexels.com/photos/276724/pexels-photo-276724.jpeg',
            caption: 'Living de la casa quinta',
            description: 'Sala de estar con TV y sillones cómodos para días de descanso'
        },
        {
            url: 'https://images.pexels.com/photos/2104882/pexels-photo-2104882.jpeg',
            caption: 'Interior con detalles rústicos',
            description: 'Ambiente principal con techos altos y elementos en madera'
        },
        {
            url: 'https://images.pexels.com/photos/567186/pexels-photo-567186.jpeg',
            caption: 'Casona de piedra',
            description: 'Antigua casa rural en piedra rodeada de verde y árboles'
        },
        {
            url: 'https://images.pexels.com/photos/5543266/pexels-photo-5543266.jpeg',
            caption: 'Casa de campo con cerco blanco',
            description: 'Casa rural pintoresca con cerco blanco y vegetación abundante'
        },
        {
            url: 'https://images.pexels.com/photos/6858170/pexels-photo-6858170.jpeg',
            caption: 'Casa rústica',
            description: 'Casa con paredes de madera y base de ladrillo rodeada de árboles'
        },
        {
            url: 'https://images.pexels.com/photos/33623258/pexels-photo-33623258.jpeg',
            caption: 'Casa quinta con campo',
            description: 'Casa de campo con tierras alrededor y vista despejada al horizonte'
        },
        {
            url: 'https://images.pexels.com/photos/23458269/pexels-photo-23458269.jpeg',
            caption: 'Casa de madera celeste',
            description: 'Casa rural rústica de madera celeste en zona tranquila'
        },
        {
            url: 'https://images.pexels.com/photos/4256852/pexels-photo-4256852.jpeg',
            caption: 'Galería de la casa quinta',
            description: 'Galería techada con vista al parque de la propiedad'
        },
        {
            url: 'https://images.pexels.com/photos/2736388/pexels-photo-2736388.jpeg',
            caption: 'Parrilla y patio',
            description: 'Sector de parrilla y patio para reuniones al aire libre'
        },
        {
            url: 'https://images.pexels.com/photos/9811328/pexels-photo-9811328.jpeg',
            caption: 'Casa de campo entre cultivos',
            description: 'Casa quinta solitaria rodeada de cultivos verdes bajo cielo despejado'
        },
        {
            url: 'https://images.pexels.com/photos/34467492/pexels-photo-34467492.jpeg',
            caption: 'Casa rural con galería',
            description: 'Casa de campo rústica de madera con vista a paisaje montañoso'
        },
        {
            url: 'https://images.pexels.com/photos/17648544/pexels-photo-17648544.jpeg',
            caption: 'Casa quinta con campos',
            description: 'Casa rural pintoresca con techo a dos aguas rodeada de campos verdes'
        },
        {
            url: 'https://images.pexels.com/photos/13280780/pexels-photo-13280780.jpeg',
            caption: 'Casa quinta tranquila',
            description: 'Casa rural en paisaje natural con vegetación abundante alrededor'
        },
        {
            url: 'https://images.pexels.com/photos/36394900/pexels-photo-36394900.jpeg',
            caption: 'Casa con techo rojo',
            description: 'Casa rural con techo rojo en paisaje sereno del campo verde'
        },
        {
            url: 'https://images.pexels.com/photos/17503665/pexels-photo-17503665.jpeg',
            caption: 'Casa de piedra rural',
            description: 'Casa de piedra con detalles rojos sobre colinas verdes y cielo abierto'
        },
        {
            url: 'https://images.pexels.com/photos/19612932/pexels-photo-19612932.jpeg',
            caption: 'Casa quinta con jardín',
            description: 'Casa de campo pintoresca rodeada de jardín y cultivos en paisaje rural'
        },
        {
            url: 'https://images.pexels.com/photos/164306/pexels-photo-164306.jpeg',
            caption: 'Casa rural antigua',
            description: 'Casa rural envejecida en paisaje vibrante del campo bajo cielo nublado'
        },
        {
            url: 'https://images.pexels.com/photos/9769288/pexels-photo-9769288.jpeg',
            caption: 'Casa quinta con verde',
            description: 'Casa rural pintoresca rodeada de vegetación verde en día soleado'
        },
        {
            url: 'https://images.pexels.com/photos/27056345/pexels-photo-27056345.jpeg',
            caption: 'Casa de campo con flores',
            description: 'Casa rural en paisaje campestre con camino sinuoso y flores silvestres'
        },
        {
            url: 'https://images.pexels.com/photos/32150698/pexels-photo-32150698.jpeg',
            caption: 'Casa rural soleada',
            description: 'Casa rural pintoresca rodeada de vegetación en día soleado de verano'
        },
        {
            url: 'https://images.pexels.com/photos/9811331/pexels-photo-9811331.jpeg',
            caption: 'Casa de madera rural',
            description: 'Casa rural de madera rodeada de vegetación abundante en verano'
        },
        {
            url: 'https://images.pexels.com/photos/19937378/pexels-photo-19937378.jpeg',
            caption: 'Casa rural rústica',
            description: 'Casa quinta rústica rodeada de naturaleza serena y árboles cercanos'
        },
        {
            url: 'https://images.pexels.com/photos/36675535/pexels-photo-36675535.jpeg',
            caption: 'Casa rural con verde',
            description: 'Casa rural rústica con vegetación frondosa alrededor en día nublado'
        },
        {
            url: 'https://images.pexels.com/photos/17249891/pexels-photo-17249891.jpeg',
            caption: 'Casa rural pintoresca',
            description: 'Casa rural con arquitectura rústica en campo soleado y vegetación verde'
        }
    ],
    [AccommodationTypeEnum.CABIN]: [
        {
            url: 'https://images.pexels.com/photos/6489103/pexels-photo-6489103.jpeg',
            caption: 'Altillo de la cabaña',
            description: 'Entrepiso de madera de la cabaña con cama y vista al living'
        },
        {
            url: 'https://images.pexels.com/photos/15586348/pexels-photo-15586348.jpeg',
            caption: 'Cabaña entre el verde',
            description: 'Cabaña de madera rodeada de vegetación y flores'
        },
        {
            url: 'https://images.pexels.com/photos/12566236/pexels-photo-12566236.jpeg',
            caption: 'Cabaña rústica',
            description: 'Cabaña de madera estilo rústico en entorno arbolado'
        },
        {
            url: 'https://images.pexels.com/photos/12319415/pexels-photo-12319415.jpeg',
            caption: 'Cabaña en el monte',
            description: 'Cabaña de madera enclavada en bosque verde y frondoso'
        },
        {
            url: 'https://images.pexels.com/photos/17041194/pexels-photo-17041194.jpeg',
            caption: 'Cabaña con pradera',
            description: 'Cabaña en paisaje veraniego con pasto verde y árboles altos'
        },
        {
            url: 'https://images.pexels.com/photos/13807232/pexels-photo-13807232.jpeg',
            caption: 'Cabaña en el campo',
            description: 'Cabaña ubicada en campo abierto con árboles alrededor'
        },
        {
            url: 'https://images.pexels.com/photos/34034355/pexels-photo-34034355.jpeg',
            caption: 'Entorno natural de la cabaña',
            description: 'Espacio al aire libre rodeado de vegetación característica del Litoral'
        },
        {
            url: 'https://images.pexels.com/photos/2104882/pexels-photo-2104882.jpeg',
            caption: 'Interior con detalles de madera',
            description: 'Ambiente cálido con revestimientos de madera y mobiliario rústico'
        },
        {
            url: 'https://images.pexels.com/photos/5994751/pexels-photo-5994751.jpeg',
            caption: 'Cabaña iluminada de noche',
            description: 'Cabaña iluminada desde el interior durante el atardecer en el bosque'
        },
        {
            url: 'https://images.pexels.com/photos/33567174/pexels-photo-33567174.jpeg',
            caption: 'Cabaña tradicional',
            description: 'Antigua cabaña de madera enclavada en bosque verde y húmedo'
        },
        {
            url: 'https://images.pexels.com/photos/11293209/pexels-photo-11293209.jpeg',
            caption: 'Cabaña en invierno',
            description: 'Cabaña de troncos en bosque nevado durante el invierno'
        },
        {
            url: 'https://images.pexels.com/photos/4406354/pexels-photo-4406354.jpeg',
            caption: 'Cabaña en el valle',
            description: 'Cabaña de troncos en valle verde rodeada de pinos y vegetación'
        },
        {
            url: 'https://images.pexels.com/photos/18332501/pexels-photo-18332501.jpeg',
            caption: 'Cabaña al atardecer',
            description: 'Cabaña de troncos entre árboles con luz cálida del atardecer'
        },
        {
            url: 'https://images.pexels.com/photos/1518757/pexels-photo-1518757.jpeg',
            caption: 'Cabaña escondida',
            description: 'Cabaña de troncos escondida entre árboles densos en entorno rural'
        },
        {
            url: 'https://images.pexels.com/photos/17804250/pexels-photo-17804250.jpeg',
            caption: 'Cabaña en bosque denso',
            description: 'Cabaña de troncos rodeada de bosque denso y vegetación frondosa'
        },
        {
            url: 'https://images.pexels.com/photos/2294125/pexels-photo-2294125.jpeg',
            caption: 'Cabaña con ventanales',
            description: 'Imponente cabaña de troncos con grandes ventanales de vidrio al exterior'
        },
        {
            url: 'https://images.pexels.com/photos/25853247/pexels-photo-25853247.jpeg',
            caption: 'Cabaña en bosque verde',
            description: 'Cabaña de madera rodeada de vegetación verde y árboles altos'
        },
        {
            url: 'https://images.pexels.com/photos/13354350/pexels-photo-13354350.jpeg',
            caption: 'Cabaña ideal para descanso',
            description: 'Cabaña de troncos en bosque sereno, perfecta para descansar de la rutina'
        },
        {
            url: 'https://images.pexels.com/photos/1365110/pexels-photo-1365110.jpeg',
            caption: 'Cabaña en verano',
            description: 'Vieja cabaña de troncos en paisaje veraniego con árboles alrededor'
        },
        {
            url: 'https://images.pexels.com/photos/803975/pexels-photo-803975.jpeg',
            caption: 'Cabaña en otoño',
            description: 'Cabaña de troncos rodeada de árboles otoñales con iluminación cálida'
        },
        {
            url: 'https://images.pexels.com/photos/751546/pexels-photo-751546.jpeg',
            caption: 'Cabaña rural',
            description: 'Cabaña de madera con encanto rústico en entorno rural sereno y verde'
        },
        {
            url: 'https://images.pexels.com/photos/11539579/pexels-photo-11539579.jpeg',
            caption: 'Cabaña en pradera',
            description: 'Cabaña de madera en pradera verde con vegetación frondosa alrededor'
        },
        {
            url: 'https://images.pexels.com/photos/14771408/pexels-photo-14771408.jpeg',
            caption: 'Cabaña en paisaje rural',
            description: 'Cabaña de madera en paisaje rural con cielo despejado y horizonte abierto'
        },
        {
            url: 'https://images.pexels.com/photos/6374162/pexels-photo-6374162.jpeg',
            caption: 'Cabaña entre árboles',
            description: 'Cabaña de madera enclavada en bosque denso de tonos verdes'
        },
        {
            url: 'https://images.pexels.com/photos/31493936/pexels-photo-31493936.jpeg',
            caption: 'Cabaña con sol filtrado',
            description: 'Cabaña de madera con sol que se filtra entre los árboles del bosque'
        }
    ],
    [AccommodationTypeEnum.HOTEL]: [
        {
            url: 'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg',
            caption: 'Fachada del hotel',
            description: 'Frente del hotel con entrada principal y cartelería'
        },
        {
            url: 'https://images.pexels.com/photos/271619/pexels-photo-271619.jpeg',
            caption: 'Habitación superior',
            description: 'Habitación contemporánea minimalista con iluminación cálida'
        },
        {
            url: 'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg',
            caption: 'Habitación standard',
            description: 'Habitación moderna con tonos neutros y luz natural abundante'
        },
        {
            url: 'https://images.pexels.com/photos/260922/pexels-photo-260922.jpeg',
            caption: 'Lobby bar',
            description: 'Bar elegante del hotel con iluminación tenue y ambiente sofisticado'
        },
        {
            url: 'https://images.pexels.com/photos/53464/sheraton-palace-hotel-lobby-architecture-san-francisco-53464.jpeg',
            caption: 'Lobby del hotel',
            description: 'Lobby amplio con arquitectura clásica y techo abovedado'
        },
        {
            url: 'https://images.pexels.com/photos/34559240/pexels-photo-34559240.jpeg',
            caption: 'Habitación de lujo',
            description: 'Habitación amplia con diseño contemporáneo y mobiliario premium'
        },
        {
            url: 'https://images.pexels.com/photos/28962539/pexels-photo-28962539.jpeg',
            caption: 'Habitación con vista',
            description: 'Habitación moderna con ventanal panorámico y vista a la ciudad'
        },
        {
            url: 'https://images.pexels.com/photos/36816426/pexels-photo-36816426.jpeg',
            caption: 'Habitación matrimonial',
            description: 'Habitación con cama doble, lámparas suaves y diseño elegante'
        },
        {
            url: 'https://images.pexels.com/photos/33400871/pexels-photo-33400871.jpeg',
            caption: 'Habitación con balcón',
            description: 'Habitación con acceso a balcón privado y mobiliario contemporáneo'
        },
        {
            url: 'https://images.pexels.com/photos/36767624/pexels-photo-36767624.jpeg',
            caption: 'Habitación luminosa',
            description: 'Suite con ventanal grande, luz natural y mobiliario moderno'
        },
        {
            url: 'https://images.pexels.com/photos/29649745/pexels-photo-29649745.jpeg',
            caption: 'Lobby con araña',
            description: 'Lobby elegante del hotel con araña de cristal y mobiliario clásico'
        },
        {
            url: 'https://images.pexels.com/photos/36354489/pexels-photo-36354489.jpeg',
            caption: 'Lobby moderno',
            description: 'Lobby del hotel con diseño moderno, mobiliario sobrio y luz cálida'
        },
        {
            url: 'https://images.pexels.com/photos/7512139/pexels-photo-7512139.jpeg',
            caption: 'Recepción del hotel',
            description: 'Vista aérea de la recepción moderna del hotel con huéspedes en el lobby'
        },
        {
            url: 'https://images.pexels.com/photos/28102352/pexels-photo-28102352.jpeg',
            caption: 'Lobby con sillones',
            description: 'Sillones en el lobby moderno del hotel para descansar y esperar'
        },
        {
            url: 'https://images.pexels.com/photos/7942138/pexels-photo-7942138.jpeg',
            caption: 'Atrio del hotel',
            description: 'Atrio amplio y elegante del hotel con interior moderno y techo alto'
        },
        {
            url: 'https://images.pexels.com/photos/14841133/pexels-photo-14841133.jpeg',
            caption: 'Lobby con araña moderna',
            description: 'Lobby elegante con araña de diseño moderno y mobiliario contemporáneo'
        },
        {
            url: 'https://images.pexels.com/photos/18117651/pexels-photo-18117651.jpeg',
            caption: 'Lobby con estilo',
            description: 'Lobby de hotel con decoración moderna y zonas de estar para huéspedes'
        },
        {
            url: 'https://images.pexels.com/photos/37252307/pexels-photo-37252307.jpeg',
            caption: 'Lobby contemporáneo',
            description: 'Lobby espacioso del hotel con decoración contemporánea y luz cuidada'
        },
        {
            url: 'https://images.pexels.com/photos/6474588/pexels-photo-6474588.jpeg',
            caption: 'Lobby decorado',
            description: 'Lobby del hotel con decoración elegante y luces tenues por la noche'
        },
        {
            url: 'https://images.pexels.com/photos/5378699/pexels-photo-5378699.jpeg',
            caption: 'Pareja en el lobby',
            description: 'Pareja caminando por un lobby lujoso del hotel con detalles elegantes'
        },
        {
            url: 'https://images.pexels.com/photos/35664333/pexels-photo-35664333.jpeg',
            caption: 'Habitación con cabecero floral',
            description: 'Habitación elegante del hotel con cabecero de motivos florales'
        },
        {
            url: 'https://images.pexels.com/photos/237371/pexels-photo-237371.jpeg',
            caption: 'Habitación contemporánea',
            description: 'Habitación del hotel con diseño contemporáneo y elegancia cuidada'
        },
        {
            url: 'https://images.pexels.com/photos/31967701/pexels-photo-31967701.jpeg',
            caption: 'Habitación de noche',
            description: 'Habitación moderna del hotel con iluminación cálida en horario nocturno'
        },
        {
            url: 'https://images.pexels.com/photos/35103156/pexels-photo-35103156.jpeg',
            caption: 'Habitación acogedora',
            description: 'Habitación del hotel de diseño moderno con detalles acogedores'
        },
        {
            url: 'https://images.pexels.com/photos/13722872/pexels-photo-13722872.jpeg',
            caption: 'Habitación doble',
            description: 'Habitación del hotel con cama doble y diseño moderno cuidado'
        }
    ],
    [AccommodationTypeEnum.HOSTEL]: [
        {
            url: 'https://images.pexels.com/photos/2844474/pexels-photo-2844474.jpeg',
            caption: 'Fachada del hostel',
            description: 'Frente del hostel con balcón ornamentado y torre colonial al fondo'
        },
        {
            url: 'https://images.pexels.com/photos/6957069/pexels-photo-6957069.jpeg',
            caption: 'Sala común',
            description: 'Living compartido con sillón beige, pared de ladrillo y luz natural'
        },
        {
            url: 'https://images.pexels.com/photos/7005428/pexels-photo-7005428.jpeg',
            caption: 'Cocina comunitaria',
            description: 'Cocina compartida del hostel con barra y utensilios para los huéspedes'
        },
        {
            url: 'https://images.pexels.com/photos/4907208/pexels-photo-4907208.jpeg',
            caption: 'Dormitorio compartido',
            description: 'Habitación con cuchetas de madera y huéspedes charlando relajados'
        },
        {
            url: 'https://images.pexels.com/photos/5137980/pexels-photo-5137980.jpeg',
            caption: 'Dormitorio con cuchetas',
            description: 'Dormitorio del hostel con cuchetas prolijas y luz natural'
        },
        {
            url: 'https://images.pexels.com/photos/4907232/pexels-photo-4907232.jpeg',
            caption: 'Cucheta superior',
            description: 'Huéspedes descansando en distintos niveles de las cuchetas del dormitorio'
        },
        {
            url: 'https://images.pexels.com/photos/4907181/pexels-photo-4907181.jpeg',
            caption: 'Llegada al dormitorio',
            description: 'Viajeras ingresando al dormitorio compartido al inicio de su estadía'
        },
        {
            url: 'https://images.pexels.com/photos/4907190/pexels-photo-4907190.jpeg',
            caption: 'Habitación compartida luminosa',
            description: 'Dormitorio amplio con cuchetas y muchísima luz natural'
        },
        {
            url: 'https://images.pexels.com/photos/4907433/pexels-photo-4907433.jpeg',
            caption: 'Charla entre viajeros',
            description: 'Ambiente sociable característico del hostel con huéspedes charlando'
        },
        {
            url: 'https://images.pexels.com/photos/4907211/pexels-photo-4907211.jpeg',
            caption: 'Encuentro en el dormitorio',
            description: 'Huéspedes compartiendo un momento en el dormitorio del hostel'
        },
        {
            url: 'https://images.pexels.com/photos/5137981/pexels-photo-5137981.jpeg',
            caption: 'Cucheta minimalista',
            description: 'Cucheta de madera con sábanas a rayas en habitación cálida del hostel'
        },
        {
            url: 'https://images.pexels.com/photos/4907210/pexels-photo-4907210.jpeg',
            caption: 'Subiendo a la cucheta',
            description: 'Viajera subiendo la escalera de la cucheta en el dormitorio del hostel'
        },
        {
            url: 'https://images.pexels.com/photos/4907626/pexels-photo-4907626.jpeg',
            caption: 'Relax en las cuchetas',
            description: 'Dos viajeras descansando en cuchetas y revisando sus teléfonos'
        },
        {
            url: 'https://images.pexels.com/photos/4907609/pexels-photo-4907609.jpeg',
            caption: 'Charla entre cuchetas',
            description: 'Mujeres jóvenes conversando en dormitorio moderno con cuchetas'
        },
        {
            url: 'https://images.pexels.com/photos/7969098/pexels-photo-7969098.jpeg',
            caption: 'Estadía con mochila',
            description: 'Viajeros con mochila disfrutando la estadía en habitación con cuchetas'
        },
        {
            url: 'https://images.pexels.com/photos/7969102/pexels-photo-7969102.jpeg',
            caption: 'Amigos en el hostel',
            description: 'Dos amigas compartiendo un momento alegre en habitación con cuchetas'
        },
        {
            url: 'https://images.pexels.com/photos/4907221/pexels-photo-4907221.jpeg',
            caption: 'Charla en la cucheta',
            description: 'Dos viajeras sentadas en la cucheta sonriendo y charlando relajadas'
        },
        {
            url: 'https://images.pexels.com/photos/4907430/pexels-photo-4907430.jpeg',
            caption: 'Cuchetas azules',
            description: 'Dos viajeras descansando en cuchetas azules del dormitorio del hostel'
        },
        {
            url: 'https://images.pexels.com/photos/4907205/pexels-photo-4907205.jpeg',
            caption: 'Dormitorio moderno',
            description: 'Habitación moderna del hostel con cuchetas y huéspedes relajadas'
        },
        {
            url: 'https://images.pexels.com/photos/4907600/pexels-photo-4907600.jpeg',
            caption: 'Viajeros conversando',
            description: 'Dos viajeros charlando en el dormitorio del hostel con cuchetas'
        },
        {
            url: 'https://images.pexels.com/photos/35165103/pexels-photo-35165103.jpeg',
            caption: 'Dormitorio rústico',
            description: 'Dormitorio acogedor del hostel con cuchetas y decoración rústica'
        },
        {
            url: 'https://images.pexels.com/photos/7969103/pexels-photo-7969103.jpeg',
            caption: 'Llegada al hostel',
            description: 'Mochilero ingresando al hostel por la puerta vidriada de entrada'
        },
        {
            url: 'https://images.pexels.com/photos/5137963/pexels-photo-5137963.jpeg',
            caption: 'Mochileros con mapa',
            description: 'Mochileros consultando un mapa de la zona en el sector de recepción'
        },
        {
            url: 'https://images.pexels.com/photos/4907458/pexels-photo-4907458.jpeg',
            caption: 'Recepción del hostel',
            description: 'Dos viajeras realizando el check-in en la recepción del hostel'
        },
        {
            url: 'https://images.pexels.com/photos/5152833/pexels-photo-5152833.jpeg',
            caption: 'Lobby cálido',
            description: 'Lobby acogedor del hostel con decoración tropical y luz cálida'
        }
    ],
    [AccommodationTypeEnum.CAMPING]: [
        {
            url: 'https://images.pexels.com/photos/2666598/pexels-photo-2666598.jpeg',
            caption: 'Carpa bajo cielo estrellado',
            description:
                'Vista nocturna del área de acampe con tipi iluminado y la Vía Láctea de fondo'
        },
        {
            url: 'https://images.pexels.com/photos/104664/pexels-photo-104664.jpeg',
            caption: 'Carpa azul sobre el césped',
            description: 'Parcela con carpa familiar instalada sobre pasto al borde del monte'
        },
        {
            url: 'https://images.pexels.com/photos/5993943/pexels-photo-5993943.jpeg',
            caption: 'Armando la carpa',
            description: 'Acampante terminando de montar la carpa amarilla bajo los árboles'
        },
        {
            url: 'https://images.pexels.com/photos/5994751/pexels-photo-5994751.jpeg',
            caption: 'Carpa iluminada en el bosque',
            description: 'Atardecer en el camping con carpa marrón iluminada desde adentro'
        },
        {
            url: 'https://images.pexels.com/photos/17192955/pexels-photo-17192955.jpeg',
            caption: 'Varias carpas en el claro',
            description: 'Grupo de carpas distribuidas en un claro del monte al atardecer'
        },
        {
            url: 'https://images.pexels.com/photos/15925118/pexels-photo-15925118.jpeg',
            caption: 'Carpa entre árboles',
            description: 'Carpa naranja y azul instalada entre la arboleda del camping'
        },
        {
            url: 'https://images.pexels.com/photos/33102155/pexels-photo-33102155.jpeg',
            caption: 'Acampe junto al arroyo',
            description: 'Carpas armadas a orillas del arroyo con vista a los cerros'
        },
        {
            url: 'https://images.pexels.com/photos/14036357/pexels-photo-14036357.jpeg',
            caption: 'Campamento con tarp',
            description: 'Carpa con techo extendido para sombra en un sector arbolado del predio'
        },
        {
            url: 'https://images.pexels.com/photos/34034355/pexels-photo-34034355.jpeg',
            caption: 'Carpa entre el verde',
            description: 'Carpa amarilla rodeada de vegetación frondosa típica del Litoral'
        },
        {
            url: 'https://images.pexels.com/photos/33102150/pexels-photo-33102150.jpeg',
            caption: 'Carpa naranja al aire libre',
            description: 'Carpa naranja instalada en parcela soleada lista para recibir huéspedes'
        },
        {
            url: 'https://images.pexels.com/photos/12623152/pexels-photo-12623152.jpeg',
            caption: 'Campamento con fogón',
            description: 'Carpas y fogón en un claro rodeado de bosque verde y frondoso'
        },
        {
            url: 'https://images.pexels.com/photos/9159974/pexels-photo-9159974.jpeg',
            caption: 'Carpa azul entre árboles',
            description:
                'Carpa azul instalada entre árboles altos en un sector arbolado del camping'
        },
        {
            url: 'https://images.pexels.com/photos/4268158/pexels-photo-4268158.jpeg',
            caption: 'Carpas en la ladera',
            description: 'Grupo de carpas sobre la ladera con vista despejada al horizonte'
        },
        {
            url: 'https://images.pexels.com/photos/17282348/pexels-photo-17282348.jpeg',
            caption: 'Carpas de colores',
            description: 'Carpas de varios colores armadas en el sector arbolado del predio'
        },
        {
            url: 'https://images.pexels.com/photos/15331106/pexels-photo-15331106.jpeg',
            caption: 'Carpa en el bosque',
            description: 'Carpa solitaria en medio del bosque rodeada de pasto y árboles'
        },
        {
            url: 'https://images.pexels.com/photos/8985295/pexels-photo-8985295.jpeg',
            caption: 'Acampe con vista',
            description: 'Campamento al pie de un cerro rodeado de vegetación y árboles verdes'
        },
        {
            url: 'https://images.pexels.com/photos/20468085/pexels-photo-20468085.jpeg',
            caption: 'Carpas en valle',
            description: 'Varias carpas distribuidas en un valle abierto al amanecer'
        },
        {
            url: 'https://images.pexels.com/photos/9375017/pexels-photo-9375017.jpeg',
            caption: 'Acampe bajo los árboles',
            description: 'Carpas armadas bajo árboles altos en sector de sombra del predio'
        },
        {
            url: 'https://images.pexels.com/photos/14087937/pexels-photo-14087937.jpeg',
            caption: 'Carpas al amanecer',
            description: 'Carpas iluminadas por el sol de la mañana en sector despejado del camping'
        },
        {
            url: 'https://images.pexels.com/photos/17767045/pexels-photo-17767045.jpeg',
            caption: 'Carpa bajo los árboles',
            description: 'Carpa instalada bajo árboles del monte con luz filtrada del sol'
        },
        {
            url: 'https://images.pexels.com/photos/8993120/pexels-photo-8993120.jpeg',
            caption: 'Carpa verde en pradera',
            description: 'Carpa verde solitaria sobre pasto verde en un área abierta del predio'
        },
        {
            url: 'https://images.pexels.com/photos/20708782/pexels-photo-20708782.jpeg',
            caption: 'Campamento en el monte',
            description: 'Sector de acampe enclavado en bosque verde con varias carpas armadas'
        },
        {
            url: 'https://images.pexels.com/photos/11320367/pexels-photo-11320367.jpeg',
            caption: 'Dos carpas en pradera',
            description: 'Par de carpas instaladas sobre pasto verde en sector tranquilo del predio'
        },
        {
            url: 'https://images.pexels.com/photos/34883304/pexels-photo-34883304.jpeg',
            caption: 'Camping con pava',
            description: 'Acampe en el bosque con pava sobre el fuego para el mate de la tarde'
        },
        {
            url: 'https://images.pexels.com/photos/18755614/pexels-photo-18755614.jpeg',
            caption: 'Mesa y sombra',
            description: 'Mesas y árboles del camping al atardecer en sector común del predio'
        }
    ],
    [AccommodationTypeEnum.ROOM]: [
        {
            url: 'https://images.pexels.com/photos/271620/pexels-photo-271620.jpeg',
            caption: 'Habitación privada',
            description: 'Habitación amena con cama doble y mobiliario sencillo'
        },
        {
            url: 'https://images.pexels.com/photos/6580369/pexels-photo-6580369.jpeg',
            caption: 'Habitación serena',
            description: 'Dormitorio con iluminación elegante y almohadones acogedores'
        },
        {
            url: 'https://images.pexels.com/photos/8089073/pexels-photo-8089073.jpeg',
            caption: 'Habitación con TV',
            description: 'Dormitorio moderno con cama gris y TV en la pared'
        },
        {
            url: 'https://images.pexels.com/photos/6782578/pexels-photo-6782578.jpeg',
            caption: 'Cama con almohadones',
            description: 'Habitación luminosa con almohadones y manta sobre la cama'
        },
        {
            url: 'https://images.pexels.com/photos/6862448/pexels-photo-6862448.jpeg',
            caption: 'Habitación cálida',
            description: 'Dormitorio acogedor con cama de madera y luz suave'
        },
        {
            url: 'https://images.pexels.com/photos/7045354/pexels-photo-7045354.jpeg',
            caption: 'Habitación contemporánea',
            description: 'Dormitorio con detalles de madera y lámparas colgantes'
        },
        {
            url: 'https://images.pexels.com/photos/8089081/pexels-photo-8089081.jpeg',
            caption: 'Dormitorio minimalista',
            description: 'Habitación sobria con cama mullida y mobiliario contemporáneo'
        },
        {
            url: 'https://images.pexels.com/photos/6782338/pexels-photo-6782338.jpeg',
            caption: 'Dormitorio con mesas de luz',
            description: 'Habitación con mesas de luz, lámparas y silloncito al pie'
        },
        {
            url: 'https://images.pexels.com/photos/7511702/pexels-photo-7511702.jpeg',
            caption: 'Cama con respaldo tapizado',
            description: 'Habitación con cama de respaldo blando junto a mesa de luz blanca'
        },
        {
            url: 'https://images.pexels.com/photos/3144580/pexels-photo-3144580.jpeg',
            caption: 'Dormitorio elegante',
            description: 'Habitación de diseño con iluminación tenue y ropa de cama prolija'
        },
        {
            url: 'https://images.pexels.com/photos/30457596/pexels-photo-30457596.jpeg',
            caption: 'Habitación acogedora',
            description: 'Dormitorio cálido con ropa de cama suave y luz tenue para descansar'
        },
        {
            url: 'https://images.pexels.com/photos/35236655/pexels-photo-35236655.jpeg',
            caption: 'Habitación con escritorio',
            description:
                'Dormitorio moderno con escritorio de madera y placard en habitación amplia'
        },
        {
            url: 'https://images.pexels.com/photos/36710323/pexels-photo-36710323.jpeg',
            caption: 'Habitación minimalista',
            description: 'Dormitorio minimalista con cama prolija y ventanas amplias'
        },
        {
            url: 'https://images.pexels.com/photos/36411723/pexels-photo-36411723.jpeg',
            caption: 'Habitación en tonos neutros',
            description: 'Dormitorio elegante con decoración en tonos neutros y cama mullida'
        },
        {
            url: 'https://images.pexels.com/photos/10917522/pexels-photo-10917522.jpeg',
            caption: 'Cama con dosel',
            description: 'Cama con dosel de tela blanca en dormitorio luminoso y ordenado'
        },
        {
            url: 'https://images.pexels.com/photos/11327757/pexels-photo-11327757.jpeg',
            caption: 'Dormitorio minimal',
            description: 'Dormitorio con decoración mínima, cama bien armada y luz natural'
        },
        {
            url: 'https://images.pexels.com/photos/6438756/pexels-photo-6438756.jpeg',
            caption: 'Habitación espaciosa',
            description: 'Dormitorio amplio con cama mullida y mobiliario en madera clara'
        },
        {
            url: 'https://images.pexels.com/photos/33619684/pexels-photo-33619684.jpeg',
            caption: 'Dormitorio con estilo',
            description: 'Habitación con interior moderno y detalles de decoración cuidados'
        },
        {
            url: 'https://images.pexels.com/photos/35430054/pexels-photo-35430054.jpeg',
            caption: 'Dormitorio con madera',
            description: 'Habitación acogedora con mobiliario de madera y luz cálida'
        },
        {
            url: 'https://images.pexels.com/photos/31538824/pexels-photo-31538824.jpeg',
            caption: 'Habitación con macramé',
            description: 'Dormitorio acogedor con luz cálida y detalles de macramé en la pared'
        },
        {
            url: 'https://images.pexels.com/photos/31538818/pexels-photo-31538818.jpeg',
            caption: 'Dormitorio cálido',
            description: 'Habitación acogedora con luz cálida en ambiente sereno para descansar'
        },
        {
            url: 'https://images.pexels.com/photos/545012/pexels-photo-545012.jpeg',
            caption: 'Mesa de luz con lámpara',
            description: 'Cama blanca con mesa de luz y lámpara de cobre en habitación serena'
        },
        {
            url: 'https://images.pexels.com/photos/16436957/pexels-photo-16436957.jpeg',
            caption: 'Habitación rústica',
            description:
                'Dormitorio con diseño rústico iluminado por luz cálida y mobiliario de madera'
        },
        {
            url: 'https://images.pexels.com/photos/14580423/pexels-photo-14580423.jpeg',
            caption: 'Habitación con almohadones',
            description: 'Dormitorio acogedor con almohadones y obras de arte sobre la pared'
        },
        {
            url: 'https://images.pexels.com/photos/4119845/pexels-photo-4119845.jpeg',
            caption: 'Habitación limpia',
            description: 'Cama prolija en habitación limpia, ordenada y lista para huéspedes'
        }
    ]
} as const;
