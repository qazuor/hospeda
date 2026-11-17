import { createRouter } from '../../../utils/create-app';
import { publicPartnerClaimLookupRoute } from './lookup.js';
import { publicPartnerClaimSignUpRoute } from './signup.js';
import { publicSubmitPartnerApplicationRoute } from './submit';

const router = createRouter();
router.route('/', publicSubmitPartnerApplicationRoute);

/** Public Partner application routes. */
export const publicPartnerApplicationRoutes = router;

const partnerClaimRouter = createRouter();
partnerClaimRouter.route('/lookup', publicPartnerClaimLookupRoute);
partnerClaimRouter.route('/signup', publicPartnerClaimSignUpRoute);

/** Public Partner claim entry routes. */
export const publicPartnerClaimRoutes = partnerClaimRouter;
