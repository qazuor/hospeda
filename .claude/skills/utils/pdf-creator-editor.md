---
name: pdf-creator-editor
category: utils
description: PDF creation and editing specialist for generating reports, invoices, documentation, and contracts
usage: Use when generating PDFs from data, creating invoices, producing reports, or converting documentation to PDF
input: Content data, template requirements, formatting specifications, output destination
output: Generated PDF files with proper formatting, styling, and metadata
---

# PDF Creator & Editor

## Overview

**Purpose**: Generate and edit PDF documents for invoices, reports, contracts, and documentation with proper formatting and professional appearance

**Category**: Utils
**Primary Users**: hono-engineer, tech-writer, payments-specialist, product-functional

## When to Use This Skill

- Generating booking confirmations
- Creating invoices for payments
- Producing monthly reports
- Generating contracts
- Converting documentation to PDF
- Creating printable receipts
- Generating analytics reports
- Creating tax documents

## Prerequisites

**Required:**

- Content data to include in PDF
- Template design or layout requirements
- Output specifications (size, orientation)

**Optional:**

- Company logo and branding assets
- Custom fonts
- Styling requirements
- Digital signature requirements

## Input

**What the skill needs:**

- **Content**: Data to include in PDF
- **Template**: Layout and structure
- **Styling**: Fonts, colors, spacing
- **Metadata**: Title, author, subject
- **Output**: Destination path or stream

## Workflow

### Step 1: Choose PDF Library

**Objective**: Select appropriate PDF generation library

**Available Libraries:**

1. **PDFKit** (Node.js)
   - Pros: Simple API, good for programmatic PDFs
   - Cons: Limited HTML/CSS support
   - Best for: Invoices, reports, receipts

2. **Puppeteer** (Headless Chrome)
   - Pros: Full HTML/CSS support, pixel-perfect
   - Cons: Heavier, requires Chrome
   - Best for: Complex layouts, documentation

3. **jsPDF** (Browser/Node)
   - Pros: Client-side generation, no server needed
   - Cons: Limited features
   - Best for: Simple client-side PDFs

4. **React-PDF** (@react-pdf/renderer)
   - Pros: React components for PDFs
   - Cons: Learning curve
   - Best for: React-based applications

**Decision Matrix:**

- Simple invoice/receipt → **PDFKit**
- Complex HTML layout → **Puppeteer**
- Client-side generation → **jsPDF**
- React application → **React-PDF**

**Validation:**

- [ ] Library supports required features
- [ ] Performance acceptable
- [ ] Dependencies acceptable
- [ ] Licensing compatible

**Output**: Selected PDF library

### Step 2: Setup and Configuration

**Objective**: Install and configure PDF generation

**PDFKit Setup:**

```typescript
import PDFDocument from 'pdfkit';
import fs from 'fs';

interface PDFConfig {
  size?: 'A4' | 'LETTER';
  margin?: number;
  layout?: 'portrait' | 'landscape';
}

export function createPDFDoc(config: PDFConfig = {}) {
  return new PDFDocument({
    size: config.size || 'A4',
    margin: config.margin || 50,
    layout: config.layout || 'portrait',
    bufferPages: true,
    autoFirstPage: true
  });
}
```

**Puppeteer Setup:**

```typescript
import puppeteer from 'puppeteer';

interface PDFOptions {
  format?: 'A4' | 'LETTER';
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  printBackground?: boolean;
}

export async function generatePDFFromHTML(
  html: string,
  options: PDFOptions = {}
): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdf = await page.pdf({
    format: options.format || 'A4',
    margin: options.margin || {
      top: '20mm',
      right: '20mm',
      bottom: '20mm',
      left: '20mm'
    },
    printBackground: options.printBackground ?? true
  });

  await browser.close();
  return pdf;
}
```

**Validation:**

- [ ] Library installed correctly
- [ ] Dependencies resolved
- [ ] Configuration working
- [ ] Test PDF generates

**Output**: Configured PDF generation setup

### Step 3: Create Invoice Template

**Objective**: Generate professional invoices

**Invoice with PDFKit:**

