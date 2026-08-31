import { clampFontSize } from '$lib/features/terminals/types';

export const PINCH_SCALE_PER_FONT_STEP = 1.12;

type TouchPoint = Pick<Touch, 'clientX' | 'clientY'>;

export function touchDistance(a: TouchPoint, b: TouchPoint): number {
	return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

/**
 * Convert a two-finger scale into discrete persisted font-size steps.
 * A full 12% scale change is required per step so normal finger jitter near the
 * gesture origin does not continuously toggle font size.
 */
export function fontSizeForPinch(
	startFontSize: number,
	startDistance: number,
	currentDistance: number
): number {
	if (!Number.isFinite(startDistance) || !Number.isFinite(currentDistance)) {
		return clampFontSize(startFontSize);
	}
	if (startDistance <= 0 || currentDistance <= 0) return clampFontSize(startFontSize);

	const scale = currentDistance / startDistance;
	const rawSteps = Math.log(scale) / Math.log(PINCH_SCALE_PER_FONT_STEP);
	const steps = Math.trunc(rawSteps);
	return clampFontSize(startFontSize + steps);
}
