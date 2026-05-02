/**
 * Protected user bookmark collection routes.
 * All routes require authentication.
 */
import { createRouter } from '../../../utils/create-app';
import { addBookmarkToCollectionRoute } from './addBookmark';
import { createUserBookmarkCollectionRoute } from './create';
import { deleteUserBookmarkCollectionRoute } from './delete';
import { getUserBookmarkCollectionByIdRoute } from './getById';
import { listUserBookmarkCollectionsRoute } from './list';
import { removeBookmarkFromCollectionRoute } from './removeBookmark';
import { updateUserBookmarkCollectionRoute } from './update';

const app = createRouter();

// GET / - List collections for the authenticated user
app.route('/', listUserBookmarkCollectionsRoute);

// POST / - Create a new collection for the authenticated user
app.route('/', createUserBookmarkCollectionRoute);

// GET /:id - Get a single collection by ID (with optional embedded bookmarks)
app.route('/', getUserBookmarkCollectionByIdRoute);

// PATCH /:id - Partially update a collection
app.route('/', updateUserBookmarkCollectionRoute);

// DELETE /:id - Soft-delete a collection (nullifies bookmarks' collectionId)
app.route('/', deleteUserBookmarkCollectionRoute);

// POST /:id/bookmarks/:bookmarkId - Assign a bookmark to a collection
app.route('/', addBookmarkToCollectionRoute);

// DELETE /:id/bookmarks/:bookmarkId - Remove a bookmark from its collection
app.route('/', removeBookmarkFromCollectionRoute);

export { app as protectedUserBookmarkCollectionRoutes };
