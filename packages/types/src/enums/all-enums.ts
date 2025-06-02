import { AccommodationTypeEnum } from './accommodation-type.enum.js';
import { AmenitiesTypeEnum } from './amenity-type.enum.js';
import { ClientTypeEnum } from './client-type.enum.js';
import { PreferredContactEnum } from './contact-preference.enum.js';
import { PriceCurrencyEnum } from './currency.enum.js';
import { EntityTypeEnum } from './entity-type.enum.js';
import { EventCategoryEnum } from './event-category.enum.js';
import { LifecycleStatusEnum } from './lifecycle-state.enum.js';
import { PermissionCategoryEnum, PermissionEnum } from './permission.enum.js';
import { PostCategoryEnum } from './post-category.enum.js';
import { RecurrenceTypeEnum } from './recurrence.enum.js';
import { RoleEnum } from './role.enum.js';
import { ModerationStatusEnum } from './state.enum.js';
import { TagColorEnum } from './tag-color.enum.js';
import { VisibilityEnum } from './visibility.enum.js';

export const AllEnums = {
    AccommodationTypeEnum,
    AmenitiesTypeEnum,
    ClientTypeEnum,
    PreferredContactEnum,
    PriceCurrencyEnum,
    EntityTypeEnum,
    EventCategoryEnum,
    LifecycleStatusEnum,
    PermissionEnum,
    PermissionCategoryEnum,
    PostCategoryEnum,
    RecurrenceTypeEnum,
    RoleEnum,
    ModerationStatusEnum,
    TagColorEnum,
    VisibilityEnum
} as const;

export const AllEnumNames = Object.keys(AllEnums) as Array<keyof typeof AllEnums>;
