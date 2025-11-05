/**
 * Complex Form Example
 *
 * This file demonstrates an advanced multi-step form with:
 * - Multi-step wizard form
 * - Array fields (dynamic add/remove)
 * - Nested object fields
 * - Dependent fields (show/hide based on other fields)
 * - Async validation with debouncing
 * - File upload field
 * - Custom field components
 * - Field-level error messages
 * - Form-level validation
 * - Submit with loading state
 * - Success/error handling
 *
 * Copy-paste ready code that follows Hospeda Admin patterns.
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash,
  Upload,
  X,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// Types & Schemas
// ============================================================================

/**
 * Address type
 */
type Address = {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
};

/**
 * Contact person type
 */
type Contact = {
  name: string;
  email: string;
  phone: string;
  role: string;
};

/**
 * Social media type
 */
type SocialMedia = {
  platform: string;
  url: string;
};

/**
 * Complete venue form data
 */
type VenueFormData = {
  // Step 1: Basic Info
  name: string;
  description: string;
  type: 'hotel' | 'resort' | 'apartment' | 'hostel' | 'other';
  category: string;
  website: string;

  // Step 2: Location
  address: Address;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  timezone: string;

  // Step 3: Contacts
  contacts: Contact[];
  socialMedia: SocialMedia[];

  // Step 4: Features
  amenities: string[];
  accessibility: string[];
  languages: string[];
  paymentMethods: string[];

  // Step 5: Media
  logo: File | null;
  images: File[];
  virtualTourUrl?: string;

  // Step 6: Policies
  checkInTime: string;
  checkOutTime: string;
  cancellationPolicy: string;
  petPolicy: 'allowed' | 'not-allowed' | 'some-allowed';
  smokingPolicy: 'allowed' | 'not-allowed' | 'designated-areas';
};

/**
 * Validation schemas for each step
 */
const step1Schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  type: z.enum(['hotel', 'resort', 'apartment', 'hostel', 'other']),
  category: z.string().min(1, 'Category is required'),
  website: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

const step2Schema = z.object({
  address: z.object({
    street: z.string().min(1, 'Street is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    zipCode: z.string().min(1, 'Zip code is required'),
    country: z.string().min(1, 'Country is required'),
  }),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  timezone: z.string().min(1, 'Timezone is required'),
});

const contactSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone is required'),
  role: z.string().min(1, 'Role is required'),
});

const socialMediaSchema = z.object({
  platform: z.string().min(1, 'Platform is required'),
  url: z.string().url('Must be a valid URL'),
});

// ============================================================================
// API Functions
// ============================================================================

/**
 * Check if venue name is available (async validation)
 */
async function checkVenueNameAvailable(name: string): Promise<boolean> {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Simulate some names being taken
  const takenNames = ['Grand Hotel', 'Paradise Resort', 'City Center'];
  return !takenNames.includes(name);
}

/**
 * Submit venue form
 */
async function createVenue(data: VenueFormData): Promise<{ id: string }> {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // In real app, would use FormData for file uploads
  console.log('Creating venue:', data);

  return { id: `venue-${Date.now()}` };
}

// ============================================================================
// Custom Field Components
// ============================================================================

/**
 * Image upload field component
 */
