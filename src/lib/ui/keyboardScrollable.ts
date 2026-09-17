import type { Attachment } from 'svelte/attachments';

export const keyboardScrollable: Attachment<HTMLElement> = (element) => {
	const update = () => {
		if (element.scrollHeight > element.clientHeight) element.setAttribute('tabindex', '0');
		else element.removeAttribute('tabindex');
	};
	const sizeWatcher = new ResizeObserver(update);
	sizeWatcher.observe(element);
	const contentWatcher = new MutationObserver(update);
	contentWatcher.observe(element, { childList: true, subtree: true });
	update();
	return () => {
		sizeWatcher.disconnect();
		contentWatcher.disconnect();
	};
};