```typescript
import PDFDocument from 'pdfkit';

interface InvoiceData {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  from: {
    name: string;
    address: string;
    email: string;
  };
  to: {
    name: string;
    address: string;
    email: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
}

export function generateInvoice(data: InvoiceData): Buffer {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc
      .fontSize(20)
      .text('INVOICE', 50, 50);

    doc
      .fontSize(10)
      .text(`Invoice #: ${data.invoiceNumber}`, 50, 80)
      .text(`Date: ${data.date}`, 50, 95)
      .text(`Due Date: ${data.dueDate}`, 50, 110);

    // From section
    doc
      .fontSize(12)
      .text('From:', 50, 140)
      .fontSize(10)
      .text(data.from.name, 50, 160)
      .text(data.from.address, 50, 175)
      .text(data.from.email, 50, 190);

    // To section
    doc
      .fontSize(12)
      .text('To:', 300, 140)
      .fontSize(10)
      .text(data.to.name, 300, 160)
      .text(data.to.address, 300, 175)
      .text(data.to.email, 300, 190);

    // Items table
    const tableTop = 250;
    const itemHeight = 25;

    doc
      .fontSize(10)
      .text('Description', 50, tableTop, { bold: true })
      .text('Qty', 300, tableTop)
      .text('Price', 370, tableTop)
      .text('Total', 450, tableTop);

    doc
      .moveTo(50, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .stroke();

    let yPosition = tableTop + 25;

    data.items.forEach((item) => {
      doc
        .fontSize(9)
        .text(item.description, 50, yPosition)
        .text(item.quantity.toString(), 300, yPosition)
        .text(`$${item.price.toFixed(2)}`, 370, yPosition)
        .text(`$${item.total.toFixed(2)}`, 450, yPosition);

      yPosition += itemHeight;
    });

    // Totals
    const totalsTop = yPosition + 20;

    doc
      .fontSize(10)
      .text('Subtotal:', 370, totalsTop)
      .text(`$${data.subtotal.toFixed(2)}`, 450, totalsTop)
      .text('Tax:', 370, totalsTop + 20)
      .text(`$${data.tax.toFixed(2)}`, 450, totalsTop + 20);

    doc
      .moveTo(370, totalsTop + 35)
      .lineTo(550, totalsTop + 35)
      .stroke();

    doc
      .fontSize(12)
      .text('Total:', 370, totalsTop + 45, { bold: true })
      .text(`$${data.total.toFixed(2)}`, 450, totalsTop + 45);

    // Footer
    doc
      .fontSize(8)
      .text('Thank you for your business!', 50, 700, {
        align: 'center',
        width: 500
      });

    doc.end();
  });
}
```

**Invoice with Puppeteer (HTML template):**

```typescript
export function generateInvoiceHTML(data: InvoiceData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Arial', sans-serif;
          padding: 40px;
          color: #333;
        }
        .header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 40px;
        }
        .invoice-title {
          font-size: 32px;
          font-weight: bold;
          color: #2563EB;
        }
        .invoice-details {
          text-align: right;
          font-size: 14px;
        }
        .parties {
          display: flex;
          justify-content: space-between;
          margin-bottom: 40px;
        }
        .party h3 {
          margin-bottom: 10px;
          color: #2563EB;
        }
        .party p {
          margin: 5px 0;
          font-size: 14px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 40px;
        }
        th {
          background: #2563EB;
          color: white;
          padding: 12px;
          text-align: left;
          font-weight: 600;
        }
        td {
          padding: 12px;
          border-bottom: 1px solid #E5E7EB;
        }
        .totals {
          text-align: right;
          margin-bottom: 40px;
        }
        .totals-row {
          display: flex;
          justify-content: flex-end;
          margin: 10px 0;
          font-size: 14px;
        }
        .totals-row span:first-child {
          margin-right: 40px;
        }
        .total {
          font-size: 18px;
          font-weight: bold;
          color: #2563EB;
        }
        .footer {
          text-align: center;
          color: #6B7280;
          font-size: 12px;
          margin-top: 60px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="invoice-title">INVOICE</div>
        <div class="invoice-details">
          <p>Invoice #: ${data.invoiceNumber}</p>
          <p>Date: ${data.date}</p>
          <p>Due Date: ${data.dueDate}</p>
        </div>
      </div>

      <div class="parties">
        <div class="party">
          <h3>From</h3>
          <p>${data.from.name}</p>
          <p>${data.from.address}</p>
          <p>${data.from.email}</p>
        </div>
        <div class="party">
          <h3>To</h3>
          <p>${data.to.name}</p>
          <p>${data.to.address}</p>
          <p>${data.to.email}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Quantity</th>
            <th>Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${data.items.map(item => `
            <tr>
              <td>${item.description}</td>
              <td>${item.quantity}</td>
              <td>$${item.price.toFixed(2)}</td>
              <td>$${item.total.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-row">
          <span>Subtotal:</span>
          <span>$${data.subtotal.toFixed(2)}</span>
        </div>
        <div class="totals-row">
          <span>Tax:</span>
          <span>$${data.tax.toFixed(2)}</span>
        </div>
        <div class="totals-row total">
          <span>Total:</span>
          <span>$${data.total.toFixed(2)}</span>
        </div>
      </div>

      <div class="footer">
        <p>Thank you for your business!</p>
      </div>
    </body>
    </html>
  `;
}

// Generate PDF from HTML
async function createInvoicePDF(data: InvoiceData): Promise<Buffer> {
  const html = generateInvoiceHTML(data);
  return await generatePDFFromHTML(html);
}
```

**Validation:**

- [ ] Invoice renders correctly
- [ ] All data displayed
- [ ] Calculations accurate
- [ ] Professional appearance

**Output**: Invoice PDF generation

### Step 4: Create Booking Confirmation

**Objective**: Generate booking confirmation PDFs

```typescript
interface BookingConfirmation {
  bookingId: string;
  confirmationCode: string;
  guestName: string;
  accommodation: {
    name: string;
    address: string;
    images: string[];
  };
  dates: {
    checkIn: string;
    checkOut: string;
    nights: number;
  };
  guests: number;
  price: {
    perNight: number;
    total: number;
  };
  policies: {
    cancellation: string;
    checkInTime: string;
    checkOutTime: string;
  };
}

export async function generateBookingConfirmation(
  data: BookingConfirmation
): Promise<Buffer> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px;
        }
        .header {
          background: #2563EB;
          color: white;
          padding: 30px;
          text-align: center;
          margin-bottom: 30px;
        }
        .confirmation-code {
          font-size: 32px;
          font-weight: bold;
          margin: 20px 0;
        }
        .section {
          margin-bottom: 30px;
        }
        .section h2 {
          color: #2563EB;
          border-bottom: 2px solid #E5E7EB;
          padding-bottom: 10px;
          margin-bottom: 15px;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          margin: 10px 0;
          padding: 10px 0;
          border-bottom: 1px solid #F3F4F6;
        }
        .detail-label {
          font-weight: 600;
          color: #6B7280;
        }
        .price-total {
          font-size: 24px;
          color: #2563EB;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Booking Confirmed!</h1>
        <div class="confirmation-code">${data.confirmationCode}</div>
        <p>Keep this confirmation for your records</p>
      </div>

      <div class="section">
        <h2>Guest Information</h2>
        <div class="detail-row">
          <span class="detail-label">Name:</span>
          <span>${data.guestName}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Booking ID:</span>
          <span>${data.bookingId}</span>
        </div>
      </div>

      <div class="section">
        <h2>Accommodation</h2>
        <div class="detail-row">
          <span class="detail-label">Property:</span>
          <span>${data.accommodation.name}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Address:</span>
          <span>${data.accommodation.address}</span>
        </div>
      </div>

      <div class="section">
        <h2>Stay Details</h2>
        <div class="detail-row">
          <span class="detail-label">Check-in:</span>
          <span>${data.dates.checkIn} (${data.policies.checkInTime})</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Check-out:</span>
          <span>${data.dates.checkOut} (${data.policies.checkOutTime})</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Nights:</span>
          <span>${data.dates.nights}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Guests:</span>
          <span>${data.guests}</span>
        </div>
      </div>

      <div class="section">
        <h2>Pricing</h2>
        <div class="detail-row">
          <span class="detail-label">Per Night:</span>
          <span>$${data.price.perNight.toFixed(2)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Total:</span>
          <span class="price-total">$${data.price.total.toFixed(2)}</span>
        </div>
      </div>

      <div class="section">
        <h2>Policies</h2>
        <p><strong>Cancellation:</strong> ${data.policies.cancellation}</p>
      </div>
    </body>
    </html>
  `;

  return await generatePDFFromHTML(html);
}
```

**Validation:**

- [ ] Confirmation renders correctly
- [ ] All booking details included
- [ ] Branding consistent
- [ ] Policies clearly stated

**Output**: Booking confirmation PDF

### Step 5: Generate Reports

**Objective**: Create analytics and business reports

```typescript
interface MonthlyReport {
  month: string;
  year: number;
  metrics: {
    totalBookings: number;
    totalRevenue: number;
    averageBookingValue: number;
    occupancyRate: number;
  };
  topAccommodations: Array<{
    name: string;
    bookings: number;
    revenue: number;
  }>;
  revenueByDay: Array<{
    date: string;
    revenue: number;
  }>;
}

export async function generateMonthlyReport(
  data: MonthlyReport
): Promise<Buffer> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 40px;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
        }
        .metrics {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-bottom: 40px;
        }
        .metric-card {
          background: #F3F4F6;
          padding: 20px;
          border-radius: 8px;
        }
        .metric-value {
          font-size: 32px;
          font-weight: bold;
          color: #2563EB;
        }
        .metric-label {
          color: #6B7280;
          margin-top: 5px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        th {
          background: #2563EB;
          color: white;
          padding: 12px;
          text-align: left;
        }
        td {
          padding: 12px;
          border-bottom: 1px solid #E5E7EB;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Monthly Report</h1>
        <p>${data.month} ${data.year}</p>
      </div>

      <div class="metrics">
        <div class="metric-card">
          <div class="metric-value">${data.metrics.totalBookings}</div>
          <div class="metric-label">Total Bookings</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">$${data.metrics.totalRevenue.toFixed(2)}</div>
          <div class="metric-label">Total Revenue</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">$${data.metrics.averageBookingValue.toFixed(2)}</div>
          <div class="metric-label">Average Booking Value</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${data.metrics.occupancyRate.toFixed(1)}%</div>
          <div class="metric-label">Occupancy Rate</div>
        </div>
      </div>

      <h2>Top Accommodations</h2>
      <table>
        <thead>
          <tr>
            <th>Accommodation</th>
            <th>Bookings</th>
            <th>Revenue</th>
          </tr>
        </thead>
        <tbody>
          ${data.topAccommodations.map(acc => `
            <tr>
              <td>${acc.name}</td>
              <td>${acc.bookings}</td>
              <td>$${acc.revenue.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;

  return await generatePDFFromHTML(html);
}
```

**Validation:**

- [ ] Report data accurate
- [ ] Charts/tables render correctly
- [ ] Professional formatting
- [ ] Readable at print size

**Output**: Business report PDF

## Output

**Produces:**

- Professional PDF documents
- Invoices with proper calculations
- Booking confirmations
- Business reports
- Properly formatted and styled PDFs

**Success Criteria:**

- PDFs generate without errors
- All content rendered correctly
- Professional appearance
- Proper metadata set
- Optimized file size

## Best Practices

1. **Fonts**: Use web-safe fonts or embed custom fonts
2. **Images**: Optimize images before embedding
3. **Layout**: Test print layout before finalizing
4. **Metadata**: Set PDF title, author, subject
5. **Compression**: Compress PDFs for web delivery
6. **Validation**: Test on multiple PDF viewers
7. **Accessibility**: Include proper structure tags
8. **Security**: Set permissions appropriately
9. **Templates**: Reuse templates for consistency
10. **Testing**: Test with various data scenarios

## Related Skills

- payments-specialist - Invoice generation
- tech-writer - Documentation conversion

## Notes

- PDFKit for simple programmatic PDFs
- Puppeteer for complex HTML layouts
- Always test print output
- Set proper page breaks for long content
- Include page numbers on multi-page documents
- Test file size with various content
- Consider PDF/A for archival purposes

---

## Changelog

| Version | Date | Changes | Author | Related |
|---------|------|---------|--------|---------|
| 1.0.0 | 2025-10-31 | Initial version | @tech-lead | P-004 |
