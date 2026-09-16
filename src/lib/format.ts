const SECONDS_PER_MINUTE = 60;
const MILLION = 1_000_000;

export function formatMeters(value: number, decimals = 0): string {
	return `${value.toLocaleString('id-ID', {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	})} m`;
}

export function formatKilometers(meters: number): string {
	return `${(meters / 1000).toLocaleString('id-ID', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	})} km`;
}

export function formatSeconds(value: number): string {
	if (!Number.isFinite(value)) return '—';
	const rounded = Math.round(value);
	const minutes = Math.floor(rounded / SECONDS_PER_MINUTE);
	const seconds = rounded % SECONDS_PER_MINUTE;
	return `${minutes}′${seconds.toString().padStart(2, '0')}″`;
}

export function formatCount(value: number): string {
	return value.toLocaleString('id-ID');
}

export function formatShare(value: number): string {
	return `${(value * 100).toLocaleString('id-ID', {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1
	})} %`;
}

export function formatDecimal(value: number, decimals = 1): string {
	return value.toLocaleString('id-ID', {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	});
}

export function formatRupiah(value: number): string {
	if (value >= MILLION) {
		return `Rp ${(value / MILLION).toLocaleString('id-ID', {
			minimumFractionDigits: 1,
			maximumFractionDigits: 1
		})} jt`;
	}
	return `Rp ${value.toLocaleString('id-ID')}`;
}

export function formatCoordinate(lon: number, lat: number): string {
	return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

export function formatDate(isoText: string): string {
	const parsed = new Date(isoText);
	if (Number.isNaN(parsed.getTime())) return isoText;
	return parsed.toLocaleDateString('id-ID', {
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	});
}
