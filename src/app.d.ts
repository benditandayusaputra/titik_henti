declare global {
	namespace App {
		interface Error {
			message: string;
		}
		interface Locals {}
		interface PageData {}
		interface PageState {}
		interface Platform {}
	}
}

export {};
