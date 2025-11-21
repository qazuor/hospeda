import { createRouter } from '../../utils/create-app';
import { creditNoteCreateRoute } from './create';
import { creditNoteDeleteRoute } from './delete';
import { creditNoteGetByIdRoute } from './getById';
import { creditNoteListRoute } from './list';
import { creditNoteUpdateRoute } from './update';

const router = createRouter();

router.route('/', creditNoteListRoute);
router.route('/', creditNoteCreateRoute);
router.route('/', creditNoteGetByIdRoute);
router.route('/', creditNoteUpdateRoute);
router.route('/', creditNoteDeleteRoute);

export default router;
