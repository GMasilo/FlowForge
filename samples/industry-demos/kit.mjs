/** Shared helpers for industry use-case chatbot packs. */

export const SHARED = {
  runAfter: { succeeded: true, failed: false, skipped: false, timedOut: false },
  delaySeconds: 0,
  timeoutSeconds: 0,
}

export function createBuilder(idPrefix) {
  let seq = 1
  const idByKey = new Map()
  const nodes = []
  const edges = []
  const byKey = {}

  function nid(key) {
    const existing = idByKey.get(key)
    if (existing) return existing
    const id = `${idPrefix}${String(seq++).padStart(12, '0')}`
    idByKey.set(key, id)
    return id
  }

  function eid() {
    return `${idPrefix.replace(/^a/, 'e')}${String(seq++).padStart(12, '0')}`
  }

  function push(node) {
    nodes.push(node)
    byKey[node.key] = node
    return node
  }

  function message(key, label, text, extra = {}) {
    return push({
      id: nid(key),
      key,
      type: 'message',
      label,
      config: { ...SHARED, text, ...extra },
      position: { x: 80, y: 40 + nodes.length * 110 },
    })
  }

  function question(key, label, prompt, answerType, extra = {}) {
    const { output, required, config = {}, ...rest } = extra
    return push({
      id: nid(key),
      key,
      type: 'question',
      label,
      config: {
        ...SHARED,
        prompt,
        answerType,
        answerRequired: required !== false,
        outputVariable: output ?? key.replace(/^ask_/, ''),
        ...config,
        ...rest,
      },
      position: { x: 80, y: 40 + nodes.length * 110 },
    })
  }

  function switchStep(key, label, value, cases) {
    return push({
      id: nid(key),
      key,
      type: 'switch',
      label,
      config: { ...SHARED, value, cases },
      position: { x: 80, y: 40 + nodes.length * 110 },
    })
  }

  function condition(key, label, left, operator, right) {
    return push({
      id: nid(key),
      key,
      type: 'condition',
      label,
      config: { ...SHARED, left, operator, right },
      position: { x: 80, y: 40 + nodes.length * 110 },
    })
  }

  function loop(key, label, collection, itemVariable = 'item', indexVariable = 'index') {
    return push({
      id: nid(key),
      key,
      type: 'loop',
      label,
      config: { ...SHARED, collection, itemVariable, indexVariable },
      position: { x: 80, y: 40 + nodes.length * 110 },
    })
  }

  function setVar(key, label, variableKey, value, valueType = 'string') {
    return push({
      id: nid(key),
      key,
      type: 'set_variable',
      label,
      config: {
        ...SHARED,
        variableKey,
        value,
        valueType,
        assignments: [{ variableKey, value, valueType }],
      },
      position: { x: 80, y: 40 + nodes.length * 110 },
    })
  }

  function setVars(key, label, assignments) {
    const first = assignments[0] ?? { variableKey: '', value: '', valueType: 'string' }
    return push({
      id: nid(key),
      key,
      type: 'set_variable',
      label,
      config: {
        ...SHARED,
        variableKey: first.variableKey,
        value: first.value,
        valueType: first.valueType ?? 'string',
        assignments,
      },
      position: { x: 80, y: 40 + nodes.length * 110 },
    })
  }

  function operation(key, label, cfg) {
    return push({
      id: nid(key),
      key,
      type: 'operation',
      label,
      config: { ...SHARED, ...cfg },
      position: { x: 80, y: 40 + nodes.length * 110 },
    })
  }

  function entity(key, label, cfg) {
    return push({
      id: nid(key),
      key,
      type: 'entity',
      label,
      config: {
        ...SHARED,
        entityId: cfg.entityId,
        operation: cfg.operation,
        recordId: cfg.recordId ?? '',
        filterAttribute: cfg.filterAttribute ?? '',
        filterEquals: cfg.filterEquals ?? '',
        fieldMap: cfg.fieldMap ?? {},
        outputVariable: cfg.outputVariable ?? '',
      },
      position: { x: 80, y: 40 + nodes.length * 110 },
    })
  }

  function http(key, label, cfg) {
    return push({
      id: nid(key),
      key,
      type: 'http',
      label,
      config: {
        ...SHARED,
        connectionId: cfg.connectionId ?? '',
        method: cfg.method ?? 'GET',
        path: cfg.path ?? '/',
        body: cfg.body ?? '',
        paramValues: cfg.paramValues ?? {},
        outputVariable: cfg.outputVariable ?? 'http_result',
      },
      position: { x: 80, y: 40 + nodes.length * 110 },
    })
  }

  function email(key, label, cfg) {
    return push({
      id: nid(key),
      key,
      type: 'email',
      label,
      config: {
        ...SHARED,
        connectionId: cfg.connectionId ?? '',
        templateKey: cfg.templateKey ?? 'followup_email',
        to: cfg.to ?? '{{vars.email}}',
        subject: cfg.subject ?? '',
        body: cfg.body ?? '{{templates.followup_email.html}}',
        paramValues: cfg.paramValues ?? {},
        templateBindings: cfg.templateBindings ?? {},
      },
      position: { x: 80, y: 40 + nodes.length * 110 },
    })
  }

  function end(key, label, text) {
    return push({
      id: nid(key),
      key,
      type: 'end',
      label,
      config: { ...SHARED, message: text },
      position: { x: 80, y: 40 + nodes.length * 110 },
    })
  }

  function link(from, to, sourceHandle = null, label = null) {
    if (!byKey[from]) throw new Error(`link: unknown from key "${from}"`)
    if (!byKey[to]) throw new Error(`link: unknown to key "${to}"`)
    edges.push({
      id: eid(),
      source: byKey[from].id,
      target: byKey[to].id,
      sourceHandle,
      label,
    })
  }

  function chain(keys) {
    for (let i = 0; i < keys.length - 1; i++) link(keys[i], keys[i + 1])
  }

  return {
    nodes,
    edges,
    byKey,
    message,
    question,
    switchStep,
    condition,
    loop,
    setVar,
    setVars,
    operation,
    entity,
    http,
    email,
    end,
    link,
    chain,
  }
}

