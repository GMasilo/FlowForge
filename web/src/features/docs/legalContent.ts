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
  effectiveDateIso: string
  summary: string
  sections: LegalSection[]
}

const EFFECTIVE = '5 October 2026'
const EFFECTIVE_ISO = '2026-10-05'

export const TERMS_OF_SERVICE: LegalDocument = {
  slug: 'terms',
  title: 'Terms of Service',
  shortTitle: 'Terms',
  effectiveDate: EFFECTIVE,
  effectiveDateIso: EFFECTIVE_ISO,
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
        'You grant us a limited licence to host, process, transmit, and display Customer Content to provide and secure the Service on your organisation’s instructions. Data collected or retrieved through your organisation’s integrations and connections is not used by FlowForge for its own independent purposes, including advertising, sale, model training, or general product improvement.',
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
        'Configured actions can send messages, create or update external records, initiate checkout, and transmit files or conversation data. This includes outgoing webhooks, Slack and Jira requests, email and model-service calls. Review recipients, payloads, permissions and credentials before enabling an action. Preview and manual integration tests may contact live services; use test accounts and fictional data where possible.',
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
    {
      id: 'models-and-automation',
      title: '16. Machine learning, routing and testing',
      paragraphs: [
        'Optional model integrations can classify intent or images, estimate sentiment, or compare text. Outputs depend on the selected model, examples, thresholds and input data and may be incorrect or biased. Similarity scores are not guarantees of accuracy. You are responsible for evaluating outputs, providing fallback paths, and supervising consequential decisions.',
        'Do not use model results as the sole basis for decisions with legal or similarly significant effects on a person unless the processing is permitted by applicable law and the required safeguards are in place. Provide human review and a way to challenge decisions where required.',
        'Automated scenario checks, design analysis, release reviews and staging are aids, not certifications of correctness, security or compliance. Configure and test deployed services separately. Model hosting, access controls, availability and provider terms remain subject to your selected deployment and agreements.',
      ],
    },
    {
      id: 'documents-and-payments',
      title: '17. Documents, shared resources and payments',
      paragraphs: [
        'Document, invoice, agreement, certificate and lifecycle templates are editable examples. Review their content, calculations, signatures, recipients and legal suitability before issuing them. Capturing a signature or generating a document does not by itself establish identity, authority, enforceability or a qualified electronic signature.',
        'Sharing entities, installing resources on another chatbot, exporting data or publishing a marketplace pack can make content available to additional recipients. Review records, template defaults, examples and test fixtures for personal information and secrets before sharing. Joining entities or selecting fewer output columns does not replace access controls.',
        'Use an appropriately configured payment provider for real payments. A pay link, a visitor’s confirmation, or client-side validation does not prove settlement. Card-entry demonstrations must use test data; do not collect live card numbers or CVV through general chatbot questions, variables, logs or templates. FlowForge does not represent that its generic forms are a certified payment-processing environment.',
      ],
    },
  ],
}

