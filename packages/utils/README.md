# @repo/utils

Shared utility functions for the Hospeda monorepo. Provides commonly used utilities for array manipulation, string processing, date operations, currency formatting, object operations, and validation.

## Installation

This package is part of the Hospeda monorepo workspace. Add it as a dependency in your `package.json`:

```json
{
  "dependencies": {
    "@repo/utils": "workspace:*"
  }
}
```

Then run:

```bash
pnpm install
```

## What's Included

- **array** - Array manipulation utilities (chunk, unique, groupBy, etc.)
- **string** - String processing utilities (slugify, truncate, capitalize, etc.)
- **date** - Date manipulation utilities (format, add, difference, etc.)
- **currency** - Currency formatting and calculation utilities
- **object** - Object manipulation utilities (pick, omit, merge, etc.)
- **validation** - Validation helper functions (email, URL, phone, etc.)

## Usage

### Array Utilities

Functions for working with arrays:

```typescript
import {
  isEmptyArray,
  getRandomItem,
  shuffleArray,
  groupBy,
  uniqueArray,
  chunkArray,
  arrayIntersection,
  arrayDifference,
  sortArrayByKey
} from '@repo/utils';

// Check if array is empty
isEmptyArray([]);  // true
isEmptyArray(null);  // true
isEmptyArray([1, 2, 3]);  // false

// Get random item
const items = ['apple', 'banana', 'orange'];
getRandomItem(items);  // 'banana' (random)

// Shuffle array
shuffleArray([1, 2, 3, 4]);  // [3, 1, 4, 2] (random order)

// Group items by key
const users = [
  { name: 'Juan', role: 'admin' },
  { name: 'María', role: 'user' },
  { name: 'Pedro', role: 'admin' }
];
groupBy(users, (u) => u.role);
// { admin: [{...}, {...}], user: [{...}] }

// Remove duplicates
uniqueArray([1, 2, 2, 3, 3, 3]);  // [1, 2, 3]
uniqueArray(
  [{ id: 1 }, { id: 2 }, { id: 1 }],
  (item) => item.id
);  // [{ id: 1 }, { id: 2 }]

// Chunk into smaller arrays
chunkArray([1, 2, 3, 4, 5], 2);
// [[1, 2], [3, 4], [5]]

// Find intersection
arrayIntersection([1, 2, 3], [2, 3, 4]);  // [2, 3]

// Find difference
arrayDifference([1, 2, 3], [2, 3, 4]);  // [1]

// Sort by key
sortArrayByKey(users, 'name', 'asc');
// Sorted by name ascending
```

### String Utilities

Functions for string manipulation:

```typescript
import {
  capitalize,
  titleCase,
  truncate,
  toSlug,
  createUniqueSlug,
  stripHtml,
  isEmpty,
  randomString
} from '@repo/utils';

// Capitalize first letter
capitalize('hello');  // 'Hello'

// Convert to title case
titleCase('hello world');  // 'Hello World'

// Truncate string
truncate('Long text here', 10);  // 'Long te...'
truncate('Long text here', 10, '…');  // 'Long text…'

// Create URL slug
toSlug('Casa de Playa en Concepción');
// 'casa-de-playa-en-concepcion'

// Create unique slug (async)
const slug = await createUniqueSlug(
  'My Accommodation',
  async (slug) => {
    // Check if slug exists in database
    return !!(await db.accommodation.findBySlug(slug));
  }
);
// Returns 'my-accommodation' or 'my-accommodation-2' if exists

// Strip HTML tags
stripHtml('<p>Hello <strong>world</strong></p>');
// 'Hello world'

// Check if string is empty
isEmpty('');  // true
isEmpty('  ');  // true
isEmpty(null);  // true
isEmpty('hello');  // false

// Generate random string
randomString(8);  // 'aB3xYz9K'
randomString(12, '0123456789');  // '482916375028'
```

### Date Utilities

Functions for date manipulation using `date-fns`:

