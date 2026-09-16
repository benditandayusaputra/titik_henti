import type {
	AccessClass,
	CorrectionStatus,
	FireCoefficients,
	MaterialClass,
	WaterSourceKind,
	WidthSource
} from './types';

export const LARGE_UNIT_MIN_WIDTH_METERS = 4;
export const SMALL_UNIT_MIN_WIDTH_METERS = 2.5;

export const ACCESS_CLASS_CODE: Record<AccessClass, number> = {
	hoseOnly: 0,
	smallUnit: 1,
	largeUnit: 2
};

export const ACCESS_CLASS_BY_CODE: AccessClass[] = ['hoseOnly', 'smallUnit', 'largeUnit'];

export const ACCESS_CLASS_LABEL: Record<AccessClass, string> = {
	largeUnit: 'Unit besar',
	smallUnit: 'Unit kecil',
	hoseOnly: 'Selang saja'
};

export const ACCESS_CLASS_WIDTH_NOTE: Record<AccessClass, string> = {
	largeUnit: '≥ 4,0 m',
	smallUnit: '2,5–4,0 m',
	hoseOnly: '< 2,5 m'
};

export const ACCESS_CLASS_COLOR: Record<AccessClass, string> = {
	largeUnit: '#1A1A1C',
	smallUnit: '#C98A14',
	hoseOnly: '#D6202A'
};

export const ACCESS_CLASS_SURFACE_COLOR: Record<AccessClass, string> = {
	largeUnit: '#C2BEB4',
	smallUnit: '#C98A14',
	hoseOnly: '#D6202A'
};

export const ACCESS_CLASS_MAP_COLOR: Record<AccessClass, string> = {
	largeUnit: 'rgba(226,223,216,0.86)',
	smallUnit: '#C98A14',
	hoseOnly: '#D6202A'
};

export const ACCESS_CLASS_RGB: Record<AccessClass, [number, number, number]> = {
	largeUnit: [232, 230, 225],
	smallUnit: [201, 138, 20],
	hoseOnly: [214, 32, 42]
};

export const MATERIAL_CLASS_BY_CODE: MaterialClass[] = ['masonry', 'mixed', 'lightweight'];

export const MATERIAL_CLASS_LABEL: Record<MaterialClass, string> = {
	masonry: 'Permanen',
	mixed: 'Semi permanen',
	lightweight: 'Ringan'
};

export const HOSE_ROLL_LENGTH_METERS = 20;
export const HOSE_DEPLOY_SECONDS_PER_ROLL = 55;
export const HOSE_COUPLING_SECONDS_PER_JOINT = 20;
export const CREW_APPROACH_SPEED_METERS_PER_SECOND = 1.1;

export const DEFAULT_MAX_HOSE_LENGTH_METERS = 200;
export const MIN_HOSE_LENGTH_METERS = 100;
export const MAX_HOSE_LENGTH_METERS = 500;
export const HOSE_LENGTH_STEP_METERS = 10;

export const APPLIANCE_TURNOUT_SECONDS = 150;

export const ADJACENCY_RADIUS_METERS = 25;

export const FIRE_STEP_SECONDS = 30;
export const FIRE_DEFAULT_STEP_COUNT = 120;
export const FIRE_MILESTONE_BUILDING_COUNT = 10;

export const BUILDING_STATE_INTACT = 0;
export const BUILDING_STATE_BURNING = 1;
export const BUILDING_STATE_FULLY_INVOLVED = 2;
export const BUILDING_STATE_BURNT_OUT = 3;
export const BUILDING_STATE_SAVED = 4;

export const BUILDING_STATE_LABEL: Record<number, string> = {
	0: 'Utuh',
	1: 'Menyala',
	2: 'Terbakar penuh',
	3: 'Habis',
	4: 'Terselamatkan'
};

export const BUILDING_STATE_RGB: Record<number, [number, number, number]> = {
	0: [126, 126, 132],
	1: [214, 32, 42],
	2: [141, 19, 25],
	3: [40, 40, 44],
	4: [15, 124, 138]
};

