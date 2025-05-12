import {
    AccommodationTypeEnum,
    AmenitiesTypeEnum,
    BuiltinPermissionTypeEnum,
    BuiltinRoleTypeEnum,
    ClientTypeEnum,
    EventCategoryEnum,
    PostCategoryEnum,
    PreferedContactEnum,
    PriceCurrencyEnum,
    RecurrenceTypeEnum,
    StateEnum,
    VisibilityEnum
} from '@repo/types';
import { z } from 'zod';

/**
 * Zod schema for StateEnum.
 */
export const StateEnumSchema = z.nativeEnum(StateEnum, {
    required_error: 'error:enum.state.required',
    invalid_type_error: 'error:enum.state.invalid'
});

/**
 * Zod schema for PreferedContactEnum.
 */
export const PreferedContactEnumSchema = z.nativeEnum(PreferedContactEnum, {
    required_error: 'error:enum.preferedContact.required',
    invalid_type_error: 'error:enum.preferedContact.invalid'
});

/**
 * Zod schema for AccommodationTypeEnum.
 */
export const AccommodationTypeEnumSchema = z.nativeEnum(AccommodationTypeEnum, {
    required_error: 'error:enum.accommodationType.required',
    invalid_type_error: 'error:enum.accommodationType.invalid'
});

/**
 * Zod schema for AmenitiesTypeEnum.
 */
export const AmenitiesTypeEnumSchema = z.nativeEnum(AmenitiesTypeEnum, {
    required_error: 'error:enum.amenitiesType.required',
    invalid_type_error: 'error:enum.amenitiesType.invalid'
});

/**
 * Zod schema for BuiltinRoleTypeEnum.
 */
export const BuiltinRoleTypeEnumSchema = z.nativeEnum(BuiltinRoleTypeEnum, {
    required_error: 'error:enum.role.required',
    invalid_type_error: 'error:enum.role.invalid'
});

/**
 * Zod schema for BuiltinPermissionTypeEnum.
 */
export const BuiltinPermissionTypeEnumSchema = z.nativeEnum(BuiltinPermissionTypeEnum, {
    required_error: 'error:enum.permission.required',
    invalid_type_error: 'error:enum.permission.invalid'
});

/**
 * Zod schema for PostCategoryEnum.
 */
export const PostCategoryEnumSchema = z.nativeEnum(PostCategoryEnum, {
    required_error: 'error:enum.postCategory.required',
    invalid_type_error: 'error:enum.postCategory.invalid'
});

/**
 * Zod schema for VisibilityEnum.
 */
export const VisibilityEnumSchema = z.nativeEnum(VisibilityEnum, {
    required_error: 'error:enum.visibility.required',
    invalid_type_error: 'error:enum.visibility.invalid'
});

/**
 * Zod schema for RecurrenceTypeEnum.
 */
export const RecurrenceTypeEnumSchema = z.nativeEnum(RecurrenceTypeEnum, {
    required_error: 'error:enum.recurrence.required',
    invalid_type_error: 'error:enum.recurrence.invalid'
});

/**
 * Zod schema for EventCategoryEnum.
 */
export const EventCategoryEnumSchema = z.nativeEnum(EventCategoryEnum, {
    required_error: 'error:enum.eventCategory.required',
    invalid_type_error: 'error:enum.eventCategory.invalid'
});

/**
 * Zod schema for ClientTypeEnum.
 */
export const ClientTypeEnumSchema = z.nativeEnum(ClientTypeEnum, {
    required_error: 'error:enum.clientType.required',
    invalid_type_error: 'error:enum.clientType.invalid'
});

/**
 * Zod schema for PriceCurrencyEnum.
 */
export const PriceCurrencyEnumSchema = z.nativeEnum(PriceCurrencyEnum, {
    required_error: 'error:enum.currency.required',
    invalid_type_error: 'error:enum.currency.invalid'
});