```typescript
import {
  formatDate,
  formatRelativeDate,
  formatDateDistance,
  parseDate,
  isValidDate,
  isDateBefore,
  isDateAfter,
  areDatesEqual,
  getDaysDifference,
  getHoursDifference,
  getMinutesDifference,
  addDaysToDate,
  addMonthsToDate,
  addYearsToDate
} from '@repo/utils';

// Format date
formatDate(new Date());  // '2024-01-15'
formatDate('2024-01-15', 'dd/MM/yyyy');  // '15/01/2024'
formatDate(new Date(), 'PPP');  // 'January 15, 2024'

// Format relative to now
formatRelativeDate('2024-01-15');
// 'yesterday at 3:00 PM'

// Format distance
formatDateDistance('2024-01-15');
// '2 days ago'
formatDateDistance('2024-01-15', new Date(), { addSuffix: true });
// 'in 2 days'

// Parse date
parseDate('15/01/2024', 'dd/MM/yyyy');
// Date object

// Validate date
isValidDate(new Date());  // true
isValidDate('2024-01-15');  // true
isValidDate('invalid');  // false

// Compare dates
isDateBefore('2024-01-15', '2024-01-20');  // true
isDateAfter('2024-01-20', '2024-01-15');  // true
areDatesEqual('2024-01-15', '2024-01-15');  // true

// Calculate differences
getDaysDifference('2024-01-20', '2024-01-15');  // 5
getHoursDifference('2024-01-15 14:00', '2024-01-15 10:00');  // 4
getMinutesDifference(date1, date2);  // 120

// Add time periods
addDaysToDate(new Date(), 7);  // Date 7 days from now
addMonthsToDate('2024-01-15', 3);  // Date 3 months from Jan 15
addYearsToDate(new Date(), 1);  // Date 1 year from now
```

### Currency Utilities

Functions for currency formatting and calculations:

```typescript
import {
  formatCurrency,
  convertCurrency,
  calculateTax,
  calculateTotalWithTax,
  calculateDiscount,
  calculateTotalWithDiscount,
  parseCurrency
} from '@repo/utils';

// Format currency
formatCurrency(1250.50, 'USD');  // '$1,250.50'
formatCurrency(1250.50, 'ARS', 'es-AR');  // '$ 1.250,50'
formatCurrency(1250.50, 'EUR', 'de-DE');  // '1.250,50 €'

// Convert currency
const rates = { USD: 1, ARS: 350, EUR: 0.92 };
convertCurrency(100, 'USD', 'ARS', rates);  // 35000

// Calculate tax
calculateTax(1000, 21);  // 210 (21% tax)

// Calculate total with tax
calculateTotalWithTax(1000, 21);  // 1210

// Calculate discount
calculateDiscount(1000, 10);  // 100 (10% discount)

// Calculate total with discount
calculateTotalWithDiscount(1000, 10);  // 900

// Parse currency string to number
parseCurrency('$ 1.250,50');  // 1250.50
parseCurrency('$1,250.50');  // 1250.50
```

### Object Utilities

Functions for object manipulation:

```typescript
import {
  isEmptyObject,
  pick,
  omit,
  deepClone,
  deepMerge,
  isObject,
  flattenObject,
  objectToQueryString
} from '@repo/utils';

// Check if object is empty
isEmptyObject({});  // true
isEmptyObject({ name: 'Juan' });  // false

// Pick properties
const user = { id: 1, name: 'Juan', email: 'juan@example.com', role: 'admin' };
pick(user, ['id', 'name']);  // { id: 1, name: 'Juan' }

// Omit properties
omit(user, ['email', 'role']);  // { id: 1, name: 'Juan' }

// Deep clone
const original = { user: { name: 'Juan', settings: { theme: 'dark' } } };
const cloned = deepClone(original);
cloned.user.name = 'María';  // Doesn't affect original

// Deep merge
const defaults = { theme: 'light', fontSize: 14 };
const userSettings = { theme: 'dark' };
deepMerge(defaults, userSettings);
// { theme: 'dark', fontSize: 14 }

// Check if value is object
isObject({ name: 'Juan' });  // true
isObject([1, 2, 3]);  // false
isObject(null);  // false

// Flatten nested object
flattenObject({
  user: {
    name: 'Juan',
    address: { city: 'Concepción' }
  }
});
// { 'user.name': 'Juan', 'user.address.city': 'Concepción' }

// Convert to query string
objectToQueryString({ city: 'Concepción', guests: 2 });
// 'city=Concepci%C3%B3n&guests=2'
```

### Validation Utilities

Functions for common validation tasks:

