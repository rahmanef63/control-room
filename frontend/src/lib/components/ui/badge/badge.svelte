<script lang="ts" module>
	import { type VariantProps, tv } from 'tailwind-variants';

	export const badgeVariants = tv({
		base: 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
		variants: {
			variant: {
				default: 'bg-cyan-400/15 text-cyan-200 border border-cyan-400/30',
				outline: 'border border-white/15 text-slate-200',
				warning: 'bg-amber-400/15 text-amber-200 border border-amber-400/30',
				danger: 'bg-rose-500/15 text-rose-200 border border-rose-500/30'
			}
		},
		defaultVariants: { variant: 'default' }
	});

	export type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLSpanElement> {
		variant?: BadgeVariant;
		class?: string;
	}

	let { variant = 'default', class: className = '', children, ...rest }: Props = $props();
</script>

<span class={badgeVariants({ variant, class: className })} {...rest}>
	{@render children?.()}
</span>
