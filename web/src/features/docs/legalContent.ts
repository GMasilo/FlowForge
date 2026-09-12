export type LegalSection = {
  id: string
  title: string
  paragraphs: string[]
  bullets?: string[]
}

export type LegalDocument = {
  slug: 'terms' | 'privacy'
  title: string
  shortTitle: string
  effectiveDate: string
  summary: string
  sections: LegalSection[]
}

const EFFECTIVE = '11 September 2026'

export const TERMS_OF_SERVICE: LegalDocument = {
  slug: 'terms',
  title: 'Terms of Service',
  shortTitle: 'Terms',
  effectiveDate: EFFECTIVE,
  summary:
    'These Terms govern access to and use of FlowForge — the conversational design platform for organisations, including the designer, public chat, embeds, agent tools, APIs, and related services.',
  sections: [
    {
      id: 'agreement',
      title: '1. Agreement',
      paragraphs: [
        'By creating an account, accepting an organisation invite, signing in, or using FlowForge (the “Service”), you agree to these Terms of Service (“Terms”). If you use the Service on behalf of an organisation, you confirm you have authority to bind that organisation, and “you” includes that organisation.',
        'If you do not agree, do not use the Service.',
      ],
    },
    {
      id: 'service',
      title: '2. The Service',
      paragraphs: [
        'FlowForge lets organisations design, publish, and operate conversational chatbots and related workflows. Features may include flow design, templates, entities and data tables, connections to external systems, public and embedded chat, staging tests, agent inbox/console, analytics, webhooks, marketplace templates, platform APIs, and administrative controls.',
        'We may update, add, or remove features. Demo and use-case chatbots are for illustration and may use sample data; they are not advice, regulated financial products, medical diagnosis, or official government services unless your organisation explicitly configures them as such under its own responsibility.',
      ],
    },
    {
      id: 'accounts',
      title: '3. Accounts and organisations',
      paragraphs: [
        'You must provide accurate account information and keep credentials confidential. Organisation owners and admins control membership, roles (such as owner, admin, editor, and agent), branding, and access to chatbots and data within their organisation.',
        'You are responsible for activity under your accounts and for ensuring members comply with these Terms and applicable law. We may suspend access that appears compromised, abusive, or in breach of these Terms.',
      ],
    },
    {
      id: 'customer-content',
      title: '4. Your content and conversations',
      paragraphs: [
        'You retain rights to content you and your organisation submit to the Service (“Customer Content”), including chatbot flows, templates, entity data, connection configuration (excluding our platform code), and conversation transcripts and uploads from your visitors when those visitors interact with your chatbots.',
        'You grant us a limited licence to host, process, transmit, and display Customer Content solely to provide, secure, and improve the Service, and as otherwise described in our Privacy Policy.',
        'You are responsible for obtaining any consents required from end users (chat visitors), for the lawfulness of prompts and data you collect (including signatures, files, identity fields, and payment-related demos), and for how you use outputs from your bots and integrations.',
      ],
    },
    {
      id: 'acceptable-use',
      title: '5. Acceptable use',
      paragraphs: ['You must not use the Service to:'],
      bullets: [
        'Violate law, privacy, intellectual property, or export controls',
        'Probe, scan, or attack the Service or other systems without authorisation',
        'Distribute malware, phishing, or deceptive content',
        'Collect sensitive personal data (such as live payment credentials, government IDs, or health records) unless you have a lawful basis and appropriate safeguards',
        'Impersonate others, spam, or interfere with other customers’ use',
        'Resell or provide the Service to third parties except as expressly allowed in writing',
        'Circumvent usage limits, security controls, or access restrictions',
      ],
    },
    {
      id: 'integrations',
      title: '6. Connections and third-party services',
      paragraphs: [
        'Organisations may connect FlowForge to third-party APIs, databases, email, payment, SSO/identity, and other systems. Those services are governed by their own terms. We are not responsible for third-party outages, data handling, or charges.',
        'You must store secrets securely via the Service’s connection mechanisms and rotate credentials if exposed.',
      ],
    },
    {
      id: 'apis',
      title: '7. APIs and automation',
      paragraphs: [
        'If you use platform or organisation APIs, tokens, webhooks, or automation, you must keep credentials confidential, respect rate limits, and use them only for lawful purposes tied to your organisation. We may revoke tokens that are leaked or abused.',
      ],
    },
    {
      id: 'compliance-tools',
      title: '8. Compliance tooling',
      paragraphs: [
        'Features such as retention settings, legal hold, audit logs, visitor export/delete, and consent-related policies are tools to help your organisation meet its obligations. Enabling a feature does not by itself make you compliant. Your organisation remains the controller (or equivalent) of visitor and member personal data it processes through FlowForge, except where we process data as described in the Privacy Policy.',
      ],
    },
    {
      id: 'availability',
      title: '9. Availability and support',
      paragraphs: [
        'We aim for reliable availability but do not guarantee uninterrupted Service. Maintenance, incidents, or dependency failures may occur. Documentation, FAQ, and Help content are provided for guidance and may change.',
      ],
    },
    {
      id: 'ip',
      title: '10. Intellectual property',
      paragraphs: [
        'FlowForge, including software, branding, documentation, and sample packs we publish, remains ours or our licensors’. These Terms do not transfer ownership of the platform to you. Feedback you provide may be used to improve the Service without obligation to you.',
      ],
    },
    {
      id: 'disclaimer',
      title: '11. Disclaimers',
      paragraphs: [
        'THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE” TO THE MAXIMUM EXTENT PERMITTED BY LAW. WE DISCLAIM WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. Chatbot behaviour depends on your configuration; we do not warrant that flows, demos, or AI-assisted content will be accurate, complete, or suitable for regulated decisions.',
      ],
    },
    {
      id: 'liability',
      title: '12. Limitation of liability',
      paragraphs: [
        'To the maximum extent permitted by law, we are not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, revenue, data, or goodwill. Our aggregate liability arising from the Service is limited to the fees you paid us for the Service in the three months before the claim (or zero if you use a free or demo tier with no fees).',
        'Nothing in these Terms excludes liability that cannot be limited under applicable law.',
      ],
    },
    {
      id: 'termination',
      title: '13. Suspension and termination',
      paragraphs: [
        'You may stop using the Service at any time. Organisation admins may remove members or delete organisation resources subject to product controls. We may suspend or terminate access for breach, risk, non-payment (where applicable), or to protect the Service and other users.',
        'After termination, we may delete or anonymise Customer Content according to our retention practices and your organisation’s settings, except where we must retain records by law.',
      ],
    },
    {
      id: 'changes',
      title: '14. Changes',
      paragraphs: [
        'We may update these Terms. Material changes will be indicated by updating the effective date on this page and, where appropriate, notifying account holders. Continued use after the effective date constitutes acceptance of the updated Terms.',
      ],
    },
    {
      id: 'contact',
      title: '15. Contact',
      paragraphs: [
        'Questions about these Terms: use the contact details published on the FlowForge landing page or platform settings (email / URL), or contact your organisation administrator for organisation-specific arrangements.',
      ],
    },
  ],
}

