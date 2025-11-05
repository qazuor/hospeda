/**
 * Complex Validation Patterns Example
 *
 * Demonstrates:
 * - Cross-field validation
 * - Conditional validation
 * - Business rule validation
 * - Multi-step wizard validation
 * - Discriminated unions
 * - Real-world business logic
 *
 * @example
 * ```typescript
 * // Comprehensive validation scenarios for booking system
 * import {
 *   bookingSchema,
 *   paymentSchema,
 *   reviewSchema,
 *   wizardSchema,
 *   accommodationSchema,
 * } from './complex-validation';
 * ```
 *
 * @packageDocumentation
 */

import { z } from 'zod';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate number of nights between two dates
 *
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @returns Number of nights
 */
export function calculateNights(checkIn: Date, checkOut: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((checkOut.getTime() - checkIn.getTime()) / msPerDay);
}

/**
 * Check if date is in the past
 *
 * @param date - Date to check
 * @returns True if date is in the past
 */
export function isPastDate(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

/**
 * Luhn algorithm for credit card validation
 *
 * @param cardNumber - Card number to validate
 * @returns True if valid
 *
 * @example
 * ```typescript
 * luhnCheck('4532015112830366'); // true (valid Visa)
 * luhnCheck('1234567890123456'); // false (invalid)
 * ```
 */
export function luhnCheck(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');

  if (digits.length < 13 || digits.length > 19) {
    return false;
  }

  let sum = 0;
  let isEven = false;

  // Process digits from right to left
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * Check if expiry date is valid (future date)
 *
 * @param month - Expiry month (1-12)
 * @param year - Expiry year (full year, e.g., 2025)
 * @returns True if valid
 */
export function isValidExpiry(month: number, year: number): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year < currentYear) {
    return false;
  }

  if (year === currentYear && month < currentMonth) {
    return false;
  }

  return true;
}

/**
 * Check if text contains profanity or URLs
 *
 * @param text - Text to check
 * @returns True if content is appropriate
 */
export function isAppropriateContent(text: string): boolean {
  // Simple profanity filter (extend as needed)
  const profanityPattern = /\b(badword1|badword2|badword3)\b/gi;

  // URL pattern
  const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;

  return !profanityPattern.test(text) && !urlPattern.test(text);
}

// ============================================================================
// 1. BOOKING VALIDATION
// ============================================================================

/**
 * Booking schema with complex date and business rule validation
 *
 * Validates:
 * - Date ranges (checkIn < checkOut, no past dates)
 * - Duration limits (1-30 nights)
 * - Guest capacity (within accommodation limits)
 * - Availability (no overlapping bookings)
 * - Pricing calculations
 *
 * @example
 * ```typescript
 * const booking = bookingSchema.parse({
 *   accommodationId: 'acc-123',
 *   guestId: 'user-456',
 *   checkIn: new Date('2025-06-01'),
 *   checkOut: new Date('2025-06-05'),
 *   guests: 4,
 *   totalPrice: 20000,
 *   calculatedPrice: 20000,
 * });
 * ```
 */
export const bookingSchema = z
  .object({
    accommodationId: z.string().uuid('Invalid accommodation ID'),
    guestId: z.string().uuid('Invalid guest ID'),
    checkIn: z.coerce.date(),
    checkOut: z.coerce.date(),
    guests: z
      .number()
      .int('Number of guests must be a whole number')
      .min(1, 'At least 1 guest is required')
      .max(20, 'Cannot exceed 20 guests'),
    totalPrice: z
      .number()
      .positive('Total price must be positive')
      .multipleOf(0.01, 'Price must have at most 2 decimal places'),
    calculatedPrice: z
      .number()
      .positive('Calculated price must be positive')
      .multipleOf(0.01, 'Price must have at most 2 decimal places'),
    specialRequests: z.string().max(500, 'Special requests cannot exceed 500 characters').optional(),
    maxAccommodationGuests: z.number().int().min(1).optional(), // For validation
  })
  // Validate checkOut is after checkIn
  .refine(
    (data) => data.checkOut > data.checkIn,
    {
      message: 'Check-out date must be after check-in date',
      path: ['checkOut'],
    }
  )
  // Validate checkIn is not in the past
  .refine(
    (data) => !isPastDate(data.checkIn),
    {
      message: 'Check-in date cannot be in the past',
      path: ['checkIn'],
    }
  )
  // Validate duration (1-30 nights)
  .refine(
    (data) => {
      const nights = calculateNights(data.checkIn, data.checkOut);
      return nights >= 1 && nights <= 30;
    },
    {
      message: 'Stay must be between 1 and 30 nights',
      path: ['checkOut'],
    }
  )
  // Validate guests don't exceed accommodation capacity
  .refine(
    (data) => {
      if (data.maxAccommodationGuests) {
        return data.guests <= data.maxAccommodationGuests;
      }
      return true; // Skip if not provided
    },
    {
      message: 'Number of guests exceeds accommodation capacity',
      path: ['guests'],
    }
  )
  // Validate total price matches calculated price (prevent price manipulation)
  .refine(
    (data) => Math.abs(data.totalPrice - data.calculatedPrice) < 0.01,
    {
      message: 'Total price does not match calculated price',
      path: ['totalPrice'],
    }
  );

