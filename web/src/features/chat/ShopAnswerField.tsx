import { useMemo, useState } from 'react'
import { Minus, Plus, ShoppingBag, ShoppingCart } from 'lucide-react'
import {
  buildShopCart,
  formatTemplateMoney,
  productMaxQty,
  type CartContent,
  type ShopCartValue,
  type StoreProduct,
} from '@/features/templates/templateModel'
import type { ChatbotMediaFile } from '@/features/designer/model/chatbotMedia'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

const ALL = '__all__'

export function ShopAnswerField({
  catalog,
  media = [],
  onSubmit,
  preview,
  className,
}: {
  catalog: CartContent
  media?: ChatbotMediaFile[]
  onSubmit?: (value: ShopCartValue) => void
  preview?: boolean
  className?: string
}) {
  const [categoryId, setCategoryId] = useState(ALL)
  const [qtyById, setQtyById] = useState<Record<string, number>>({})
  const urlByName = useMemo(() => new Map(media.map((f) => [f.filename, f.url])), [media])

  const categories = catalog.categories.filter((c) => c.name.trim() || catalog.products.some((p) => p.categoryId === c.id))
  const products = catalog.products.filter((p) => p.name.trim())
  const visible = products.filter((p) => categoryId === ALL || p.categoryId === categoryId)
  const cart = buildShopCart(catalog, qtyById)

  function setQty(id: string, qty: number) {
    const product = products.find((p) => p.id === id)
    const max = product ? productMaxQty(product) : 99
    setQtyById((prev) => {
      const next = { ...prev }
      const capped = Math.min(max, qty)
      if (capped <= 0) delete next[id]
      else next[id] = capped
      return next
    })
  }

  function checkout() {
    if (preview || !onSubmit || !cart.itemCount) return
    onSubmit(cart)
  }

  if (!products.length) {
    return (
      <p className="text-sm text-slate-500">This store has no products yet. Add categories and products on the Templates tab.</p>
    )
  }

  return (
    <div className={cn('flex min-h-0 flex-col gap-3', className)}>
      {catalog.storeName.trim() ? (
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-50 text-teal-800">
            <ShoppingBag className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800">{catalog.storeName.trim()}</p>
            {catalog.intro.trim() ? (
              <p className="text-[11px] text-slate-500">{catalog.intro.trim()}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {categories.length > 1 ? (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Categories">
          <CategoryChip
            label="All"
            active={categoryId === ALL}
            onClick={() => setCategoryId(ALL)}
          />
          {categories.map((cat) => (
            <CategoryChip
              key={cat.id}
              label={cat.name.trim() || 'Untitled'}
              active={categoryId === cat.id}
              onClick={() => setCategoryId(cat.id)}
            />
          ))}
        </div>
      ) : null}

      <div className="ff-hide-scrollbar grid max-h-[min(26rem,50vh)] auto-rows-min grid-cols-2 items-start gap-2 overflow-y-auto overscroll-contain">
        {visible.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            currency={catalog.currency}
            imageUrl={product.image ? urlByName.get(product.image) ?? '' : ''}
            qty={qtyById[product.id] ?? 0}
            maxQty={productMaxQty(product)}
            onAdd={() => setQty(product.id, (qtyById[product.id] ?? 0) + 1)}
            onDec={() => setQty(product.id, (qtyById[product.id] ?? 0) - 1)}
          />
        ))}
        {!visible.length ? (
          <p className="col-span-2 py-6 text-center text-sm text-slate-500">No products in this category.</p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <ShoppingCart className="h-4 w-4 text-teal-700" />
            Cart
          </p>
          <p className="text-sm font-semibold text-teal-800">
            {cart.itemCount
              ? `${cart.itemCount} · ${formatTemplateMoney(cart.total, cart.currency)}`
              : 'Empty'}
          </p>
        </div>
        {cart.items.length ? (
          <ul className="mb-3 space-y-1.5">
            {cart.items.map((line) => (
              <li key={line.id} className="flex items-center justify-between gap-2 text-xs text-slate-600">
                <span className="min-w-0 truncate">
                  {line.name} × {line.qty}
                </span>
                <span className="shrink-0 font-medium text-slate-800">
                  {formatTemplateMoney(line.lineTotal, cart.currency)}
                </span>
              </li>
            ))}
            {cart.fees.length || cart.subtotal !== cart.total ? (
              <li className="flex items-center justify-between gap-2 border-t border-slate-200/80 pt-1.5 text-xs text-slate-500">
                <span>Subtotal</span>
                <span className="shrink-0">{formatTemplateMoney(cart.subtotal, cart.currency)}</span>
              </li>
            ) : null}
            {cart.fees.map((fee) => (
              <li key={fee.id} className="flex items-center justify-between gap-2 text-xs text-slate-600">
                <span className="min-w-0 truncate">
                  {fee.name}
                  {fee.kind === 'percent' ? ` (${fee.amount}%)` : ''}
                </span>
                <span className="shrink-0 font-medium text-slate-800">
                  {formatTemplateMoney(fee.value, cart.currency)}
                </span>
              </li>
            ))}
            {cart.fees.length ? (
              <li className="flex items-center justify-between gap-2 pt-0.5 text-xs font-semibold text-slate-800">
                <span>Total</span>
                <span className="shrink-0">{formatTemplateMoney(cart.total, cart.currency)}</span>
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="mb-3 text-[11px] text-slate-500">
            {catalog.cartHint.trim() || 'Add products, then checkout to continue.'}
          </p>
        )}
        <Button
          className="w-full"
          disabled={!cart.itemCount || preview || !onSubmit}
          onClick={checkout}
        >
          {catalog.checkoutLabel.trim() || 'Checkout'}
          {cart.itemCount ? ` · ${formatTemplateMoney(cart.total, cart.currency)}` : ''}
        </Button>
        {preview ? (
          <p className="mt-1.5 text-center text-[11px] text-slate-500">
            Preview only — in chat, Checkout saves the cart and continues the flow.
          </p>
        ) : null}
      </div>
    </div>
  )
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition',
        active
          ? 'border-teal-500 bg-teal-50 text-teal-800'
          : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300',
      )}
    >
      {label}
    </button>
  )
}

function ProductCard({
  product,
  currency,
  imageUrl,
  qty,
  maxQty,
  onAdd,
  onDec,
}: {
  product: StoreProduct
  currency: string
  imageUrl: string
  qty: number
  maxQty: number
  onAdd: () => void
  onDec: () => void
}) {
  const initial = product.name.trim().slice(0, 1).toUpperCase() || '?'
  const soldOut = maxQty <= 0
  const atCap = qty >= maxQty
  return (
    <div className="flex min-h-min flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid h-20 shrink-0 place-items-center overflow-hidden rounded-t-2xl bg-slate-100">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-lg font-semibold text-slate-400">{initial}</span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
        <p className="truncate text-sm font-semibold text-slate-800">{product.name}</p>
        {product.description.trim() ? (
          <p className="line-clamp-2 text-[11px] leading-snug text-slate-500">{product.description}</p>
        ) : null}
        <p className="text-sm font-semibold text-teal-800">{formatTemplateMoney(product.price, currency)}</p>
        {soldOut ? (
          <p className="mt-auto text-center text-[11px] font-medium text-slate-500">Sold out</p>
        ) : qty > 0 ? (
          <div className="mt-auto flex shrink-0 items-center justify-between rounded-xl border border-teal-200 bg-teal-50/70 px-1 py-0.5">
            <button
              type="button"
              aria-label={`Remove one ${product.name}`}
              className="grid h-7 w-7 place-items-center rounded-lg text-teal-800 hover:bg-white"
              onClick={onDec}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="text-sm font-semibold text-slate-800">{qty}</span>
            <button
              type="button"
              aria-label={`Add another ${product.name}`}
              disabled={atCap}
              className="grid h-7 w-7 place-items-center rounded-lg text-teal-800 hover:bg-white disabled:opacity-40"
              onClick={onAdd}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <Button size="sm" variant="secondary" className="mt-auto w-full shrink-0" onClick={onAdd}>
            Add to cart
          </Button>
        )}
      </div>
    </div>
  )
}
