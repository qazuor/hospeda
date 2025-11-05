/**
 * Form Validation with Schemas Example
 *
 * Demonstrates:
 * - React Hook Form integration
 * - zodResolver for Zod schemas
 * - Field-level validation
 * - Error display patterns
 * - Submit handling with TanStack Query
 * - Type-safe form data
 *
 * @example
 * ```tsx
 * // Complete accommodation booking form component
 * import { AccommodationForm } from './form-schema';
 *
 * export function CreateAccommodationPage() {
 *   return <AccommodationForm />;
 * }
 * ```
 *
 * @packageDocumentation
 */

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import type { ReactElement } from 'react';

// ============================================================================
// 1. FORM SCHEMA
// ============================================================================

/**
 * Accommodation form schema with comprehensive validation
 *
 * Includes validation for:
 * - Basic information (title, description)
 * - Location data (address, city, coordinates)
 * - Pricing (per night, cleaning fee)
 * - Capacity constraints
 * - Amenities selection
 * - Image gallery
 *
 * @example
 * ```typescript
 * const formData = accommodationFormSchema.parse({
 *   title: 'Beach House Paradise',
 *   description: 'Beautiful beachfront property with ocean views',
 *   address: '123 Beach Road',
 *   city: 'Concepción del Uruguay',
 *   state: 'Entre Ríos',
 *   country: 'Argentina',
 *   zipCode: '3260',
 *   latitude: -32.4833,
 *   longitude: -58.2333,
 *   pricePerNight: 15000,
 *   cleaningFee: 2000,
 *   maxGuests: 6,
 *   bedrooms: 3,
 *   beds: 4,
 *   bathrooms: 2,
 *   amenities: ['wifi', 'pool', 'parking'],
 *   images: ['https://cdn.example.com/image1.jpg'],
 * });
 * ```
 */
export const accommodationFormSchema = z.object({
  // Basic Information
  title: z
    .string()
    .min(10, 'Title must be at least 10 characters')
    .max(100, 'Title cannot exceed 100 characters')
    .trim(),
  description: z
    .string()
    .min(50, 'Description must be at least 50 characters')
    .max(2000, 'Description cannot exceed 2000 characters')
    .trim(),

  // Location
  address: z
    .string()
    .min(10, 'Address must be at least 10 characters')
    .max(200, 'Address cannot exceed 200 characters')
    .trim(),
  city: z
    .string()
    .min(2, 'City name must be at least 2 characters')
    .max(100, 'City name cannot exceed 100 characters')
    .trim(),
  state: z
    .string()
    .min(2, 'State name must be at least 2 characters')
    .max(100, 'State name cannot exceed 100 characters')
    .trim(),
  country: z.string().default('Argentina'),
  zipCode: z
    .string()
    .regex(/^\d{4}$/, 'ZIP code must be 4 digits')
    .optional(),

  // Coordinates
  latitude: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),

  // Pricing
  pricePerNight: z
    .number()
    .min(100, 'Price per night must be at least $100')
    .max(1000000, 'Price per night cannot exceed $1,000,000')
    .multipleOf(100, 'Price must be a multiple of 100'),
  cleaningFee: z
    .number()
    .min(0, 'Cleaning fee cannot be negative')
    .max(100000, 'Cleaning fee cannot exceed $100,000')
    .multipleOf(100, 'Cleaning fee must be a multiple of 100')
    .optional()
    .default(0),

  // Capacity
  maxGuests: z
    .number()
    .int('Maximum guests must be a whole number')
    .min(1, 'Must accommodate at least 1 guest')
    .max(20, 'Cannot accommodate more than 20 guests'),
  bedrooms: z
    .number()
    .int('Number of bedrooms must be a whole number')
    .min(1, 'Must have at least 1 bedroom')
    .max(10, 'Cannot have more than 10 bedrooms'),
  beds: z
    .number()
    .int('Number of beds must be a whole number')
    .min(1, 'Must have at least 1 bed')
    .max(20, 'Cannot have more than 20 beds'),
  bathrooms: z
    .number()
    .min(0.5, 'Must have at least a half bathroom')
    .max(10, 'Cannot have more than 10 bathrooms')
    .multipleOf(0.5, 'Bathrooms must be in increments of 0.5'),

  // Amenities
  amenities: z
    .array(
      z.enum([
        'wifi',
        'kitchen',
        'parking',
        'pool',
        'hot_tub',
        'air_conditioning',
        'heating',
        'tv',
        'washer',
        'dryer',
        'gym',
        'bbq_grill',
        'beach_access',
        'pet_friendly',
      ])
    )
    .min(1, 'Select at least one amenity')
    .max(14, 'Cannot select more than 14 amenities'),

  // Images
  images: z
    .array(z.string().url('Each image must be a valid URL'))
    .min(1, 'Upload at least one image')
    .max(20, 'Cannot upload more than 20 images'),
}).refine(
  (data) => data.beds >= data.bedrooms,
  {
    message: 'Number of beds must be at least equal to number of bedrooms',
    path: ['beds'],
  }
);

