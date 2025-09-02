import type { FormModeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { AccommodationType } from '@repo/types';

/**
 * Accommodation form data type
 * Extends the core accommodation type with form-specific properties
 */
export type AccommodationFormData = AccommodationType & {
    // Form-specific computed fields
    _isNew?: boolean;
    _isDirty?: boolean;
    _hasUnsavedChanges?: boolean;
};

/**
 * Accommodation form props
 */
export type AccommodationFormProps = {
    /** Current form mode */
    mode: FormModeEnum;
    /** Accommodation ID for edit/view modes */
    accommodationId?: string;
    /** Initial form data */
    initialData?: Partial<AccommodationFormData>;
    /** Callback when form is submitted successfully */
    onSuccess?: (data: AccommodationFormData) => void;
    /** Callback when form encounters an error */
    onError?: (error: Error) => void;
    /** Callback when form is cancelled */
    onCancel?: () => void;
};

/**
 * Accommodation view props
 */
export type AccommodationViewProps = {
    /** Accommodation ID to display */
    accommodationId: string;
    /** Current section to display (optional, shows all if not provided) */
    sectionId?: string;
    /** Whether to show edit actions */
    showEditActions?: boolean;
    /** Callback when edit is requested */
    onEdit?: () => void;
};

/**
 * Accommodation section view props
 */
export type AccommodationSectionViewProps = {
    /** Accommodation data */
    accommodation: AccommodationFormData;
    /** Section ID to display */
    sectionId: string;
    /** Current form mode */
    mode: FormModeEnum;
    /** Whether the section is currently being edited */
    isEditing?: boolean;
    /** Callback when section edit is requested */
    onEdit?: () => void;
    /** Callback when section save is requested */
    onSave?: (sectionData: Partial<AccommodationFormData>) => void;
    /** Callback when section cancel is requested */
    onCancel?: () => void;
};

/**
 * Location field specific data
 */
export type LocationFieldData = {
    destinationId: string;
    destinationName?: string;
    address: string;
    city: string;
    state: string;
    country: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
    locationNotes?: string;
};

/**
 * Contact info field specific data
 */
export type ContactInfoFieldData = {
    email: string;
    phone?: string;
    website?: string;
    contactPersonName?: string;
    contactPersonEmail?: string;
    contactPersonPhone?: string;
    whatsapp?: string;
    instagram?: string;
    facebook?: string;
};

/**
 * Basic info field specific data
 */
export type BasicInfoFieldData = {
    name: string;
    slug: string;
    description: string;
    shortDescription?: string;
    type: string;
    lifecycleState: string;
    visibility: string;
    featured: boolean;
};

/**
 * States field specific data
 */
export type StatesFieldData = {
    moderationState: string;
    moderationNotes?: string;
    assignedUserId?: string;
    assignedUserName?: string;
    viewCount?: number;
    bookingCount?: number;
    internalNotes?: string;
    internalTags?: string[];
    priority?: number;
};

/**
 * Accommodation form validation errors
 */
export type AccommodationFormErrors = {
    [K in keyof AccommodationFormData]?: string[];
} & {
    _form?: string[]; // General form errors
    _sections?: {
        [sectionId: string]: string[];
    };
};

/**
 * Accommodation form state
 */
export type AccommodationFormState = {
    data: AccommodationFormData;
    errors: AccommodationFormErrors;
    isLoading: boolean;
    isSubmitting: boolean;
    isDirty: boolean;
    mode: FormModeEnum;
    currentSection?: string;
};
