import type { Page } from '@playwright/test';

const TUNGGU_PANDUAN_MILIDETIK = 8000;

export async function tutupPanduan(page: Page): Promise<void> {
	try {
		await page
			.getByRole('button', { name: 'Lewati' })
			.click({ timeout: TUNGGU_PANDUAN_MILIDETIK });
	} catch {
		return;
	}
}
