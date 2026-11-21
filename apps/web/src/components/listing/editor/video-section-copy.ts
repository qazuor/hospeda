/**
 * @file video-section-copy.ts
 * @description The i18n keys (with Spanish fallbacks) of the shared video
 * widget, one set per owner-facing surface (HOS-2258).
 *
 * The accommodation editor keeps its original `host.properties.editor.video.*`
 * keys; the venue editor uses `listing.owner.editor.video.*`. Every key is a
 * string literal on purpose: the i18n key-usage guards read the source, and a
 * key assembled from a prefix would be invisible to them.
 */

/** Which surface the widget renders for. */
export type VideoCopyScope = 'accommodation' | 'listing';

/** One translatable string: its key and its Spanish fallback. */
export interface CopyEntry {
    readonly key: string;
    readonly fallback: string;
}

/** Every string the video widget and its hook render. */
export interface VideoSectionCopy {
    readonly sectionTitle: CopyEntry;
    readonly sectionDescription: CopyEntry;
    readonly empty: CopyEntry;
    readonly urlLabel: CopyEntry;
    readonly urlPlaceholder: CopyEntry;
    readonly captionLabel: CopyEntry;
    readonly addButton: CopyEntry;
    readonly saveButton: CopyEntry;
    readonly removeAria: CopyEntry;
    readonly urlInvalid: CopyEntry;
    readonly captionInvalid: CopyEntry;
    readonly saveSuccess: CopyEntry;
    readonly saveFailed: CopyEntry;
    readonly forbidden: CopyEntry;
    readonly tooMany: CopyEntry;
    readonly network: CopyEntry;
    readonly noChanges: CopyEntry;
    readonly saving: CopyEntry;
    readonly unsavedChanges: CopyEntry;
}

const ACCOMMODATION_COPY: VideoSectionCopy = {
    sectionTitle: { key: 'host.properties.editor.video.sectionTitle', fallback: 'Videos' },
    sectionDescription: {
        key: 'host.properties.editor.video.sectionDescription',
        fallback:
            'Agregá enlaces a videos de YouTube, Vimeo o Dailymotion que muestren tu propiedad.'
    },
    empty: {
        key: 'host.properties.editor.video.empty',
        fallback: 'Todavía no cargaste ningún video.'
    },
    urlLabel: { key: 'host.properties.editor.video.urlLabel', fallback: 'Enlace del video' },
    urlPlaceholder: {
        key: 'host.properties.editor.video.urlPlaceholder',
        fallback: 'https://youtube.com/watch?v=...'
    },
    captionLabel: {
        key: 'host.properties.editor.video.captionLabel',
        fallback: 'Título (opcional)'
    },
    addButton: { key: 'host.properties.editor.video.addButton', fallback: 'Agregar video' },
    saveButton: { key: 'host.properties.editor.video.saveButton', fallback: 'Guardar videos' },
    removeAria: {
        key: 'host.properties.editor.video.removeAria',
        fallback: 'Eliminar video {{index}}'
    },
    urlInvalid: {
        key: 'host.properties.editor.video.urlInvalid',
        fallback: 'Ingresá una URL de video válida'
    },
    captionInvalid: {
        key: 'host.properties.editor.video.captionInvalid',
        fallback: 'El título debe tener entre 3 y 100 caracteres, o dejalo vacío'
    },
    saveSuccess: { key: 'host.properties.editor.video.saveSuccess', fallback: 'Videos guardados' },
    saveFailed: {
        key: 'host.properties.editor.video.saveFailed',
        fallback: 'No se pudieron guardar los videos'
    },
    // An accommodation has no per-plan video gate in the editor; these two are
    // never reached, they only keep the record total.
    forbidden: {
        key: 'host.properties.editor.video.saveFailed',
        fallback: 'No se pudieron guardar los videos'
    },
    tooMany: {
        key: 'host.properties.editor.video.saveFailed',
        fallback: 'No se pudieron guardar los videos'
    },
    network: { key: 'host.properties.editor.error.network', fallback: 'Error de conexión' },
    noChanges: {
        key: 'host.properties.editor.toast.noChanges',
        fallback: 'No hay cambios para guardar'
    },
    saving: { key: 'host.properties.editor.action.saving', fallback: 'Guardando...' },
    unsavedChanges: {
        key: 'host.properties.editor.unsavedChanges',
        fallback: 'Tenés cambios sin guardar. Si salís ahora se pierden. ¿Querés salir igual?'
    }
};

const LISTING_COPY: VideoSectionCopy = {
    sectionTitle: { key: 'listing.owner.editor.video.sectionTitle', fallback: 'Videos' },
    sectionDescription: {
        key: 'listing.owner.editor.video.sectionDescription',
        fallback: 'Agregá enlaces a videos de YouTube, Vimeo o Dailymotion que muestren tu local.'
    },
    empty: {
        key: 'listing.owner.editor.video.empty',
        fallback: 'Todavía no cargaste ningún video.'
    },
    urlLabel: { key: 'listing.owner.editor.video.urlLabel', fallback: 'Enlace del video' },
    urlPlaceholder: {
        key: 'listing.owner.editor.video.urlPlaceholder',
        fallback: 'https://youtube.com/watch?v=...'
    },
    captionLabel: {
        key: 'listing.owner.editor.video.captionLabel',
        fallback: 'Título (opcional)'
    },
    addButton: { key: 'listing.owner.editor.video.addButton', fallback: 'Agregar video' },
    saveButton: { key: 'listing.owner.editor.video.saveButton', fallback: 'Guardar videos' },
    removeAria: {
        key: 'listing.owner.editor.video.removeAria',
        fallback: 'Eliminar video {{index}}'
    },
    urlInvalid: {
        key: 'listing.owner.editor.video.urlInvalid',
        fallback: 'Ingresá una URL de video válida'
    },
    captionInvalid: {
        key: 'listing.owner.editor.video.captionInvalid',
        fallback: 'El título debe tener entre 3 y 100 caracteres, o dejalo vacío'
    },
    saveSuccess: { key: 'listing.owner.editor.video.saveSuccess', fallback: 'Videos guardados' },
    saveFailed: {
        key: 'listing.owner.editor.video.saveFailed',
        fallback: 'No se pudieron guardar los videos'
    },
    forbidden: {
        key: 'listing.owner.editor.video.forbidden',
        fallback: 'Tu plan no incluye videos. No se guardó nada.'
    },
    tooMany: {
        key: 'listing.owner.editor.video.tooMany',
        fallback: 'Podés cargar hasta 6 videos.'
    },
    network: { key: 'listing.owner.editor.video.network', fallback: 'Error de conexión' },
    noChanges: {
        key: 'listing.owner.editor.video.noChanges',
        fallback: 'No hay cambios para guardar'
    },
    saving: { key: 'listing.owner.editor.video.saving', fallback: 'Guardando...' },
    unsavedChanges: {
        key: 'listing.owner.editor.video.unsavedChanges',
        fallback: 'Tenés cambios sin guardar. Si salís ahora se pierden. ¿Querés salir igual?'
    }
};

const COPY_BY_SCOPE: Readonly<Record<VideoCopyScope, VideoSectionCopy>> = {
    accommodation: ACCOMMODATION_COPY,
    listing: LISTING_COPY
};

/**
 * Returns the copy set of one surface.
 *
 * @param params - The surface the widget renders for.
 * @returns Its keys and Spanish fallbacks.
 */
export function getVideoSectionCopy({
    scope
}: {
    readonly scope: VideoCopyScope;
}): VideoSectionCopy {
    return COPY_BY_SCOPE[scope];
}
