import { describe, expect, it } from 'vitest';
import { SeededRandom, deriveSeed, hashToUnitInterval } from '$lib/sim/random';

const SAMPLE_COUNT = 10_000;

describe('random', () => {
	it('benih yang sama menghasilkan deret yang sama persis', () => {
		const first = new SeededRandom(42);
		const second = new SeededRandom(42);
		const third = new SeededRandom(43);
		const sequence = Array.from({ length: 20 }, () => first.nextUnitInterval());
		expect(Array.from({ length: 20 }, () => second.nextUnitInterval())).toEqual(sequence);
		expect(Array.from({ length: 20 }, () => third.nextUnitInterval())).not.toEqual(sequence);
	});

	it('benih nol tidak membuat deret macet', () => {
		const random = new SeededRandom(0);
		expect(new Set(Array.from({ length: 10 }, () => random.nextUnitInterval())).size).toBe(10);
	});

	it('nilai selalu berada di dalam rentang yang diminta', () => {
		const random = new SeededRandom(7);
		for (let index = 0; index < SAMPLE_COUNT; index += 1) {
			const unit = random.nextUnitInterval();
			expect(unit >= 0 && unit < 1).toBe(true);
			const below = random.nextBelow(5);
			expect(Number.isInteger(below) && below >= 0 && below < 5).toBe(true);
			const ranged = random.nextInRange(-3, 3);
			expect(ranged >= -3 && ranged < 3).toBe(true);
		}
	});

	it('benih turunan berbeda per lari dan tidak pernah nol', () => {
		const seeds = Array.from({ length: 100 }, (_, offset) => deriveSeed(123, offset));
		expect(new Set(seeds).size).toBe(100);
		expect(seeds.every((seed) => seed > 0)).toBe(true);
		expect(deriveSeed(123, 5)).toBe(deriveSeed(123, 5));
	});

	it('hash per langkah dan per bangunan tetap dan tersebar rata', () => {
		expect(hashToUnitInterval(9, 3, 4, 0)).toBe(hashToUnitInterval(9, 3, 4, 0));
		expect(hashToUnitInterval(9, 3, 4, 0)).not.toBe(hashToUnitInterval(9, 3, 4, 1));

		let sum = 0;
		for (let item = 0; item < SAMPLE_COUNT; item += 1) {
			const value = hashToUnitInterval(9, 0, item, 0);
			expect(value >= 0 && value < 1).toBe(true);
			sum += value;
		}
		expect(sum / SAMPLE_COUNT).toBeCloseTo(0.5, 1);
	});
});
