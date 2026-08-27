import { zipSync } from 'fflate'
import type { FilledDocument, FilledDocumentBlock } from '@/features/templates/documentFill'
import {
  A4_HEIGHT_PT,
  A4_WIDTH_PT,
  a4SizePt,
  DIVIDER_MIN_MM,
  blockBoxPts,
  documentPageCount,
  docxFontName,
  hexToRgb01,
  normalizeDocumentColor,
  optionalDocumentFill,
} from '@/features/templates/documentLayout'
import { documentMime, type DocumentFont, type DocumentOrientation } from '@/features/templates/templateModel'

function docOrientation(doc: Pick<FilledDocument, 'orientation'>): DocumentOrientation {
  return doc.orientation === 'landscape' ? 'landscape' : 'portrait'
}

/** A4 size in twips (1/20 pt) for Word page setup. */
function a4PageSize(orientation: DocumentOrientation): {
  width: number
  height: number
  orientation: 'portrait' | 'landscape'
} {
  // Word expects portrait dimensions plus an orientation flag (it swaps for landscape).
  return {
    width: Math.round(A4_WIDTH_PT * 20),
    height: Math.round(A4_HEIGHT_PT * 20),
    orientation,
  }
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function bytesFromImageUrl(url: string): Promise<{ bytes: Uint8Array; png: boolean } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = new Uint8Array(await res.arrayBuffer())
    if (!buf.length) return null
    const png = buf[0] === 0x89 && buf[1] === 0x50
    return { bytes: buf, png }
  } catch {
    return null
  }
}

