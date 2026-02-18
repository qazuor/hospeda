/**
 * Tests for UserReviewsList.client.tsx, user-reviews-i18n.ts, and ReviewEditForm.tsx
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

const i18nPath = resolve(__dirname, '../../../src/components/account/user-reviews-i18n.ts');
const i18nContent = readFileSync(i18nPath, 'utf8');

const editFormPath = resolve(__dirname, '../../../src/components/account/ReviewEditForm.tsx');
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
            expect(content).toContain("import { userApi } from '../../lib/api/endpoints'");
        });

        it('should import addToast from toast store', () => {
            expect(content).toContain("import { addToast } from '../../store/toast-store'");
        });

        it('should import TAB_LABELS and REVIEWS_MESSAGES from i18n file', () => {
            expect(content).toContain('TAB_LABELS');
            expect(content).toContain('REVIEWS_MESSAGES');
            expect(content).toContain("from './user-reviews-i18n'");
        });

        it('should import ReviewEditForm', () => {
            expect(content).toContain('ReviewEditForm');
            expect(content).toContain("from './ReviewEditForm'");
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
            expect(content).toContain('aria-label="Review categories"');
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

        it('should color filled stars yellow and empty stars gray', () => {
            expect(content).toContain('text-yellow-500');
            expect(content).toContain('text-gray-300');
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

        it('should handle fetch error with toast', () => {
            expect(content).toContain('messages.fetchError');
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
            expect(content).toContain('accommodationReviews: 0, destinationReviews: 0, total: 0');
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

        it('should show empty message text', () => {
            expect(content).toContain('{messages.empty}');
        });

        it('should show empty action text', () => {
            expect(content).toContain('{messages.emptyAction}');
        });

        it('should show loading spinner animation', () => {
            expect(content).toContain('animate-spin');
        });

        it('should show loading text during initial load', () => {
            expect(content).toContain('{messages.loading}');
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

        it('should render review date formatted', () => {
            expect(content).toContain('new Date(review.createdAt).toLocaleDateString(locale');
        });

        it('should use StarRating component for each review', () => {
            expect(content).toContain('<StarRating');
        });

        it('should pass review.rating to StarRating', () => {
            expect(content).toContain('rating={review.rating}');
        });

        it('should distinguish accommodation vs destination reviews', () => {
            expect(content).toContain('review.accommodationId');
            expect(content).toContain('messages.accommodationReview');
            expect(content).toContain('messages.destinationReview');
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

        it('should pass messages to ReviewEditForm', () => {
            expect(content).toContain('messages={messages}');
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

        it('should use window.confirm before deleting', () => {
            expect(content).toContain('window.confirm');
            expect(content).toContain('messages.deleteConfirm');
        });

        it('should show EditIcon button for each review', () => {
            expect(content).toContain('<EditIcon');
        });

        it('should show DeleteIcon button for each review', () => {
            expect(content).toContain('<DeleteIcon');
        });

        it('should show success toast after saving', () => {
            expect(content).toContain('messages.updateSuccess');
        });

        it('should show success toast after deleting', () => {
            expect(content).toContain('messages.deleteSuccess');
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

describe('user-reviews-i18n.ts', () => {
    describe('Exports', () => {
        it('should export TAB_LABELS', () => {
            expect(i18nContent).toContain('export const TAB_LABELS');
        });

        it('should export REVIEWS_MESSAGES', () => {
            expect(i18nContent).toContain('export const REVIEWS_MESSAGES');
        });

        it('should export ReviewsMessages interface', () => {
            expect(i18nContent).toContain('export interface ReviewsMessages');
        });
    });

    describe('Localization - Spanish (es)', () => {
        it('should have Spanish all tab label', () => {
            expect(i18nContent).toContain("all: 'Todas'");
        });

        it('should have Spanish accommodation tab label', () => {
            expect(i18nContent).toContain("accommodation: 'Alojamientos'");
        });

        it('should have Spanish destination tab label', () => {
            expect(i18nContent).toContain("destination: 'Destinos'");
        });

        it('should have Spanish empty state message', () => {
            expect(i18nContent).toContain('No tienes resenas todavia');
        });

        it('should have Spanish empty action message', () => {
            expect(i18nContent).toContain(
                'Visita alojamientos y destinos para dejar tus primeras resenas'
            );
        });

        it('should have Spanish loading text', () => {
            expect(i18nContent).toContain("loading: 'Cargando...'");
        });

        it('should have Spanish fetch error message', () => {
            expect(i18nContent).toContain('Error al cargar las resenas');
        });

        it('should have Spanish load more text', () => {
            expect(i18nContent).toContain("loadMore: 'Cargar mas'");
        });

        it('should have Spanish rating label', () => {
            expect(i18nContent).toContain("ratingLabel: 'Puntuacion'");
        });

        it('should have Spanish accommodation review type label', () => {
            expect(i18nContent).toContain("accommodationReview: 'Resena de alojamiento'");
        });

        it('should have Spanish destination review type label', () => {
            expect(i18nContent).toContain("destinationReview: 'Resena de destino'");
        });

        it('should have Spanish edit button label', () => {
            expect(i18nContent).toContain("editButton: 'Editar resena'");
        });

        it('should have Spanish delete button label', () => {
            expect(i18nContent).toContain("deleteButton: 'Eliminar resena'");
        });

        it('should have Spanish delete confirmation message', () => {
            expect(i18nContent).toContain('Esta seguro que desea eliminar esta resena');
        });

        it('should have Spanish update success message', () => {
            expect(i18nContent).toContain('Resena actualizada correctamente');
        });

        it('should have Spanish delete success message', () => {
            expect(i18nContent).toContain('Resena eliminada correctamente');
        });
    });

    describe('Localization - English (en)', () => {
        it('should have English all tab label', () => {
            expect(i18nContent).toContain("all: 'All'");
        });

        it('should have English accommodation tab label', () => {
            expect(i18nContent).toContain("accommodation: 'Accommodations'");
        });

        it('should have English destination tab label', () => {
            expect(i18nContent).toContain("destination: 'Destinations'");
        });

        it('should have English empty state message', () => {
            expect(i18nContent).toContain('You have no reviews yet');
        });

        it('should have English loading text', () => {
            expect(i18nContent).toContain("loading: 'Loading...'");
        });

        it('should have English fetch error message', () => {
            expect(i18nContent).toContain('Error loading reviews');
        });

        it('should have English load more text', () => {
            expect(i18nContent).toContain("loadMore: 'Load more'");
        });

        it('should have English rating label', () => {
            expect(i18nContent).toContain("ratingLabel: 'Rating'");
        });

        it('should have English accommodation review type label', () => {
            expect(i18nContent).toContain("accommodationReview: 'Accommodation review'");
        });

        it('should have English destination review type label', () => {
            expect(i18nContent).toContain("destinationReview: 'Destination review'");
        });

        it('should have English edit button label', () => {
            expect(i18nContent).toContain("editButton: 'Edit review'");
        });

        it('should have English delete button label', () => {
            expect(i18nContent).toContain("deleteButton: 'Delete review'");
        });

        it('should have English delete confirmation message', () => {
            expect(i18nContent).toContain('Are you sure you want to delete this review');
        });

        it('should have English update success message', () => {
            expect(i18nContent).toContain('Review updated successfully');
        });

        it('should have English delete success message', () => {
            expect(i18nContent).toContain('Review deleted successfully');
        });
    });

    describe('Localization - Portuguese (pt)', () => {
        it('should have Portuguese all tab label', () => {
            expect(i18nContent).toContain("all: 'Todas'");
        });

        it('should have Portuguese empty state message', () => {
            expect(i18nContent).toContain('Voce nao tem avaliacoes ainda');
        });

        it('should have Portuguese loading text', () => {
            expect(i18nContent).toContain("loading: 'Carregando...'");
        });

        it('should have Portuguese fetch error message', () => {
            expect(i18nContent).toContain('Erro ao carregar avaliacoes');
        });

        it('should have Portuguese load more text', () => {
            expect(i18nContent).toContain("loadMore: 'Carregar mais'");
        });

        it('should have Portuguese edit button label', () => {
            expect(i18nContent).toContain("editButton: 'Editar avaliacao'");
        });

        it('should have Portuguese delete button label', () => {
            expect(i18nContent).toContain("deleteButton: 'Excluir avaliacao'");
        });

        it('should have Portuguese delete confirmation message', () => {
            expect(i18nContent).toContain('Tem certeza que deseja excluir esta avaliacao');
        });
    });
});

describe('ReviewEditForm.tsx', () => {
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
            expect(editFormContent).toContain('text-yellow-500');
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
