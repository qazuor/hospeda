/**
 * @file constructor.mjs
 * @description Builds the ChatGPT image prompts for the sales kit. The section
 * layout (shortcuts, IMÁGENES ADJUNTAS, IMAGEN, TEXTOS, ESTRUCTURA, MEDIDAS
 * FIJAS, TIPOGRAFÍA, DIRECCIÓN DE ARTE, ESTILO) mirrors the "Flyers de venta"
 * artifact so both families of prompts behave the same in the custom GPT.
 *
 * Every piece asks for the logo again before each new image: the logo drifts
 * image after image unless the original file is attached every time.
 */

/** Sales WhatsApp printed on every piece. */
export const PHONE = '3442 47-0650';

/** Badge carried by the pieces that try to sign up a new business. */
export const BADGE = '30 días de prueba gratis · Sin tarjeta';

const SC_HEAD = '/herooffer-minimal + /brand-illustration + /anti-slop + /no-ai-slop';

/** Canvas measures per ratio. 2:3 is the PDF page, 3:2 the printable card. */
const RATIO = {
    '4:5': {
        w: 1080,
        h: 1350,
        side: 56,
        top: 56,
        right: 56,
        bottomFree: 0,
        iso: 88,
        word: 44,
        badgeH: 72,
        badgeF: 28,
        barH: 150,
        pad: 64,
        cta: 40,
        ctaPhone: 34,
        phone: 50,
        icon: 52,
        title: 80,
        titleMin: 64,
        body: 34,
        tag: 44
    },
    '9:16': {
        w: 1080,
        h: 1920,
        side: 56,
        top: 250,
        right: 180,
        bottomFree: 420,
        iso: 96,
        word: 48,
        badgeH: 76,
        badgeF: 30,
        barH: 160,
        pad: 64,
        cta: 42,
        ctaPhone: 36,
        phone: 52,
        icon: 54,
        title: 96,
        titleMin: 76,
        body: 40,
        tag: 52
    },
    '2:3': {
        w: 1080,
        h: 1620,
        side: 72,
        top: 72,
        right: 72,
        bottomFree: 0,
        iso: 72,
        word: 36,
        badgeH: 60,
        badgeF: 24,
        barH: 110,
        pad: 72,
        cta: 30,
        ctaPhone: 28,
        phone: 36,
        icon: 40,
        title: 64,
        titleMin: 48,
        body: 28,
        tag: 36
    },
    '3:2': {
        w: 1620,
        h: 1080,
        side: 80,
        top: 80,
        right: 80,
        bottomFree: 0,
        iso: 110,
        word: 56,
        badgeH: 0,
        badgeF: 0,
        barH: 0,
        pad: 80,
        cta: 40,
        ctaPhone: 36,
        phone: 44,
        icon: 46,
        title: 76,
        titleMin: 60,
        body: 34,
        tag: 44
    }
};

const LOGO_LINE =
    '- Logo de Hospeda (isotipo: forma azul de río, franja verde y turquesa, círculo naranja de sol, y la palabra "hospeda"). Usalo tal cual: no lo redibujes ni le cambies los colores.';

const HOSPEDIN_LINE =
    '- Hospedín, la mascota (imagen y guías del personaje). Respetalo exactamente y no lo rediseñes: cabeza azul #3AA7D9 orgánica y asimétrica, franja turquesa #1EA7A1 y verde #8CC63F en la parte baja del rostro, círculo naranja #F5A623 flotando separado arriba a la derecha de la cabeza (nunca lo omitas), buzo canguro blanco con el logo y la palabra "hospeda", zapatillas blancas.';

const LOGO_EACH =
    'EL LOGO EN CADA IMAGEN: antes de generar cualquier imagen a partir de la segunda (otra página, otra placa, otro formato o una corrección de la misma), pedime que te adjunte de nuevo el logo de Hospeda y esperá a que lo haga. Usá siempre ese archivo original, tal cual, nunca el logo de una imagen anterior: no lo redibujes, no lo deformes ni le cambies proporciones, colores o tipografía.';

