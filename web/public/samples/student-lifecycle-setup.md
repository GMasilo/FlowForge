# Summit University: admission to alumni

A fictional FlowForge showcase with 12 chapters, 346 steps, 10 entity definitions, two reusable templates and 14 saved test scenarios. Follow the guided journey or enter any chapter from the menu.

## Import and explore

Download the Education JSON from Use cases, then import it into a new chatbot using FlowForge's flow importer. Superadmins can also choose the bundled Education pack in Platform settings. Importing/publishing through Platform settings can replace the configured Education demo: review that destination first.

Keep `demoMode` set to `true`. Preview the journey and run the saved test scenarios. Sample identity is Alex Student (SUM-DEMO-2027-001); all data is fictional. External actions, entity persistence, uploads, sign-in, payments and adviser handoff are bypassed in demo mode. Conversation analytics/session storage can still operate normally. No real emails, payments or tickets are created by the sample paths.

## Chapters

1. Programme discovery: catalogue entity, table, programme choice and indicative entry guidance.
2. Applications: applicant routes, missing-document branch, upload placeholder, submission, entity record and acknowledgement email.
3. Admissions: authoritative decision lookup, conditional offer, waitlist, further-information and acceptance paths.
4. Funding: tuition calculation, funding opportunities, hosted checkout and payment-plan request.
5. Registration: eligibility hold, module table, registration API and LMS provisioning.
6. Campus readiness: orientation, residence/accessibility appointment, calendar and confirmation.
7. Learning: timetable/attendance table, repeating checklist and tutor booking.
8. Student support: topic, urgency, case priority, case entity, service-desk ticket and human handoff.
9. Assessment: results table, progression guidance and mark-review request.
10. Careers: opportunities, placement interest, careers CRM and email.
11. Graduation: clearance hold, attendance RSVP and a downloadable preparation guide (not a certificate).
12. Alumni: mentoring, continuing education, events, CRM preferences and optional email consent.

## Configure services later

Connection IDs, installed integration IDs/actions and the adviser queue are deliberately empty. A JSON flow import does not provision credentials or install integrations. `connections.json` in the downloadable source pack is a per-step setup reference, not a second import file. Create connections in your instance, select them on each live step and map returned fields before disabling demo mode.

| Dependency | Configuration |
| --- | --- |
| Institutional identity | Configure `student_sign_in` HTTP identity connection. Return user.id, user.name, verified user.email and token, or adjust the mappings. Applicants need an applicant identity too. |
| Student information system | Select an HTTP connection on all HTTP steps. Paths and bodies are examples, not existing FlowForge endpoints. Map them to your admissions, registration, learning, finance, assessment and graduation APIs. |
| HTTP authorization | Use server-held connection credentials. For student-scoped APIs, declare the appropriate header input on the connection and bind its parameter on each node to the identity token if supported by your service. Never trust a client-supplied student reference alone; enforce ownership server-side. |
| Email | Choose an SMTP/email connection on application_email, orientation_email, career_email and alumni_welcome. Configure sender identity and recipient verification. Edit the shared student_email template for your institution. |
| Payments | Select a configured payment connection on tuition_payment, configure its verified webhook/return URLs and test reconciliation. Replace the sample estimate with a server-issued invoice amount and reference. |
| LMS | Install your LMS integration or replace lms_provision with an HTTP step. Map student identity, programme and module codes. |
| Calendar and tutoring | Configure campus_calendar and tutor_booking actions. Map service, preferred date, student identity and confirmed appointment response. |
| Service desk | Configure support_ticket with Jira/your service desk, mapping topic and casePriority. Jira REST authentication belongs in the connection (email plus API token using Basic Auth), not a webhook token. |
| Human support | Select an actual queue on adviser_handoff and configure agent routing/hours. |
| Careers and alumni CRM | Configure career_crm and alumni_crm. Map career_choice, alumni_interest and alumni_opt_in into the chosen provider's fields. Do not subscribe service-only contacts to marketing. |
| Documents | Review the student_document template. Its output is only a graduation preparation guide. |

HTTP responses must match each step's expected output shape or you must adjust downstream expressions. For example admission_status returns status and offer_ref; registration_clearance returns eligible; graduation_clearance returns eligible plus academic/library/finance results. Provider payload fields vary: integration field maps are starting placeholders, not universally executable contracts.

## Entities and controls

The pack includes static programmes/modules plus applications, students, registrations, support_cases, appointments, placement_applications, alumni_preferences and journey_feedback. Applications, support cases, appointments, alumni preferences and feedback have demonstrated create actions. Students, registrations and placement_applications are extension schemas: authoritative writes currently go to the example institutional/CRM services. Add local persistence if required, with duplicate prevention and access policies.

The programme guidance currently illustrates the Computing threshold, even when browsing other programmes. The registration module list is illustrative; replace it with your programme-specific catalogue and prerequisites. Application upload collection is a placeholder: map uploaded references into your real submission API. Demonstration outcome selection is ignored by the live decision lookup; remove that question in your production adaptation.

HTTP/email/integration/entity actions have success checks and recovery routes back to the menu. Recovery does not prove that an external write was rolled back. Require idempotency keys and reconcile uncertain responses before retrying financial, registration or ticket writes. A successful HTTP transport is not an academic approval: validate returned business statuses before allowing irreversible actions.

## Tests and publishing

Saved tests cover each chapter, the complete guided journey and declined consent. They verify fictional paths, not external credentials, delivery or payment settlement. Before live publishing, configure all placeholders, test alternate holds/declines and external failures, run designer checks, preview actual sign-in/upload/payment/handoff flows and verify each destination system. Use an isolated institutional test environment first. The existing hosted Education demo updates only when the new pack is imported and published.

## Rebuild for maintainers

From the repository root, run `python artifacts/student-lifecycle/build_student.py`, then run `web/scripts/student-lifecycle.test.ts` with Vitest and `BUILD_STUDENT=1`. The normalizer supplies schema defaults, reusable templates and the public JSON. Run the tests without that environment variable for validation only.
