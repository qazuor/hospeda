import { LifecycleStatusEnum } from '@repo/types/enums/lifecycle-state.enum';
import { VisibilityEnum } from '@repo/types/enums/visibility.enum';
import { getMockAccommodation, getMockAccommodationWithMedia } from '../mockData';

export const makePublicAccommodation = (overrides = {}) =>
    getMockAccommodation({ visibility: VisibilityEnum.PUBLIC, ...overrides });

export const makePrivateAccommodation = (overrides = {}) =>
    getMockAccommodation({ visibility: VisibilityEnum.PRIVATE, ...overrides });

export const makeArchivedAccommodation = (overrides = {}) =>
    getMockAccommodation({
        lifecycleState: LifecycleStatusEnum.ARCHIVED,
        ...overrides
    });

export const makeAccommodationWithMedia = (overrides = {}) =>
    getMockAccommodationWithMedia({ ...overrides });

export const makeAccommodation = (overrides = {}) => getMockAccommodation({ ...overrides });