export type AccommodationFormData = z.infer<typeof accommodationFormSchema>;

// ============================================================================
// 2. REACT HOOK FORM SETUP
// ============================================================================

/**
 * Custom hook for accommodation form logic
 *
 * Handles:
 * - Form initialization with default values
 * - Type-safe form state
 * - Validation with Zod resolver
 * - Mutation for API submission
 *
 * @example
 * ```tsx
 * function MyForm() {
 *   const {
 *     form,
 *     onSubmit,
 *     isSubmitting,
 *     isSuccess,
 *   } = useAccommodationForm();
 *
 *   return <form onSubmit={form.handleSubmit(onSubmit)}>...</form>;
 * }
 * ```
 */
export function useAccommodationForm() {
  const queryClient = useQueryClient();

  // Initialize form with React Hook Form + Zod resolver
  const form = useForm<AccommodationFormData>({
    resolver: zodResolver(accommodationFormSchema),
    defaultValues: {
      title: '',
      description: '',
      address: '',
      city: 'Concepción del Uruguay',
      state: 'Entre Ríos',
      country: 'Argentina',
      zipCode: '',
      latitude: -32.4833,
      longitude: -58.2333,
      pricePerNight: 5000,
      cleaningFee: 1000,
      maxGuests: 4,
      bedrooms: 2,
      beds: 2,
      bathrooms: 1,
      amenities: [],
      images: [],
    },
    mode: 'onBlur', // Validate on blur for better UX
  });

  // TanStack Query mutation for API submission
  const mutation = useMutation({
    mutationFn: async (data: AccommodationFormData) => {
      const response = await fetch('/api/accommodations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create accommodation');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate accommodations query to refetch
      queryClient.invalidateQueries({ queryKey: ['accommodations'] });

      // Reset form
      form.reset();
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    mutation.mutate(data);
  });

  return {
    form,
    onSubmit,
    isSubmitting: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
  };
}

// ============================================================================
// 3. COMPLETE FORM COMPONENT
// ============================================================================

/**
 * Form field wrapper component (shadcn/ui style)
 *
 * Provides consistent styling and error display
 */
function FormField(props: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}): ReactElement {
  const { label, error, required, children } = props;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-sm font-medium text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Input component (shadcn/ui style)
 */
function Input(
  props: React.InputHTMLAttributes<HTMLInputElement>
): ReactElement {
  const { className = '', ...rest } = props;

  return (
    <input
      className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    />
  );
}

/**
 * Textarea component (shadcn/ui style)
 */
function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
): ReactElement {
  const { className = '', ...rest } = props;

  return (
    <textarea
      className={`flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    />
  );
}

/**
 * Select component (shadcn/ui style)
 */
function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement>
): ReactElement {
  const { className = '', ...rest } = props;

  return (
    <select
      className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    />
  );
}

/**
 * Button component (shadcn/ui style)
 */
function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'default' | 'outline';
    loading?: boolean;
  }
): ReactElement {
  const { className = '', variant = 'default', loading, children, ...rest } =
    props;

  const baseStyles =
    'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2';
  const variantStyles =
    variant === 'default'
      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
      : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground';

  return (
    <button
      className={`${baseStyles} ${variantStyles} ${className}`}
      disabled={loading}
      {...rest}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}

/**
 * Checkbox group component for amenities
 */
function CheckboxGroup(props: {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
}): ReactElement {
  const { label, options, value, onChange, error } = props;

  const handleChange = (optionValue: string, checked: boolean) => {
    if (checked) {
      onChange([...value, optionValue]);
    } else {
      onChange(value.filter((v) => v !== optionValue));
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none">{label}</label>
      <div className="grid grid-cols-2 gap-4">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex items-center space-x-2 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={value.includes(option.value)}
              onChange={(e) => handleChange(option.value, e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm">{option.label}</span>
          </label>
        ))}
      </div>
      {error && (
        <p className="text-sm font-medium text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Complete accommodation form component
 *
 * Features:
 * - Full type safety from schema
 * - Field-level validation
 * - Error display
 * - Loading states
 * - Success feedback
 * - Accessibility attributes
 *
 * @example
 * ```tsx
 * export function CreateAccommodationPage() {
 *   return (
 *     <div className="container mx-auto py-8">
 *       <h1 className="text-3xl font-bold mb-8">Create Accommodation</h1>
 *       <AccommodationForm />
 *     </div>
 *   );
 * }
 * ```
 */
export function AccommodationForm(): ReactElement {
  const { form, onSubmit, isSubmitting, isSuccess, error } =
    useAccommodationForm();

  const {
    register,
    formState: { errors },
    setValue,
    watch,
  } = form;

  const amenitiesValue = watch('amenities');

  const amenityOptions = [
    { value: 'wifi', label: 'Wi-Fi' },
    { value: 'kitchen', label: 'Kitchen' },
    { value: 'parking', label: 'Parking' },
    { value: 'pool', label: 'Pool' },
    { value: 'hot_tub', label: 'Hot Tub' },
    { value: 'air_conditioning', label: 'Air Conditioning' },
    { value: 'heating', label: 'Heating' },
    { value: 'tv', label: 'TV' },
    { value: 'washer', label: 'Washer' },
    { value: 'dryer', label: 'Dryer' },
    { value: 'gym', label: 'Gym' },
    { value: 'bbq_grill', label: 'BBQ Grill' },
    { value: 'beach_access', label: 'Beach Access' },
    { value: 'pet_friendly', label: 'Pet Friendly' },
  ];

  return (
    <form onSubmit={onSubmit} className="space-y-8 max-w-2xl" noValidate>
      {/* Success Message */}
      {isSuccess && (
        <div
          className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded"
          role="alert"
        >
          <p className="font-medium">Success!</p>
          <p className="text-sm">Accommodation created successfully.</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded"
          role="alert"
        >
          <p className="font-medium">Error</p>
          <p className="text-sm">{error.message}</p>
        </div>
      )}

      {/* Basic Information */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Basic Information</h2>

        <FormField
          label="Title"
          error={errors.title?.message}
          required
        >
          <Input
            {...register('title')}
            placeholder="Enter accommodation title"
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'title-error' : undefined}
          />
        </FormField>

        <FormField
          label="Description"
          error={errors.description?.message}
          required
        >
          <Textarea
            {...register('description')}
            placeholder="Describe your accommodation"
            rows={5}
            aria-invalid={!!errors.description}
            aria-describedby={
              errors.description ? 'description-error' : undefined
            }
          />
        </FormField>
      </section>

      {/* Location */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Location</h2>

        <FormField
          label="Address"
          error={errors.address?.message}
          required
        >
          <Input
            {...register('address')}
            placeholder="Street address"
            aria-invalid={!!errors.address}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="City" error={errors.city?.message} required>
            <Input {...register('city')} aria-invalid={!!errors.city} />
          </FormField>

          <FormField label="State" error={errors.state?.message} required>
            <Input {...register('state')} aria-invalid={!!errors.state} />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="ZIP Code" error={errors.zipCode?.message}>
            <Input {...register('zipCode')} placeholder="1234" />
          </FormField>

          <FormField label="Country" error={errors.country?.message} required>
            <Input {...register('country')} disabled />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Latitude" error={errors.latitude?.message} required>
            <Input
              type="number"
              step="any"
              {...register('latitude', { valueAsNumber: true })}
            />
          </FormField>

          <FormField
            label="Longitude"
            error={errors.longitude?.message}
            required
          >
            <Input
              type="number"
              step="any"
              {...register('longitude', { valueAsNumber: true })}
            />
          </FormField>
        </div>
      </section>

      {/* Pricing */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Pricing</h2>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Price per Night ($)"
            error={errors.pricePerNight?.message}
            required
          >
            <Input
              type="number"
              step="100"
              {...register('pricePerNight', { valueAsNumber: true })}
            />
          </FormField>

          <FormField
            label="Cleaning Fee ($)"
            error={errors.cleaningFee?.message}
          >
            <Input
              type="number"
              step="100"
              {...register('cleaningFee', { valueAsNumber: true })}
            />
          </FormField>
        </div>
      </section>

      {/* Capacity */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Capacity</h2>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Maximum Guests"
            error={errors.maxGuests?.message}
            required
          >
            <Input
              type="number"
              {...register('maxGuests', { valueAsNumber: true })}
            />
          </FormField>

          <FormField label="Bedrooms" error={errors.bedrooms?.message} required>
            <Input
              type="number"
              {...register('bedrooms', { valueAsNumber: true })}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Beds" error={errors.beds?.message} required>
            <Input
              type="number"
              {...register('beds', { valueAsNumber: true })}
            />
          </FormField>

          <FormField
            label="Bathrooms"
            error={errors.bathrooms?.message}
            required
          >
            <Input
              type="number"
              step="0.5"
              {...register('bathrooms', { valueAsNumber: true })}
            />
          </FormField>
        </div>
      </section>

      {/* Amenities */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Amenities</h2>
        <CheckboxGroup
          label="Select available amenities"
          options={amenityOptions}
          value={amenitiesValue || []}
          onChange={(value) => setValue('amenities', value as any)}
          error={errors.amenities?.message}
        />
      </section>

      {/* Submit Button */}
      <div className="flex gap-4">
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Accommodation'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => form.reset()}
          disabled={isSubmitting}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}

// ============================================================================
// 4. TYPE-SAFE SUBMIT HANDLER
// ============================================================================

/**
 * API client for accommodation creation
 *
 * @param input - Accommodation form data
 * @returns Created accommodation
 *
 * @example
 * ```typescript
 * const accommodation = await createAccommodation({
 *   data: formData,
 * });
 * ```
 */
export async function createAccommodation(input: {
  data: AccommodationFormData;
}): Promise<{ success: boolean; data: AccommodationFormData & { id: string } }> {
  const { data } = input;

  const response = await fetch('/api/accommodations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create accommodation');
  }

  return response.json();
}