const CAPTURE_RULE =
    'Si adjunté la captura, usala tal cual dentro de la pantalla, sin redibujarla, sin traducirla y sin cambiarle datos. Si NO adjunté ninguna, no inventes una interfaz: dejá la pantalla como un rectángulo liso #DFECF8 con la palabra CAPTURA centrada en gris, para reemplazarla después. El texto de la pantalla puede verse chico, pero nunca compite con el título.';

const ART_DIRECTION = `Priorizá una jerarquía visual muy clara: primero se lee el título, después la insignia o la frase de valor, después los beneficios y por último el contacto.
El logo se ve bien, pero sin competir con el título.
La composición es limpia, aireada y se entiende en 3 segundos.
Separá bien la ilustración o la mascota del texto, para que no compitan.
Fondo atractivo pero simple, con el entorno más suave o desenfocado para que el texto se lea.
Si aparece Hospedín, que esté bien integrado, con una pose amigable y clara, aportando calidez sin tapar ni ensuciar la lectura.
Los beneficios van en bloques o tarjetas claras, con íconos simples de línea, texto corto y muy buena legibilidad en celular.
El pie funciona como CTA claro: el sitio web y el número de WhatsApp se leen rápido y con alto contraste.
Estilo minimalista, profesional, moderno y cálido, con pocos elementos, mucho aire y sin texto extra.
Todo está optimizado para verse en un celular, sobre todo en WhatsApp.`;

const TYPOGRAPHY =
    'TIPOGRAFÍA\nLas de la web de Hospeda: Geologica para títulos, logo, insignia y barra; Caveat solo para la tag line; Roboto para subtítulo, cuerpo e ítems. Si no tenés alguna, usá la sans-serif más parecida. Ninguna otra tipografía manuscrita, serif ni decorativa.';

const STYLE =
    'ESTILO\nPaleta de Hospeda: azules #0066EF, #2493B6 y #3AA7D9; turquesa #1EA7A1; naranjas #FC8102 y #F5A623; verdes #076C05 y #8CC63F; claros #DFECF8, #FED9AB y #CCE7C3; azul oscuro #0D2B3E para texto y barra. Íconos de línea simples, estilo Phosphor. Luz cálida del Litoral: río, costa, verde. Nada de montañas, nieve, mar ni playas tropicales. Sin montos ni signos de pesos (salvo que esta pieza los pida expresamente en TEXTOS), sin cupones, sin marcas que no estén nombradas acá y sin ningún texto extra.';

/**
 * Formats the fixed measures for one ratio.
 * @param {{ ratio: string, withPhone: boolean, withBadge: boolean, page?: boolean }} input
 * @returns {string}
 */
