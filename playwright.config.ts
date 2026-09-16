import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? 'list' : [['list']],
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: 'retain-on-failure'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: `npm run build && npm run preview -- --port ${PORT}`,
		port: PORT,
		reuseExistingServer: !process.env.CI,
		timeout: 180000
	}
});
