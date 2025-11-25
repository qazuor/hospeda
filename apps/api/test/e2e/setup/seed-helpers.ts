import {
    ClientModel,
    InvoiceLineModel,
    InvoiceModel,
    PricingPlanModel,
    ProductModel,
    ProfessionalServiceModel,
    ProfessionalServiceOrderModel,
    ProfessionalServiceTypeModel,
    SubscriptionModel,
    UserModel
} from '@repo/db';
import type {
    Client,
    Invoice,
    InvoiceLine,
    PricingPlan,
    Product,
    ProfessionalService,
    ProfessionalServiceOrder,
    ProfessionalServiceType,
    RoleEnum,
    Subscription,
    User
} from '@repo/schemas';
import {
    InvoiceStatusEnum,
    ProfessionalServiceCategoryEnum,
    ServiceOrderStatusEnum
} from '@repo/schemas';

/**
 * E2E test data seeding helpers
 * Provides utilities to create test data for E2E scenarios
 */

/**
 * Create a test user with optional overrides
 * @param overrides - Partial user data to override defaults
 * @returns Created user
 */
export async function createTestUser(overrides?: Partial<User>): Promise<User> {
    const userModel = new UserModel();

    const timestamp = Date.now();
    const defaultData = {
        clerkId: overrides?.clerkId || `test_clerk_${timestamp}`,
        email: overrides?.email || `test-user-${timestamp}@example.com`,
        slug: overrides?.slug || `test-user-${timestamp}`,
        firstName: overrides?.firstName || 'Test',
        lastName: overrides?.lastName || 'User',
        role: overrides?.role || ('USER' as RoleEnum),
        permissions: overrides?.permissions || [],
        settings: overrides?.settings || {
            notifications: {
                enabled: true,
                allowEmails: true,
                allowSms: false,
                allowPush: false
            }
        },
        ...overrides
    };

    const result = await userModel.create(defaultData as any);
    return result as User;
}

/**
 * Create a test client with optional overrides
 * @param overrides - Partial client data to override defaults
 * @returns Created client
 */
export async function createTestClient(overrides?: Partial<Client>): Promise<Client> {
    const clientModel = new ClientModel();

    const defaultData = {
        name: overrides?.name || `Test Client ${Date.now()}`,
        billingEmail: overrides?.billingEmail || `test-${Date.now()}@example.com`,
        userId: null,
        ...overrides
    };

    const result = await clientModel.create(defaultData as any);
    return result as Client;
}

/**
 * Create a test product
 * @param overrides - Partial product data to override defaults
 * @returns Created product
 */
export async function createTestProduct(overrides?: Partial<Product>): Promise<Product> {
    const productModel = new ProductModel();

    const defaultData = {
        name: overrides?.name || `Test Product ${Date.now()}`,
        description: overrides?.description || 'Test product description',
        type: overrides?.type || ('listing_plan' as const), // Default to listing_plan for test subscriptions
        ...overrides
    };

    const result = await productModel.create(defaultData as any);
    return result as Product;
}

/**
 * Create a test pricing plan (creates product first if not provided)
 * @param overrides - Partial plan data to override defaults
 * @returns Created plan
 */
export async function createTestPlan(overrides?: Partial<PricingPlan>): Promise<PricingPlan> {
    const planModel = new PricingPlanModel();

    // Create a product first if productId is not provided
    let productId = overrides?.productId;
    if (!productId) {
        const product = await createTestProduct();
        productId = product.id;
    }

    const defaultData = {
        productId,
        billingScheme: 'recurring' as const, // Use enum value directly
        interval: 'month' as const, // Use enum value directly
        amount: 1000,
        currency: 'ARS',
        ...overrides
    };

    const result = await planModel.create(defaultData as any);
    return result as PricingPlan;
}

/**
 * Create a test subscription
 * @param clientId - Client ID for the subscription
 * @param pricingPlanId - Pricing plan ID for the subscription
 * @param overrides - Partial subscription data to override defaults
 * @returns Created subscription
 */
export async function createTestSubscription(
    clientId: string,
    pricingPlanId: string,
    overrides?: Partial<Subscription>
): Promise<Subscription> {
    const subscriptionModel = new SubscriptionModel();

    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1); // 1 month from now

    const defaultData = {
        clientId,
        pricingPlanId,
        startDate: now,
        endDate,
        status: 'active' as const, // Default status
        ...overrides
    };

    const result = await subscriptionModel.create(defaultData as any);
    return result as Subscription;
}

