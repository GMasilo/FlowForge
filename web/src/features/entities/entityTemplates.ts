import type { EntityKind, VariableType } from '@/shared/types/database'

export type EntityTemplateField = { key: string; label: string; value_type: VariableType; required?: boolean; is_unique?: boolean }
export type EntityTemplate = { key: string; name: string; description: string; kind: EntityKind; fields: EntityTemplateField[] }
const field = (key: string, label: string, value_type: VariableType = 'string', required = false, is_unique = false): EntityTemplateField => ({ key, label, value_type, required, is_unique })

export const ENTITY_TEMPLATES: EntityTemplate[] = [
  { key: 'leads', name: 'Leads', description: 'Capture enquiries, their source, and follow-up progress.', kind: 'dynamic', fields: [
    field('name', 'Name', 'string', true), field('email', 'Email'), field('phone', 'Phone'), field('company', 'Company'), field('source', 'Source'), field('status', 'Status'), field('notes', 'Notes'), field('follow_up_at', 'Follow-up date', 'date'),
  ] },
  { key: 'appointments', name: 'Appointments', description: 'Store bookings, scheduled times, and customer contact details.', kind: 'dynamic', fields: [
    field('booking_reference', 'Booking reference', 'string', true, true), field('customer_name', 'Customer name', 'string', true), field('customer_email', 'Customer email'), field('service', 'Service', 'string', true), field('starts_at', 'Starts at', 'date', true), field('ends_at', 'Ends at', 'date'), field('status', 'Status'), field('notes', 'Notes'),
  ] },
  { key: 'support_tickets', name: 'Support tickets', description: 'Track support requests, priorities, owners, and resolution notes.', kind: 'dynamic', fields: [
    field('ticket_number', 'Ticket number', 'string', true, true), field('subject', 'Subject', 'string', true), field('description', 'Description'), field('requester_email', 'Requester email'), field('priority', 'Priority'), field('status', 'Status'), field('assigned_to', 'Assigned to'), field('resolution', 'Resolution'),
  ] },
  { key: 'feedback', name: 'Feedback', description: 'Collect ratings and comments about a service or experience.', kind: 'dynamic', fields: [
    field('topic', 'Topic', 'string', true), field('rating', 'Rating', 'number'), field('comment', 'Comment'), field('respondent_email', 'Respondent email'), field('submitted_at', 'Submitted at', 'date'),
  ] },
  { key: 'faq', name: 'FAQs', description: 'A reusable library of questions, answers, and search tags.', kind: 'static', fields: [
    field('question', 'Question', 'string', true), field('answer', 'Answer', 'string', true), field('category', 'Category'), field('tags', 'Tags', 'array'), field('active', 'Active', 'boolean'),
  ] },
  { key: 'locations', name: 'Locations', description: 'Store branch addresses, contact details, and map coordinates.', kind: 'static', fields: [
    field('name', 'Name', 'string', true), field('address', 'Address', 'string', true), field('city', 'City'), field('country', 'Country'), field('phone', 'Phone'), field('opening_hours', 'Opening hours'), field('latitude', 'Latitude', 'number'), field('longitude', 'Longitude', 'number'),
  ] },
  { key: 'services', name: 'Services', description: 'List bookable services with prices and estimated durations.', kind: 'static', fields: [
    field('name', 'Name', 'string', true), field('description', 'Description'), field('price', 'Price', 'number'), field('currency', 'Currency'), field('duration_minutes', 'Duration in minutes', 'number'), field('active', 'Active', 'boolean'),
  ] },
  { key: 'events', name: 'Events', description: 'Publish event details, venue information, and capacity.', kind: 'static', fields: [
    field('title', 'Title', 'string', true), field('description', 'Description'), field('starts_at', 'Starts at', 'date', true), field('ends_at', 'Ends at', 'date'), field('venue', 'Venue'), field('capacity', 'Capacity', 'number'), field('registration_url', 'Registration URL'),
  ] },
  { key: 'registrations', name: 'Event registrations', description: 'Record attendees and their event IDs. Connect records through your flow.', kind: 'dynamic', fields: [
    field('event_id', 'Event ID', 'string', true), field('attendee_name', 'Attendee name', 'string', true), field('attendee_email', 'Attendee email', 'string', true), field('ticket_count', 'Ticket count', 'number'), field('status', 'Status'), field('registered_at', 'Registered at', 'date'),
  ] },
  { key: 'tasks', name: 'Tasks', description: 'Manage follow-up actions, assignments, priorities, and due dates.', kind: 'dynamic', fields: [
    field('title', 'Title', 'string', true), field('description', 'Description'), field('assigned_to', 'Assigned to'), field('priority', 'Priority'), field('status', 'Status'), field('due_at', 'Due at', 'date'), field('completed', 'Completed', 'boolean'),
  ] },
  { key: 'blank', name: 'Blank', description: 'Start with an ID and add your own fields.', kind: 'dynamic', fields: [] },
  { key: 'users', name: 'Users', description: 'Store chatbot user profiles and contact details. This does not create sign-in accounts.', kind: 'dynamic', fields: [
    field('name', 'Name', 'string', true), field('email', 'Email', 'string', true, true), field('phone', 'Phone'), field('active', 'Active', 'boolean'),
  ] },
  { key: 'products', name: 'Products', description: 'A catalog of products, prices, and available stock.', kind: 'static', fields: [
    field('sku', 'SKU', 'string', true, true), field('name', 'Name', 'string', true), field('description', 'Description'), field('price', 'Price', 'number', true), field('currency', 'Currency', 'string', true), field('stock', 'Stock', 'number'), field('image_url', 'Image URL'), field('active', 'Active', 'boolean'),
  ] },
  { key: 'polls', name: 'Polls', description: 'Poll questions and their answer options. Store votes separately with Poll responses.', kind: 'static', fields: [
    field('question', 'Question', 'string', true), field('options', 'Options', 'array', true), field('allow_multiple', 'Allow multiple answers', 'boolean'), field('closes_at', 'Closes at', 'date'), field('active', 'Active', 'boolean'),
  ] },
  { key: 'poll_responses', name: 'Poll responses', description: 'Record votes using the poll ID, respondent ID, and selected options. Link these in your flow.', kind: 'dynamic', fields: [
    field('poll_id', 'Poll ID', 'string', true), field('respondent_id', 'Respondent ID'), field('selected_options', 'Selected options', 'array', true), field('submitted_at', 'Submitted at', 'date'),
  ] },
  { key: 'orders', name: 'Orders', description: 'Track customer orders, line items, totals, and payment references.', kind: 'dynamic', fields: [
    field('order_number', 'Order number', 'string', true, true), field('customer_email', 'Customer email'), field('items', 'Items', 'array', true), field('total', 'Total', 'number', true), field('currency', 'Currency', 'string', true), field('status', 'Status'), field('payment_reference', 'Payment reference'), field('placed_at', 'Placed at', 'date'),
  ] },
]