export const PRIVACY_POLICY: LegalDocument = {
  slug: 'privacy',
  title: 'Privacy Policy',
  shortTitle: 'Privacy',
  effectiveDate: EFFECTIVE,
  effectiveDateIso: EFFECTIVE_ISO,
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
      paragraphs: [
        'Instances (organisations) may collect or retrieve information through the integrations and connections they configure, including external APIs, databases, identity services, payment providers, email and other third-party systems. Depending on the organisation’s workflow, this may include contact details, account identifiers, transaction references, records, documents and other information supplied by those systems. The organisation determines what it collects and why; its own privacy notice and the connected provider’s terms also apply.',
        'This organisation-collected data is not used by FlowForge for its own independent purposes. FlowForge processes it only on the organisation’s instructions to deliver and secure the configured services, such as receiving, transmitting, storing or displaying workflow results, and where processing is required by law. FlowForge does not use this data for advertising, sale, model training, or general product improvement.',
        'Separately, FlowForge processes platform account, operational and support data as described below. Depending on how the Service is used, the categories processed include:',
      ],
      bullets: [
        'Account data: name, email, authentication identifiers, organisation membership and roles, profile preferences',
        'Organisation data: organisation name and settings, branding, member lists, audit events',
        'Product usage: feature usage, diagnostics, security logs, approximate technical metadata (such as browser type or IP where needed for security)',
        'Customer Content: chatbot flows, templates, entities, connection metadata, messages, form answers, signatures, files, and related session data for that organisation’s bots',
        'Configured workflow data: imported spreadsheet records, joined entity results, document inputs and generated files, test fixtures, step inputs and outputs, review records, and agent routing information',
        'Model inputs and outputs when enabled: submitted text or images, category examples, inferred intent or sentiment, similarity scores and image labels',
        'Support and communications you send us',
      ],
    },
    {
      id: 'purposes',
      title: '3. How we use data',
      paragraphs: [
        'The purposes below apply according to the type of data and our role. They do not permit independent use of data collected through an organisation’s integrations or connections; that data remains subject to the restrictions in section 2.',
      ],
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
        'Organisations should explain the purposes of collection, required and optional fields, recipients, applicable retention, and any consequential automated processing in their visitor notice. For South African processing, applicable duties and rights arise under POPIA; other jurisdictions may impose additional requirements.',
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
        'Deleting a conversation does not necessarily remove separately saved entity records, generated or downloaded documents, test fixtures, shared packs, or copies sent to external services. These require the relevant resource controls or a request to the recipient. Actual retention and backup arrangements depend on deployment and applicable agreements; this notice does not promise a fixed deletion deadline for every copy.',
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
        'A chatbot can also be configured to remember values using cookie functions for returning visits. The organisation chooses these values and must explain their purpose and obtain consent where required. Embedded media, maps, payment pages and other third-party content can make requests to their providers and are subject to those providers’ notices and browser-storage behaviour.',
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
    {
      id: 'model-processing',
      title: '15. Model services and inferred information',
      paragraphs: [
        'When an organisation enables a model action, the configured text, examples or images are sent to its selected model-service endpoint. An image supplied by URL may be fetched by that service from the image host. The endpoint operator, hosting location and any further processing depend on the organisation’s configuration and provider arrangements.',
        'The supplied TensorFlow service uses pre-trained models for inference; its supplied inference path does not train those models on submitted requests. This is not a platform-wide promise about every custom endpoint or provider. Model download requests are separate from classification requests. Review the selected service’s logging, retention and training terms before sending personal information.',
        'Predictions and scores can be stored as step outputs or variables and included in conversation records, diagnostics, documents or subsequent integrations. They may be inaccurate. Ask the chatbot operator about its use of inferred information, correction requests, and available human review or objections to automated processing.',
      ],
    },
    {
      id: 'configured-disclosures',
      title: '16. Integrations, exports and testing',
      paragraphs: [
        'Outgoing webhook and API payloads, email, Slack or Jira actions, and payment integrations disclose the fields selected by the organisation to the configured recipients. Provider checkout can return payment references and status to the flow. Do not submit live card details or CVV to generic chatbot forms or demonstrations.',
        'Authorised users may inspect variables and step outputs in debugging tools and export records, transcripts or documents. Document previews and downloads can contain the same bound personal information as the conversation. Test fixtures and shared templates may contain personal information if users put it there; use fictional or appropriately minimised data.',
        'Entity sharing, chatbot installations and marketplace publication can extend access beyond the original author. Organisations control these choices and must review the content and intended audience. Masking text on screen or hiding a column does not establish that underlying data has been erased.',
      ],
    },
  ],
}

export function legalDocumentBySlug(slug: string): LegalDocument | null {
  if (slug === 'terms') return TERMS_OF_SERVICE
  if (slug === 'privacy') return PRIVACY_POLICY
  return null
}
