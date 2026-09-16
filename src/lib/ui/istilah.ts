import type { SimulationFailureCause } from '$lib/sim/workers/messages';

export const ISTILAH = {
	kartuSiaga: 'Kartu siaga RT',
	lembarKerja: 'Lembar kerja',
	koreksiLapangan: 'Koreksi lapangan',
	hidranUjiCoba: 'Hidran uji coba',
	mobilPemadam: 'mobil pemadam',
	jarakAntarbangunan: 'jarak antarbangunan',
	titikHenti: 'titik henti',
	kantongTakTerjangkau: 'kantong tak terjangkau',
	waktuAirSampai: 'waktu air sampai',
	estimasiSatelit: 'estimasi satelit',
	tapakBangunan: 'tapak bangunan',
	benihAcak: 'benih acak',
	simulasi: 'simulasi'
} as const;

export interface VarianTerlarang {
	pola: RegExp;
	gantiDengan: string;
}

export const VARIAN_TERLARANG: VarianTerlarang[] = [
	{ pola: /Kartu Siaga RT/, gantiDengan: ISTILAH.kartuSiaga },
	{ pola: /\bKartu siaga\b(?! RT)/, gantiDengan: ISTILAH.kartuSiaga },
	{ pola: /Lembar Kerja/, gantiDengan: ISTILAH.lembarKerja },
	{ pola: /[Kk]oreksi dari lapangan/, gantiDengan: ISTILAH.koreksiLapangan },
	{ pola: /[Hh]idran (?:usulan|hipotetis|percobaan)/, gantiDengan: ISTILAH.hidranUjiCoba },
	{ pola: /[Uu]nit pemadam/, gantiDengan: ISTILAH.mobilPemadam },
	{ pola: /[Mm]obil damkar/, gantiDengan: ISTILAH.mobilPemadam },
	{ pola: /[Kk]etetanggaan/, gantiDengan: ISTILAH.jarakAntarbangunan },
	{ pola: /[Ff]ootprint/, gantiDengan: ISTILAH.tapakBangunan },
	{ pola: /\bIngest\b|\bEmit\b/, gantiDengan: 'judul tahap berbahasa Indonesia' },
	{ pola: /\bseed\b/, gantiDengan: ISTILAH.benihAcak },
	{ pola: /\blari (?:simulasi|acak)\b|Jumlah lari/, gantiDengan: ISTILAH.simulasi },
	{ pola: /[Mm]ode batch|pada worker/, gantiDengan: 'kalimat tanpa istilah teknis' },
	{ pola: /Jalankan optimizer|Optimizer intervensi/, gantiDengan: 'Cari intervensi' },
	{ pola: /constants\.ts/, gantiDengan: 'penjelasan tanpa nama berkas kode' },
	{ pola: /benar benar/, gantiDengan: 'benar-benar' },
	{ pola: /[Tt]entukan (?:minimal satu )?titik api/, gantiDengan: 'Tetapkan titik api, sama dengan label tombolnya' }
];

export const PESAN_GAGAL_SIMULASI: Record<SimulationFailureCause, string> = {
	notReady:
		'Data jarak antarbangunan belum selesai dimuat, jadi simulasi belum bisa dimulai. Tunggu beberapa detik, lalu jalankan lagi.',
	computation:
		'Perhitungan penjalaran api berhenti di tengah jalan. Penyebab paling umum adalah koefisien di panel kalibrasi yang berada di luar rentang wajar. Ulangi dengan parameter awal untuk mengembalikan seluruh koefisien ke nilai bawaan.'
};
