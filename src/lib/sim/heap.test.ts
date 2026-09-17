import { describe, expect, it } from 'vitest';
import { MinHeap } from '$lib/sim/heap';

describe('heap', () => {
	it('mengeluarkan simpul urut dari prioritas terkecil', () => {
		const heap = new MinHeap(4);
		const priorities = [7, 3, 9, 1, 5, 8, 2, 6, 4, 0];
		priorities.forEach((priority, node) => heap.push(node, priority));

		expect(heap.length).toBe(priorities.length);
		const popped: number[] = [];
		while (heap.length > 0) popped.push(priorities[heap.pop()]);
		expect(popped).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
	});

	it('tetap benar saat simpul dimasukkan di sela pengeluaran', () => {
		const heap = new MinHeap(1);
		heap.push(10, 10);
		heap.push(20, 20);
		expect(heap.pop()).toBe(10);
		heap.push(5, 5);
		heap.push(30, 30);
		expect([heap.pop(), heap.pop(), heap.pop()]).toEqual([5, 20, 30]);
		expect(heap.length).toBe(0);
	});
});
