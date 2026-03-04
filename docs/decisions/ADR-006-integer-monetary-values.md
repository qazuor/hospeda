# ADR-006: Integer Storage for Monetary Values

## Status

Accepted

## Context

The platform handles monetary values throughout the billing system (subscription prices, add-on costs, promotional discounts, exchange rates). During development, a significant issue was discovered:

- PostgreSQL's `numeric()` / `decimal()` types return **strings** in JavaScript when queried through most database drivers, including the one used by Drizzle ORM.
- This caused type confusion throughout the codebase, where values expected to be numbers arrived as strings, leading to incorrect comparisons and arithmetic.
- Argentine Pesos (ARS) use two decimal places (centavos), following the same pattern as USD cents or EUR cents.
- Floating-point arithmetic in JavaScript is inherently imprecise for monetary calculations (e.g., `0.1 + 0.2 !== 0.3`).

## Decision

We store all monetary amounts as **integers representing centavos** (the smallest currency unit). For example, ARS 1,500.50 is stored as `150050`. Conversion to display format happens at the presentation layer.

## Consequences

### Positive

- **No floating-point errors** .. Integer arithmetic is exact. `15000 + 50 === 15050` is always true, unlike `150.00 + 0.50`.
- **Clean integer math** .. All calculations (totals, discounts, taxes) use integer addition, subtraction, and multiplication without precision concerns.
- **Consistent types** .. Values are always `number` (integer) in TypeScript. No surprise string conversions from the database driver.
- **Standard industry practice** .. This is the same approach used by Stripe, MercadoPago, and most payment processors, making integration natural.

### Negative

- **Display conversion required** .. Every monetary value must be divided by 100 before display, adding a consistent but easy-to-forget step.
- **Migration effort** .. Existing decimal-stored values had to be converted to integer centavos during the transition.
- **Mental overhead** .. Developers must remember that `150050` means ARS 1,500.50, not ARS 150,050.

### Neutral

- The `@repo/billing` package provides utility functions for centavo-to-display conversion, reducing the risk of display errors.
- Database storage size for integers is comparable to or smaller than numeric/decimal columns.

## Alternatives Considered

### PostgreSQL numeric/decimal

Using `numeric(10, 2)` was the initial approach. It was abandoned because:

- The PostgreSQL driver returns `numeric` values as JavaScript strings (e.g., `"1500.50"` instead of `1500.50`).
- This required manual parsing (`parseFloat`) at every query boundary, which was error-prone and defeated the purpose of strong typing.
- No built-in way to enforce the numeric-to-number conversion at the ORM level.

### JavaScript float

Storing and working with floating-point numbers was rejected because:

- JavaScript's IEEE 754 floating-point representation introduces rounding errors in monetary calculations.
- Classic example: `0.1 + 0.2 === 0.30000000000000004` is unacceptable for financial data.
- Accumulation of rounding errors across many transactions could result in real monetary discrepancies.

### String Representation

Storing amounts as formatted strings (e.g., `"1500.50"`) was rejected because:

- Arithmetic operations on strings require parsing, which is error-prone and slow.
- Comparisons and sorting on strings do not work correctly for numeric values.
- Adds unnecessary complexity to every calculation.