function wrapLines(
  text: string,
  size: number,
  widthOf: (s: string, size: number) => number,
  maxWidth: number,
): string[] {
  const words = text.replace(/\r/g, '').split(/(\s+)/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (word.includes('\n')) {
      const parts = word.split('\n')
      for (let i = 0; i < parts.length; i++) {
        const piece = parts[i] ?? ''
        const next = current + piece
        if (piece && widthOf(next, size) > maxWidth && current) {
          lines.push(current)
          current = piece
        } else current += piece
        if (i < parts.length - 1) {
          lines.push(current)
          current = ''
        }
      }
      continue
    }
    const next = current + word
    if (widthOf(next, size) > maxWidth && current.trim()) {
      lines.push(current)
      current = word.trimStart()
    } else current = next
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

function cleanPdfText(text: string): string {
  return text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
}

function sortedBlocks(blocks: FilledDocumentBlock[]): FilledDocumentBlock[] {
  return [...blocks].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x)
}

async function generatePdfPage(doc: FilledDocument): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const orientation = docOrientation(doc)
  const pageSize = a4SizePt(orientation)
  const families = new Set<DocumentFont>(['helvetica'])
  for (const block of doc.blocks) families.add(block.fontFamily || 'helvetica')
  const faces: Record<DocumentFont, { regular: Awaited<ReturnType<typeof pdf.embedFont>>; bold: Awaited<ReturnType<typeof pdf.embedFont>> }> =
    {} as Record<DocumentFont, { regular: Awaited<ReturnType<typeof pdf.embedFont>>; bold: Awaited<ReturnType<typeof pdf.embedFont>> }>
  for (const family of families) {
    if (family === 'times') {
      faces.times = {
        regular: await pdf.embedFont(StandardFonts.TimesRoman),
        bold: await pdf.embedFont(StandardFonts.TimesRomanBold),
      }
    } else if (family === 'courier') {
      faces.courier = {
        regular: await pdf.embedFont(StandardFonts.Courier),
        bold: await pdf.embedFont(StandardFonts.CourierBold),
      }
    } else {
      faces.helvetica = {
        regular: await pdf.embedFont(StandardFonts.Helvetica),
        bold: await pdf.embedFont(StandardFonts.HelveticaBold),
      }
    }
  }
  const pages = Array.from({ length: documentPageCount(doc.blocks) }, () =>
    pdf.addPage([pageSize.width, pageSize.height]),
  )

  for (const block of doc.blocks) {
    const page = pages[Math.max(0, block.page - 1)]
    if (!page) continue
    const box = blockBoxPts(block, orientation)
    const size = block.fontSize || 11
    const pair = faces[block.fontFamily || 'helvetica'] ?? faces.helvetica
    if (!pair) continue
    const face = block.bold ? pair.bold : pair.regular
    const tone = hexToRgb01(block.color || '#0f172a')
    const ink = rgb(tone.r, tone.g, tone.b)
    const fillHex = optionalDocumentFill(block.fill)
    if (fillHex) {
      const fill = hexToRgb01(fillHex)
      page.drawRectangle({
        x: box.x,
        y: box.y,
        width: box.w,
        height: box.h,
        color: rgb(fill.r, fill.g, fill.b),
      })
    }
    if (block.type === 'divider') {
      page.drawLine({
        start: { x: box.x, y: box.y + box.h / 2 },
        end: { x: box.x + box.w, y: box.y + box.h / 2 },
        thickness: Math.max((DIVIDER_MIN_MM / 25.4) * 72, box.h),
        color: ink,
      })
      continue
    }
    if (block.type === 'image') {
      if (block.label.trim()) {
        page.drawText(cleanPdfText(block.label), {
          x: box.x,
          y: box.y + box.h - 10,
          size: 9,
          font: pair.bold,
          color: ink,
          maxWidth: box.w,
        })
      }
      if (block.imageUrl) {
        const img = await bytesFromImageUrl(block.imageUrl)
        if (img) {
          try {
            const embedded = img.png ? await pdf.embedPng(img.bytes) : await pdf.embedJpg(img.bytes)
            const top = block.label.trim() ? 12 : 0
            const availH = Math.max(8, box.h - top)
            const scale = Math.min(box.w / embedded.width, availH / embedded.height)
            const width = embedded.width * scale
            const height = embedded.height * scale
            page.drawImage(embedded, { x: box.x, y: box.y, width, height })
          } catch {
            /* keep label */
          }
        }
      }
      continue
    }
    if (block.type === 'cart' && doc.cart) {
      let y = box.y + box.h - size
      const lines = [
        block.label || 'Order',
        ...doc.cart.items.map((item) => `${item.name} × ${item.qty}  ${item.lineTotal}`),
        ...doc.cart.fees.map((fee) => `${fee.name}  ${fee.value}`),
        `Total ${doc.cart.total}`,
      ]
      for (const line of lines) {
        if (y < box.y) break
        page.drawText(cleanPdfText(line), { x: box.x, y, size: size - 1, font: face, color: ink, maxWidth: box.w })
        y -= size + 2
      }
      continue
    }
    const labelPrefix = block.type === 'field' && block.label.trim() ? `${block.label}: ` : ''
    const text = `${labelPrefix}${block.text}`.trim()
    if (!text) continue
    const lines = wrapLines(text, size, (s, sz) => face.widthOfTextAtSize(s, sz), Math.max(8, box.w))
    let y = box.y + box.h - size
    for (const line of lines) {
      if (y < box.y - 2) break
      const width = face.widthOfTextAtSize(line, size)
      let x = box.x
      if (block.align === 'center') x = box.x + Math.max(0, (box.w - width) / 2)
      if (block.align === 'right') x = box.x + Math.max(0, box.w - width)
      page.drawText(cleanPdfText(line), { x, y, size, font: face, color: ink, maxWidth: box.w + 4 })
      y -= size + 2
    }
  }
  return pdf.save()
}