```typescript
import {
  isDefined,
  isValidEmail,
  isValidUrl,
  isValidPhone,
  isValidPassword,
  isNumber,
  isString,
  isBoolean,
  isFunction
} from '@repo/utils';

// Check if defined (not null/undefined)
isDefined('hello');  // true
isDefined(null);  // false
isDefined(undefined);  // false

// Validate email
isValidEmail('juan@example.com');  // true
isValidEmail('invalid');  // false

// Validate URL
isValidUrl('https://hospeda.com');  // true
isValidUrl('not-a-url');  // false

// Validate phone
isValidPhone('+5493435123456');  // true
isValidPhone('123');  // false

// Validate password
isValidPassword('MyPass123!');  // true
isValidPassword('weak');  // false

// Custom password validation
isValidPassword('MyPassword', {
  minLength: 6,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: false,
  requireSpecialChars: false
});  // true

// Type checks
isNumber(42);  // true
isString('hello');  // true
isBoolean(true);  // true
isFunction(() => {});  // true
```

## API Reference

### Array Functions

- `isEmptyArray<T>(arr?: T[] | null): boolean` - Check if array is empty
- `getRandomItem<T>(arr: T[]): T | undefined` - Get random item
- `shuffleArray<T>(arr: T[]): T[]` - Shuffle array
- `groupBy<T, K>(arr: T[], keyGetter: (item: T) => K): Record<K, T[]>` - Group by key
- `uniqueArray<T, K>(arr: T[], keyGetter?: (item: T) => K): T[]` - Remove duplicates
- `chunkArray<T>(arr: T[], size: number): T[][]` - Split into chunks
- `arrayIntersection<T>(arr1: T[], arr2: T[]): T[]` - Find common elements
- `arrayDifference<T>(arr1: T[], arr2: T[]): T[]` - Find unique to arr1
- `sortArrayByKey<T>(arr: T[], key: keyof T, direction?: 'asc' | 'desc'): T[]` - Sort by property

### String Functions

- `capitalize(str: string): string` - Capitalize first letter
- `titleCase(str: string): string` - Convert to title case
- `truncate(str: string, length: number, suffix?: string): string` - Truncate with ellipsis
- `toSlug(str: string, options?: SlugifyOptions): string` - Create URL slug
- `createUniqueSlug(str: string, checkExists: (slug: string) => Promise<boolean>): Promise<string>` - Create unique slug
- `stripHtml(html: string): string` - Remove HTML tags
- `isEmpty(str?: string | null): boolean` - Check if empty/whitespace
- `randomString(length?: number, chars?: string): string` - Generate random string

### Date Functions

- `formatDate(date: Date | string | number, formatStr?: string): string` - Format date
- `formatRelativeDate(date: Date | string | number, baseDate?: Date): string` - Relative format
- `formatDateDistance(date: Date | string | number, baseDate?: Date): string` - Distance format
- `parseDate(dateStr: string, formatStr: string, referenceDate?: Date): Date` - Parse date
- `isValidDate(date: unknown): boolean` - Validate date
- `isDateBefore(date: Date | string, compareDate: Date | string): boolean` - Check if before
- `isDateAfter(date: Date | string, compareDate: Date | string): boolean` - Check if after
- `areDatesEqual(date1: Date | string, date2: Date | string): boolean` - Check if equal
- `getDaysDifference(date1: Date | string, date2: Date | string): number` - Days between
- `getHoursDifference(date1: Date | string, date2: Date | string): number` - Hours between
- `getMinutesDifference(date1: Date | string, date2: Date | string): number` - Minutes between
- `addDaysToDate(date: Date | string, days: number): Date` - Add days
- `addMonthsToDate(date: Date | string, months: number): Date` - Add months
- `addYearsToDate(date: Date | string, years: number): Date` - Add years

### Currency Functions

- `formatCurrency(amount: number, currency?: string, locale?: string): string` - Format as currency
- `convertCurrency(amount: number, from: string, to: string, rates: Record<string, number>): number` - Convert currency
- `calculateTax(amount: number, taxRate: number): number` - Calculate tax amount
- `calculateTotalWithTax(amount: number, taxRate: number): number` - Total with tax
- `calculateDiscount(amount: number, discountRate: number): number` - Calculate discount
- `calculateTotalWithDiscount(amount: number, discountRate: number): number` - Total with discount
- `parseCurrency(currencyString: string): number` - Parse to number

### Object Functions

- `isEmptyObject(obj: Record<string, unknown>): boolean` - Check if empty
- `pick<T, K>(obj: T, keys: K[]): Pick<T, K>` - Pick properties
- `omit<T, K>(obj: T, keys: K[]): Omit<T, K>` - Omit properties
- `deepClone<T>(obj: T): T` - Deep clone object
- `deepMerge<T, U>(target: T, source: U): T & U` - Deep merge objects
- `isObject(item: unknown): boolean` - Check if object
- `flattenObject(obj: Record<string, unknown>, prefix?: string): Record<string, unknown>` - Flatten to dot notation
- `objectToQueryString(params: Record<string, unknown>): string` - Convert to query string