export const PRIVACY_POLICY: LegalDocument = {
  slug: 'privacy',
  title: 'Privacy Policy',
  shortTitle: 'Privacy',
  effectiveDate: EFFECTIVE,
  summary:
    'This Privacy Policy explains how FlowForge handles personal data for platform users (designers, admins, agents) and, as a processor/service provider, how we process end-user (visitor) data on behalf of customer organisations.',
  sections: [
    {
      id: 'roles',
      title: '1. Who we are and roles',
      paragraphs: [
        'FlowForge is a multi-tenant conversational platform. For account and billing-related data about platform users, we typically act as a controller (or equivalent). For conversation content, visitor answers, uploads, and chatbot configuration belonging to a customer organisation, that organisation is generally the controller, and we process such data to provide the Service on their instructions.',
        'If you are chatting with a customer’s public or embedded bot, that organisation’s own privacy notice also applies to what they ask you and how they use your answers.',
      ],
    },
    {
      id: 'collect',
      title: '2. Data we collect',
      paragraphs: ['Depending on how the Service is used, we may process:'],
      bullets: [
        'Account data: name, email, authentication identifiers, organisation membership and roles, profile preferences',
        'Organisation data: organisation name and settings, branding, member lists, audit events',
        'Product usage: feature usage, diagnostics, security logs, approximate technical metadata (such as browser type or IP where needed for security)',
        'Customer Content: chatbot flows, templates, entities, connection metadata, messages, form answers, signatures, files, and related session data for that organisation’s bots',
        'Support and communications you send us',
      ],
    },
    {
      id: 'purposes',
      title: '3. How we use data',
      paragraphs: ['We use personal data to:'],
      bullets: [
        'Provide, operate, secure, and improve the Service',
        'Authenticate users, enforce roles, and prevent abuse',
        'Enable chatbot runtime, agent tools, analytics, webhooks, and APIs for your organisation',
        'Provide support and important service notices',
        'Comply with law and enforce our Terms',
      ],
    },
    {
      id: 'legal-bases',
      title: '4. Legal bases (where applicable)',
      paragraphs: [
        'Where GDPR or similar laws apply, we rely on bases such as contract performance (providing the Service), legitimate interests (security, product improvement, fraud prevention — balanced against your rights), consent where required (for example certain cookies or optional communications), and legal obligation.',
      ],
    },
    {
      id: 'visitors',
      title: '5. Chat visitors and customer responsibility',
      paragraphs: [
        'Organisations design what their bots ask for (including identity, contact details, files, and signatures). Organisations must provide appropriate notices and collect required consents from visitors, and must not instruct FlowForge to process data unlawfully.',
        'Organisation admins can configure retention, legal hold, and visitor export/delete tools where available. Those controls affect how long Customer Content is kept in the organisation’s tenant.',
      ],
    },
    {
      id: 'sharing',
      title: '6. Sharing',
      paragraphs: [
        'We do not sell personal data. We may share data with:',
      ],
      bullets: [
        'Infrastructure and subprocessors that host or deliver the Service (for example database, storage, email, or auth providers) under appropriate agreements',
        'Your organisation’s authorised members and agents who access the same tenant',
        'Third-party systems your organisation connects (HTTP APIs, databases, SSO, payments, email) — those receive data your flows send them',
        'Professional advisers or authorities when required by law or to protect rights and safety',
      ],
    },
    {
      id: 'international',
      title: '7. International transfers',
      paragraphs: [
        'Data may be processed in regions where we or our subprocessors operate. Where required, we use appropriate transfer safeguards (such as standard contractual clauses or equivalent mechanisms).',
      ],
    },
    {
      id: 'security',
      title: '8. Security',
      paragraphs: [
        'We apply technical and organisational measures appropriate to the Service, including access controls, encrypted transport, role-based permissions within organisations, and audit logging for sensitive actions. No method of transmission or storage is perfectly secure; please use strong passwords, SSO where offered, and least-privilege roles.',
      ],
    },
    {
      id: 'retention',
      title: '9. Retention',
      paragraphs: [
        'Account data is kept while your account is active and as needed for legitimate business and legal purposes afterward. Customer Content retention follows organisation settings (including retention TTLs and legal hold) and our operational backups. Deleted resources may persist in backups for a limited period before irreversible removal.',
      ],
    },
    {
      id: 'rights',
      title: '10. Your rights',
      paragraphs: [
        'Subject to applicable law, you may request access, correction, deletion, restriction, portability, or objection regarding personal data we control. Platform users can update many profile fields in-product. Chat visitors should contact the organisation that operates the chatbot first; we will assist that organisation as a processor where appropriate.',
        'You may have the right to lodge a complaint with a supervisory authority.',
      ],
    },
    {
      id: 'cookies',
      title: '11. Cookies and similar technologies',
      paragraphs: [
        'We use essential cookies or local storage for authentication, security, and preferences (such as theme). Analytics or similar technologies, if enabled, are used to understand product usage. You can control cookies through your browser; disabling essential storage may prevent sign-in.',
      ],
    },
    {
      id: 'children',
      title: '12. Children',
      paragraphs: [
        'The Service is not directed to children under 16 (or the minimum age required in your jurisdiction). Do not create accounts for children below that age. Organisations must not design bots that knowingly collect children’s data without appropriate legal basis and parental safeguards.',
      ],
    },
    {
      id: 'changes-privacy',
      title: '13. Changes',
      paragraphs: [
        'We may update this Privacy Policy by posting a new version with an updated effective date. Material changes may also be communicated to account holders where appropriate.',
      ],
    },
    {
      id: 'contact-privacy',
      title: '14. Contact',
      paragraphs: [
        'Privacy questions: use the contact email or URL shown on the FlowForge landing page / platform settings, or ask your organisation administrator if your question concerns an organisation-operated chatbot.',
      ],
    },
  ],
}

export function legalDocumentBySlug(slug: string): LegalDocument | null {
  if (slug === 'terms') return TERMS_OF_SERVICE
  if (slug === 'privacy') return PRIVACY_POLICY
  return null
}