const measures = ({ ratio, withPhone, withBadge, page = false }) => {
    const m = RATIO[ratio];
    const out = [`Formato ${ratio}: lienzo de ${m.w}x${m.h} px.`];
    out.push(
        `- Márgenes de seguridad: ${m.side} px a la izquierda, ${m.right} px a la derecha y ${m.top} px arriba. Ningún texto ni elemento importante por fuera de ellos.`
    );
    out.push(
        `- Logo: arriba a la izquierda, a ${m.top} px del borde superior y a ${m.side} px del izquierdo. Isotipo de ${m.iso} px de alto; a su derecha, a ${Math.round(m.iso / 5.5)} px y centrada con el isotipo, la palabra "hospeda" en minúsculas, Geologica Bold de ${m.word} px, color #0D2B3E (blanco sobre fondo oscuro o foto).`
    );
    if (withBadge && m.badgeH) {
        out.push(
            `- Insignia: arriba a la derecha, a ${m.top} px del borde superior y a ${m.right} px del derecho. Píldora de ${m.badgeH} px de alto, fondo #F5A623, texto Geologica Bold de ${m.badgeF} px color #0D2B3E.`
        );
    }
    if (m.barH) {
        const barTop = m.h - m.bottomFree - m.barH;
        const free = m.bottomFree
            ? ` Los ${m.bottomFree} px de abajo de la barra quedan sin texto: la interfaz de los estados y las historias los tapa. Ahí sigue el fondo de la pieza.`
            : ' Pegada al borde inferior.';
        const content = withPhone
            ? `A la izquierda, el CTA en Geologica Bold de ${m.ctaPhone} px, blanco, en hasta 2 líneas. A la derecha, el ícono de WhatsApp de ${m.icon} px (verde #25D366) y, a ${Math.round(m.icon / 4)} px, "${PHONE}" en Geologica Bold de ${m.phone} px, blanco.`
            : `El CTA centrado, en Geologica Bold de ${m.cta} px, blanco, en hasta 2 líneas.`;
        const pageNo = page
            ? ' En el extremo derecho de la barra, a 24 px del teléfono, el número de página en Roboto de 24 px, blanco al 70%.'
            : '';
        out.push(
            `- Barra de contacto: todo el ancho (${m.w} px), ${m.barH} px de alto, fondo #0D2B3E sólido sin degradado ni sombra, desde y=${barTop} hasta y=${barTop + m.barH} px.${free} Padding de ${m.pad} px a la izquierda y ${Math.max(m.pad, m.right)} px a la derecha. ${content}${pageNo} Nada de la imagen se superpone con la barra.`
        );
    }
    out.push(
        `- Título: Geologica ExtraBold (800), ${m.title} px, interlineado 1.05, máximo 3 líneas; si no entra, bajalo hasta ${m.titleMin} px, nunca menos.`
    );
    out.push(
        `- Tag line: Caveat Bold, ${m.tag} px. Subtítulo: Roboto Medium, ${Math.round(m.body * 1.1)} px. Cuerpo e ítems: Roboto, ${m.body} px.`
    );
    return out.join('\n');
};

/**
 * Formats the TEXTOS lines of one image.
 * @param {{ texts: object, withPhone: boolean, withBadge: boolean, indicator?: string }} input
 * @returns {string[]}
 */
const textLines = ({ texts, withPhone, withBadge, indicator }) => {
    const t = texts || {};
    const out = [];
    if (t.tag) out.push(`- Tag line (chica, arriba del título): "${t.tag}"`);
    if (t.title) out.push(`- Título: "${t.title}"`);
    if (t.subtitle) out.push(`- Subtítulo: "${t.subtitle}"`);
    if (t.body) out.push(`- Cuerpo: "${t.body}"`);
    if (t.items?.length) {
        out.push(`- ${t.itemsLabel || 'Ítems, cada uno en su bloque con un ícono simple'}:`);
        for (const it of t.items) out.push(`  ✓ ${it}`);
    }
    if (t.value) out.push(`- Frase de valor (destacado secundario): "${t.value}"`);
    if (t.extra) out.push(...t.extra);
    if (indicator) out.push(`- Indicador de posición, chico, arriba a la derecha: "${indicator}"`);
    if (withBadge) out.push(`- Insignia: "${BADGE}"`);
    if (t.cta) {
        out.push(
            `- CTA en la barra de contacto: "${t.cta}"${/hospeda\.com\.ar/i.test(t.cta) ? '' : ' y, debajo, "hospeda.com.ar"'}`
        );
    }
    if (withPhone && t.cta) out.push(`- En la barra, a la derecha: "${PHONE}"`);
    return out;
};

/**
 * Builds the IMAGEN block for one image.
 * @param {{ img?: string, capture?: string, photo?: string, hospedin: boolean }} input
 * @returns {string}
 */
