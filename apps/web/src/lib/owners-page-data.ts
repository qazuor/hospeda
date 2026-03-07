/**
 * Localized content data for the property owners (propietarios) landing page.
 * Extracted from propietarios/index.astro to keep the page under 500 lines.
 */
import type { SupportedLocale } from './i18n';

/** Hero section content shape */
export interface OwnerHeroContent {
    readonly headline: string;
    readonly subheadline: string;
    readonly ctaPrimary: string;
    readonly ctaSecondary: string;
}

/** Single benefit item */
export interface OwnerBenefit {
    readonly icon: string;
    readonly title: string;
    readonly description: string;
}

/** Benefits section content shape */
export interface OwnerBenefitsContent {
    readonly sectionTitle: string;
    readonly sectionSubtitle: string;
    readonly benefits: OwnerBenefit[];
}

/** Single how-it-works step */
export interface OwnerStep {
    readonly number: number;
    readonly title: string;
    readonly description: string;
}

/** How it works section content shape */
export interface OwnerHowItWorksContent {
    readonly sectionTitle: string;
    readonly sectionSubtitle: string;
    readonly steps: OwnerStep[];
}

/** Single FAQ item */
export interface OwnerFaqItem {
    readonly question: string;
    readonly answer: string;
}

/** FAQ section content shape */
export interface OwnerFaqContent {
    readonly sectionTitle: string;
    readonly faqs: OwnerFaqItem[];
}

/** Final CTA section content shape */
export interface OwnerFinalCtaContent {
    readonly title: string;
    readonly subtitle: string;
    readonly ctaPrimary: string;
    readonly ctaSecondary: string;
}

// --- Hero ---

/** Localized hero section content */
export const OWNER_HERO: Record<SupportedLocale, OwnerHeroContent> = {
    es: {
        headline: 'Publica tu alojamiento y llega a miles de viajeros',
        subheadline:
            'Hospeda es la plataforma lider para descubrir alojamientos en Concepcion del Uruguay y toda la region del Litoral argentino. Conecta con viajeros que buscan exactamente lo que tu ofreces.',
        ctaPrimary: 'Comenzar Ahora',
        ctaSecondary: 'Ver Planes'
    },
    en: {
        headline: 'List your property and reach thousands of travelers',
        subheadline:
            'Hospeda is the leading platform for discovering accommodations in Concepcion del Uruguay and the entire Argentine Litoral region. Connect with travelers looking for exactly what you offer.',
        ctaPrimary: 'Start Now',
        ctaSecondary: 'See Plans'
    },
    pt: {
        headline: 'Publique seu alojamento e alcance milhares de viajantes',
        subheadline:
            'Hospeda e a plataforma lider para descobrir alojamentos em Concepcion del Uruguay e em toda a regiao do Litoral argentino. Conecte-se com viajantes que buscam exatamente o que voce oferece.',
        ctaPrimary: 'Comecar Agora',
        ctaSecondary: 'Ver Planos'
    }
};

// --- Benefits ---

