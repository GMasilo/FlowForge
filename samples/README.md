# Samples

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

`university-student-admission-flow.json` can be imported from the Chatbots screen. After import on another instance, recreate the entity first, then set the Entity step’s entity to the new `student_admissions` id (entity IDs are environment-specific).
