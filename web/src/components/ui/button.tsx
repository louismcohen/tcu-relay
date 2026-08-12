import { cn } from '@/lib/utils';
import { type VariantProps, cva } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';

const buttonVariants = cva(
    'inline-flex items-center cursor-pointer justify-center rounded-sm px-4 py-2 text-sm font-medium tracking-wide transition-colors disabled:pointer-events-none disabled:opacity-50',
    {
        variants: {
            variant: {
                default: 'bg-brass text-ink hover:bg-brass-dim',
                ghost: 'border border-line text-paper hover:border-brass hover:text-brass',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
    VariantProps<typeof buttonVariants>;

export function Button({
    className,
    variant,
    type = 'button',
    ...props
}: ButtonProps) {
    return (
        <button
            type={type}
            className={cn(buttonVariants({ variant }), className)}
            {...props}
        />
    );
}
