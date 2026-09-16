const MULTIPLIER = 1664525;
const INCREMENT = 1013904223;
const MODULUS = 4294967296;
const MIX_A = 0x9e3779b1;
const MIX_B = 0x85ebca6b;
const MIX_C = 0xc2b2ae35;

export class SeededRandom {
	private state: number;

	constructor(seed: number) {
		this.state = (seed >>> 0) || 1;
	}

	nextUnitInterval(): number {
		this.state = (Math.imul(this.state, MULTIPLIER) + INCREMENT) >>> 0;
		return this.state / MODULUS;
	}

	nextBelow(exclusiveMaximum: number): number {
		return Math.floor(this.nextUnitInterval() * exclusiveMaximum);
	}

	nextInRange(minimum: number, maximum: number): number {
		return minimum + this.nextUnitInterval() * (maximum - minimum);
	}
}

export function deriveSeed(baseSeed: number, offset: number): number {
	return (Math.imul(baseSeed ^ (offset + 1), 2654435761) >>> 0) || 1;
}

export function hashToUnitInterval(
	seed: number,
	stepIndex: number,
	itemIndex: number,
	channel: number
): number {
	let mixed = (seed ^ Math.imul(stepIndex + 1, MIX_A)) >>> 0;
	mixed = (mixed ^ Math.imul(itemIndex + 1, MIX_B)) >>> 0;
	mixed = (mixed ^ Math.imul(channel + 1, MIX_C)) >>> 0;
	mixed = (mixed ^ (mixed >>> 16)) >>> 0;
	mixed = Math.imul(mixed, MIX_B) >>> 0;
	mixed = (mixed ^ (mixed >>> 13)) >>> 0;
	mixed = Math.imul(mixed, MIX_C) >>> 0;
	mixed = (mixed ^ (mixed >>> 16)) >>> 0;
	return mixed / MODULUS;
}
