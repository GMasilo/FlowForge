import { Plus, Trash2 } from 'lucide-react'
import { ShopAnswerField } from '@/features/chat/ShopAnswerField'
import { TemplateField } from '@/features/designer/inspector/TemplateField'
import type { TemplateSuggestion } from '@/features/designer/inspector/TemplateField'
import { mediaKindOf, type ChatbotMediaFile } from '@/features/designer/model/chatbotMedia'
import {
  emptyStoreCategory,
  emptyStoreFee,
  emptyStoreProduct,
  type CartContent,
  type StoreFee,
} from '@/features/templates/templateModel'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { COMMON_CURRENCY_CODES } from '@/features/designer/model/flowSchema'

export function StoreCatalogEditor({
  content,
  onChange,
  suggestions,
  readOnly,
  media = [],
}: {
  content: CartContent
  onChange: (next: CartContent) => void
  suggestions: TemplateSuggestion[]
  readOnly?: boolean
  media?: ChatbotMediaFile[]
}) {
  const images = media.filter((f) => mediaKindOf(f) === 'image')
  const firstCat = content.categories[0]?.id ?? ''

  function patch(partial: Partial<CartContent>) {
    onChange({ ...content, ...partial })
  }

  function updateCategory(index: number, name: string) {
    const categories = content.categories.map((row, i) => (i === index ? { ...row, name } : row))
    patch({ categories })
  }

  function removeCategory(index: number) {
    if (content.categories.length <= 1) return
    const removed = content.categories[index]
    const categories = content.categories.filter((_, i) => i !== index)
    const fallback = categories[0]!.id
    const products = content.products.map((p) =>
      p.categoryId === removed?.id ? { ...p, categoryId: fallback } : p,
    )
    patch({ categories, products })
  }

  function updateProduct(index: number, next: Partial<CartContent['products'][number]>) {
    const products = content.products.map((row, i) => (i === index ? { ...row, ...next } : row))
    patch({ products })
  }

  const fees = content.fees ?? []

  function updateFee(index: number, next: Partial<StoreFee>) {
    patch({
      fees: fees.map((row, i) => (i === index ? { ...row, ...next } : row)),
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Store name</Label>
            <Input
              disabled={readOnly}
              value={content.storeName}
              onChange={(e) => patch({ storeName: e.target.value })}
              placeholder="Corner café"
            />
          </div>
          <div>
            <Label>Currency</Label>
            <Select
              disabled={readOnly}
              value={content.currency || 'USD'}
              onChange={(e) => patch({ currency: e.target.value })}
            >
              {COMMON_CURRENCY_CODES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
              {content.currency &&
              !(COMMON_CURRENCY_CODES as readonly string[]).includes(content.currency) ? (
                <option value={content.currency}>{content.currency}</option>
              ) : null}
            </Select>
          </div>
        </div>
        <div>
          <Label>Intro</Label>
          <TemplateField
            disabled={readOnly}
            value={content.intro}
            suggestions={suggestions}
            onChange={(intro) => patch({ intro })}
            placeholder="Browse the menu and add items to your cart."
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Checkout button</Label>
            <Input
              disabled={readOnly}
              value={content.checkoutLabel}
              onChange={(e) => patch({ checkoutLabel: e.target.value })}
              placeholder="Checkout"
            />
          </div>
          <div>
            <Label>Empty-cart hint</Label>
            <Input
              disabled={readOnly}
              value={content.cartHint}
              onChange={(e) => patch({ cartHint: e.target.value })}
              placeholder="Add products, then checkout"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Categories</Label>
          {content.categories.map((cat, index) => (
            <div key={cat.id} className="flex items-center gap-2">
              <Input
                disabled={readOnly}
                value={cat.name}
                placeholder="Category name"
                onChange={(e) => updateCategory(index, e.target.value)}
              />
              <Button
                size="sm"
                variant="ghost"
                disabled={readOnly || content.categories.length <= 1}
                onClick={() => removeCategory(index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            disabled={readOnly}
            onClick={() => patch({ categories: [...content.categories, emptyStoreCategory('')] })}
          >
            <Plus className="h-3.5 w-3.5" />
            Add category
          </Button>
        </div>

        <div className="space-y-2">
          <Label>Products</Label>
          {content.products.map((product, index) => {
            const file = images.find((f) => f.filename === product.image)
            return (
              <div key={product.id} className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-3">
                <div className="flex items-start gap-2">
                  <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-[var(--color-surface-2)]">
                    {file?.url ? (
                      <img src={file.url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-[var(--color-ink-muted)]">No img</span>
                    )}
                  </div>
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                    <Input
                      disabled={readOnly}
                      value={product.name}
                      placeholder="Product name"
                      onChange={(e) => updateProduct(index, { name: e.target.value })}
                    />
                    <Input
                      disabled={readOnly}
                      value={product.sku}
                      placeholder="SKU"
                      onChange={(e) => updateProduct(index, { sku: e.target.value })}
                    />
                    <Select
                      disabled={readOnly}
                      value={product.categoryId || firstCat}
                      onChange={(e) => updateProduct(index, { categoryId: e.target.value })}
                    >
                      {content.categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name.trim() || 'Untitled category'}
                        </option>
                      ))}
                    </Select>
                    <Input
                      disabled={readOnly}
                      type="number"
                      min="0"
                      step="0.01"
                      value={Number.isFinite(product.price) ? product.price : 0}
                      onChange={(e) => updateProduct(index, { price: Number(e.target.value) })}
                    />
                    <Input
                      disabled={readOnly}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Stock (unlimited)"
                      value={product.stock ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value
                        if (raw === '') {
                          updateProduct(index, { stock: null })
                          return
                        }
                        const n = Math.floor(Number(raw))
                        updateProduct(index, { stock: Number.isFinite(n) && n >= 0 ? n : null })
                      }}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={readOnly || content.products.length <= 1}
                    onClick={() =>
                      patch({ products: content.products.filter((_, i) => i !== index) })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input
                  disabled={readOnly}
                  value={product.description}
                  placeholder="Short description"
                  onChange={(e) => updateProduct(index, { description: e.target.value })}
                />
                <p className="text-[11px] text-[var(--color-ink-muted)]">
                  Stock is stored on the catalog, not a live inventory service. Leave empty for unlimited.
                </p>
                <Select
                  disabled={readOnly}
                  value={product.image}
                  onChange={(e) => updateProduct(index, { image: e.target.value })}
                >
                  <option value="">No product image</option>
                  {product.image && !images.some((f) => f.filename === product.image) ? (
                    <option value={product.image}>{product.image}</option>
                  ) : null}
                  {images.map((f) => (
                    <option key={f.filename} value={f.filename}>
                      {f.filename}
                    </option>
                  ))}
                </Select>
              </div>
            )
          })}
          <Button
            size="sm"
            variant="secondary"
            disabled={readOnly}
            onClick={() =>
              patch({
                products: [...content.products, emptyStoreProduct(firstCat || emptyStoreCategory().id)],
              })
            }
          >
            <Plus className="h-3.5 w-3.5" />
            Add product
          </Button>
        </div>

        <div className="space-y-2">
          <div>
            <Label>Fees</Label>
            <p className="mt-0.5 text-[11px] text-[var(--color-ink-muted)]">
              Extra costs added at checkout — shipping, delivery, tax, service charge, and so on.
              Percent fees use the product subtotal. Fees apply only when the cart has items.
            </p>
          </div>
          {fees.map((fee, index) => (
            <div
              key={fee.id}
              className="grid gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-3 sm:grid-cols-[minmax(0,1.2fr)_7.5rem_6.5rem_auto]"
            >
              <Input
                disabled={readOnly}
                value={fee.name}
                placeholder="Shipping, delivery, tax…"
                onChange={(e) => updateFee(index, { name: e.target.value })}
              />
              <Select
                disabled={readOnly}
                value={fee.kind}
                onChange={(e) =>
                  updateFee(index, { kind: e.target.value === 'percent' ? 'percent' : 'fixed' })
                }
              >
                <option value="fixed">Fixed amount</option>
                <option value="percent">% of subtotal</option>
              </Select>
              <Input
                disabled={readOnly}
                type="number"
                min="0"
                step={fee.kind === 'percent' ? '0.1' : '0.01'}
                value={Number.isFinite(fee.amount) ? fee.amount : 0}
                placeholder={fee.kind === 'percent' ? '15' : '5.00'}
                onChange={(e) => updateFee(index, { amount: Number(e.target.value) })}
              />
              <Button
                size="sm"
                variant="ghost"
                disabled={readOnly}
                onClick={() => patch({ fees: fees.filter((_, i) => i !== index) })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              disabled={readOnly}
              onClick={() => patch({ fees: [...fees, emptyStoreFee()] })}
            >
              <Plus className="h-3.5 w-3.5" />
              Add fee
            </Button>
            {!fees.some((f) => /tax/i.test(f.name)) ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={readOnly}
                onClick={() => patch({ fees: [...fees, { ...emptyStoreFee('Tax'), kind: 'percent', amount: 15 }] })}
              >
                + Tax %
              </Button>
            ) : null}
            {!fees.some((f) => /ship|deliver/i.test(f.name)) ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={readOnly}
                onClick={() => patch({ fees: [...fees, emptyStoreFee('Delivery')] })}
              >
                + Delivery
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div>
        <Label>Store preview</Label>
        <p className="mb-2 text-[11px] text-[var(--color-ink-muted)]">
          This is what visitors see on a Shop question. Add products, then use a Question step with
          answer type Shop.
        </p>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm">
          <ShopAnswerField catalog={content} media={media} preview />
        </div>
      </div>
    </div>
  )
}