export const DEFAULT_FIRE_COEFFICIENTS: FireCoefficients = {
	radiationGain: 0.045,
	radiationFalloffExponent: 2,
	radiationReferenceDistanceMeters: 3.5,
	heightGain: 0.06,
	areaGain: 0.004,
	windAlignmentGain: 1.25,
	windSpeedGain: 0.11,
	firebrandBaseProbability: 0.0015,
	firebrandRangeMeters: 55,
	firebrandWindConeDegrees: 55,
	materialFactorMasonry: 0.42,
	materialFactorMixed: 0.78,
	materialFactorLightweight: 1,
	growthToFullSeconds: 240,
	fullToBurntSeconds: 1500,
	suppressionEffectiveness: 0.82,
	extinguishChancePerStep: 0.14
};

export const FIRE_COEFFICIENT_RANGE: Record<keyof FireCoefficients, [number, number, number]> = {
	radiationGain: [0, 0.3, 0.005],
	radiationFalloffExponent: [1, 3, 0.1],
	radiationReferenceDistanceMeters: [1, 10, 0.5],
	heightGain: [0, 0.3, 0.005],
	areaGain: [0, 0.02, 0.0005],
	windAlignmentGain: [0, 3, 0.05],
	windSpeedGain: [0, 0.4, 0.01],
	firebrandBaseProbability: [0, 0.01, 0.0002],
	firebrandRangeMeters: [10, 150, 5],
	firebrandWindConeDegrees: [10, 120, 5],
	materialFactorMasonry: [0, 1.5, 0.01],
	materialFactorMixed: [0, 1.5, 0.01],
	materialFactorLightweight: [0, 1.5, 0.01],
	growthToFullSeconds: [60, 1800, 30],
	fullToBurntSeconds: [300, 7200, 60],
	suppressionEffectiveness: [0, 1, 0.01],
	extinguishChancePerStep: [0, 1, 0.01]
};

export const FIRE_COEFFICIENT_LABEL: Record<keyof FireCoefficients, string> = {
	radiationGain: 'Bobot radiasi',
	radiationFalloffExponent: 'Eksponen peluruhan jarak',
	radiationReferenceDistanceMeters: 'Jarak acuan radiasi',
	heightGain: 'Bobot tinggi sumber',
	areaGain: 'Bobot luas sumber',
	windAlignmentGain: 'Bobot searah angin',
	windSpeedGain: 'Bobot kecepatan angin',
	firebrandBaseProbability: 'Peluang percikan bara',
	firebrandRangeMeters: 'Jangkauan percikan bara',
	firebrandWindConeDegrees: 'Kerucut arah bara',
	materialFactorMasonry: 'Faktor material permanen',
	materialFactorMixed: 'Faktor material semi permanen',
	materialFactorLightweight: 'Faktor material ringan',
	growthToFullSeconds: 'Waktu sampai terbakar penuh',
	fullToBurntSeconds: 'Waktu sampai habis',
	suppressionEffectiveness: 'Efektivitas pemadaman',
	extinguishChancePerStep: 'Peluang padam per langkah'
};

export const FIRE_COEFFICIENT_UNIT: Record<keyof FireCoefficients, string> = {
	radiationGain: '',
	radiationFalloffExponent: '',
	radiationReferenceDistanceMeters: 'm',
	heightGain: '',
	areaGain: '',
	windAlignmentGain: '',
	windSpeedGain: '',
	firebrandBaseProbability: '',
	firebrandRangeMeters: 'm',
	firebrandWindConeDegrees: '°',
	materialFactorMasonry: '',
	materialFactorMixed: '',
	materialFactorLightweight: '',
	growthToFullSeconds: 's',
	fullToBurntSeconds: 's',
	suppressionEffectiveness: '',
	extinguishChancePerStep: ''
};

export const DEFAULT_WIND_DIRECTION_DEGREES = 225;
export const DEFAULT_WIND_SPEED_METERS_PER_SECOND = 3;
export const MAX_WIND_SPEED_METERS_PER_SECOND = 15;
export const DEFAULT_RANDOM_SEED = 20260726;

export const WATER_SOURCE_LABEL: Record<WaterSourceKind, string> = {
	hydrant: 'Hidran',
	well: 'Sumur',
	openWater: 'Air permukaan',
	reservoir: 'Tandon',
	applianceStand: 'Posisi unit',
	hypothetical: 'Hidran usulan'
};