### Validation Functions

- `isDefined<T>(value: T | undefined | null): value is T` - Check if defined
- `isValidEmail(email: string): boolean` - Validate email
- `isValidUrl(url: string): boolean` - Validate URL
- `isValidPhone(phone: string): boolean` - Validate phone (simple)
- `isValidPassword(password: string, options?: PasswordOptions): boolean` - Validate password
- `isNumber(value: unknown): boolean` - Check if number
- `isString(value: unknown): boolean` - Check if string
- `isBoolean(value: unknown): boolean` - Check if boolean
- `isFunction(value: unknown): boolean` - Check if function

## Dependencies

This package uses:

- **date-fns** (^4.1.0) - Date manipulation
- **slugify** (^1.6.6) - URL slug generation

## Best Practices

### When to Use vs External Libraries

**Use @repo/utils when:**

- You need simple, common operations
- You want consistent utilities across the monorepo
- The operation is lightweight and frequently used

**Use external libraries (lodash, date-fns directly) when:**

- You need advanced features (e.g., complex date parsing)
- You need locale-specific functionality
- Performance is critical for large datasets

### Performance Tips

```typescript
// ✅ Good: Use built-in methods for simple operations
const unique = [...new Set(simpleArray)];

// ✅ Also good: Use utils for type-safe operations
const unique = uniqueArray(complexArray, (item) => item.id);

// ❌ Avoid: Over-nesting utilities
const result = sortArrayByKey(
  uniqueArray(
    chunkArray(items, 10).flat(),
    (item) => item.id
  ),
  'name'
);

// ✅ Better: Break into steps
const chunked = chunkArray(items, 10);
const flattened = chunked.flat();
const unique = uniqueArray(flattened, (item) => item.id);
const sorted = sortArrayByKey(unique, 'name');
```

### Type Safety

```typescript
// ✅ Use TypeScript generics for type inference
const users: User[] = [...];
const grouped = groupBy(users, (u) => u.role);
// Type: Record<string, User[]>

// ✅ Use type guards
if (isDefined(user)) {
  // user is User (not null/undefined)
  console.log(user.name);
}

// ✅ Use validation functions in schemas
import { z } from 'zod';

const schema = z.object({
  email: z.string().refine(isValidEmail, 'Invalid email'),
  url: z.string().refine(isValidUrl, 'Invalid URL')
});
```

## Common Patterns

### Creating Slugs for Entities

```typescript
import { createUniqueSlug } from '@repo/utils';

// In your service
async createAccommodation(input: CreateInput) {
  const slug = await createUniqueSlug(
    input.title,
    async (s) => !!(await this.model.findBySlug(s))
  );

  return this.model.create({ ...input, slug });
}
```

### Formatting Currency for Display

```typescript
import { formatCurrency } from '@repo/utils';

// In components
export function PriceDisplay({ amount, currency = 'ARS' }) {
  return <span>{formatCurrency(amount, currency, 'es-AR')}</span>;
}
```

### Validating User Input

```typescript
import { isValidEmail, isValidPassword } from '@repo/utils';

// In forms
export function validateSignup(data: SignupInput) {
  const errors: Record<string, string> = {};

  if (!isValidEmail(data.email)) {
    errors.email = 'Invalid email address';
  }

  if (!isValidPassword(data.password)) {
    errors.password = 'Password must be at least 8 characters with uppercase, lowercase, numbers, and special characters';
  }

  return errors;
}
```

### Working with Dates

```typescript
import { formatDate, getDaysDifference, addDaysToDate } from '@repo/utils';

// Calculate booking duration
const checkIn = new Date('2024-01-15');
const checkOut = new Date('2024-01-20');
const nights = getDaysDifference(checkOut, checkIn);  // 5

// Format for display
const displayDate = formatDate(checkIn, 'PPP');  // 'January 15, 2024'

// Calculate cancellation deadline (e.g., 2 days before check-in)
const cancellationDeadline = addDaysToDate(checkIn, -2);
```

## Related Packages

- [@repo/config](../config) - Environment configuration
- [@repo/logger](../logger) - Logging utilities
- [@repo/schemas](../schemas) - Zod validation schemas

## License

MIT