const imageBlock = ({ img, capture, photo, hospedin }) => {
    const out = [];
    if (photo) {
        out.push(
            `Esta imagen va con una FOTO REAL: ${photo}\nUsá la foto adjunta tal cual como imagen principal. Podés recortarla, ajustar el color, desenfocar el fondo u oscurecerla para que se lea el texto, pero no inventes ni agregues nada. Si no adjunté ninguna foto, no la generes: pedímela y esperá.`
        );
    }
    if (img) out.push(img);
    if (!img && !photo)
        out.push(
            'Fondo liso de un color claro de la paleta, sin foto, con a lo sumo un ícono simple de línea (estilo Phosphor).'
        );
    out.push(
        hospedin
            ? 'Integrá a Hospedín como se indica, sin tapar ni ensuciar el texto.'
            : 'No incluyas a Hospedín.'
    );
    if (capture) {
        out.push(
            `SCREENSHOT EN PANTALLA: la pantalla del celular o de la computadora muestra ${capture}\n${CAPTURE_RULE}`
        );
    }
    return out.join('\n');
};

/**
 * Lists what has to be attached for a piece (logo always first).
 * @param {object} p piece
 * @returns {string[]}
 */
export const attachmentsOf = (p) => {
    const out = [LOGO_LINE];
    const units = p.pages || p.slides || [p];
    if (p.hospedin || units.some((u) => u.hospedin)) out.push(HOSPEDIN_LINE);
    units.forEach((u, i) => {
        const where = units.length > 1 ? ` (para la ${p.pages ? 'página' : 'placa'} ${i + 1})` : '';
        if (u.capture)
            out.push(
                `- Captura real de Hospeda, sacada con una cuenta de anfitrión: ${u.capture}${where}`
            );
        if (u.photo) out.push(`- Foto real: ${u.photo}${where}`);
    });
    if (p.attach) out.push(...p.attach.map((a) => `- ${a}`));
    return out;
};

/**
 * Builds the prompt of a single-image piece (placa, listado or tarjeta).
 * @param {object} p piece
 * @returns {string}
 */
const buildSingle = (p) => {
    const rs = p.formats;
    const withPhone = p.phone !== false;
    const withBadge = Boolean(p.badge);
    const t = [`${SC_HEAD} + /BRANDPALETTE + /shallowdepth + ${p.sc}`];
    t.push(
        `Diseñá la pieza "${p.name}" del material de venta de Hospeda, el portal turístico del Litoral argentino (hospeda.com.ar). Un vendedor la manda por WhatsApp, Instagram o mail a ${p.audience}. Formato principal: ${rs[0]}.`
    );
    t.push(`IMÁGENES ADJUNTAS\n${attachmentsOf(p).join('\n')}`);
    t.push(`IMAGEN\n${imageBlock(p)}`);
    t.push(`IDEA DE COMPOSICIÓN (respetala mientras no choque con las medidas fijas)\n${p.comp}`);
    t.push(
        `TEXTOS (escribilos exactamente así, en español, sin agregar ni cambiar palabras)\n${textLines({ texts: p.texts, withPhone, withBadge }).join('\n')}`
    );
    t.push(
        `ESTRUCTURA\n${p.structure || 'Es una sola imagen con los textos de arriba.'}\n${LOGO_EACH}`
    );
    t.push(
        `MEDIDAS FIJAS (iguales en todas las piezas de la serie)\n${p.measures || measures({ ratio: rs[0], withPhone, withBadge })}`
    );
    if (rs.length > 1) {
        t.push(
            `OTROS FORMATOS\nCuando la pieza esté lista, te voy a pedir «ahora en ${rs.slice(1).join(' y después en ')}». Antes de cada uno, pedime de nuevo el logo. Reacomodá la misma pieza con estas medidas, sin cambiar textos, colores ni estilo:\n${rs
                .slice(1)
                .map((r) => measures({ ratio: r, withPhone, withBadge }))
                .join('\n\n')}`
        );
    }
    t.push(TYPOGRAPHY, `DIRECCIÓN DE ARTE\n${ART_DIRECTION}`, STYLE);
    return t.join('\n\n');
};

/**
 * Builds the prompt of a multi-image piece: a carousel (slides) or a PDF (pages).
 * One prompt, generated one image at a time on «siguiente».
 * @param {object} p piece
 * @returns {string}
 */
