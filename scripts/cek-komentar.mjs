import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const SCANNED_EXTENSIONS = new Set(['.ts', '.js', '.mjs', '.svelte', '.css', '.py']);
const SKIPPED_DIRECTORIES = new Set([
	'node_modules',
	'.svelte-kit',
	'.git',
	'.vercel',
	'.venv',
	'build',
	'dist',
	'__pycache__'
]);
const SCANNED_ROOTS = ['src', 'pipeline', 'scripts', 'tests'];

function listSourceFiles(directory) {
	const found = [];
	for (const entry of readdirSync(directory)) {
		if (SKIPPED_DIRECTORIES.has(entry)) continue;
		const path = join(directory, entry);
		if (statSync(path).isDirectory()) {
			found.push(...listSourceFiles(path));
		} else if (SCANNED_EXTENSIONS.has(extname(entry))) {
			found.push(path);
		}
	}
	return found;
}

const REGEX_LITERAL_PATTERN =
	/(^|[=(,:[!&|?{};+\-*%^~]|\breturn\b)(\s*)\/(?![/*])(?:\\.|\[(?:\\.|[^\]])*\]|[^\\/\n])+\/[gimsuyd]*/g;

function blankStringLiterals(line) {
	return line
		.replace(/'[^']*'/g, "''")
		.replace(/"[^"]*"/g, '""')
		.replace(/`[^`]*`/g, '``');
}

function blankRegexLiterals(line) {
	return line.replace(REGEX_LITERAL_PATTERN, '$1$2POLA');
}

function findCommentLines(path) {
	const isPython = extname(path) === '.py';
	const violations = [];
	const lines = readFileSync(path, 'utf8').split('\n');
	lines.forEach((line, index) => {
		const stripped = blankRegexLiterals(blankStringLiterals(line));
		const offends = isPython
			? /^\s*#/.test(stripped)
			: /\/\/|\/\*|\*\/|<!--/.test(stripped);
		if (offends) violations.push({ line: index + 1, text: line.trim() });
	});
	return violations;
}

const failures = [];
for (const root of SCANNED_ROOTS) {
	let files = [];
	try {
		files = listSourceFiles(root);
	} catch {
		continue;
	}
	for (const path of files) {
		for (const violation of findCommentLines(path)) {
			failures.push(`${path}:${violation.line}  ${violation.text}`);
		}
	}
}

if (failures.length > 0) {
	console.error(`Ditemukan ${failures.length} komentar di dalam kode:`);
	for (const failure of failures) console.error(`  ${failure}`);
	process.exit(1);
}

console.log('Nol komentar di dalam kode.');