async function generatePdf(doc: FilledDocument): Promise<Uint8Array> {
  if (doc.layout === 'page' && doc.blocks.length) return generatePdfPage(doc)
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const size = a4SizePt(docOrientation(doc))
  const pageSize: [number, number] = [size.width, size.height]
  let page = pdf.addPage(pageSize)
  const margin = 48
  let y = page.getHeight() - margin
  const maxWidth = page.getWidth() - margin * 2
  const ink = rgb(0.09, 0.17, 0.22)
  const muted = rgb(0.39, 0.45, 0.52)

  function ensure(space: number) {
    if (y - space >= margin) return
    page = pdf.addPage(pageSize)
    y = page.getHeight() - margin
  }

  function wrap(text: string, size: number, face: typeof font): string[] {
    const words = text.replace(/\r/g, '').split(/(\s+)/)
    const lines: string[] = []
    let current = ''
    for (const word of words) {
      if (word.includes('\n')) {
        const parts = word.split('\n')
        for (let i = 0; i < parts.length; i++) {
          const piece = parts[i] ?? ''
          const next = current + piece
          if (piece && face.widthOfTextAtSize(next, size) > maxWidth && current) {
            lines.push(current)
            current = piece
          } else current += piece
          if (i < parts.length - 1) {
            lines.push(current)
            current = ''
          }
        }
        continue
      }
      const next = current + word
      if (face.widthOfTextAtSize(next, size) > maxWidth && current.trim()) {
        lines.push(current)
        current = word.trimStart()
      } else current = next
    }
    if (current) lines.push(current)
    return lines.length ? lines : ['']
  }

  function write(text: string, size: number, face: typeof font, color = ink, gap = 6) {
    if (!text.trim()) return
    for (const line of wrap(text, size, face)) {
      ensure(size + 4)
      page.drawText(line.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ''), {
        x: margin,
        y: y - size,
        size,
        font: face,
        color,
        maxWidth,
      })
      y -= size + 3
    }
    y -= gap
  }

  write(doc.title || doc.filename, 18, bold, ink, 10)
  write(doc.intro, 11, font, muted, 12)
  for (const field of doc.fields) {
    write(`${field.label}: ${field.imageUrl ? '' : field.text}`, 11, font, ink, field.imageUrl ? 4 : 8)
    if (!field.imageUrl) continue
    const img = await bytesFromImageUrl(field.imageUrl)
    if (!img) {
      write(field.text || '(signature unavailable)', 10, font, muted, 8)
      continue
    }
    try {
      const embedded = img.png ? await pdf.embedPng(img.bytes) : await pdf.embedJpg(img.bytes)
      const width = Math.min(220, embedded.width)
      const height = (embedded.height / embedded.width) * width
      ensure(height + 12)
      page.drawImage(embedded, { x: margin, y: y - height, width, height })
      y -= height + 10
    } catch {
      write(field.text || '(signature unavailable)', 10, font, muted, 8)
    }
  }
  write(doc.body, 11, font, ink, 12)
  if (doc.cart) {
    write('Order', 13, bold, ink, 8)
    for (const item of doc.cart.items) {
      write(`${item.name} × ${item.qty}  ${item.lineTotal}`, 11, font)
    }
    for (const fee of doc.cart.fees) write(`${fee.name}  ${fee.value}`, 11, font, muted, 4)
    write(`Total ${doc.cart.total}`, 12, bold, ink, 12)
  }
  write(doc.footer, 9, font, muted, 0)
  return pdf.save()
}

async function generateDocx(doc: FilledDocument): Promise<Uint8Array> {
  if (doc.layout === 'page' && doc.blocks.length) return generateDocxPage(doc)
  return generateDocxFlow(doc)
}