const buildMulti = (p) => {
    const isPdf = Boolean(p.pages);
    const units = p.pages || p.slides;
    const n = units.length;
    const word = isPdf ? 'página' : 'placa';
    const Word = isPdf ? 'PÁGINA' : 'PLACA';
    const ratio = p.formats[0];
    const withPhone = p.phone !== false;
    const t = [`${SC_HEAD} + /BRANDPALETTE + /shallowdepth + ${p.sc}`];
    t.push(
        isPdf
            ? `Diseñá el documento "${p.name}" (${n} páginas) del material de venta de Hospeda, el portal turístico del Litoral argentino (hospeda.com.ar). Cada página es una imagen vertical ${ratio} que después se arma en un PDF. Un vendedor lo manda por WhatsApp o mail a ${p.audience}. Todas las páginas comparten exactamente el mismo diseño.`
            : `Diseñá el carrusel "${p.name}" (${n} placas) del material de venta de Hospeda, el portal turístico del Litoral argentino (hospeda.com.ar). Un vendedor lo manda por WhatsApp, Instagram o mail a ${p.audience}. Formato: ${ratio}. Es UNA sola pieza: todas las placas comparten exactamente el mismo diseño.`
    );
    t.push(`IMÁGENES ADJUNTAS\n${attachmentsOf(p).join('\n')}`);
    t.push(
        `CÓMO VAMOS A TRABAJAR\nGenerá ahora SOLO la ${word} 1. Después yo te voy a ir diciendo «siguiente» (generás la que sigue) o «${word} X de ${n}» (generás esa). Cada ${word} usa exactamente el mismo diseño, márgenes, tipografía, logo, barra de contacto, colores y estilo que la ${word} 1: solo cambia lo que indica su sección más abajo. Cada ${word} lleva su ${isPdf ? 'número de página en la barra' : 'indicador'} ("1/${n}", "2/${n}"…).${units.some((u) => u.capture || u.photo) ? ` Las capturas y fotos te las puedo adjuntar todas ahora o cada una cuando te pida su ${word}.` : ''}\n${LOGO_EACH}\nFICHA DE ESTILO: apenas generes la ${word} 1, escribime debajo una ficha corta con los valores exactos que usaste en cada elemento común (colores, tipografías, tamaños y posiciones). Antes de cada ${word} nueva, releé el SISTEMA VISUAL FIJO y esa ficha, y aplicalos sin cambiar nada. Si notás que una ${word} salió distinta en algún elemento común, decímelo y rehacela.${p.structure ? `\n${p.structure}` : ''}`
    );
    t.push(
        `SISTEMA VISUAL FIJO (idéntico en todas las ${word}s)\n${(p.system || []).map((s) => `- ${s}`).join('\n')}`
    );
    units.forEach((u, i) => {
        const withBadge = Boolean(u.badge ?? (i === 0 && p.badge));
        const lines = textLines({
            texts: u.texts,
            withPhone,
            withBadge,
            indicator: isPdf ? undefined : `${i + 1}/${n}`
        });
        if (isPdf) lines.push(`- Número de página, en la barra: "${i + 1}/${n}"`);
        t.push(
            `${Word} ${i + 1} DE ${n}: ${u.name}\nImagen: ${imageBlock({ ...u, hospedin: Boolean(u.hospedin) })}\nComposición: ${u.comp}\nTextos (exactamente así, sin agregar ni cambiar palabras):\n${lines.join('\n')}`
        );
    });
    t.push(
        `MEDIDAS FIJAS (iguales en todas las ${word}s)\n${measures({ ratio, withPhone, withBadge: Boolean(p.badge), page: isPdf })}`
    );
    t.push(TYPOGRAPHY, `DIRECCIÓN DE ARTE\n${ART_DIRECTION}`, STYLE);
    return t.join('\n\n');
};

/**
 * Builds the full prompt of any piece.
 * @param {object} p piece
 * @returns {string}
 */
export const buildPrompt = (p) => (p.pages || p.slides ? buildMulti(p) : buildSingle(p));
