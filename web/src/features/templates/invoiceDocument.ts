import { emptyDocumentBlock } from './documentLayout'
import { emptyTemplateContent, type DocumentBlock, type DocumentContent } from './templateModel'

export const INVOICE_SAMPLE_INPUTS: Record<string, string> = {
  supplier: 'LUMEN DIGITAL', supplier_details: '18 Harbour Way, Cape Town\nhello@lumen.example | +27 21 555 0100',
  invoice_number: 'INV-2026-0042', issued: '28 September 2026', due: '12 October 2026',
  customer: 'Acme Services', customer_details: 'Accounts payable\n42 Market Street, Johannesburg\naccounts@acme.example',
  reference: 'Digital service pilot / PO-1048', currency: 'ZAR',
  description_1: 'Discovery and journey mapping', quantity_1: '1', rate_1: '4,000.00', amount_1: '4,000.00',
  description_2: 'Chatbot configuration', quantity_2: '8', rate_2: '500.00', amount_2: '4,000.00',
  description_3: 'Training and handover', quantity_3: '2', rate_3: '750.00', amount_3: '1,500.00',
  subtotal: '9,500.00', tax_label: 'Tax (15%)', tax: '1,425.00', total: '10,925.00',
  payment_details: 'Pay by bank transfer using the invoice number as your reference.\nBank: [Your bank] | Account: [Your account number]',
  notes: 'Payment is due within 14 days. Please contact us with any invoice queries.\nThank you for choosing Lumen Digital.',
}

export function createInvoiceDocument(): DocumentContent {
  const block = (type: DocumentBlock['type'], x: number, y: number, w: number, h: number, text: string, extra: Partial<DocumentBlock> = {}): DocumentBlock =>
    ({ ...emptyDocumentBlock(type, y), x, y, w, h, text, fontSize: 10, color: '#334155', ...extra })
  const input = (key: string) => `{{inputs.${key}}}`
  const blocks: DocumentBlock[] = [
    block('heading', 8, 7, 55, 5, input('supplier'), { fontSize: 17, color: '#0f766e' }),
    block('heading', 65, 7, 27, 6, 'INVOICE', { fontSize: 26, align: 'right', color: '#0f172a' }),
    block('text', 8, 14, 55, 8, input('supplier_details')),
    block('text', 65, 15, 27, 6, input('invoice_number'), { align: 'right', bold: true }),
    block('divider', 8, 24, 84, 1, '', { color: '#0f766e' }),
    block('heading', 8, 27, 46, 3, 'BILL TO', { color: '#0f766e', fontSize: 9 }),
    block('heading', 8, 32, 46, 4, input('customer'), { fontSize: 14 }),
    block('text', 8, 38, 46, 10, input('customer_details')),
    block('text', 61, 28, 31, 14, `ISSUED
${input('issued')}

DUE DATE
${input('due')}`, { align: 'right' }),
    block('text', 8, 49, 84, 4, `REFERENCE: ${input('reference')}`, { fontSize: 9 }),
    ...[['DESCRIPTION', 8, 44], ['QTY', 54, 8], ['RATE', 64, 12], ['AMOUNT', 78, 14]].map(([text, x, w]) =>
      block('heading', Number(x), 55, Number(w), 4, String(text), { fill: '#e6f3f1', color: '#0f766e', fontSize: 9, align: x === 8 ? 'left' : 'right' })),
    ...[1, 2, 3].flatMap((row, index) => [
      block('text', 8, 61 + index * 6, 44, 5, input(`description_${row}`)),
      block('text', 54, 61 + index * 6, 8, 5, input(`quantity_${row}`), { align: 'right' }),
      block('text', 64, 61 + index * 6, 12, 5, input(`rate_${row}`), { align: 'right' }),
      block('text', 78, 61 + index * 6, 14, 5, input(`amount_${row}`), { align: 'right' }),
    ]),
    block('divider', 8, 80, 84, 1, '', { color: '#cbd5e1' }),
    block('text', 8, 83, 46, 10, `PAYMENT DETAILS
${input('payment_details')}`, { fontSize: 9 }),
    block('text', 59, 83, 18, 7, `Subtotal
${input('tax_label')}`, { fontSize: 10 }),
    block('text', 78, 83, 14, 7, `${input('subtotal')}
${input('tax')}`, { align: 'right' }),
    block('heading', 59, 92, 33, 6, `TOTAL ${input('currency')}  ${input('total')}`, { align: 'right', fontSize: 13, color: '#0f766e', fill: '#e6f3f1' }),
    block('heading', 8, 8, 84, 6, 'Payment terms & notes', { page: 2, fontSize: 20, color: '#0f766e' }),
    block('text', 8, 19, 84, 16, input('notes'), { page: 2, fontSize: 11 }),
  ]
  return {
    ...emptyTemplateContent('document') as DocumentContent,
    filename: 'invoice.pdf', title: 'Invoice', format: 'pdf', layout: 'page', orientation: 'portrait', fields: [], blocks,
    inputs: Object.keys(INVOICE_SAMPLE_INPUTS).map(key => ({ key, label: key.replace(/_/g, ' '), type: 'string', required: false })),
  }
}