/** Localized benefits section content */
export const OWNER_BENEFITS: Record<SupportedLocale, OwnerBenefitsContent> = {
    es: {
        sectionTitle: 'Todo lo que necesitas para gestionar tu alojamiento',
        sectionSubtitle:
            'Herramientas profesionales diseñadas para que puedas enfocarte en lo que mejor sabes hacer: brindar una experiencia increible a tus huespedes.',
        benefits: [
            {
                icon: 'search',
                title: 'Visibilidad Online',
                description:
                    'Tu alojamiento aparece en los resultados de busqueda de miles de viajeros que visitan el Litoral argentino cada año.'
            },
            {
                icon: 'dashboard',
                title: 'Panel de Gestion',
                description:
                    'Administra tu propiedad desde un panel intuitivo. Actualiza disponibilidad, precios y fotos en tiempo real.'
            },
            {
                icon: 'star',
                title: 'Reseñas de Huespedes',
                description:
                    'Construye tu reputacion con reseñas verificadas de huespedes reales. Mas reseñas positivas, mas reservas.'
            },
            {
                icon: 'statistics',
                title: 'Estadisticas y Analiticas',
                description:
                    'Accede a datos detallados sobre visitas, reservas y rendimiento de tu propiedad para tomar mejores decisiones.'
            },
            {
                icon: 'chat',
                title: 'Soporte Dedicado',
                description:
                    'Nuestro equipo esta disponible para ayudarte con cualquier consulta o problema que pueda surgir.'
            },
            {
                icon: 'settings',
                title: 'Herramientas Profesionales',
                description:
                    'Configura politicas de cancelacion, precios estacionales, descuentos y mucho mas con nuestras herramientas avanzadas.'
            }
        ]
    },
    en: {
        sectionTitle: 'Everything you need to manage your property',
        sectionSubtitle:
            'Professional tools designed so you can focus on what you do best: providing an incredible experience to your guests.',
        benefits: [
            {
                icon: 'search',
                title: 'Online Visibility',
                description:
                    'Your property appears in search results for thousands of travelers visiting the Argentine Litoral every year.'
            },
            {
                icon: 'dashboard',
                title: 'Management Dashboard',
                description:
                    'Manage your property from an intuitive dashboard. Update availability, prices and photos in real time.'
            },
            {
                icon: 'star',
                title: 'Guest Reviews',
                description:
                    'Build your reputation with verified reviews from real guests. More positive reviews, more bookings.'
            },
            {
                icon: 'statistics',
                title: 'Statistics and Analytics',
                description:
                    'Access detailed data on visits, bookings and property performance to make better decisions.'
            },
            {
                icon: 'chat',
                title: 'Dedicated Support',
                description:
                    'Our team is available to help you with any question or issue that may arise.'
            },
            {
                icon: 'settings',
                title: 'Professional Tools',
                description:
                    'Set cancellation policies, seasonal pricing, discounts and much more with our advanced tools.'
            }
        ]
    },
    pt: {
        sectionTitle: 'Tudo que voce precisa para gerir seu alojamento',
        sectionSubtitle:
            'Ferramentas profissionais projetadas para que voce possa se concentrar no que faz melhor: proporcionar uma experiencia incrivel aos seus hospedes.',
        benefits: [
            {
                icon: 'search',
                title: 'Visibilidade Online',
                description:
                    'Seu alojamento aparece nos resultados de pesquisa de milhares de viajantes que visitam o Litoral argentino a cada ano.'
            },
            {
                icon: 'dashboard',
                title: 'Painel de Gestao',
                description:
                    'Gerencie sua propriedade a partir de um painel intuitivo. Atualize disponibilidade, precos e fotos em tempo real.'
            },
            {
                icon: 'star',
                title: 'Avaliacoes de Hospedes',
                description:
                    'Construa sua reputacao com avaliacoes verificadas de hospedes reais. Mais avaliacoes positivas, mais reservas.'
            },
            {
                icon: 'statistics',
                title: 'Estatisticas e Analiticas',
                description:
                    'Acesse dados detalhados sobre visitas, reservas e desempenho da sua propriedade para tomar melhores decisoes.'
            },
            {
                icon: 'chat',
                title: 'Suporte Dedicado',
                description:
                    'Nossa equipe esta disponivel para ajuda-lo com qualquer duvida ou problema que possa surgir.'
            },
            {
                icon: 'settings',
                title: 'Ferramentas Profissionais',
                description:
                    'Configure politicas de cancelamento, precos sazonais, descontos e muito mais com nossas ferramentas avancadas.'
            }
        ]
    }
};

// --- How It Works ---