export const OPTIMIZER_EXTINGUISHER_COST_RUPIAH = 850_000;
export const OPTIMIZER_WATER_SOURCE_COST_RUPIAH = 24_000_000;
export const OPTIMIZER_WIDENING_COST_RUPIAH_PER_METER = 1_450_000;
export const OPTIMIZER_DEFAULT_BUDGET_RUPIAH = 250_000_000;
export const OPTIMIZER_MIN_BUDGET_RUPIAH = 25_000_000;
export const OPTIMIZER_MAX_BUDGET_RUPIAH = 2_000_000_000;
export const OPTIMIZER_EARLY_RUN_COUNT = 10;
export const OPTIMIZER_LATE_RUN_COUNT = 28;
export const OPTIMIZER_CANDIDATE_LIMIT = 48;
export const OPTIMIZER_MAX_ROUNDS = 12;
export const OPTIMIZER_EXTINGUISHER_RADIUS_METERS = 60;
export const OPTIMIZER_EXTINGUISHER_EFFECTIVENESS = 0.35;
export const OPTIMIZER_SLOWEST_SAMPLE_COUNT = 64;
export const OPTIMIZER_IGNITION_POOL_COUNT = 500;
export const OPTIMIZER_STEP_COUNT = 60;
export const BATCH_PROBE_RUN_COUNT = 24;

export const FIRE_RADIATION_STRENGTH_BY_STATE: Record<number, number> = {
	0: 0,
	1: 0.45,
	2: 1,
	3: 0,
	4: 0
};

export const FIREBRAND_THROWS_PER_STEP = 2;
export const FIREBRAND_MIN_THROW_METERS = 12;
export const FIREBRAND_REFERENCE_WIND_SPEED = 6;
export const SPATIAL_GRID_CELL_METERS = 30;
export const MAX_PAIR_IGNITION_PROBABILITY = 0.96;

export const EARTH_RADIUS_METERS = 6371008.8;
export const METERS_PER_DEGREE_LATITUDE = 111194.9;

export const MAP_MIN_ZOOM = 12;
export const MAP_MAX_ZOOM = 20;

export const FIRE_PLAYBACK_FRAME_MILLISECONDS = 90;
export const STACKED_BAR_LABEL_MIN_SHARE = 0.14;

export const HOSE_RULER_METERS_PER_SECOND = 62;
export const HOSE_RULER_MIN_DURATION_MS = 420;
export const HOSE_RULER_MAX_DURATION_MS = 2600;

export const DATA_BASE_PATH = '/data';

export const CORRECTION_ENDPOINT_PATH = '/api/koreksi';
export const CORRECTION_MIN_WIDTH_METERS = 0.4;
export const CORRECTION_MAX_WIDTH_METERS = 25;
export const CORRECTION_SENTENCE_MIN_LENGTH = 8;
export const CORRECTION_SENTENCE_MAX_LENGTH = 400;
export const CORRECTION_SESSION_COOKIE = 'sesi_koreksi';
export const CORRECTION_SESSION_MAX_AGE_SECONDS = 86400;
export const CORRECTION_RATE_LIMIT_COUNT = 10;
export const CORRECTION_RATE_LIMIT_WINDOW_SECONDS = 600;
export const CORRECTION_MAX_OUTPUT_TOKENS = 1024;
export const CORRECTION_REQUEST_TIMEOUT_MS = 30000;
export const SUPPORTED_LLM_PROVIDER = 'openai-compatible';
export const CORRECTION_LOW_CONFIDENCE_THRESHOLD = 0.6;

export const WIDTH_SOURCE_LABEL: Record<WidthSource, string> = {
	satellite: 'Estimasi satelit',
	field: 'Ukur lapangan'
};

export const WIDTH_SOURCE_NOTE: Record<WidthSource, string> = {
	satellite: 'Nilai diturunkan dari citra satelit pada grid 0,5 meter.',
	field: 'Nilai berasal dari koreksi lapangan yang sudah disetujui, bukan dari citra satelit.'
};

export const CORRECTION_STATUS_LABEL: Record<CorrectionStatus, string> = {
	pending: 'Menunggu tinjauan',
	approved: 'Disetujui',
	rejected: 'Ditolak'
};
export const SEGMENT_PICK_TOLERANCE_PIXELS = 6;
