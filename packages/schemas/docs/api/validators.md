# Custom Validators Guide - @repo/schemas

**Master custom validation with refinements, transforms, and custom validators**

This guide covers all custom validation patterns available in the `@repo/schemas` package, including built-in utilities, custom refinements, transforms, and how to create your own validators.

## Table of Contents

- [Built-in Zod Validators](#built-in-zod-validators)
- [Custom Refinements](#custom-refinements)
- [Custom Transforms](#custom-transforms)
- [Creating Your Own Validators](#creating-your-own-validators)
- [Composing Validators](#composing-validators)
- [Async Validation](#async-validation)
- [Conditional Validation](#conditional-validation)
- [Error Messages](#error-messages)
- [Best Practices](#best-practices)

## Built-in Zod Validators

Before diving into custom validators, understand Zod's built-in validation methods.

### String Validators

```typescript
import { z } from 'zod';

// Basic
z.string()
z.string().min(5)
z.string().max(100)
z.string().length(10)
z.string().email()
z.string().url()
z.string().uuid()
z.string().cuid()
z.string().regex(/^[a-z0-9]+$/)

// Advanced
z.string().trim()
z.string().toLowerCase()
z.string().toUpperCase()
z.string().startsWith('prefix')
z.string().endsWith('suffix')
z.string().datetime()   // ISO 8601
z.string().ip()         // v4 or v6
```

### Number Validators

```typescript
// Basic
z.number()
z.number().min(0)
z.number().max(100)
z.number().int()
z.number().positive()
z.number().negative()
z.number().nonnegative()
z.number().nonpositive()
z.number().multipleOf(5)

// Advanced
z.number().finite()
z.number().safe()      // Within Number.MAX_SAFE_INTEGER
```

### Date Validators

```typescript
z.date()
z.date().min(new Date('2024-01-01'))
z.date().max(new Date('2024-12-31'))
```

### Array Validators

```typescript
z.array(z.string())
z.array(z.string()).min(1)
z.array(z.string()).max(10)
z.array(z.string()).length(5)
z.array(z.string()).nonempty()
```

### Object Validators

```typescript
z.object({ name: z.string() })
z.object({ name: z.string() }).strict()    // No extra keys
z.object({ name: z.string() }).passthrough() // Allow extra keys
```

## Custom Refinements

Refinements add custom validation logic to existing schemas using `.refine()` or `.superRefine()`.

### Basic Refinement with .refine()

```typescript
import { z } from 'zod';

// Simple refinement
const passwordSchema = z.string().refine(
  (val) => val.length >= 8,
  { message: 'Password must be at least 8 characters' }
);

// Multiple conditions
const strongPasswordSchema = z.string().refine(
  (val) => {
    const hasUpperCase = /[A-Z]/.test(val);
    const hasLowerCase = /[a-z]/.test(val);
    const hasNumber = /[0-9]/.test(val);
    const hasSpecialChar = /[^A-Za-z0-9]/.test(val);

    return hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
  },
  {
    message: 'Password must contain uppercase, lowercase, number, and special character'
  }
);
```

### Refinements in @repo/schemas

#### Slug Validation

```typescript
import { SlugRegex } from '@repo/schemas';

export const slugSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(SlugRegex, {
    message: 'Slug must be lowercase with hyphens only'
  });

// SlugRegex pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
// Valid: 'my-slug', 'slug-123', 'a'
// Invalid: 'My-Slug', 'slug_name', 'slug--name', '-slug', 'slug-'
```

**Usage:**

```typescript
const result = slugSchema.safeParse('my-valid-slug');
// { success: true, data: 'my-valid-slug' }

const invalid = slugSchema.safeParse('Invalid-Slug');
// { success: false, error: { ... } }
```

#### Phone Number Validation

```typescript
import { InternationalPhoneRegex } from '@repo/schemas';

export const phoneSchema = z
  .string()
  .regex(InternationalPhoneRegex, {
    message: 'Phone must be in international format (E.164)'
  });

// InternationalPhoneRegex: /^\+[1-9]\d{1,14}(?:\s\d{1,15})*$/
// Valid: '+5491123456789', '+1234567890'
// Invalid: '123456', '(11) 1234-5678'
```

#### Time Validation

```typescript
import { TimeRegExp } from '@repo/schemas';

export const timeSchema = z
  .string()
  .regex(TimeRegExp, {
    message: 'Time must be in HH:mm format (24-hour)'
  });

// TimeRegExp: /^([01]\d|2[0-3]):([0-5]\d)$/
// Valid: '14:30', '09:00', '23:59'
// Invalid: '25:00', '14:60', '9:00'
```

#### Coordinate Validation

```typescript
import { isValidLatitude, isValidLongitude } from '@repo/schemas';

export const latitudeSchema = z.string().refine(
  (val) => isValidLatitude(val),
  { message: 'Invalid latitude (-90 to 90)' }
);

export const longitudeSchema = z.string().refine(
  (val) => isValidLongitude(val),
  { message: 'Invalid longitude (-180 to 180)' }
);

// Usage
latitudeSchema.parse('-34.603722'); // ✅ Buenos Aires
longitudeSchema.parse('-58.381592'); // ✅ Buenos Aires

latitudeSchema.parse('91'); // ❌ Out of range
```

### Advanced Refinements with .superRefine()

`.superRefine()` provides more control over error handling:

```typescript
const userSchema = z.object({
  password: z.string(),
  confirmPassword: z.string()
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Passwords do not match',
      path: ['confirmPassword']
    });
  }

  if (data.password.length < 8) {
    ctx.addIssue({
      code: z.ZodIssueCode.too_small,
      minimum: 8,
      type: 'string',
      inclusive: true,
      message: 'Password must be at least 8 characters',
      path: ['password']
    });
  }
});
```

**Multiple field validation:**

```typescript
const bookingSchema = z.object({
  checkInDate: z.date(),
  checkOutDate: z.date(),
  guests: z.number().min(1)
}).superRefine((data, ctx) => {
  // Check-out must be after check-in
  if (data.checkOutDate <= data.checkInDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Check-out date must be after check-in date',
      path: ['checkOutDate']
    });
  }

  // Minimum stay of 1 night
  const nights = Math.ceil(
    (data.checkOutDate.getTime() - data.checkInDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (nights < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Minimum stay is 1 night',
      path: ['checkOutDate']
    });
  }
});
```

## Custom Transforms

Transforms modify data during parsing while maintaining type safety.

### Basic Transforms

```typescript
// Trim strings
const trimmedSchema = z.string().transform((val) => val.trim());

// Lowercase
const lowercaseSchema = z.string().transform((val) => val.toLowerCase());

// Uppercase
const uppercaseSchema = z.string().transform((val) => val.toUpperCase());

// Parse number from string
const numberFromStringSchema = z.string().transform((val) => parseFloat(val));

// Parse date from string
const dateFromStringSchema = z.string().transform((val) => new Date(val));
```

### Slug Transform

```typescript
export const slugFromString = z.string().transform((val) =>
  val
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')    // Replace non-alphanumeric with -
    .replace(/^-+|-+$/g, '')        // Remove leading/trailing -
);

// Usage
const result = slugFromString.parse('Hello World! 123');
// Result: 'hello-world-123'
```

### Normalize Text Transform

```typescript
export const normalizeText = z.string().transform((val) =>
  val
    .trim()
    .replace(/\s+/g, ' ')           // Replace multiple spaces with single
    .replace(/\n\s*\n/g, '\n\n')    // Normalize line breaks
);

// Usage
const result = normalizeText.parse('  Hello    World  ');
// Result: 'Hello World'
```

### Complex Transform

```typescript
const userInputSchema = z.object({
  email: z.string().email().transform((val) => val.toLowerCase()),
  name: z.string().transform((val) => val.trim()),
  tags: z.array(z.string()).transform((arr) =>
    arr
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0)
  )
});

// Usage
const result = userInputSchema.parse({
  email: 'JOHN@EXAMPLE.COM',
  name: '  John Doe  ',
  tags: ['  Tag1  ', '', 'TAG2', '  ']
});

// Result:
// {
//   email: 'john@example.com',
//   name: 'John Doe',
//   tags: ['tag1', 'tag2']
// }
```

## Creating Your Own Validators

### Custom Validator Pattern

```typescript
import { z } from 'zod';

// 1. Define validation function
export function isValidCUIT(cuit: string): boolean {
  // Remove non-digits
  const digits = cuit.replace(/\D/g, '');

  if (digits.length !== 11) return false;

  // CUIT validation algorithm
  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = digits
    .slice(0, 10)
    .split('')
    .reduce((acc, digit, index) => acc + parseInt(digit) * multipliers[index], 0);

  const verifier = (11 - (sum % 11)) % 11;
  return verifier === parseInt(digits[10]);
}

// 2. Create schema with refinement
export const cuitSchema = z
  .string()
  .refine(isValidCUIT, {
    message: 'Invalid CUIT format or checksum'
  });

// 3. Optional: Add transform for formatting
export const cuitFormattedSchema = cuitSchema.transform((val) => {
  const digits = val.replace(/\D/g, '');
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
});
```

**Usage:**

```typescript
// Validation
const result = cuitSchema.safeParse('20-12345678-9');

if (result.success) {
  console.log('Valid CUIT:', result.data);
} else {
  console.error('Invalid CUIT:', result.error.message);
}

// With formatting
const formatted = cuitFormattedSchema.parse('20123456789');
// Result: '20-12345678-9'
```

### Argentine DNI Validator

```typescript
export function isValidDNI(dni: string): boolean {
  const digits = dni.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 8;
}

export const dniSchema = z
  .string()
  .refine(isValidDNI, {
    message: 'DNI must be 7 or 8 digits'
  });

export const dniFormattedSchema = dniSchema.transform((val) => {
  const digits = val.replace(/\D/g, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
});

// Usage
const formatted = dniFormattedSchema.parse('12345678');
// Result: '12.345.678'
```

### Price Validator

```typescript
export function isValidPrice(price: number): boolean {
  // Must be positive and have max 2 decimal places
  return price > 0 && Math.round(price * 100) === price * 100;
}

export const priceSchema = z
  .number()
  .refine(isValidPrice, {
    message: 'Price must be positive with max 2 decimal places'
  });

// Usage
priceSchema.parse(19.99); // ✅ Valid
priceSchema.parse(19.999); // ❌ Too many decimals
priceSchema.parse(-10); // ❌ Negative
```

### URL Validator with Allowed Domains

```typescript
export function isAllowedDomain(url: string, allowedDomains: string[]): boolean {
  try {
    const parsed = new URL(url);
    return allowedDomains.some(domain =>
      parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

export const allowedUrlSchema = (allowedDomains: string[]) =>
  z.string().url().refine(
    (url) => isAllowedDomain(url, allowedDomains),
    (url) => ({
      message: `URL must be from allowed domains: ${allowedDomains.join(', ')}`
    })
  );

// Usage
const socialUrlSchema = allowedUrlSchema([
  'facebook.com',
  'instagram.com',
  'twitter.com'
]);

socialUrlSchema.parse('https://facebook.com/page'); // ✅ Valid
socialUrlSchema.parse('https://example.com'); // ❌ Not allowed
```

## Composing Validators

### Combining Multiple Validators

```typescript
const emailSchema = z.string().email().toLowerCase();

const uniqueEmailSchema = emailSchema.refine(
  async (email) => {
    const exists = await checkEmailExists(email);
    return !exists;
  },
  { message: 'Email already exists' }
);
```

### Chain Refinements

```typescript
const usernameSchema = z.string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username cannot exceed 20 characters')
  .regex(/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores')
  .refine(
    (val) => !val.startsWith('_'),
    'Username cannot start with underscore'
  )
  .refine(
    (val) => !val.endsWith('_'),
    'Username cannot end with underscore'
  );
```

### Reusable Validator Factories

```typescript
// Factory for min/max string length with custom messages
export const stringLength = (min: number, max: number, fieldName: string) =>
  z.string()
    .min(min, `${fieldName} must be at least ${min} characters`)
    .max(max, `${fieldName} cannot exceed ${max} characters`);

// Usage
const nameSchema = stringLength(2, 50, 'Name');
const bioSchema = stringLength(10, 500, 'Bio');

// Factory for required enum with message
export const requiredEnum = <T extends readonly [string, ...string[]]>(
  values: T,
  fieldName: string
) => z.enum(values, {
  errorMap: () => ({ message: `${fieldName} must be one of: ${values.join(', ')}` })
});

// Usage
const roleSchema = requiredEnum(['user', 'admin'], 'Role');
```

## Async Validation

### Basic Async Refinement

```typescript
const emailSchema = z.string().email().refine(
  async (email) => {
    const response = await fetch(`/api/check-email?email=${email}`);
    const data = await response.json();
    return !data.exists;
  },
  { message: 'Email already registered' }
);

// Usage with parseAsync
const result = await emailSchema.parseAsync('user@example.com');
```

### Multiple Async Checks

```typescript
const userSchema = z.object({
  email: z.string().email(),
  username: z.string()
}).refine(
  async (data) => {
    const [emailExists, usernameExists] = await Promise.all([
      checkEmailExists(data.email),
      checkUsernameExists(data.username)
    ]);
    return !emailExists && !usernameExists;
  },
  {
    message: 'Email or username already exists',
    path: ['email'] // Error will appear on email field
  }
);
```

### Async Validation in Forms

```typescript
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

const registerSchema = z.object({
  email: z.string().email().refine(
    async (email) => {
      const available = await checkEmailAvailable(email);
      return available;
    },
    { message: 'Email already taken' }
  )
});

export function RegisterForm() {
  const form = useForm({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur' // Trigger async validation on blur
  });

  // ...
}
```

## Conditional Validation

### Based on Other Fields

```typescript
const paymentSchema = z.object({
  method: z.enum(['credit_card', 'bank_transfer']),
  cardNumber: z.string().optional(),
  bankAccount: z.string().optional()
}).superRefine((data, ctx) => {
  if (data.method === 'credit_card' && !data.cardNumber) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Card number is required for credit card payments',
      path: ['cardNumber']
    });
  }

  if (data.method === 'bank_transfer' && !data.bankAccount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Bank account is required for bank transfers',
      path: ['bankAccount']
    });
  }
});
```

### Discriminated Union

```typescript
const paymentSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('credit_card'),
    cardNumber: z.string().regex(/^\d{16}$/),
    cvv: z.string().regex(/^\d{3,4}$/)
  }),
  z.object({
    method: z.literal('bank_transfer'),
    bankAccount: z.string(),
    routingNumber: z.string()
  })
]);

// Type narrowing works automatically
function processPayment(payment: z.infer<typeof paymentSchema>) {
  switch (payment.method) {
    case 'credit_card':
      // TypeScript knows cardNumber and cvv exist
      console.log(payment.cardNumber);
      break;
    case 'bank_transfer':
      // TypeScript knows bankAccount and routingNumber exist
      console.log(payment.bankAccount);
      break;
  }
}
```

## Error Messages

### Custom Error Messages

```typescript
// Per-validator messages
const nameSchema = z.string()
  .min(2, { message: 'Name must be at least 2 characters' })
  .max(50, { message: 'Name cannot exceed 50 characters' });

// Custom error map
const ageSchema = z.number({
  required_error: 'Age is required',
  invalid_type_error: 'Age must be a number'
})
.min(18, { message: 'You must be at least 18 years old' })
.max(120, { message: 'Age must be less than 120' });
```

### Internationalization (i18n)

```typescript
import { z } from 'zod';
import { zodI18nMap } from 'zod-i18n-map';

// Set custom error map
z.setErrorMap(zodI18nMap);

// Now errors will use i18n messages
const schema = z.string().min(2);
schema.parse('a'); // Error message in user's language
```

### Field-Specific Errors

```typescript
const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  age: z.number().min(18, 'You must be 18 or older')
});

const result = schema.safeParse({
  email: 'invalid',
  password: 'short',
  age: 16
});

if (!result.success) {
  result.error.issues.forEach(issue => {
    console.log(`${issue.path.join('.')}: ${issue.message}`);
  });
}

// Output:
// email: Please enter a valid email address
// password: Password must be at least 8 characters
// age: You must be 18 or older
```

## Best Practices

### 1. Reuse Common Validators

```typescript
// ✅ Define once, reuse everywhere
export const emailSchema = z.string().email().toLowerCase();

export const UserSchema = z.object({
  email: emailSchema,
  backupEmail: emailSchema.optional()
});

// ❌ Don't repeat validation logic
export const UserSchema = z.object({
  email: z.string().email().toLowerCase(),
  backupEmail: z.string().email().toLowerCase().optional()
});
```

### 2. Provide Clear Error Messages

```typescript
// ✅ Clear, actionable messages
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(
    /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)/,
    'Password must contain at least one uppercase letter, one lowercase letter, and one number'
  );

// ❌ Vague messages
const passwordSchema = z.string()
  .min(8, 'Too short')
  .regex(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)/, 'Invalid format');
```

### 3. Use superRefine for Complex Logic

```typescript
// ✅ Use superRefine for multiple field validation
const schema = z.object({
  startDate: z.date(),
  endDate: z.date()
}).superRefine((data, ctx) => {
  if (data.endDate <= data.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End date must be after start date',
      path: ['endDate']
    });
  }
});

// ❌ Don't use refine for multi-field validation
const schema = z.object({
  startDate: z.date(),
  endDate: z.date()
}).refine(
  (data) => data.endDate > data.startDate,
  { message: 'End date must be after start date' }
  // Can't specify which field has the error!
);
```

### 4. Document Custom Validators

```typescript
/**
 * Validates Argentine CUIT (Código Único de Identificación Tributaria)
 *
 * Format: XX-XXXXXXXX-X (11 digits total)
 * - First 2 digits: Entity type
 * - Next 8 digits: ID number
 * - Last digit: Verification digit
 *
 * @example
 * cuitSchema.parse('20-12345678-9'); // Valid
 * cuitSchema.parse('123'); // Invalid - too short
 */
export const cuitSchema = z.string().refine(isValidCUIT, {
  message: 'Invalid CUIT format or checksum'
});
```

### 5. Separate Concerns

```typescript
// ✅ Separate validation from transformation
const emailValidationSchema = z.string().email();
const emailTransformSchema = emailValidationSchema.transform(val => val.toLowerCase());

// Use validation for API input
app.post('/check-email', zValidator('json', emailValidationSchema), ...);

// Use transform for user signup
app.post('/signup', zValidator('json', emailTransformSchema), ...);
```

### 6. Test Custom Validators

```typescript
import { describe, it, expect } from 'vitest';
import { cuitSchema } from './validators';

describe('cuitSchema', () => {
  it('should accept valid CUIT', () => {
    const result = cuitSchema.safeParse('20-12345678-9');
    expect(result.success).toBe(true);
  });

  it('should reject invalid CUIT', () => {
    const result = cuitSchema.safeParse('123');
    expect(result.success).toBe(false);
  });

  it('should accept CUIT without separators', () => {
    const result = cuitSchema.safeParse('20123456789');
    expect(result.success).toBe(true);
  });
});
```

### 7. Handle Async Validation Carefully

```typescript
// ✅ Use debounce for frequent async checks
import { debounce } from 'lodash';

const checkEmailDebounced = debounce(
  async (email: string) => {
    return await checkEmailExists(email);
  },
  500
);

const emailSchema = z.string().email().refine(
  async (email) => !(await checkEmailDebounced(email)),
  { message: 'Email already exists' }
);
```

### 8. Compose Validators Logically

```typescript
// ✅ Build from simple to complex
const baseStringSchema = z.string();
const trimmedStringSchema = baseStringSchema.transform(val => val.trim());
const nonEmptyStringSchema = trimmedStringSchema.min(1);
const slugSchema = nonEmptyStringSchema.regex(/^[a-z0-9-]+$/);

// Now use at appropriate abstraction level
export { slugSchema }; // Export the final, complete validator
```

## Related Documentation

- **[Quick Start Guide](../quick-start.md)**: Get started with schemas
- **[Schema Reference](./schema-reference.md)**: All available schemas
- **[Type Inference Guide](./type-inference.md)**: Working with types
- **[Main Documentation](../README.md)**: Package overview

## Further Reading

- [Zod Documentation - Refinements](https://zod.dev/?id=refine)
- [Zod Documentation - Transforms](https://zod.dev/?id=transform)
- [Zod Documentation - Custom Error Messages](https://zod.dev/?id=customize-error-messages)