export function attr(key, label, valueType, extra = {}) {
  return {
    key,
    label,
    value_type: valueType,
    required: extra.required === true,
    is_identifier: extra.is_identifier === true,
    is_unique: extra.is_unique === true,
    sort_order: extra.sort_order ?? 0,
    default_value: extra.default_value ?? null,
  }
}

export function idAttr() {
  return attr('id', 'Id', 'string', { required: true, is_identifier: true, is_unique: true, sort_order: -1 })
}

/** Rich HTML confirmation email for visitors (no installer jargon). */
export function emailHtml(brand) {
  return `<!DOCTYPE html>
<html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 0;">
    <tr><td align="center">
      <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 12px 40px rgba(15,23,42,.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#0f766e,#0891b2);padding:32px 36px;color:#ffffff;">
            <p style="margin:0;font-size:11px;letter-spacing:.2em;text-transform:uppercase;opacity:.88;">{{coalesce(inputs.brand, "${brand}")}}</p>
            <h1 style="margin:10px 0 0;font-size:24px;font-weight:650;letter-spacing:-.02em;">You're all set, {{titleCase(inputs.name)}}</h1>
            <p style="margin:10px 0 0;font-size:14px;opacity:.9;">{{formatDate(utcNow(), "EEEE, d MMMM yyyy · HH:mm")}}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 36px 8px;color:#334155;font-size:15px;line-height:1.65;">
            <p style="margin:0 0 14px;">We have logged your <strong>{{coalesce(inputs.service, "service")}}</strong> request.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;margin:0 0 18px;">
              <tr>
                <td style="padding:16px 18px;">
                  <p style="margin:0 0 6px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;">Reference</p>
                  <p style="margin:0;font-size:18px;font-weight:650;color:#0f172a;font-family:ui-monospace,Consolas,monospace;">{{coalesce(inputs.reference, "pending")}}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 18px 16px;">
                  <p style="margin:0;font-size:13px;color:#64748b;">City · {{coalesce(inputs.city, "—")}} · Follow-up around {{coalesce(inputs.followup, "soon")}}</p>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 12px;">{{coalesce(inputs.summary, "A member of the team will use the details you shared in this chat.")}}</p>
            <p style="margin:0 0 18px;color:#64748b;font-size:13px;">Need help? Reply to this email or write to <a href="mailto:{{coalesce(inputs.support, "")}}" style="color:#0d9488;">{{coalesce(inputs.support, "support")}}</a>.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 36px 28px;">
            <p style="margin:0;padding:14px 16px;border-radius:12px;background:linear-gradient(90deg,#ecfdf5,#e0f2fe);color:#0f766e;font-size:13px;line-height:1.5;">
              This is a demonstration confirmation from <strong>{{coalesce(inputs.brand, "${brand}")}}</strong> — thank you for trying the assistant.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

export function hoursDays() {
  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => ({
    day,
    open: '08:00',
    close: day === 'Saturday' ? '13:00' : '17:00',
    closed: day === 'Sunday',
  }))
}

export function cartTemplate({ key, name, intro, categories, products }) {
  return {
    key,
    name,
    kind: 'cart',
    description: `${name} catalog for shop + payment.`,
    content: {
      storeName: name,
      intro,
      currency: 'ZAR',
      categories,
      products: products.map((p) => ({ ...p, image: p.image ?? '' })),
      fees: [
        { id: 'fee_ship', name: 'Shipping / handling', kind: 'fixed', amount: 45 },
        { id: 'fee_vat', name: 'VAT', kind: 'percent', amount: 15 },
      ],
    },
  }
}

/** Page-layout confirmation PDF — two-column field cells, fonts, fills, signature image. */
export function packDocumentTemplate(ind) {
  const brand = ind.brand
  const blk = (id, type, patch) => ({
    id,
    type,
    x: 8,
    y: 8,
    w: 84,
    h: 6,
    page: 1,
    text: '',
    label: '',
    value: '',
    align: 'left',
    fontSize: 11,
    fontFamily: 'helvetica',
    bold: false,
    color: '#0f172a',
    fill: '',
    ...patch,
  })

  return {
    key: 'pack_document',
    name: 'Document pack',
    kind: 'document',
    description: 'Formatted A4 PDF with field cells and signature',
    content: {
      format: 'pdf',
      filename: `{{slugify(coalesce(inputs.name, "visitor"))}}-${ind.id}-pack.pdf`,
      title: `${brand} – confirmation pack`,
      intro: 'Prepared for **{{titleCase(inputs.name)}}** on {{formatDate(utcNow(), "EEEE, d MMMM yyyy")}}.',
      body: [
        'This pack confirms your {{coalesce(inputs.service, "enquiry")}} with {{coalesce(inputs.brand, "' + brand + '")}}.',
        '',
        '{{if(empty(inputs.summary), "", inputs.summary)}}',
        '',
        '{{if(empty(inputs.followup), "", "We aim to follow up around " + inputs.followup + ".")}}',
        '',
        'Questions? {{coalesce(inputs.support, "' + ind.supportEmail + '")}}',
      ].join('\n'),
      footer: `© ${brand} · generated by FlowForge`,
      fields: [
        { label: 'Full name', value: '{{titleCase(inputs.name)}}', as: 'text' },
        { label: 'Email', value: '{{inputs.email}}', as: 'text' },
        { label: 'Cell', value: '{{coalesce(inputs.phone, "—")}}', as: 'text' },
        { label: 'Country', value: '{{coalesce(inputs.country, "—")}}', as: 'text' },
        { label: 'City', value: '{{coalesce(inputs.city, "—")}}', as: 'text' },
        { label: 'Service', value: '{{coalesce(inputs.service, "—")}}', as: 'text' },
        { label: 'Priority', value: '{{coalesce(inputs.priority, "standard")}}', as: 'text' },
        { label: 'Reference', value: '{{coalesce(inputs.reference, "pending")}}', as: 'text' },
        { label: 'Follow-up', value: '{{coalesce(inputs.followup, "soon")}}', as: 'text' },
        { label: 'Summary', value: '{{coalesce(inputs.summary, "—")}}', as: 'text' },
        { label: 'Signature', value: '{{inputs.signature}}', as: 'image' },
      ],
      includeCart: true,
      layout: 'page',
      orientation: 'portrait',
      blocks: [
        blk('hdr', 'heading', {
          y: 5,
          h: 8,
          text: `${brand} confirmation`,
          fontSize: 20,
          bold: true,
          color: '#0f766e',
          fill: '#ecfdf5',
        }),
        blk('sub', 'text', {
          y: 14,
          h: 7,
          text: 'Prepared for {{titleCase(inputs.name)}} · {{formatDate(utcNow(), "EEEE, d MMMM yyyy")}}',
          fontSize: 10,
          fontFamily: 'times',
          color: '#475569',
        }),
        blk('div1', 'divider', { y: 22, h: 0.4, color: '#99f6e4' }),
        blk('name', 'field', {
          x: 8,
          y: 25,
          w: 40,
          h: 7,
          label: 'Full name',
          value: '{{titleCase(inputs.name)}}',
          fill: '#f8fafc',
          bold: true,
        }),
        blk('cell', 'field', {
          x: 52,
          y: 25,
          w: 40,
          h: 7,
          label: 'Cell',
          value: '{{coalesce(inputs.phone, "—")}}',
          fill: '#f8fafc',
          bold: true,
        }),
        blk('email', 'field', {
          x: 8,
          y: 34,
          w: 40,
          h: 7,
          label: 'Email',
          value: '{{inputs.email}}',
          fill: '#f8fafc',
          fontFamily: 'courier',
          fontSize: 10,
        }),
        blk('city', 'field', {
          x: 52,
          y: 34,
          w: 40,
          h: 7,
          label: 'City / area',
          value: '{{coalesce(inputs.city, "—")}}, {{coalesce(inputs.country, "")}}',
          fill: '#f8fafc',
        }),
        blk('service', 'field', {
          x: 8,
          y: 43,
          w: 40,
          h: 7,
          label: 'Service',
          value: '{{coalesce(inputs.service, "—")}}',
          fill: '#ecfdf5',
          color: '#0f766e',
          bold: true,
        }),
        blk('ref', 'field', {
          x: 52,
          y: 43,
          w: 40,
          h: 7,
          label: 'Reference',
          value: '{{coalesce(inputs.reference, "pending")}}',
          fill: '#ecfdf5',
          color: '#0f766e',
          bold: true,
          fontFamily: 'courier',
        }),
        blk('prio', 'field', {
          x: 8,
          y: 52,
          w: 40,
          h: 6,
          label: 'Priority',
          value: '{{coalesce(inputs.priority, "standard")}}',
          fill: '#fff7ed',
          color: '#9a3412',
        }),
        blk('follow', 'field', {
          x: 52,
          y: 52,
          w: 40,
          h: 6,
          label: 'Follow-up',
          value: '{{coalesce(inputs.followup, "soon")}}',
          fill: '#fff7ed',
          color: '#9a3412',
        }),
        blk('div2', 'divider', { y: 60, h: 0.35, color: '#cbd5e1' }),
        blk('notes', 'text', {
          y: 63,
          h: 10,
          text: '{{if(empty(inputs.summary), "No additional notes.", "Notes: " + inputs.summary)}}',
          fontSize: 11,
          fontFamily: 'times',
          color: '#334155',
        }),
        blk('sig', 'image', {
          y: 75,
          w: 46,
          h: 14,
          label: 'Signature',
          value: '{{inputs.signature}}',
          fill: '#ffffff',
          color: '#0f172a',
        }),
        blk('cart', 'cart', {
          x: 56,
          y: 75,
          w: 36,
          h: 14,
          label: 'Order (if any)',
          fontSize: 9,
          fill: '#f8fafc',
        }),
        blk('foot', 'text', {
          y: 92,
          h: 4,
          text: `© ${brand} · demo pack · FlowForge`,
          fontSize: 8,
          color: '#94a3b8',
          align: 'center',
        }),
      ],
      inputs: [
        { key: 'name', label: 'Full name', type: 'string', required: true },
        { key: 'email', label: 'Email', type: 'string', required: true },
        { key: 'phone', label: 'Cell', type: 'string', required: false },
        { key: 'country', label: 'Country', type: 'string', required: false },
        { key: 'city', label: 'City', type: 'string', required: false },
        { key: 'service', label: 'Service', type: 'string', required: false },
        { key: 'priority', label: 'Priority', type: 'string', required: false },
        { key: 'mood', label: 'Mood', type: 'string', required: false },
        { key: 'reference', label: 'Reference', type: 'string', required: false },
        { key: 'followup', label: 'Follow-up date', type: 'string', required: false },
        { key: 'summary', label: 'Summary', type: 'string', required: false },
        { key: 'signature', label: 'Signature', type: 'file', required: false },
        { key: 'brand', label: 'Brand', type: 'string', required: false },
        { key: 'support', label: 'Support email', type: 'string', required: false },
      ],
    },
  }
}

/** Extra attributes for dynamic enquiry entities across industries. */
export function enquiryAttributes() {
  return [
    idAttr(),
    attr('name', 'Name', 'string', { required: true, sort_order: 0 }),
    attr('email', 'Email', 'string', { required: true, sort_order: 1 }),
    attr('phone', 'Phone', 'string', { sort_order: 2 }),
    attr('country', 'Country', 'string', { sort_order: 3 }),
    attr('city', 'City', 'string', { sort_order: 4 }),
    attr('service', 'Service', 'string', { required: true, sort_order: 5 }),
    attr('summary', 'Summary', 'string', { sort_order: 6 }),
    attr('priority', 'Priority', 'string', { sort_order: 7 }),
    attr('mood', 'Mood', 'string', { sort_order: 8 }),
    attr('reference', 'Reference', 'string', { sort_order: 9 }),
    attr('followup_on', 'Follow-up on', 'string', { sort_order: 10 }),
  ]
}