/**
 * Create a complete subscription flow setup
 * Returns client, plan, and subscription
 */
export async function setupSubscriptionFlow() {
    const client = await createTestClient();
    const plan = await createTestPlan();
    const subscription = await createTestSubscription(client.id, plan.id);

    return { client, plan, subscription };
}

/**
 * Create multiple test clients
 * @param count - Number of clients to create
 * @param baseOverrides - Base overrides to apply to all clients
 * @returns Array of created clients
 */
export async function createTestClients(
    count: number,
    baseOverrides?: Partial<Client>
): Promise<Client[]> {
    const clients: Client[] = [];

    for (let i = 0; i < count; i++) {
        const client = await createTestClient({
            ...baseOverrides,
            name: `${baseOverrides?.name || 'Test Client'} ${i + 1}`,
            billingEmail: `test-${i + 1}-${Date.now()}@example.com`
        });
        clients.push(client);
    }

    return clients;
}

/**
 * Create multiple test plans
 * @param count - Number of plans to create
 * @param baseOverrides - Base overrides to apply to all plans
 * @returns Array of created plans
 */
export async function createTestPlans(
    count: number,
    baseOverrides?: Partial<PricingPlan>
): Promise<PricingPlan[]> {
    const plans: PricingPlan[] = [];

    for (let i = 0; i < count; i++) {
        const plan = await createTestPlan({
            ...baseOverrides,
            amount: (baseOverrides?.amount || 1000) + i * 500
        });
        plans.push(plan);
    }

    return plans;
}

/**
 * Create a test professional service type
 * @param overrides - Partial data to override defaults
 * @returns Created professional service type
 */
export async function createTestProfessionalServiceType(
    overrides?: Partial<ProfessionalServiceType>
): Promise<ProfessionalServiceType> {
    const model = new ProfessionalServiceTypeModel();

    const timestamp = Date.now();
    const defaultData = {
        name: overrides?.name || `Test Service Type ${timestamp}`,
        category: overrides?.category || ProfessionalServiceCategoryEnum.PHOTOGRAPHY,
        description: overrides?.description || 'A test professional service type for E2E testing',
        defaultPricing: overrides?.defaultPricing || {
            hourlyRate: 50,
            fixedPrice: 500,
            currency: 'ARS',
            notes: 'Test pricing'
        },
        isActive: overrides?.isActive ?? true,
        ...overrides
    };

    const result = await model.create(defaultData as any);
    return result as ProfessionalServiceType;
}

/**
 * Create a test professional service
 * @param overrides - Partial data to override defaults
 * @returns Created professional service
 */
export async function createTestProfessionalService(
    overrides?: Partial<ProfessionalService>
): Promise<ProfessionalService> {
    const model = new ProfessionalServiceModel();

    const timestamp = Date.now();
    const defaultData = {
        name: overrides?.name || `Test Professional Service ${timestamp}`,
        description:
            overrides?.description ||
            'A test professional service for E2E testing with detailed description',
        category: overrides?.category || ProfessionalServiceCategoryEnum.PHOTOGRAPHY,
        defaultPricing: overrides?.defaultPricing || {
            basePrice: 150,
            currency: 'ARS',
            billingUnit: 'project' as const,
            minOrderValue: 100,
            maxOrderValue: 10000
        },
        isActive: overrides?.isActive ?? true,
        ...overrides
    };

    const result = await model.create(defaultData as any);
    return result as ProfessionalService;
}

/**
 * Create a test professional service order
 * @param clientId - Client ID for the order
 * @param serviceTypeId - Service type ID for the order
 * @param pricingPlanId - Pricing plan ID for the order
 * @param overrides - Partial data to override defaults
 * @returns Created professional service order
 */
export async function createTestProfessionalServiceOrder(
    clientId: string,
    serviceTypeId: string,
    pricingPlanId: string,
    overrides?: Partial<ProfessionalServiceOrder>
): Promise<ProfessionalServiceOrder> {
    const model = new ProfessionalServiceOrderModel();

    const defaultData = {
        clientId,
        serviceTypeId,
        pricingPlanId,
        status: overrides?.status || ServiceOrderStatusEnum.PENDING,
        orderedAt: overrides?.orderedAt || new Date(),
        notes: overrides?.notes || 'Test order notes',
        clientRequirements:
            overrides?.clientRequirements || 'Test client requirements for the order',
        ...overrides
    };

    const result = await model.create(defaultData as any);
    return result as ProfessionalServiceOrder;
}

