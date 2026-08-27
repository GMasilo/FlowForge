# Samples

## Built-in starter templates

On **Chatbots → New chatbot**, pick a starter instead of importing JSON:

| Pack | What you get |
|------|----------------|
| **Blank** | Default welcome → end only |
| **Essentials** | Welcome flow + message, menu, hours, FAQ, legal, and follow-up email templates |
| **Customer support** | Topic branch, hours/FAQ, contact handoff |
| **Lead capture** | Lead questions + **Leads** entity |
| **Appointment booking** | Appointment question + **Appointments** entity |
| **Shop & checkout** | Store catalog, shop, payment, receipt |
| **Feedback survey** | NPS / stars / mood + **Feedback** entity |
| **Contact form** | Multi-field form + **Contacts** entity |

Common org templates (welcome, menu, hours, FAQ, legal, HTML email) are included on every non-blank pack.

---

Import JSON from the organisation **Chatbots** screen (**Import**). A full bundle (flow + templates + entities + test scenarios) is created in one step.

## ForgeHub Feature Tour

Showcase chatbot: **ForgeHub Feature Tour**.

`flowforge-feature-tour.json` walks a visitor through **every question / response type**, **every template kind**, **entity list + create**, variables, operations, a condition, a loop, HTTP, and email.

Regenerate the file after editing the builder:

```bash
node samples/feature-tour/build.mjs
```

### What you get on import

| Area | Contents |
|------|----------|
| **Templates** | Welcome message, menu, hours, FAQ, legal, HTML email, store catalog (with stock + shipping/VAT), receipt, downloadable PDF |
| **Data** | Global variables (`brand_name`, `featured_cities`, …). Static entity `catalog_programs` with sample rows. Dynamic entity `tour_visits` written at the end of the flow |
| **Test scenario** | **Happy path seeds** on the Data tab (Preview → scenario) |
| **Flow** | Captcha → confirm → identity → dates → scales → choices → files → shop → pay → logic → entities → HTTP/email → receipt + PDF → end |

### After import

1. Open **Design** → **Preview** and walk the conversation (it is long on purpose).
2. Optional: bind organisation **HTTP**, **email**, and **Payment** connections on the matching steps if you want live calls instead of mocked/self-confirm behaviour.
3. Optional: upload `look_studio.png` and `look_garden.png` to the Media library so the Image choice step has pictures.
4. **Publish** when you want the public chat widget to use this graph.

Entity IDs in the file are remapped to the new chatbot automatically.

## University Student Admission

Created in CRM Team as chatbot **University Student Admission**.

### Entity (Data tab)

Dynamic entity `student_admissions` / **Student Admissions** with attributes:

| Key | Label | Type | Notes |
|-----|-------|------|-------|
| `first_name` | First name | string | required |
| `last_name` | Last name | string | required |
| `email` | Email | string | required, identifier |
| `phone` | Phone | string | optional |
| `date_of_birth` | Date of birth | date | required |
| `program` | Program of study | string | required |
| `high_school` | High school | string | optional |
| `gpa` | GPA | number | optional |
| `nationality` | Nationality | string | optional |

### Flow

Asks for each field, then **Entity → Create** into `student_admissions`, then confirms with `{{vars.application.id}}`.

Export a JSON copy anytime with **Export** on the chatbot Design/Data/Settings tabs.

`university-student-admission-flow.json` can be imported from the Chatbots screen. After import on another instance, recreate the entity first, then set the Entity step’s entity to the new `student_admissions` id (entity IDs are environment-specific). Newer exports that include `entityDefs` recreate the table for you.
