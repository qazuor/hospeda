/**
 * Tests for UserReviewsList.client.tsx, account.json locale files (reviews section), and ReviewEditForm.client.tsx
 *
 * Verifies component structure, exports, props interface, localization,
 * accessibility attributes, API integration, tab navigation, star rating patterns,
 * edit/delete functionality, and the review edit form component.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
    __dirname,
    '../../../src/components/account/UserReviewsList.client.tsx'
);
const content = readFileSync(componentPath, 'utf8');

const editFormPath = resolve(
    __dirname,
    '../../../src/components/account/ReviewEditForm.client.tsx'
);
const editFormContent = readFileSync(editFormPath, 'utf8');

describe('UserReviewsList.client.tsx', () => {
    describe('Module exports', () => {
        it('should export UserReviewsList as named export', () => {
            expect(content).toContain('export function UserReviewsList(');
        });

        it('should not use default export', () => {
            expect(content).not.toContain('export default');
        });
    });

    describe('Props interface', () => {
        it('should define UserReviewsListProps interface', () => {
            expect(content).toContain('interface UserReviewsListProps');
        });

        it('should define locale prop with supported locales', () => {
            expect(content).toContain("locale: 'es' | 'en' | 'pt'");
        });
    });

    describe('Imports', () => {
        it('should import useState and useEffect from react', () => {
            expect(content).toContain('useState');
            expect(content).toContain('useEffect');
        });

        it('should import ChatIcon from @repo/icons', () => {
            expect(content).toContain('ChatIcon');
            expect(content).toContain("from '@repo/icons'");
        });

        it('should import EditIcon from @repo/icons', () => {
            expect(content).toContain('EditIcon');
        });

        it('should import DeleteIcon from @repo/icons', () => {
            expect(content).toContain('DeleteIcon');
        });

        it('should import userApi from endpoints', () => {
            expect(content).toContain(
                "import { userApi } from '../../lib/api/endpoints-protected'"
            );
        });

        it('should import addToast from toast store', () => {
            expect(content).toContain("import { addToast } from '../../store/toast-store'");
        });

        it('should import useTranslation from hooks', () => {
            expect(content).toContain('useTranslation');
        });

        it('should import SupportedLocale from lib/i18n', () => {
            expect(content).toContain('SupportedLocale');
        });

        it('should import ReviewEditForm', () => {
            expect(content).toContain('ReviewEditForm');
            expect(content).toContain("from './ReviewEditForm.client'");
        });

        it('should import apiClient', () => {
            expect(content).toContain('apiClient');
        });
    });

    describe('Internal types', () => {
        it('should define ReviewType union type', () => {
            expect(content).toContain("type ReviewType = 'all' | 'accommodation' | 'destination'");
        });

        it('should define ReviewItem interface with id field', () => {
            expect(content).toContain('id: string');
        });

        it('should define ReviewItem interface with rating field', () => {
            expect(content).toContain('rating: number');
        });

        it('should define ReviewItem interface with title field', () => {
            expect(content).toContain('title: string');
        });

        it('should define ReviewItem interface with content field', () => {
            expect(content).toContain('content: string');
        });

        it('should define ReviewItem interface with createdAt field', () => {
            expect(content).toContain('createdAt: string');
        });

        it('should define ReviewItem interface with updatedAt field', () => {
            expect(content).toContain('updatedAt: string');
        });

        it('should define optional accommodationId on ReviewItem', () => {
            expect(content).toContain('accommodationId?: string');
        });

        it('should define optional destinationId on ReviewItem', () => {
            expect(content).toContain('destinationId?: string');
        });

        it('should define TabConfig interface', () => {
            expect(content).toContain('interface TabConfig');
        });
    });

    describe('Tab navigation', () => {
        it('should initialize activeTab to all', () => {
            expect(content).toContain("useState<ReviewType>('all')");
        });

        it('should have all 3 tabs defined', () => {
            expect(content).toContain("{ id: 'all'");
            expect(content).toContain("{ id: 'accommodation'");
            expect(content).toContain("{ id: 'destination'");
        });

        it('should use t for all tab label', () => {
            expect(content).toContain("t('reviews.tabs.all')");
        });

        it('should use t for accommodation tab label', () => {
            expect(content).toContain("t('reviews.tabs.accommodation')");
        });

        it('should use t for destination tab label', () => {
            expect(content).toContain("t('reviews.tabs.destination')");
        });

        it('should have handleTabChange function', () => {
            expect(content).toContain('const handleTabChange = (tabId: ReviewType)');
        });

        it('should reset reviews when tab changes', () => {
            expect(content).toContain('setReviews([])');
        });

        it('should reset page to 1 on tab change', () => {
            expect(content).toContain('setPage(1)');
        });

        it('should fetch reviews when activeTab changes via useEffect', () => {
            expect(content).toContain('useEffect(() => {');
            expect(content).toContain('}, [activeTab])');
        });
    });

    describe('Accessibility', () => {
        it('should have tablist role on nav element', () => {
            expect(content).toContain('role="tablist"');
        });

        it('should have aria-label on tablist nav', () => {
            expect(content).toContain("aria-label={tUi('accessibility.reviewCategories')}");
        });

        it('should have tab role on tab buttons', () => {
            expect(content).toContain('role="tab"');
        });

        it('should have aria-selected on tab buttons', () => {
            expect(content).toContain('aria-selected={activeTab === tab.id}');
        });

        it('should have aria-controls on tab buttons', () => {
            expect(content).toContain('aria-controls={`panel-${tab.id}`}');
        });

        it('should have tabpanel role on content panel', () => {
            expect(content).toContain('role="tabpanel"');
        });

        it('should have aria-labelledby on tabpanel', () => {
            expect(content).toContain('aria-labelledby={`tab-${activeTab}`}');
        });
    });

    describe('Star rating component', () => {
        it('should define StarRating function component', () => {
            expect(content).toContain('function StarRating(');
        });

        it('should accept rating and label props', () => {
            expect(content).toContain('rating: number; label: string');
        });

        it('should render 5 stars maximum', () => {
            expect(content).toContain('const maxStars = 5');
        });

        it('should use Array.from to generate stars', () => {
            expect(content).toContain('Array.from({ length: maxStars }');
        });

        it('should add aria-label with rating value', () => {
            expect(content).toContain('aria-label={`${label}: ${rating}/${maxStars}`}');
        });

        it('should mark individual star spans as aria-hidden', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should have sr-only span for screen reader rating', () => {
            expect(content).toContain('className="sr-only"');
        });

        it('should color filled stars yellow and empty stars with muted token', () => {
            expect(content).toContain('text-star');
            expect(content).toContain('text-text-tertiary');
        });

        it('should use star character entity', () => {
            expect(content).toContain('&#9733;');
        });
    });

    describe('API integration', () => {
        it('should call userApi.getReviews to fetch reviews', () => {
            expect(content).toContain('userApi.getReviews(');
        });

        it('should pass type (activeTab) to getReviews', () => {
            expect(content).toContain('type: activeTab');
        });

        it('should pass pageSize of 10 to getReviews', () => {
            expect(content).toContain('pageSize: 10');
        });

        it('should define fetchReviews function using useCallback', () => {
            expect(content).toContain('const fetchReviews = useCallback(');
        });

        it('should handle fetch error with t call', () => {
            expect(content).toContain("t('reviews.fetchError')");
        });

        it('should check result.ok before processing data', () => {
            expect(content).toContain('if (result.ok && result.data)');
        });
    });

    describe('Review merging', () => {
        it('should define mergeReviews function', () => {
            expect(content).toContain('function mergeReviews(');
        });

        it('should accept accommodation and destination reviews', () => {
            expect(content).toContain('accReviews: Record<string, unknown>[]');
            expect(content).toContain('destReviews: Record<string, unknown>[]');
        });

        it('should sort merged reviews by createdAt descending', () => {
            expect(content).toContain(
                'new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()'
            );
        });

        it('should map accommodationId from accommodation reviews', () => {
            expect(content).toContain('accommodationId: r.accommodationId as string');
        });

        it('should map destinationId from destination reviews', () => {
            expect(content).toContain('destinationId: r.destinationId as string');
        });
    });

    describe('Totals and pagination', () => {
        it('should define totals state with accommodation and destination counts', () => {
            expect(content).toContain('accommodationReviews: 0');
            expect(content).toContain('destinationReviews: 0');
            expect(content).toContain('total: 0');
        });

        it('should compute currentTotal based on active tab', () => {
            expect(content).toContain('const currentTotal =');
            expect(content).toContain("activeTab === 'all'");
            expect(content).toContain("activeTab === 'accommodation'");
        });

        it('should compute hasMore from reviews length vs currentTotal', () => {
            expect(content).toContain('const hasMore = reviews.length < currentTotal');
        });

        it('should show load more button when hasMore is true', () => {
            expect(content).toContain('{hasMore && !isLoading && (');
        });

        it('should define handleLoadMore function', () => {
            expect(content).toContain('const handleLoadMore = (e: FormEvent)');
        });

        it('should prevent default on load more click', () => {
            expect(content).toContain('e.preventDefault()');
        });
    });

    describe('Loading and empty states', () => {
        it('should show loading state when isLoading and no reviews', () => {
            expect(content).toContain('{isLoading && reviews.length === 0 && (');
        });

        it('should show empty state when not loading and no reviews', () => {
            expect(content).toContain('{!isLoading && reviews.length === 0 && (');
        });

        it('should show ChatIcon in empty state', () => {
            expect(content).toContain('<ChatIcon');
        });

        it('should show empty message text via t call', () => {
            expect(content).toContain("t('reviews.empty')");
        });

        it('should show empty action text via t call', () => {
            expect(content).toContain("t('reviews.emptyAction')");
        });

        it('should show loading spinner animation', () => {
            expect(content).toContain('animate-spin');
        });

        it('should show loading text via t call', () => {
            expect(content).toContain("t('reviews.loading')");
        });

        it('should show inline loading indicator when loading more', () => {
            expect(content).toContain('{isLoading && reviews.length > 0 && (');
        });
    });

    describe('Review list rendering', () => {
        it('should use review.id as key', () => {
            expect(content).toContain('key={review.id}');
        });

        it('should show reviews list when reviews exist', () => {
            expect(content).toContain('{reviews.length > 0 && (');
        });

        it('should render review title', () => {
            expect(content).toContain('{review.title}');
        });

        it('should render review content', () => {
            expect(content).toContain('{review.content}');
        });

        it('should render review date formatted using formatDate from @repo/i18n', () => {
            expect(content).toContain('formatDate');
            expect(content).toContain("from '@repo/i18n'");
            expect(content).toContain('date: review.createdAt');
        });

        it('should use StarRating component for each review', () => {
            expect(content).toContain('<StarRating');
        });

        it('should pass review.rating to StarRating', () => {
            expect(content).toContain('rating={review.rating}');
        });

        it('should distinguish accommodation vs destination reviews via t calls', () => {
            expect(content).toContain('review.accommodationId');
            expect(content).toContain("t('reviews.accommodationReview')");
            expect(content).toContain("t('reviews.destinationReview')");
        });
    });

    describe('Edit and delete functionality', () => {
        it('should define editingId state', () => {
            expect(content).toContain('editingId');
            expect(content).toContain('useState<string | null>(null)');
        });

        it('should define savingIds state as ReadonlySet', () => {
            expect(content).toContain('savingIds');
            expect(content).toContain('ReadonlySet<string>');
        });

        it('should define deletingIds state as ReadonlySet', () => {
            expect(content).toContain('deletingIds');
        });

        it('should render ReviewEditForm when editing', () => {
            expect(content).toContain('<ReviewEditForm');
        });

        it('should pass review to ReviewEditForm', () => {
            expect(content).toContain('review={review}');
        });

        it('should pass inline messages object to ReviewEditForm using t calls', () => {
            expect(content).toContain("t('reviews.ratingEditLabel')");
            expect(content).toContain("t('reviews.titleLabel')");
            expect(content).toContain("t('reviews.contentLabel')");
            expect(content).toContain("t('reviews.cancelButton')");
            expect(content).toContain("t('reviews.saveButton')");
            expect(content).toContain("t('reviews.saving')");
        });

        it('should pass onSave handler to ReviewEditForm', () => {
            expect(content).toContain('onSave={handleSave}');
        });

        it('should pass onCancel handler to ReviewEditForm', () => {
            expect(content).toContain('onCancel=');
        });

        it('should pass isSaving to ReviewEditForm', () => {
            expect(content).toContain('isSaving={isSaving}');
        });

        it('should define handleSave async function', () => {
            expect(content).toContain('const handleSave = async (id: string, data: EditFormState)');
        });

        it('should define handleDelete async function', () => {
            expect(content).toContain('const handleDelete = async (review: ReviewItem)');
        });

        it('should use apiClient.patch for updating reviews', () => {
            expect(content).toContain('apiClient.patch');
        });

        it('should use apiClient.delete for deleting reviews', () => {
            expect(content).toContain('apiClient.delete');
        });

        it('should use window.confirm before deleting with t call', () => {
            expect(content).toContain('window.confirm');
            expect(content).toContain("t('reviews.deleteConfirm')");
        });

        it('should show EditIcon button for each review', () => {
            expect(content).toContain('<EditIcon');
        });

        it('should show DeleteIcon button for each review', () => {
            expect(content).toContain('<DeleteIcon');
        });

        it('should show success toast after saving via t call', () => {
            expect(content).toContain("t('reviews.updateSuccess')");
        });

        it('should show success toast after deleting via t call', () => {
            expect(content).toContain("t('reviews.deleteSuccess')");
        });

        it('should update reviews list optimistically on save', () => {
            expect(content).toContain('setReviews((prev) =>');
        });

        it('should remove deleted review from reviews list', () => {
            expect(content).toContain('prev.filter((r) => r.id !== review.id)');
        });

        it('should update totals after deleting a review', () => {
            expect(content).toContain('setTotals((prev) => (');
        });

        it('should define getReviewEndpoint helper function', () => {
            expect(content).toContain('function getReviewEndpoint(');
        });

        it('should reset editingId on tab change', () => {
            expect(content).toContain('setEditingId(null)');
        });
    });

    describe('Container class', () => {
        it('should have user-reviews-list class on root', () => {
            expect(content).toContain('className="user-reviews-list"');
        });
    });
});

describe('account.json locale files - reviews section', () => {
    const esAccountPath = resolve(
        __dirname,
        '../../../../../packages/i18n/src/locales/es/account.json'
    );
    const enAccountPath = resolve(
        __dirname,
        '../../../../../packages/i18n/src/locales/en/account.json'
    );
    const ptAccountPath = resolve(
        __dirname,
        '../../../../../packages/i18n/src/locales/pt/account.json'
    );
    const esAccount = JSON.parse(readFileSync(esAccountPath, 'utf8'));
    const enAccount = JSON.parse(readFileSync(enAccountPath, 'utf8'));
    const ptAccount = JSON.parse(readFileSync(ptAccountPath, 'utf8'));

    describe('Structure', () => {
        it('should have reviews section in Spanish locale', () => {
            expect(esAccount.reviews).toBeDefined();
        });

        it('should have reviews section in English locale', () => {
            expect(enAccount.reviews).toBeDefined();
        });

        it('should have reviews section in Portuguese locale', () => {
            expect(ptAccount.reviews).toBeDefined();
        });

        it('should have tabs subsection in Spanish locale', () => {
            expect(esAccount.reviews.tabs).toBeDefined();
        });

        it('should have tabs subsection in English locale', () => {
            expect(enAccount.reviews.tabs).toBeDefined();
        });

        it('should have tabs subsection in Portuguese locale', () => {
            expect(ptAccount.reviews.tabs).toBeDefined();
        });
    });

    describe('Localization - Spanish (es)', () => {
        it('should have Spanish tab labels', () => {
            expect(esAccount.reviews.tabs.all).toBe('Todas');
            expect(esAccount.reviews.tabs.accommodation).toBe('Alojamientos');
            expect(esAccount.reviews.tabs.destination).toBe('Destinos');
        });

        it('should have Spanish empty state message', () => {
            expect(esAccount.reviews.empty).toBe('No tienes resenas todavia');
        });

        it('should have Spanish empty action message', () => {
            expect(esAccount.reviews.emptyAction).toBe(
                'Visita alojamientos y destinos para dejar tus primeras resenas'
            );
        });

        it('should have Spanish loading text', () => {
            expect(esAccount.reviews.loading).toBe('Cargando...');
        });

        it('should have Spanish fetch error message', () => {
            expect(esAccount.reviews.fetchError).toBe('Error al cargar las resenas');
        });

        it('should have Spanish load more text', () => {
            expect(esAccount.reviews.loadMore).toBe('Cargar mas');
        });

        it('should have Spanish rating label', () => {
            expect(esAccount.reviews.ratingLabel).toBe('Puntuacion');
        });

        it('should have Spanish accommodation review type label', () => {
            expect(esAccount.reviews.accommodationReview).toBe('Resena de alojamiento');
        });

        it('should have Spanish destination review type label', () => {
            expect(esAccount.reviews.destinationReview).toBe('Resena de destino');
        });

        it('should have Spanish edit button label', () => {
            expect(esAccount.reviews.editButton).toBe('Editar resena');
        });

        it('should have Spanish delete button label', () => {
            expect(esAccount.reviews.deleteButton).toBe('Eliminar resena');
        });

        it('should have Spanish delete confirmation message', () => {
            expect(esAccount.reviews.deleteConfirm).toContain(
                'Esta seguro que desea eliminar esta resena'
            );
        });

        it('should have Spanish update success message', () => {
            expect(esAccount.reviews.updateSuccess).toBe('Resena actualizada correctamente');
        });

        it('should have Spanish delete success message', () => {
            expect(esAccount.reviews.deleteSuccess).toBe('Resena eliminada correctamente');
        });

        it('should have Spanish save button label', () => {
            expect(esAccount.reviews.saveButton).toBeDefined();
        });

        it('should have Spanish saving text', () => {
            expect(esAccount.reviews.saving).toBeDefined();
        });
    });

    describe('Localization - English (en)', () => {
        it('should have English tab labels', () => {
            expect(enAccount.reviews.tabs.all).toBe('All');
            expect(enAccount.reviews.tabs.accommodation).toBe('Accommodations');
            expect(enAccount.reviews.tabs.destination).toBe('Destinations');
        });

        it('should have English empty state message', () => {
            expect(enAccount.reviews.empty).toBe('You have no reviews yet');
        });

        it('should have English loading text', () => {
            expect(enAccount.reviews.loading).toBe('Loading...');
        });

        it('should have English fetch error message', () => {
            expect(enAccount.reviews.fetchError).toBe('Error loading reviews');
        });

        it('should have English load more text', () => {
            expect(enAccount.reviews.loadMore).toBe('Load more');
        });

        it('should have English rating label', () => {
            expect(enAccount.reviews.ratingLabel).toBe('Rating');
        });

        it('should have English accommodation review type label', () => {
            expect(enAccount.reviews.accommodationReview).toBe('Accommodation review');
        });

        it('should have English destination review type label', () => {
            expect(enAccount.reviews.destinationReview).toBe('Destination review');
        });

        it('should have English edit button label', () => {
            expect(enAccount.reviews.editButton).toBe('Edit review');
        });

        it('should have English delete button label', () => {
            expect(enAccount.reviews.deleteButton).toBe('Delete review');
        });

        it('should have English delete confirmation message', () => {
            expect(enAccount.reviews.deleteConfirm).toContain(
                'Are you sure you want to delete this review'
            );
        });

        it('should have English update success message', () => {
            expect(enAccount.reviews.updateSuccess).toBe('Review updated successfully');
        });

        it('should have English delete success message', () => {
            expect(enAccount.reviews.deleteSuccess).toBe('Review deleted successfully');
        });

        it('should have English save button label', () => {
            expect(enAccount.reviews.saveButton).toBeDefined();
        });

        it('should have English saving text', () => {
            expect(enAccount.reviews.saving).toBeDefined();
        });
    });

    describe('Localization - Portuguese (pt)', () => {
        it('should have Portuguese tab labels', () => {
            expect(ptAccount.reviews.tabs.all).toBe('Todas');
            expect(ptAccount.reviews.tabs.accommodation).toBe('Acomodacoes');
            expect(ptAccount.reviews.tabs.destination).toBe('Destinos');
        });

        it('should have Portuguese empty state message', () => {
            expect(ptAccount.reviews.empty).toBe('Voce nao tem avaliacoes ainda');
        });

        it('should have Portuguese loading text', () => {
            expect(ptAccount.reviews.loading).toBe('Carregando...');
        });

        it('should have Portuguese fetch error message', () => {
            expect(ptAccount.reviews.fetchError).toBe('Erro ao carregar avaliacoes');
        });

        it('should have Portuguese load more text', () => {
            expect(ptAccount.reviews.loadMore).toBe('Carregar mais');
        });

        it('should have Portuguese edit button label', () => {
            expect(ptAccount.reviews.editButton).toBe('Editar avaliacao');
        });

        it('should have Portuguese delete button label', () => {
            expect(ptAccount.reviews.deleteButton).toBe('Excluir avaliacao');
        });

        it('should have Portuguese delete confirmation message', () => {
            expect(ptAccount.reviews.deleteConfirm).toContain(
                'Tem certeza que deseja excluir esta avaliacao'
            );
        });

        it('should have Portuguese update success message', () => {
            expect(ptAccount.reviews.updateSuccess).toBe('Avaliacao atualizada com sucesso');
        });

        it('should have Portuguese delete success message', () => {
            expect(ptAccount.reviews.deleteSuccess).toBe('Avaliacao excluida com sucesso');
        });
    });
});

describe('ReviewEditForm.client.tsx', () => {
    describe('Module exports', () => {
        it('should export ReviewEditForm as named export', () => {
            expect(editFormContent).toContain('export function ReviewEditForm(');
        });

        it('should export EditFormState interface', () => {
            expect(editFormContent).toContain('export interface EditFormState');
        });

        it('should export ReviewEditFormMessages interface', () => {
            expect(editFormContent).toContain('export interface ReviewEditFormMessages');
        });

        it('should export ReviewEditFormReview interface', () => {
            expect(editFormContent).toContain('export interface ReviewEditFormReview');
        });

        it('should not use default export', () => {
            expect(editFormContent).not.toContain('export default');
        });
    });

    describe('Imports', () => {
        it('should import useState from react', () => {
            expect(editFormContent).toContain('useState');
            expect(editFormContent).toContain("from 'react'");
        });

        it('should import SaveIcon and CancelIcon from @repo/icons', () => {
            expect(editFormContent).toContain('SaveIcon');
            expect(editFormContent).toContain('CancelIcon');
            expect(editFormContent).toContain("from '@repo/icons'");
        });
    });

    describe('EditFormState interface', () => {
        it('should have rating field', () => {
            expect(editFormContent).toContain('rating: number');
        });

        it('should have title field', () => {
            expect(editFormContent).toContain('title: string');
        });

        it('should have content field', () => {
            expect(editFormContent).toContain('content: string');
        });
    });

    describe('ReviewEditFormMessages interface', () => {
        it('should have ratingEditLabel field', () => {
            expect(editFormContent).toContain('ratingEditLabel: string');
        });

        it('should have titleLabel field', () => {
            expect(editFormContent).toContain('titleLabel: string');
        });

        it('should have contentLabel field', () => {
            expect(editFormContent).toContain('contentLabel: string');
        });

        it('should have cancelButton field', () => {
            expect(editFormContent).toContain('cancelButton: string');
        });

        it('should have saveButton field', () => {
            expect(editFormContent).toContain('saveButton: string');
        });

        it('should have saving field', () => {
            expect(editFormContent).toContain('saving: string');
        });
    });

    describe('Star rating selector', () => {
        it('should render a radiogroup for star selection', () => {
            expect(editFormContent).toContain('role="radiogroup"');
        });

        it('should render 5 star buttons using Array.from', () => {
            expect(editFormContent).toContain('Array.from({ length: 5 }');
        });

        it('should use radio role on individual star buttons', () => {
            expect(editFormContent).toContain('role="radio"');
        });

        it('should set aria-checked on star buttons', () => {
            expect(editFormContent).toContain('aria-checked={form.rating === star}');
        });

        it('should handle star rating change', () => {
            expect(editFormContent).toContain('handleRatingChange');
        });

        it('should use star character entity', () => {
            expect(editFormContent).toContain('&#9733;');
        });

        it('should color selected stars yellow', () => {
            expect(editFormContent).toContain('text-star');
        });
    });

    describe('Form fields', () => {
        it('should have title input field', () => {
            expect(editFormContent).toContain('name="title"');
        });

        it('should have content textarea field', () => {
            expect(editFormContent).toContain('name="content"');
        });

        it('should require title field', () => {
            expect(editFormContent).toContain('required');
        });

        it('should limit title to 200 characters', () => {
            expect(editFormContent).toContain('maxLength={200}');
        });

        it('should limit content to 2000 characters', () => {
            expect(editFormContent).toContain('maxLength={2000}');
        });

        it('should handle field changes with handleFieldChange', () => {
            expect(editFormContent).toContain('handleFieldChange');
        });
    });

    describe('Form actions', () => {
        it('should handle submit with handleSubmit', () => {
            expect(editFormContent).toContain('handleSubmit');
        });

        it('should prevent default on form submit', () => {
            expect(editFormContent).toContain('e.preventDefault()');
        });

        it('should call onSave with review id and form data', () => {
            expect(editFormContent).toContain('await onSave(review.id, form)');
        });

        it('should show SaveIcon in submit button', () => {
            expect(editFormContent).toContain('<SaveIcon');
        });

        it('should show CancelIcon in cancel button', () => {
            expect(editFormContent).toContain('<CancelIcon');
        });

        it('should display saving message when isSaving is true', () => {
            expect(editFormContent).toContain('messages.saving');
            expect(editFormContent).toContain('messages.saveButton');
        });

        it('should disable buttons when isSaving', () => {
            expect(editFormContent).toContain('disabled={isSaving}');
        });

        it('should call onCancel when cancel button is clicked', () => {
            expect(editFormContent).toContain('onClick={onCancel}');
        });
    });
});
