import type { ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] text-[var(--color-accent-fg)] shadow-[var(--shadow-lift)] hover:brightness-105',
        secondary:
          'bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-border)] shadow-sm hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface-2)] hover:shadow-md',
        ghost:
          'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] hover:shadow-sm',
        danger:
          'bg-gradient-to-br from-rose-500 to-[var(--color-danger)] text-white shadow-[0_10px_24px_-10px_rgb(225_29_72_/_0.55)] hover:brightness-105',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-11 px-5 text-[15px]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