async function generateDocxPage(doc: FilledDocument): Promise<Uint8Array> {
  const { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType, BorderStyle, ShadingType } =
    await import('docx')
  const alignOf = (align: FilledDocumentBlock['align']) =>
    align === 'center' ? AlignmentType.CENTER : align === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT
  const children: InstanceType<typeof Paragraph>[] = []
  for (const block of sortedBlocks(doc.blocks)) {
    const color = normalizeDocumentColor(block.color || '#0f172a').slice(1)
    const font = docxFontName(block.fontFamily || 'helvetica')
    const size = Math.max(16, Math.round((block.fontSize || 11) * 2))
    const fillHex = optionalDocumentFill(block.fill)
    const shading = fillHex
      ? { type: ShadingType.CLEAR, fill: fillHex.slice(1) }
      : undefined
    if (block.type === 'divider') {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          border: {
            bottom: { color, space: 1, size: 8, style: BorderStyle.SINGLE },
          },
          children: [new TextRun('')],
        }),
      )
      continue
    }
    if (block.type === 'image') {
      if (block.label.trim()) {
        children.push(
          new Paragraph({
            spacing: { after: 80 },
            alignment: alignOf(block.align),
            shading,
            children: [new TextRun({ text: block.label, bold: true, font, size: 18, color })],
          }),
        )
      }
      if (block.imageUrl) {
        const img = await bytesFromImageUrl(block.imageUrl)
        if (img) {
          children.push(
            new Paragraph({
              spacing: { after: 200 },
              alignment: alignOf(block.align),
              children: [
                new ImageRun({
                  type: img.png ? 'png' : 'jpg',
                  data: img.bytes,
                  transformation: { width: 220, height: 90 },
                }),
              ],
            }),
          )
          continue
        }
      }
      if (block.text.trim()) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: block.text, font, size, color })],
          }),
        )
      }
      continue
    }
    if (block.type === 'cart' && doc.cart) {
      const lines = [
        block.label || 'Order',
        ...doc.cart.items.map((item) => `${item.name} × ${item.qty}  ${item.lineTotal}`),
        ...doc.cart.fees.map((fee) => `${fee.name}  ${fee.value}`),
        `Total ${doc.cart.total}`,
      ]
      for (const line of lines) {
        children.push(
          new Paragraph({
            spacing: { after: 80 },
            alignment: alignOf(block.align),
            shading,
            children: [new TextRun({ text: line, font, size, color, bold: block.bold })],
          }),
        )
      }
      continue
    }
    const labelPrefix = block.type === 'field' && block.label.trim() ? `${block.label}: ` : ''
    const text = `${labelPrefix}${block.text}`.trim()
    if (!text) continue
    for (const line of text.split('\n')) {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          alignment: alignOf(block.align),
          shading,
          children: [new TextRun({ text: line, font, size, color, bold: !!block.bold })],
        }),
      )
    }
  }
  const file = new Document({
    sections: [
      {
        properties: {
          page: {
            size: a4PageSize(docOrientation(doc)),
          },
        },
        children,
      },
    ],
  })
  const buf = await Packer.toBuffer(file)
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf)
}

async function generateDocxFlow(doc: FilledDocument): Promise<Uint8Array> {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ImageRun } =
    await import('docx')
  const children: InstanceType<typeof Paragraph>[] = []
  const pushText = (text: string, opts?: { bold?: boolean; size?: number; color?: string }) => {
    if (!text.trim()) return
    for (const line of text.split('\n')) {
      children.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: line,
              bold: opts?.bold,
              size: opts?.size ?? 22,
              font: 'Calibri',
              color: opts?.color ?? '0f172a',
            }),
          ],
        }),
      )
    }
  }
  pushText(doc.title || doc.filename, { bold: true, size: 32 })
  pushText(doc.intro, { color: '64748b' })
  const rows = []
  for (const field of doc.fields) {
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 2200, type: WidthType.DXA },
            children: [new Paragraph({ children: [new TextRun({ text: field.label, bold: true })] })],
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: field.imageUrl ? '' : field.text })] })],
          }),
        ],
      }),
    )
  }
  if (rows.length) {
    children.push(new Table({ width: { size: 9026, type: WidthType.DXA }, rows }) as unknown as InstanceType<typeof Paragraph>)
  }
  for (const field of doc.fields) {
    if (!field.imageUrl) continue
    const img = await bytesFromImageUrl(field.imageUrl)
    if (!img) {
      pushText(`${field.label}: ${field.text || '(signature unavailable)'}`, { color: '64748b' })
      continue
    }
    children.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({ text: `${field.label}: `, bold: true }),
          new ImageRun({
            type: img.png ? 'png' : 'jpg',
            data: img.bytes,
            transformation: { width: 220, height: 90 },
          }),
        ],
      }),
    )
  }
  pushText(doc.body)
  if (doc.cart) {
    pushText('Order', { bold: true, size: 26 })
    for (const item of doc.cart.items) pushText(`${item.name} × ${item.qty}  ${item.lineTotal}`)
    for (const fee of doc.cart.fees) pushText(`${fee.name}  ${fee.value}`)
    pushText(`Total ${doc.cart.total}`, { bold: true })
  }
  pushText(doc.footer, { color: '64748b', size: 18 })
  const file = new Document({
    sections: [
      {
        properties: {
          page: {
            size: a4PageSize(docOrientation(doc)),
          },
        },
        children,
      },
    ],
  })
  const buf = await Packer.toBuffer(file)
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf)
}