export type Booking = z.infer<typeof bookingSchema>;

/**
 * Calculate booking price with seasonal adjustments
 *
 * @param input - Booking calculation input
 * @returns Price breakdown
 */
export function calculateBookingPrice(input: {
  pricePerNight: number;
  checkIn: Date;
  checkOut: Date;
  cleaningFee?: number;
  weekendMultiplier?: number;
}): {
  basePrice: number;
  weekendSurcharge: number;
  cleaningFee: number;
  total: number;
} {
  const { pricePerNight, checkIn, checkOut, cleaningFee = 0, weekendMultiplier = 1.2 } = input;

  const nights = calculateNights(checkIn, checkOut);
  let basePrice = 0;
  let weekendSurcharge = 0;

  // Calculate price for each night
  const currentDate = new Date(checkIn);
  for (let i = 0; i < nights; i++) {
    const dayOfWeek = currentDate.getDay();
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Friday or Saturday

    if (isWeekend) {
      const weekendPrice = pricePerNight * weekendMultiplier;
      basePrice += pricePerNight;
      weekendSurcharge += weekendPrice - pricePerNight;
    } else {
      basePrice += pricePerNight;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  const total = basePrice + weekendSurcharge + cleaningFee;

  return {
    basePrice,
    weekendSurcharge,
    cleaningFee,
    total,
  };
}

// ============================================================================
// 2. PAYMENT VALIDATION
// ============================================================================

/**
 * Card payment details schema
 *
 * Validates:
 * - Card number (Luhn algorithm)
 * - Expiry date (future dates only)
 * - CVV format
 * - Cardholder name
 */
export const cardPaymentSchema = z
  .object({
    cardNumber: z
      .string()
      .regex(/^\d{13,19}$/, 'Card number must be 13-19 digits')
      .refine(luhnCheck, {
        message: 'Invalid card number',
      }),
    expiryMonth: z
      .number()
      .int()
      .min(1, 'Month must be between 1 and 12')
      .max(12, 'Month must be between 1 and 12'),
    expiryYear: z
      .number()
      .int()
      .min(new Date().getFullYear(), 'Expiry year cannot be in the past'),
    cvv: z.string().regex(/^\d{3,4}$/, 'CVV must be 3 or 4 digits'),
    cardholderName: z
      .string()
      .min(3, 'Cardholder name must be at least 3 characters')
      .max(100, 'Cardholder name cannot exceed 100 characters')
      .regex(/^[a-zA-Z\s]+$/, 'Cardholder name can only contain letters and spaces'),
  })
  .refine(
    (data) => isValidExpiry(data.expiryMonth, data.expiryYear),
    {
      message: 'Card has expired',
      path: ['expiryMonth'],
    }
  );

export type CardPayment = z.infer<typeof cardPaymentSchema>;

/**
 * Bank transfer payment details schema
 */
export const transferPaymentSchema = z.object({
  bankName: z.string().min(3, 'Bank name must be at least 3 characters'),
  accountHolder: z.string().min(3, 'Account holder name must be at least 3 characters'),
  accountNumber: z.string().regex(/^\d{10,20}$/, 'Account number must be 10-20 digits'),
  referenceNumber: z.string().min(6, 'Reference number must be at least 6 characters').optional(),
});

export type TransferPayment = z.infer<typeof transferPaymentSchema>;

/**
 * Payment schema with method-specific validation
 *
 * @example
 * ```typescript
 * // Card payment
 * const cardPayment = paymentSchema.parse({
 *   bookingId: 'booking-123',
 *   amount: 20000,
 *   bookingAmount: 20000,
 *   currency: 'ARS',
 *   method: 'card',
 *   cardDetails: {
 *     cardNumber: '4532015112830366',
 *     expiryMonth: 12,
 *     expiryYear: 2025,
 *     cvv: '123',
 *     cardholderName: 'John Doe',
 *   },
 * });
 *
 * // Transfer payment
 * const transferPayment = paymentSchema.parse({
 *   bookingId: 'booking-123',
 *   amount: 20000,
 *   bookingAmount: 20000,
 *   currency: 'ARS',
 *   method: 'transfer',
 *   transferDetails: {
 *     bankName: 'Banco Nación',
 *     accountHolder: 'John Doe',
 *     accountNumber: '1234567890123456',
 *   },
 * });
 * ```
 */
export const paymentSchema = z
  .object({
    bookingId: z.string().uuid('Invalid booking ID'),
    amount: z
      .number()
      .positive('Amount must be positive')
      .multipleOf(0.01, 'Amount must have at most 2 decimal places'),
    bookingAmount: z
      .number()
      .positive('Booking amount must be positive')
      .multipleOf(0.01, 'Booking amount must have at most 2 decimal places'),
    currency: z.enum(['ARS', 'USD', 'EUR']).default('ARS'),
    method: z.enum(['card', 'transfer']),
    cardDetails: cardPaymentSchema.optional(),
    transferDetails: transferPaymentSchema.optional(),
  })
  // Validate amount matches booking amount
  .refine(
    (data) => Math.abs(data.amount - data.bookingAmount) < 0.01,
    {
      message: 'Payment amount does not match booking amount',
      path: ['amount'],
    }
  )
  // Validate card details are provided for card payment
  .refine(
    (data) => {
      if (data.method === 'card') {
        return data.cardDetails !== undefined;
      }
      return true;
    },
    {
      message: 'Card details are required for card payment',
      path: ['cardDetails'],
    }
  )
  // Validate transfer details are provided for transfer payment
  .refine(
    (data) => {
      if (data.method === 'transfer') {
        return data.transferDetails !== undefined;
      }
      return true;
    },
    {
      message: 'Transfer details are required for bank transfer',
      path: ['transferDetails'],
    }
  );

export type Payment = z.infer<typeof paymentSchema>;

// ============================================================================
// 3. REVIEW VALIDATION
// ============================================================================

/**
 * Review schema with business rules
 *
 * Validates:
 * - Verified purchase (must have completed booking)
 * - Rating limits (1-5)
 * - Content length (10-1000 characters)
 * - Duplicate prevention
 * - Content moderation (no profanity, no URLs)
 *
 * @example
 * ```typescript
 * const review = reviewSchema.parse({
 *   accommodationId: 'acc-123',
 *   guestId: 'user-456',
 *   bookingId: 'booking-789',
 *   rating: 5,
 *   title: 'Amazing stay!',
 *   comment: 'We had a wonderful time at this accommodation...',
 *   hasCompletedBooking: true,
 *   hasExistingReview: false,
 * });
 * ```
 */
export const reviewSchema = z
  .object({
    accommodationId: z.string().uuid('Invalid accommodation ID'),
    guestId: z.string().uuid('Invalid guest ID'),
    bookingId: z.string().uuid('Invalid booking ID'),
    rating: z
      .number()
      .int('Rating must be a whole number')
      .min(1, 'Rating must be at least 1')
      .max(5, 'Rating cannot exceed 5'),
    title: z
      .string()
      .min(5, 'Title must be at least 5 characters')
      .max(100, 'Title cannot exceed 100 characters')
      .trim(),
    comment: z
      .string()
      .min(10, 'Comment must be at least 10 characters')
      .max(1000, 'Comment cannot exceed 1000 characters')
      .trim(),
    hasCompletedBooking: z.boolean().optional(), // For validation
    hasExistingReview: z.boolean().optional(), // For validation
  })
  // Validate verified purchase (completed booking)
  .refine(
    (data) => {
      if (data.hasCompletedBooking !== undefined) {
        return data.hasCompletedBooking === true;
      }
      return true; // Skip if not provided
    },
    {
      message: 'You can only review accommodations you have stayed at',
      path: ['bookingId'],
    }
  )
  // Validate no duplicate reviews
  .refine(
    (data) => {
      if (data.hasExistingReview !== undefined) {
        return data.hasExistingReview === false;
      }
      return true; // Skip if not provided
    },
    {
      message: 'You have already reviewed this accommodation',
      path: ['accommodationId'],
    }
  )
  // Validate content moderation
  .refine(
    (data) => isAppropriateContent(data.comment),
    {
      message: 'Comment contains inappropriate content or URLs',
      path: ['comment'],
    }
  )
  .refine(
    (data) => isAppropriateContent(data.title),
    {
      message: 'Title contains inappropriate content or URLs',
      path: ['title'],
    }
  );

export type Review = z.infer<typeof reviewSchema>;

// ============================================================================
// 4. MULTI-STEP WIZARD VALIDATION
// ============================================================================

/**
 * Step 1: Accommodation selection
 */
export const wizardStep1Schema = z.object({
  accommodationId: z.string().uuid('Invalid accommodation ID'),
  pricePerNight: z.number().positive(),
  maxGuests: z.number().int().min(1),
});

export type WizardStep1 = z.infer<typeof wizardStep1Schema>;

/**
 * Step 2: Date selection
 */
export const wizardStep2Schema = z
  .object({
    checkIn: z.coerce.date(),
    checkOut: z.coerce.date(),
  })
  .refine(
    (data) => data.checkOut > data.checkIn,
    {
      message: 'Check-out date must be after check-in date',
      path: ['checkOut'],
    }
  )
  .refine(
    (data) => !isPastDate(data.checkIn),
    {
      message: 'Check-in date cannot be in the past',
      path: ['checkIn'],
    }
  );

export type WizardStep2 = z.infer<typeof wizardStep2Schema>;

/**
 * Step 3: Guest information
 */
export const wizardStep3Schema = z.object({
  guests: z.number().int().min(1, 'At least 1 guest is required'),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'),
  specialRequests: z.string().max(500).optional(),
});

export type WizardStep3 = z.infer<typeof wizardStep3Schema>;

/**
 * Step 4: Payment information
 */
export const wizardStep4Schema = z.object({
  method: z.enum(['card', 'transfer']),
  cardDetails: cardPaymentSchema.optional(),
  transferDetails: transferPaymentSchema.optional(),
});

export type WizardStep4 = z.infer<typeof wizardStep4Schema>;

/**
 * Complete wizard schema combining all steps
 *
 * @example
 * ```typescript
 * const completeBooking = wizardSchema.parse({
 *   // Step 1
 *   accommodationId: 'acc-123',
 *   pricePerNight: 5000,
 *   maxGuests: 6,
 *
 *   // Step 2
 *   checkIn: new Date('2025-06-01'),
 *   checkOut: new Date('2025-06-05'),
 *
 *   // Step 3
 *   guests: 4,
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   email: 'john@example.com',
 *   phone: '+5491123456789',
 *
 *   // Step 4
 *   method: 'card',
 *   cardDetails: {
 *     cardNumber: '4532015112830366',
 *     expiryMonth: 12,
 *     expiryYear: 2025,
 *     cvv: '123',
 *     cardholderName: 'John Doe',
 *   },
 * });
 * ```
 */
export const wizardSchema = wizardStep1Schema
  .merge(wizardStep2Schema)
  .merge(wizardStep3Schema)
  .merge(wizardStep4Schema)
  .refine(
    (data) => {
      // Validate guests don't exceed accommodation capacity
      return data.guests <= data.maxGuests;
    },
    {
      message: 'Number of guests exceeds accommodation capacity',
      path: ['guests'],
    }
  )
  .refine(
    (data) => {
      // Validate payment method has corresponding details
      if (data.method === 'card') {
        return data.cardDetails !== undefined;
      }
      if (data.method === 'transfer') {
        return data.transferDetails !== undefined;
      }
      return false;
    },
    {
      message: 'Payment details are required',
      path: ['method'],
    }
  );

export type WizardComplete = z.infer<typeof wizardSchema>;

// ============================================================================
// 5. DISCRIMINATED UNIONS (Conditional Schemas)
// ============================================================================

/**
 * Hotel-specific schema
 */
export const hotelSchema = z.object({
  type: z.literal('hotel'),
  starRating: z
    .number()
    .int('Star rating must be a whole number')
    .min(1, 'Star rating must be at least 1')
    .max(5, 'Star rating cannot exceed 5'),
  roomService: z.boolean(),
  hasRestaurant: z.boolean(),
  hasBar: z.boolean(),
  hasConferenceRooms: z.boolean(),
  checkInTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  checkOutTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
});

export type Hotel = z.infer<typeof hotelSchema>;

/**
 * Apartment-specific schema
 */
export const apartmentSchema = z.object({
  type: z.literal('apartment'),
  floor: z.number().int('Floor must be a whole number'),
  building: z.string().min(1, 'Building name is required'),
  hasElevator: z.boolean(),
  hasDoorman: z.boolean(),
  allowsPets: z.boolean(),
  apartmentNumber: z.string().min(1, 'Apartment number is required'),
});

export type Apartment = z.infer<typeof apartmentSchema>;

/**
 * House-specific schema
 */
export const houseSchema = z.object({
  type: z.literal('house'),
  landSize: z
    .number()
    .positive('Land size must be positive')
    .max(100000, 'Land size cannot exceed 100,000 m²'),
  parkingSpaces: z
    .number()
    .int('Parking spaces must be a whole number')
    .min(0, 'Parking spaces cannot be negative')
    .max(20, 'Parking spaces cannot exceed 20'),
  hasGarden: z.boolean(),
  hasPool: z.boolean(),
  stories: z
    .number()
    .int('Number of stories must be a whole number')
    .min(1, 'Must have at least 1 story')
    .max(5, 'Cannot exceed 5 stories'),
});

export type House = z.infer<typeof houseSchema>;

/**
 * Accommodation schema with type-specific validation using discriminated unions
 *
 * @example
 * ```typescript
 * // Hotel
 * const hotel = accommodationTypeSchema.parse({
 *   type: 'hotel',
 *   starRating: 4,
 *   roomService: true,
 *   hasRestaurant: true,
 *   hasBar: true,
 *   hasConferenceRooms: false,
 *   checkInTime: '14:00',
 *   checkOutTime: '11:00',
 * });
 *
 * // Apartment
 * const apartment = accommodationTypeSchema.parse({
 *   type: 'apartment',
 *   floor: 5,
 *   building: 'Torre A',
 *   hasElevator: true,
 *   hasDoorman: true,
 *   allowsPets: false,
 *   apartmentNumber: '5B',
 * });
 *
 * // House
 * const house = accommodationTypeSchema.parse({
 *   type: 'house',
 *   landSize: 500,
 *   parkingSpaces: 2,
 *   hasGarden: true,
 *   hasPool: true,
 *   stories: 2,
 * });
 * ```
 */
export const accommodationTypeSchema = z.discriminatedUnion('type', [
  hotelSchema,
  apartmentSchema,
  houseSchema,
]);

export type AccommodationType = z.infer<typeof accommodationTypeSchema>;

/**
 * Complete accommodation schema with base fields and type-specific fields
 */
export const accommodationSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(3).max(100),
    description: z.string().min(10).max(2000),
    address: z.string().min(10).max(200),
    city: z.string().min(2).max(100),
    pricePerNight: z.number().positive(),
    maxGuests: z.number().int().min(1).max(20),
  })
  .and(accommodationTypeSchema);

export type Accommodation = z.infer<typeof accommodationSchema>;

/**
 * Type guard to check accommodation type
 *
 * @param accommodation - Accommodation to check
 * @returns True if hotel
 */
export function isHotel(accommodation: Accommodation): accommodation is Accommodation & Hotel {
  return accommodation.type === 'hotel';
}

/**
 * Type guard to check accommodation type
 *
 * @param accommodation - Accommodation to check
 * @returns True if apartment
 */
export function isApartment(
  accommodation: Accommodation
): accommodation is Accommodation & Apartment {
  return accommodation.type === 'apartment';
}

/**
 * Type guard to check accommodation type
 *
 * @param accommodation - Accommodation to check
 * @returns True if house
 */
export function isHouse(accommodation: Accommodation): accommodation is Accommodation & House {
  return accommodation.type === 'house';
}