/** Localized how-it-works section content */
export const OWNER_HOW_IT_WORKS: Record<SupportedLocale, OwnerHowItWorksContent> = {
    es: {
        sectionTitle: 'Como funciona',
        sectionSubtitle:
            'Publicar tu alojamiento es rapido y sencillo. En solo 3 pasos estaras recibiendo huespedes.',
        steps: [
            {
                number: 1,
                title: 'Registra tu cuenta',
                description:
                    'Crea tu cuenta gratuita en Hospeda. Solo necesitas tu email y algunos datos basicos para comenzar.'
            },
            {
                number: 2,
                title: 'Publica tu propiedad',
                description:
                    'Completa el perfil de tu alojamiento con fotos, descripcion, servicios y precios. Nuestro asistente te guia paso a paso.'
            },
            {
                number: 3,
                title: 'Recibe huespedes y genera ingresos',
                description:
                    'Tu propiedad queda visible inmediatamente. Gestionalo todo desde tu panel y empieza a recibir consultas y reservas.'
            }
        ]
    },
    en: {
        sectionTitle: 'How it works',
        sectionSubtitle:
            'Listing your property is quick and easy. In just 3 steps you will be welcoming guests.',
        steps: [
            {
                number: 1,
                title: 'Register your account',
                description:
                    'Create your free account on Hospeda. You only need your email and some basic information to get started.'
            },
            {
                number: 2,
                title: 'List your property',
                description:
                    'Complete your property profile with photos, description, amenities and prices. Our wizard guides you step by step.'
            },
            {
                number: 3,
                title: 'Receive guests and earn income',
                description:
                    'Your property is visible immediately. Manage everything from your dashboard and start receiving inquiries and bookings.'
            }
        ]
    },
    pt: {
        sectionTitle: 'Como funciona',
        sectionSubtitle:
            'Publicar seu alojamento e rapido e simples. Em apenas 3 passos voce estara recebendo hospedes.',
        steps: [
            {
                number: 1,
                title: 'Registre sua conta',
                description:
                    'Crie sua conta gratuita no Hospeda. Voce so precisa do seu email e alguns dados basicos para comecar.'
            },
            {
                number: 2,
                title: 'Publique sua propriedade',
                description:
                    'Complete o perfil do seu alojamento com fotos, descricao, servicos e precos. Nosso assistente guia voce passo a passo.'
            },
            {
                number: 3,
                title: 'Receba hospedes e gere renda',
                description:
                    'Sua propriedade fica visivel imediatamente. Gerencie tudo a partir do seu painel e comece a receber consultas e reservas.'
            }
        ]
    }
};

// --- FAQ ---