function ImageUploadField({
  field,
  label,
  multiple = false,
}: {
  field: any;
  label: string;
  multiple?: boolean;
}) {
  const [previews, setPreviews] = useState<string[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (multiple) {
      const filesArray = Array.from(files);
      field.handleChange(filesArray);

      // Generate previews
      const newPreviews = filesArray.map((file) => URL.createObjectURL(file));
      setPreviews(newPreviews);
    } else {
      const file = files[0];
      field.handleChange(file);

      // Generate preview
      if (file) {
        const preview = URL.createObjectURL(file);
        setPreviews([preview]);
      }
    }
  };

  const removeImage = (index: number) => {
    if (multiple) {
      const currentFiles = field.state.value as File[];
      const newFiles = currentFiles.filter((_, i) => i !== index);
      field.handleChange(newFiles);

      const newPreviews = previews.filter((_, i) => i !== index);
      setPreviews(newPreviews);
    } else {
      field.handleChange(null);
      setPreviews([]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block font-medium">{label}</label>

      <div className="space-y-4">
        {/* Upload button */}
        <label className="inline-flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-muted transition-colors">
          <Upload className="h-4 w-4" />
          <span>Choose {multiple ? 'Images' : 'Image'}</span>
          <input
            type="file"
            accept="image/*"
            multiple={multiple}
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {/* Preview grid */}
        {previews.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {previews.map((preview, index) => (
              <div key={index} className="relative group">
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-32 object-cover rounded-lg border"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {field.state.meta.errors && (
        <p className="text-sm text-red-600">{field.state.meta.errors[0]}</p>
      )}
    </div>
  );
}

/**
 * Multi-select tag input
 */
function TagInput({
  field,
  label,
  options,
}: {
  field: any;
  label: string;
  options: string[];
}) {
  const [selectedTags, setSelectedTags] = useState<string[]>(
    field.state.value || []
  );

  const toggleTag = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];

    setSelectedTags(newTags);
    field.handleChange(newTags);
  };

  return (
    <div className="space-y-2">
      <label className="block font-medium">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selectedTags.includes(option);

          return (
            <button
              key={option}
              type="button"
              onClick={() => toggleTag(option)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                isSelected
                  ? 'bg-primary text-white'
                  : 'bg-muted hover:bg-muted/70'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Address fields group
 */
function AddressFields({ form }: { form: any }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Address</h3>

      <form.Field name="address.street">
        {(field: any) => (
          <div className="space-y-2">
            <label htmlFor={field.name} className="font-medium">
              Street Address *
            </label>
            <input
              id={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="123 Main St"
              className="w-full px-3 py-2 border rounded-md"
            />
            {field.state.meta.errors && (
              <p className="text-sm text-red-600">
                {field.state.meta.errors[0]}
              </p>
            )}
          </div>
        )}
      </form.Field>

      <div className="grid grid-cols-2 gap-4">
        <form.Field name="address.city">
          {(field: any) => (
            <div className="space-y-2">
              <label htmlFor={field.name} className="font-medium">
                City *
              </label>
              <input
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="New York"
                className="w-full px-3 py-2 border rounded-md"
              />
              {field.state.meta.errors && (
                <p className="text-sm text-red-600">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="address.state">
          {(field: any) => (
            <div className="space-y-2">
              <label htmlFor={field.name} className="font-medium">
                State/Province *
              </label>
              <input
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="NY"
                className="w-full px-3 py-2 border rounded-md"
              />
              {field.state.meta.errors && (
                <p className="text-sm text-red-600">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="address.zipCode">
          {(field: any) => (
            <div className="space-y-2">
              <label htmlFor={field.name} className="font-medium">
                Zip Code *
              </label>
              <input
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="10001"
                className="w-full px-3 py-2 border rounded-md"
              />
              {field.state.meta.errors && (
                <p className="text-sm text-red-600">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="address.country">
          {(field: any) => (
            <div className="space-y-2">
              <label htmlFor={field.name} className="font-medium">
                Country *
              </label>
              <input
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="United States"
                className="w-full px-3 py-2 border rounded-md"
              />
              {field.state.meta.errors && (
                <p className="text-sm text-red-600">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>
      </div>
    </div>
  );
}

// ============================================================================
// Form Steps
// ============================================================================

/**
 * Step 1: Basic Information
 */
function Step1({ form }: { form: any }) {
  const venueType = form.useStore((state: any) => state.values.type);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Basic Information</h2>
        <p className="text-muted-foreground">
          Tell us about your venue
        </p>
      </div>

      {/* Venue name with async validation */}
      <form.Field
        name="name"
        validators={{
          onChange: step1Schema.shape.name,
          onChangeAsyncDebounceMs: 500,
          onChangeAsync: async ({ value }: { value: string }) => {
            if (value.length < 2) return undefined;

            const isAvailable = await checkVenueNameAvailable(value);
            if (!isAvailable) {
              return 'This venue name is already taken';
            }
            return undefined;
          },
        }}
      >
        {(field: any) => (
          <div className="space-y-2">
            <label htmlFor={field.name} className="font-medium">
              Venue Name *
            </label>
            <input
              id={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="Grand Hotel"
              className="w-full px-3 py-2 border rounded-md"
            />
            {field.state.meta.isValidating && (
              <p className="text-sm text-blue-600">Checking availability...</p>
            )}
            {field.state.meta.errors && (
              <p className="text-sm text-red-600">
                {field.state.meta.errors[0]}
              </p>
            )}
          </div>
        )}
      </form.Field>

      {/* Description */}
      <form.Field
        name="description"
        validators={{ onChange: step1Schema.shape.description }}
      >
        {(field: any) => (
          <div className="space-y-2">
            <label htmlFor={field.name} className="font-medium">
              Description *
            </label>
            <textarea
              id={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="Describe your venue..."
              rows={5}
              className="w-full px-3 py-2 border rounded-md"
            />
            {field.state.meta.errors && (
              <p className="text-sm text-red-600">
                {field.state.meta.errors[0]}
              </p>
            )}
          </div>
        )}
      </form.Field>

      {/* Venue type */}
      <form.Field
        name="type"
        validators={{ onChange: step1Schema.shape.type }}
      >
        {(field: any) => (
          <div className="space-y-2">
            <label htmlFor={field.name} className="font-medium">
              Venue Type *
            </label>
            <select
              id={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">Select type</option>
              <option value="hotel">Hotel</option>
              <option value="resort">Resort</option>
              <option value="apartment">Apartment</option>
              <option value="hostel">Hostel</option>
              <option value="other">Other</option>
            </select>
            {field.state.meta.errors && (
              <p className="text-sm text-red-600">
                {field.state.meta.errors[0]}
              </p>
            )}
          </div>
        )}
      </form.Field>

      {/* Category (dependent field - shown only for hotels and resorts) */}
      {(venueType === 'hotel' || venueType === 'resort') && (
        <form.Field
          name="category"
          validators={{ onChange: step1Schema.shape.category }}
        >
          {(field: any) => (
            <div className="space-y-2">
              <label htmlFor={field.name} className="font-medium">
                Category *
              </label>
              <select
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">Select category</option>
                <option value="budget">Budget (1-2 stars)</option>
                <option value="mid-range">Mid-range (3 stars)</option>
                <option value="upscale">Upscale (4 stars)</option>
                <option value="luxury">Luxury (5 stars)</option>
              </select>
              {field.state.meta.errors && (
                <p className="text-sm text-red-600">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>
      )}

      {/* Website */}
      <form.Field
        name="website"
        validators={{ onChange: step1Schema.shape.website }}
      >
        {(field: any) => (
          <div className="space-y-2">
            <label htmlFor={field.name} className="font-medium">
              Website
            </label>
            <input
              id={field.name}
              type="url"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 border rounded-md"
            />
            {field.state.meta.errors && (
              <p className="text-sm text-red-600">
                {field.state.meta.errors[0]}
              </p>
            )}
          </div>
        )}
      </form.Field>
    </div>
  );
}

/**
 * Step 2: Location
 */
function Step2({ form }: { form: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Location</h2>
        <p className="text-muted-foreground">Where is your venue located?</p>
      </div>

      <AddressFields form={form} />

      {/* Coordinates */}
      <div className="space-y-4">
        <h3 className="font-semibold">Coordinates</h3>
        <div className="grid grid-cols-2 gap-4">
          <form.Field name="coordinates.latitude">
            {(field: any) => (
              <div className="space-y-2">
                <label htmlFor={field.name} className="font-medium">
                  Latitude
                </label>
                <input
                  id={field.name}
                  type="number"
                  step="0.000001"
                  value={field.state.value}
                  onChange={(e) =>
                    field.handleChange(parseFloat(e.target.value))
                  }
                  placeholder="40.7128"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            )}
          </form.Field>

          <form.Field name="coordinates.longitude">
            {(field: any) => (
              <div className="space-y-2">
                <label htmlFor={field.name} className="font-medium">
                  Longitude
                </label>
                <input
                  id={field.name}
                  type="number"
                  step="0.000001"
                  value={field.state.value}
                  onChange={(e) =>
                    field.handleChange(parseFloat(e.target.value))
                  }
                  placeholder="-74.0060"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            )}
          </form.Field>
        </div>
      </div>

      {/* Timezone */}
      <form.Field name="timezone">
        {(field: any) => (
          <div className="space-y-2">
            <label htmlFor={field.name} className="font-medium">
              Timezone *
            </label>
            <select
              id={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">Select timezone</option>
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="America/Argentina/Buenos_Aires">
                Argentina Time (ART)
              </option>
            </select>
            {field.state.meta.errors && (
              <p className="text-sm text-red-600">
                {field.state.meta.errors[0]}
              </p>
            )}
          </div>
        )}
      </form.Field>
    </div>
  );
}

/**
 * Step 3: Contacts (Array fields)
 */
function Step3({ form }: { form: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Contacts</h2>
        <p className="text-muted-foreground">
          Add contact information for your venue
        </p>
      </div>

      {/* Contacts array */}
      <form.Field name="contacts" mode="array">
        {(field: any) => (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Contact Persons</h3>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  field.pushValue({
                    name: '',
                    email: '',
                    phone: '',
                    role: '',
                  });
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </div>

            {field.state.value.map((_: any, index: number) => (
              <Card key={index}>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Contact {index + 1}</h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => field.removeValue(index)}
                      disabled={field.state.value.length === 1}
                    >
                      <Trash className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <form.Field name={`contacts[${index}].name`}>
                      {(subField: any) => (
                        <div className="space-y-2">
                          <label className="font-medium">Name *</label>
                          <input
                            value={subField.state.value}
                            onChange={(e) =>
                              subField.handleChange(e.target.value)
                            }
                            placeholder="John Doe"
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                      )}
                    </form.Field>

                    <form.Field name={`contacts[${index}].role`}>
                      {(subField: any) => (
                        <div className="space-y-2">
                          <label className="font-medium">Role *</label>
                          <input
                            value={subField.state.value}
                            onChange={(e) =>
                              subField.handleChange(e.target.value)
                            }
                            placeholder="Manager"
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                      )}
                    </form.Field>

                    <form.Field name={`contacts[${index}].email`}>
                      {(subField: any) => (
                        <div className="space-y-2">
                          <label className="font-medium">Email *</label>
                          <input
                            type="email"
                            value={subField.state.value}
                            onChange={(e) =>
                              subField.handleChange(e.target.value)
                            }
                            placeholder="john@example.com"
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                      )}
                    </form.Field>

                    <form.Field name={`contacts[${index}].phone`}>
                      {(subField: any) => (
                        <div className="space-y-2">
                          <label className="font-medium">Phone *</label>
                          <input
                            type="tel"
                            value={subField.state.value}
                            onChange={(e) =>
                              subField.handleChange(e.target.value)
                            }
                            placeholder="+1 234 567 8900"
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                      )}
                    </form.Field>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </form.Field>

      {/* Social media array */}
      <form.Field name="socialMedia" mode="array">
        {(field: any) => (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Social Media</h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  field.pushValue({ platform: '', url: '' });
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Social Media
              </Button>
            </div>

            {field.state.value.map((_: any, index: number) => (
              <div key={index} className="flex items-start gap-4">
                <form.Field name={`socialMedia[${index}].platform`}>
                  {(subField: any) => (
                    <div className="w-40">
                      <select
                        value={subField.state.value}
                        onChange={(e) => subField.handleChange(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md"
                      >
                        <option value="">Platform</option>
                        <option value="facebook">Facebook</option>
                        <option value="instagram">Instagram</option>
                        <option value="twitter">Twitter</option>
                        <option value="linkedin">LinkedIn</option>
                      </select>
                    </div>
                  )}
                </form.Field>

                <form.Field name={`socialMedia[${index}].url`}>
                  {(subField: any) => (
                    <div className="flex-1">
                      <input
                        type="url"
                        value={subField.state.value}
                        onChange={(e) => subField.handleChange(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                  )}
                </form.Field>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => field.removeValue(index)}
                >
                  <Trash className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </form.Field>
    </div>
  );
}

/**
 * Step 4: Features (Tag inputs)
 */
function Step4({ form }: { form: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Features & Amenities</h2>
        <p className="text-muted-foreground">
          Select all that apply to your venue
        </p>
      </div>

      <form.Field name="amenities">
        {(field: any) => (
          <TagInput
            field={field}
            label="Amenities"
            options={[
              'WiFi',
              'Parking',
              'Pool',
              'Gym',
              'Spa',
              'Restaurant',
              'Bar',
              'Room Service',
              'Concierge',
              'Business Center',
            ]}
          />
        )}
      </form.Field>

      <form.Field name="accessibility">
        {(field: any) => (
          <TagInput
            field={field}
            label="Accessibility Features"
            options={[
              'Wheelchair Access',
              'Elevator',
              'Accessible Parking',
              'Accessible Bathroom',
              'Braille Signage',
              'Service Animals Allowed',
            ]}
          />
        )}
      </form.Field>

      <form.Field name="languages">
        {(field: any) => (
          <TagInput
            field={field}
            label="Languages Spoken"
            options={[
              'English',
              'Spanish',
              'French',
              'German',
              'Italian',
              'Portuguese',
              'Chinese',
              'Japanese',
            ]}
          />
        )}
      </form.Field>

      <form.Field name="paymentMethods">
        {(field: any) => (
          <TagInput
            field={field}
            label="Payment Methods"
            options={[
              'Cash',
              'Credit Card',
              'Debit Card',
              'PayPal',
              'Apple Pay',
              'Google Pay',
              'Bank Transfer',
            ]}
          />
        )}
      </form.Field>
    </div>
  );
}

/**
 * Step 5: Media (File uploads)
 */
function Step5({ form }: { form: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Media</h2>
        <p className="text-muted-foreground">Upload images and media</p>
      </div>

      <form.Field name="logo">
        {(field: any) => (
          <ImageUploadField field={field} label="Logo" multiple={false} />
        )}
      </form.Field>

      <form.Field name="images">
        {(field: any) => (
          <ImageUploadField field={field} label="Gallery Images" multiple />
        )}
      </form.Field>

      <form.Field name="virtualTourUrl">
        {(field: any) => (
          <div className="space-y-2">
            <label htmlFor={field.name} className="font-medium">
              Virtual Tour URL (optional)
            </label>
            <input
              id={field.name}
              type="url"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        )}
      </form.Field>
    </div>
  );
}

/**
 * Step 6: Policies
 */
function Step6({ form }: { form: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Policies</h2>
        <p className="text-muted-foreground">Set your venue policies</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <form.Field name="checkInTime">
          {(field: any) => (
            <div className="space-y-2">
              <label htmlFor={field.name} className="font-medium">
                Check-in Time *
              </label>
              <input
                id={field.name}
                type="time"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          )}
        </form.Field>

        <form.Field name="checkOutTime">
          {(field: any) => (
            <div className="space-y-2">
              <label htmlFor={field.name} className="font-medium">
                Check-out Time *
              </label>
              <input
                id={field.name}
                type="time"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          )}
        </form.Field>
      </div>

      <form.Field name="cancellationPolicy">
        {(field: any) => (
          <div className="space-y-2">
            <label htmlFor={field.name} className="font-medium">
              Cancellation Policy *
            </label>
            <textarea
              id={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="Describe your cancellation policy..."
              rows={4}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        )}
      </form.Field>

      <form.Field name="petPolicy">
        {(field: any) => (
          <div className="space-y-2">
            <label htmlFor={field.name} className="font-medium">
              Pet Policy *
            </label>
            <select
              id={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">Select policy</option>
              <option value="allowed">Pets Allowed</option>
              <option value="not-allowed">No Pets Allowed</option>
              <option value="some-allowed">Some Pets Allowed</option>
            </select>
          </div>
        )}
      </form.Field>

      <form.Field name="smokingPolicy">
        {(field: any) => (
          <div className="space-y-2">
            <label htmlFor={field.name} className="font-medium">
              Smoking Policy *
            </label>
            <select
              id={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">Select policy</option>
              <option value="allowed">Smoking Allowed</option>
              <option value="not-allowed">No Smoking</option>
              <option value="designated-areas">Designated Areas Only</option>
            </select>
          </div>
        )}
      </form.Field>
    </div>
  );
}

// ============================================================================
// Main Form Component
// ============================================================================

/**
 * Multi-step venue form wizard
 */
function VenueFormWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;

  const mutation = useMutation({
    mutationFn: createVenue,
    onSuccess: (data) => {
      toast({
        title: 'Success!',
        description: 'Venue created successfully',
      });
      navigate({ to: `/venues/${data.id}` });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const form = useForm({
    defaultValues: {
      name: '',
      description: '',
      type: '' as any,
      category: '',
      website: '',
      address: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: '',
      },
      coordinates: {
        latitude: 0,
        longitude: 0,
      },
      timezone: '',
      contacts: [{ name: '', email: '', phone: '', role: '' }],
      socialMedia: [] as SocialMedia[],
      amenities: [] as string[],
      accessibility: [] as string[],
      languages: [] as string[],
      paymentMethods: [] as string[],
      logo: null as File | null,
      images: [] as File[],
      virtualTourUrl: '',
      checkInTime: '15:00',
      checkOutTime: '11:00',
      cancellationPolicy: '',
      petPolicy: '' as any,
      smokingPolicy: '' as any,
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
    validatorAdapter: zodValidator(),
  });

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1 form={form} />;
      case 2:
        return <Step2 form={form} />;
      case 3:
        return <Step3 form={form} />;
      case 4:
        return <Step4 form={form} />;
      case 5:
        return <Step5 form={form} />;
      case 6:
        return <Step6 form={form} />;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div>
              <CardTitle>Create New Venue</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Step {currentStep} of {totalSteps}
              </p>
            </div>

            {/* Progress bar */}
            <div className="relative">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{
                    width: `${(currentStep / totalSteps) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();

              if (currentStep === totalSteps) {
                form.handleSubmit();
              }
            }}
          >
            {/* Current step content */}
            <div className="min-h-[500px]">{renderStep()}</div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1 || mutation.isPending}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>

              <div className="flex items-center gap-2">
                {Array.from({ length: totalSteps }, (_, i) => (
                  <div
                    key={i}
                    className={`h-2 w-2 rounded-full transition-colors ${
                      i + 1 === currentStep
                        ? 'bg-primary'
                        : i + 1 < currentStep
                          ? 'bg-green-500'
                          : 'bg-muted'
                    }`}
                  />
                ))}
              </div>

              {currentStep === totalSteps ? (
                <Button
                  type="submit"
                  disabled={mutation.isPending || !form.state.canSubmit}
                >
                  {mutation.isPending ? (
                    <>Creating...</>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Create Venue
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={mutation.isPending}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Route Definition
// ============================================================================

export const Route = createFileRoute('/_authed/venues/new')({
  component: VenueFormWizard,
});