/**
 * Create a complete professional service flow setup
 * Returns client, service type, pricing plan, and service
 */
export async function setupProfessionalServiceFlow() {
    const client = await createTestClient();
    const serviceType = await createTestProfessionalServiceType();
    const plan = await createTestPlan();
    const service = await createTestProfessionalService();

    return { client, serviceType, plan, service };
}

/**
 * Create a complete professional service order flow setup
 * Returns client, service type, pricing plan, and order
 */
export async function setupProfessionalServiceOrderFlow() {
    const client = await createTestClient();
    const serviceType = await createTestProfessionalServiceType();
    const plan = await createTestPlan();
    const order = await createTestProfessionalServiceOrder(client.id, serviceType.id, plan.id);

    return { client, serviceType, plan, order };
}

/**
 * Generate a unique invoice number
 * @returns Generated invoice number
 */
function generateInvoiceNumber(): string {
    const year = new Date().getFullYear();
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, '0');
    return `INV-${year}-${timestamp}-${random}`;
}

/**
 * Create a test invoice
 * @param clientId - Client ID for the invoice
 * @param overrides - Partial data to override defaults
 * @returns Created invoice
 */
export async function createTestInvoice(
    clientId: string,
    overrides?: Partial<Invoice>
): Promise<Invoice> {
    const model = new InvoiceModel();

    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 30); // 30 days from now

    const subtotal = overrides?.subtotal ?? 1000;
    const taxes = overrides?.taxes ?? 210; // 21% IVA
    const total = overrides?.total ?? subtotal + taxes;

    const defaultData = {
        clientId,
        invoiceNumber: overrides?.invoiceNumber || generateInvoiceNumber(),
        status: overrides?.status || InvoiceStatusEnum.OPEN,
        subtotal,
        taxes,
        total,
        currency: overrides?.currency || 'ARS',
        issueDate: overrides?.issueDate || now,
        dueDate: overrides?.dueDate || dueDate,
        description: overrides?.description,
        paymentTerms: overrides?.paymentTerms,
        notes: overrides?.notes,
        metadata: overrides?.metadata,
        ...overrides
    };

    const result = await model.create(defaultData as any);
    return result as Invoice;
}

/**
 * Create a test invoice line
 * @param invoiceId - Invoice ID for the line
 * @param overrides - Partial data to override defaults
 * @returns Created invoice line
 */
export async function createTestInvoiceLine(
    invoiceId: string,
    overrides?: Partial<InvoiceLine>
): Promise<InvoiceLine> {
    const model = new InvoiceLineModel();

    const quantity = overrides?.quantity ?? 1;
    const unitPrice = overrides?.unitPrice ?? 1000;
    const total = overrides?.total ?? quantity * unitPrice;

    const defaultData = {
        invoiceId,
        description: overrides?.description || 'Test invoice line item',
        quantity,
        unitPrice,
        total,
        productReference: overrides?.productReference,
        taxAmount: overrides?.taxAmount,
        taxRate: overrides?.taxRate,
        discountRate: overrides?.discountRate,
        discountAmount: overrides?.discountAmount,
        notes: overrides?.notes,
        metadata: overrides?.metadata,
        ...overrides
    };

    const result = await model.create(defaultData as any);
    return result as InvoiceLine;
}

/**
 * Create a complete invoice flow setup
 * Returns client, invoice, and invoice lines
 */
export async function setupInvoiceFlow(lineCount = 1) {
    const client = await createTestClient();

    // Calculate totals based on line items
    const lineAmount = 1000;
    const taxRate = 0.21;
    const subtotal = lineAmount * lineCount;
    const taxes = Math.round(subtotal * taxRate);
    const total = subtotal + taxes;

    const invoice = await createTestInvoice(client.id, {
        subtotal,
        taxes,
        total
    });

    const lines: InvoiceLine[] = [];
    for (let i = 0; i < lineCount; i++) {
        const line = await createTestInvoiceLine(invoice.id, {
            description: `Service item ${i + 1}`,
            quantity: 1,
            unitPrice: lineAmount,
            total: lineAmount
        });
        lines.push(line);
    }

    return { client, invoice, lines };
}
