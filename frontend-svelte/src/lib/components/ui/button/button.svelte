<script lang="ts" module>
	import { type VariantProps, tv } from 'tailwind-variants';

	export const buttonVariants = tv({
		base: 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[1.1rem] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:pointer-events-none disabled:opacity-50',
		variants: {
			variant: {
				default: 'bg-cyan-400 text-slate-950 hover:bg-cyan-300',
				outline: 'border border-white/15 bg-white/5 text-white hover:bg-white/10',
				ghost: 'text-slate-200 hover:bg-white/10'
			},
			size: {
				default: 'h-10 px-4 py-2',
				sm: 'h-8 px-3 text-xs',
				icon: 'h-9 w-9'
			}
		},
		defaultVariants: { variant: 'default', size: 'default' }
	});

	export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
	export type ButtonSize = VariantProps<typeof buttonVariants>['size'];
</script>

<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		variant?: ButtonVariant;
		size?: ButtonSize;
		class?: string;
	}

	let { variant = 'default', size = 'default', class: className = '', children, ...rest }: Props = $props();
</script>

<button class={buttonVariants({ variant, size, class: className })} {...rest}>
	{@render children?.()}
</button>