/** Localized FAQ section content */
export const OWNER_FAQ: Record<SupportedLocale, OwnerFaqContent> = {
    es: {
        sectionTitle: 'Preguntas Frecuentes',
        faqs: [
            {
                question: '¿Cuanto cuesta publicar mi alojamiento en Hospeda?',
                answer: 'Puedes publicar tu alojamiento de forma gratuita con nuestro plan basico. Ofrecemos planes premium con funcionalidades avanzadas como estadisticas detalladas, posicionamiento destacado y herramientas de gestion profesional. Consulta nuestra pagina de precios para ver todos los planes disponibles.'
            },
            {
                question: '¿Que requisitos necesito para publicar mi propiedad?',
                answer: 'Necesitas ser el propietario o administrador legal del alojamiento, disponer de fotos de calidad de la propiedad y contar con informacion basica como ubicacion, capacidad y servicios disponibles. No se requieren habilitaciones especiales para comenzar, aunque recomendamos tener toda la documentacion legal al dia.'
            },
            {
                question: '¿Como recibo los pagos de las reservas?',
                answer: 'Los pagos se procesan de forma segura a traves de MercadoPago, el procesador de pagos lider en Argentina. Puedes recibir pagos con tarjeta de credito, debito y transferencias bancarias. El dinero se acredita en tu cuenta bancaria segun el calendario de pagos acordado.'
            },
            {
                question: '¿Que pasa si un huesped cancela su reserva?',
                answer: 'La politica de cancelacion la defines tu como propietario. Puedes elegir entre politicas flexibles, moderadas o estrictas segun tus preferencias. Hospeda aplica la politica que configures y se asegura de que tanto tu como el huesped esten protegidos en caso de cancelacion.'
            },
            {
                question: '¿Como me ayuda Hospeda si tengo problemas con un huesped?',
                answer: 'Contamos con un equipo de soporte dedicado disponible para mediar en cualquier conflicto entre propietarios y huespedes. Tambien ofrecemos un sistema de reseñas verificadas que protege tu reputacion y herramientas para reportar comportamientos inadecuados.'
            }
        ]
    },
    en: {
        sectionTitle: 'Frequently Asked Questions',
        faqs: [
            {
                question: 'How much does it cost to list my property on Hospeda?',
                answer: 'You can list your property for free with our basic plan. We offer premium plans with advanced features such as detailed statistics, featured positioning and professional management tools. Check our pricing page to see all available plans.'
            },
            {
                question: 'What requirements do I need to list my property?',
                answer: 'You need to be the owner or legal manager of the accommodation, have quality photos of the property and have basic information such as location, capacity and available amenities. No special permits are required to get started, although we recommend having all legal documentation up to date.'
            },
            {
                question: 'How do I receive payments for bookings?',
                answer: 'Payments are processed securely through MercadoPago, the leading payment processor in Argentina. You can receive payments by credit card, debit card and bank transfers. Money is credited to your bank account according to the agreed payment schedule.'
            },
            {
                question: 'What happens if a guest cancels their booking?',
                answer: 'The cancellation policy is defined by you as the owner. You can choose between flexible, moderate or strict policies according to your preferences. Hospeda applies the policy you configure and ensures that both you and the guest are protected in case of cancellation.'
            },
            {
                question: 'How does Hospeda help me if I have problems with a guest?',
                answer: 'We have a dedicated support team available to mediate any conflict between owners and guests. We also offer a verified review system that protects your reputation and tools to report inappropriate behavior.'
            }
        ]
    },
    pt: {
        sectionTitle: 'Perguntas Frequentes',
        faqs: [
            {
                question: 'Quanto custa publicar meu alojamento no Hospeda?',
                answer: 'Voce pode publicar seu alojamento gratuitamente com nosso plano basico. Oferecemos planos premium com funcionalidades avancadas como estatisticas detalhadas, posicionamento em destaque e ferramentas de gestao profissional. Consulte nossa pagina de precos para ver todos os planos disponiveis.'
            },
            {
                question: 'Que requisitos preciso para publicar minha propriedade?',
                answer: 'Voce precisa ser o proprietario ou administrador legal do alojamento, ter fotos de qualidade da propriedade e ter informacoes basicas como localizacao, capacidade e servicos disponiveis. Nao sao necessarias habilitacoes especiais para comecar, embora recomendemos ter toda a documentacao legal em dia.'
            },
            {
                question: 'Como recebo os pagamentos das reservas?',
                answer: 'Os pagamentos sao processados de forma segura atraves do MercadoPago, o principal processador de pagamentos da Argentina. Voce pode receber pagamentos com cartao de credito, debito e transferencias bancarias. O dinheiro e creditado em sua conta bancaria de acordo com o calendario de pagamentos acordado.'
            },
            {
                question: 'O que acontece se um hospede cancelar sua reserva?',
                answer: 'A politica de cancelamento e definida por voce como proprietario. Voce pode escolher entre politicas flexiveis, moderadas ou rigorosas de acordo com suas preferencias. O Hospeda aplica a politica que voce configurar e garante que tanto voce quanto o hospede estejam protegidos em caso de cancelamento.'
            },
            {
                question: 'Como o Hospeda me ajuda se eu tiver problemas com um hospede?',
                answer: 'Temos uma equipe de suporte dedicada disponivel para mediar qualquer conflito entre proprietarios e hospedes. Tambem oferecemos um sistema de avaliacoes verificadas que protege sua reputacao e ferramentas para relatar comportamentos inadequados.'
            }
        ]
    }
};

// --- Final CTA ---

/** Localized final CTA section content */
export const OWNER_FINAL_CTA: Record<SupportedLocale, OwnerFinalCtaContent> = {
    es: {
        title: '¿Listo para publicar tu alojamiento?',
        subtitle:
            'Unete a los propietarios que ya confian en Hospeda para gestionar y hacer crecer su negocio de alojamiento en el Litoral argentino.',
        ctaPrimary: 'Registrate Ahora',
        ctaSecondary: 'Ver Planes'
    },
    en: {
        title: 'Ready to list your property?',
        subtitle:
            'Join the owners who already trust Hospeda to manage and grow their accommodation business in the Argentine Litoral.',
        ctaPrimary: 'Register Now',
        ctaSecondary: 'View Plans'
    },
    pt: {
        title: 'Pronto para publicar seu alojamento?',
        subtitle:
            'Junte-se aos proprietarios que ja confiam no Hospeda para gerir e fazer crescer seu negocio de alojamento no Litoral argentino.',
        ctaPrimary: 'Cadastre-se Agora',
        ctaSecondary: 'Ver Planos'
    }
};
