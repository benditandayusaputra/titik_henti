export class MinHeap {
	private nodes: Int32Array;
	private priorities: Float64Array;
	private size = 0;

	constructor(capacity: number) {
		this.nodes = new Int32Array(capacity);
		this.priorities = new Float64Array(capacity);
	}

	get length(): number {
		return this.size;
	}

	push(node: number, priority: number): void {
		if (this.size === this.nodes.length) {
			this.grow();
		}
		let child = this.size;
		this.size += 1;
		this.nodes[child] = node;
		this.priorities[child] = priority;
		while (child > 0) {
			const parent = (child - 1) >> 1;
			if (this.priorities[parent] <= this.priorities[child]) break;
			this.swap(parent, child);
			child = parent;
		}
	}

	pop(): number {
		const top = this.nodes[0];
		this.size -= 1;
		if (this.size > 0) {
			this.nodes[0] = this.nodes[this.size];
			this.priorities[0] = this.priorities[this.size];
			let parent = 0;
			for (;;) {
				const left = parent * 2 + 1;
				const right = left + 1;
				let smallest = parent;
				if (left < this.size && this.priorities[left] < this.priorities[smallest]) smallest = left;
				if (right < this.size && this.priorities[right] < this.priorities[smallest]) smallest = right;
				if (smallest === parent) break;
				this.swap(parent, smallest);
				parent = smallest;
			}
		}
		return top;
	}

	private swap(first: number, second: number): void {
		const node = this.nodes[first];
		this.nodes[first] = this.nodes[second];
		this.nodes[second] = node;
		const priority = this.priorities[first];
		this.priorities[first] = this.priorities[second];
		this.priorities[second] = priority;
	}

	private grow(): void {
		const nextNodes = new Int32Array(this.nodes.length * 2 + 8);
		nextNodes.set(this.nodes);
		this.nodes = nextNodes;
		const nextPriorities = new Float64Array(this.priorities.length * 2 + 8);
		nextPriorities.set(this.priorities);
		this.priorities = nextPriorities;
	}
}