function colLetter(index: number): string {
  let n = index + 1
  let out = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

function xlsxCell(ref: string, value: string): string {
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`
}

function generateXlsx(doc: FilledDocument): Uint8Array {
  const fromBlocks =
    doc.layout === 'page' && doc.blocks.length
      ? sortedBlocks(doc.blocks).flatMap((block) => {
          if (block.type === 'divider') return []
          if (block.type === 'field') return [[block.label, block.text]]
          if (block.type === 'image') return [[block.label, block.imageUrl || block.text]]
          if (block.text.trim()) return [[block.text]]
          return []
        })
      : null
  const rows: string[][] = fromBlocks?.length
    ? fromBlocks
    : [[doc.title || 'Document'], [doc.intro], ['Label', 'Value']]
  if (!fromBlocks?.length) {
    for (const field of doc.fields) rows.push([field.label, field.imageUrl ? field.imageUrl : field.text])
    if (doc.body.trim()) {
      rows.push([])
      rows.push(['Details', doc.body])
    }
  }
  if (doc.cart) {
    rows.push([])
    rows.push(['Item', 'Qty', 'Amount'])
    for (const item of doc.cart.items) rows.push([item.name, String(item.qty), item.lineTotal])
    for (const fee of doc.cart.fees) rows.push([fee.name, '', fee.value])
    rows.push(['Total', '', doc.cart.total])
  }
  if (doc.footer.trim()) {
    rows.push([])
    rows.push([doc.footer])
  }
  const sheetRows = rows.map((cols, r) => {
    const cells = cols.map((value, c) => xlsxCell(`${colLetter(c)}${r + 1}`, value)).join('')
    return `<row r="${r + 1}">${cells}</row>`
  })
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetRows.join('')}</sheetData>
</worksheet>`
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Document" sheetId="1" r:id="rId1"/></sheets>
</workbook>`
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
  const enc = new TextEncoder()
  return zipSync({
    '[Content_Types].xml': enc.encode(types),
    '_rels/.rels': enc.encode(rels),
    'xl/workbook.xml': enc.encode(workbook),
    'xl/_rels/workbook.xml.rels': enc.encode(wbRels),
    'xl/worksheets/sheet1.xml': enc.encode(sheet),
  })
}

export async function generateDocumentFile(doc: FilledDocument): Promise<{ bytes: Uint8Array; filename: string; mime: string }> {
  let bytes: Uint8Array
  if (doc.format === 'pdf') bytes = await generatePdf(doc)
  else if (doc.format === 'docx') bytes = await generateDocx(doc)
  else bytes = generateXlsx(doc)
  return { bytes, filename: doc.filename, mime: documentMime(doc.format) }
}

export function documentFileBlob(bytes: Uint8Array, mime: string): Blob {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy], { type: mime })
}
