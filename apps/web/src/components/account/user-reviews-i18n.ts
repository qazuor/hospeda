/**
 * Localization constants for UserReviewsList component.
 */

type LocaleKey = 'es' | 'en' | 'pt';

/** Full set of localized messages for UserReviewsList and ReviewEditForm */
export interface ReviewsMessages {
    empty: string;
    emptyAction: string;
    loading: string;
    fetchError: string;
    loadMore: string;
    ratingLabel: string;
    accommodationReview: string;
    destinationReview: string;
    editButton: string;
    deleteButton: string;
    saveButton: string;
    cancelButton: string;
    deleteConfirm: string;
    updateSuccess: string;
    updateError: string;
    deleteSuccess: string;
    deleteError: string;
    titleLabel: string;
    contentLabel: string;
    ratingEditLabel: string;
    saving: string;
    deleting: string;
}

export const TAB_LABELS: Record<
    LocaleKey,
    Record<'all' | 'accommodation' | 'destination', string>
> = {
    es: { all: 'Todas', accommodation: 'Alojamientos', destination: 'Destinos' },
    en: { all: 'All', accommodation: 'Accommodations', destination: 'Destinations' },
    pt: { all: 'Todas', accommodation: 'Acomodacoes', destination: 'Destinos' }
};

export const REVIEWS_MESSAGES: Record<LocaleKey, ReviewsMessages> = {
    es: {
        empty: 'No tienes resenas todavia',
        emptyAction: 'Visita alojamientos y destinos para dejar tus primeras resenas',
        loading: 'Cargando...',
        fetchError: 'Error al cargar las resenas',
        loadMore: 'Cargar mas',
        ratingLabel: 'Puntuacion',
        accommodationReview: 'Resena de alojamiento',
        destinationReview: 'Resena de destino',
        editButton: 'Editar resena',
        deleteButton: 'Eliminar resena',
        saveButton: 'Guardar cambios',
        cancelButton: 'Cancelar',
        deleteConfirm:
            'Esta seguro que desea eliminar esta resena? Esta accion no se puede deshacer.',
        updateSuccess: 'Resena actualizada correctamente',
        updateError: 'Error al actualizar la resena',
        deleteSuccess: 'Resena eliminada correctamente',
        deleteError: 'Error al eliminar la resena',
        titleLabel: 'Titulo',
        contentLabel: 'Comentario',
        ratingEditLabel: 'Puntuacion',
        saving: 'Guardando...',
        deleting: 'Eliminando...'
    },
    en: {
        empty: 'You have no reviews yet',
        emptyAction: 'Visit accommodations and destinations to leave your first reviews',
        loading: 'Loading...',
        fetchError: 'Error loading reviews',
        loadMore: 'Load more',
        ratingLabel: 'Rating',
        accommodationReview: 'Accommodation review',
        destinationReview: 'Destination review',
        editButton: 'Edit review',
        deleteButton: 'Delete review',
        saveButton: 'Save changes',
        cancelButton: 'Cancel',
        deleteConfirm: 'Are you sure you want to delete this review? This action cannot be undone.',
        updateSuccess: 'Review updated successfully',
        updateError: 'Error updating review',
        deleteSuccess: 'Review deleted successfully',
        deleteError: 'Error deleting review',
        titleLabel: 'Title',
        contentLabel: 'Comment',
        ratingEditLabel: 'Rating',
        saving: 'Saving...',
        deleting: 'Deleting...'
    },
    pt: {
        empty: 'Voce nao tem avaliacoes ainda',
        emptyAction: 'Visite acomodacoes e destinos para deixar suas primeiras avaliacoes',
        loading: 'Carregando...',
        fetchError: 'Erro ao carregar avaliacoes',
        loadMore: 'Carregar mais',
        ratingLabel: 'Avaliacao',
        accommodationReview: 'Avaliacao de acomodacao',
        destinationReview: 'Avaliacao de destino',
        editButton: 'Editar avaliacao',
        deleteButton: 'Excluir avaliacao',
        saveButton: 'Salvar alteracoes',
        cancelButton: 'Cancelar',
        deleteConfirm:
            'Tem certeza que deseja excluir esta avaliacao? Esta acao nao pode ser desfeita.',
        updateSuccess: 'Avaliacao atualizada com sucesso',
        updateError: 'Erro ao atualizar avaliacao',
        deleteSuccess: 'Avaliacao excluida com sucesso',
        deleteError: 'Erro ao excluir avaliacao',
        titleLabel: 'Titulo',
        contentLabel: 'Comentario',
        ratingEditLabel: 'Avaliacao',
        saving: 'Salvando...',
        deleting: 'Excluindo...'
    }
};
