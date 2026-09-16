TAUTAN-DEPLOY-BELUM-DIISI

# Titik Henti

Platform perencanaan siaga kebakaran berbasis aksesibilitas gang untuk permukiman padat.

Titik Henti menjawab satu pertanyaan yang biasanya tidak pernah dijawab sebelum kebakaran terjadi: kalau rumah ini terbakar, mobil pemadam berhenti di mana, dan berapa meter selang yang harus ditarik dari titik itu.

Sistem menurunkan jaringan gang langsung dari citra bangunan, mengukur lebar tiap segmen, lalu memakai angka itu untuk menghitung titik henti kendaraan, panjang selang, kantong wilayah yang tidak terjangkau air, dan simulasi penjalaran api antarbangunan. Keluarannya bukan hanya layar, tapi juga Kartu Siaga RT yang bisa dicetak hitam putih dan ditempel di pos RT.

Ini alat perencanaan yang dipakai saat tidak sedang terjadi apa-apa. Bukan sistem pelaporan kebakaran dan bukan alat panggil darurat.

## Wilayah uji

Kelurahan Jelambar Baru, Kecamatan Grogol Petamburan, Jakarta Barat. Luas 1,41 km persegi, 46.675 jiwa, 5.968 bangunan terpetakan, 70,5 km jaringan gang.

## Fitur

| Kode | Fitur | Isi |
| --- | --- | --- |
| F1 | Peta klasifikasi gang | Jaringan gang diwarnai menurut kelas aksesibilitas, tiap segmen dapat diklik untuk melihat lebar dan panjangnya |
| F2 | Titik henti dan panjang selang | Pilih bangunan, sistem menghitung titik terdekat yang masih dapat dicapai kendaraan dan panjang selang dari titik itu |
| F3 | Simulasi penjalaran api | Cellular automata heterogen di Web Worker, dengan panel kalibrasi koefisien |
| F4 | Jangkauan selang dan kantong tak terjangkau | Poligon jangkauan dari tiap sumber air, ditambah mode uji coba penempatan hidran |
| F5 | Kartu Siaga RT | Satu halaman A4 potret siap cetak hitam putih |
| F6 | Koreksi lapangan berbantuan AI | Kalimat bebas dari lapangan diubah jadi usulan koreksi terstruktur yang wajib disetujui manusia |
| F7 | Optimizer intervensi | Pemilihan intervensi berbasis anggaran terhadap dampak simulasi |

## Batasan yang wajib dibaca

Lebar gang di produk ini adalah estimasi dari citra satelit yang dihitung pada grid 0,5 meter per piksel, bukan hasil ukur lapangan. Nilai ini dapat meleset karena atap yang menjorok, bangunan semi permanen yang tidak terekam, dan benda yang menghalangi gang di permukaan tanah. Verifikasi lapangan tetap wajib sebelum angka mana pun dipakai sebagai dasar keputusan operasional.

Halaman Metode di dalam produk memuat daftar batasan lengkap beserta sumber data dan lisensinya.

## Sumber data

| Lapisan | Sumber | Lisensi |
| --- | --- | --- |
| Footprint bangunan | Google Open Buildings V3 | CC BY 4.0 |
| Jaringan jalan dan gang | OpenStreetMap lewat Overpass API | ODbL 1.0 |
| Sumber air | OpenStreetMap | ODbL 1.0 |
| Batas kelurahan | OpenStreetMap relasi 5802347 | ODbL 1.0 |

## Menjalankan secara lokal

```bash
npm ci
npm run dev
```

Fitur F6 memanggil model bahasa lewat satu server route. Salin `.env.example` menjadi `.env` lalu isi `ANTHROPIC_API_KEY`. Tanpa kunci itu, seluruh fitur lain tetap berjalan dan panel koreksi menampilkan pesan bahwa layanan tidak tersedia.

```bash
npm run check
npm run test
npm run build
```

## Pipeline data

Pipeline Python berjalan offline dan tidak ikut di-deploy. Keluarannya adalah aset statis di `static/data/`.

```bash
cd pipeline
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python run.py
```

## Stack

SvelteKit 2 dan Svelte 5 dengan runes, TypeScript strict, TailwindCSS, MapLibre GL JS dengan PMTiles, deck.gl lewat MapboxOverlay, Web Worker untuk seluruh simulasi, adapter Vercel dengan seluruh halaman prerender kecuali satu server route.

## Pemanfaatan AI

Dilaporkan terbuka di `AI-USAGE.md`.

## Lisensi

Kode di repositori ini dirilis untuk keperluan penilaian TCC Vibe Code 2026, Universitas Trunojoyo Madura.
