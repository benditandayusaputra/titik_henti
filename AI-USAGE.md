# Pemanfaatan AI dalam pengembangan Titik Henti

Dokumen ini melaporkan secara terbuka di mana AI dipakai selama membangun Titik Henti, bagian mana yang dihasilkan AI, bagian mana yang diubah manual beserta alasannya, dan kesalahan apa yang dibuat AI beserta cara memperbaikinya.

Riwayat git mencatat perubahan kode, bukan alat yang dipakai. Pelaporan pemakaian AI ada di dokumen ini.

## Dua peran AI yang perlu dibedakan

**AI di dalam produk.** Hanya satu simpul, yaitu fitur F6 koreksi lapangan. Pilihan ini disengaja. AI dipakai di tempat yang tidak memiliki jawaban tunggal, yaitu menafsirkan kalimat bebas manusia menjadi struktur, dan tidak dipakai untuk perhitungan yang harus pasti.

Seluruh perhitungan geometri, klasifikasi gang, penjalaran api, jangkauan selang, dan optimasi adalah algoritma deterministik yang ditulis sendiri dan dapat diuji tanpa browser. Berkas `src/lib/sim/` tidak memanggil model bahasa sama sekali, dan seluruhnya diuji dengan unit test.

**AI di dalam proses pengembangan.** Pengembangan memakai Claude Code. Rincian per tahap ada di bawah.

## Alat yang dipakai

| Alat | Dipakai untuk |
| --- | --- |
| Claude Code | Menulis dan menata kode aplikasi dan pipeline, audit kesesuaian terhadap PRD |
| Claude API model `claude-opus-5` | Dipanggil di dalam produk oleh satu server route `/api/koreksi` |

## Catatan kejujuran tentang dokumen ini

Berkas ini mulai ditulis pada tahap koreksi lapangan berbantuan AI. Tahap-tahap sebelumnya direkonstruksi dari isi repositori dan dari catatan validasi di PRD, bukan dicatat saat tahap itu berjalan. Bagian yang direkonstruksi ditandai dengan jelas di kolom keterangan agar tidak dibaca sebagai catatan langsung.

## Tahap

### Tahap 0 sampai 5, fondasi sampai Kartu Siaga RT

Status catatan: direkonstruksi dari isi repositori.

| Aspek | Isi |
| --- | --- |
| Cakupan | Fondasi repo dan sistem desain, pipeline data Python, peta dasar, titik henti dan penggaris selang, simulasi penjalaran api, jangkauan selang dan kantong, Kartu Siaga RT, optimizer intervensi |
| Dihasilkan AI | Struktur berkas, implementasi awal fungsi simulasi, komponen antarmuka, skrip pipeline |
| Diubah manual | Belum dicatat per perubahan. Lihat catatan kejujuran di atas |

Kesalahan AI yang terdokumentasi pada tahap ini, dikutip dari hasil validasi algoritma di PRD bagian 9.3:

1. Pemakaian `skeletonize` dari scikit-image versi 0.26 bersama numpy 2.4 menyebabkan segmentation fault. Perbaikannya mengganti ke `medial_axis`, yang sekaligus mengembalikan distance transform sehingga lebar didapat dari satu panggilan yang sama.
2. Segmen di tepi area studi selalu menghasilkan lebar yang keliru karena tidak ada bangunan di seberangnya. Perbaikannya membuat pipeline mengolah area yang lebih luas dari yang ditampilkan, lalu memotong hasilnya. Nilai penyangga tersimpan sebagai `analysisBufferMeters` di `pipeline/config.json`.
3. Cabang skeleton palsu muncul pada ruang terbuka yang tidak beraturan. Perbaikannya memangkas cabang yang lebih pendek dari ambang, dan ambang itu diangkat jadi `skeletonBranchPruneMeters` supaya bisa disetel tanpa mengubah kode.

### Tahap 6, audit kesesuaian terhadap PRD

Status catatan: dicatat saat tahap berjalan.

| Aspek | Isi |
| --- | --- |
| Prompt inti | Memeriksa apakah isi repositori sudah sesuai dengan PRD, fitur demi fitur, beserta kriteria selesainya |
| Dihasilkan AI | Laporan temuan |
| Diubah manual | Tidak ada perubahan kode pada tahap ini |

Temuan yang dipakai sebagai daftar kerja berikutnya: fitur koreksi lapangan berbantuan AI belum ada sama sekali, segmen gang belum dapat diklik sehingga kriteria selesai F1 belum terpenuhi, tabel validasi lebar gang belum ditampilkan di dalam produk, dan ambang kelas gang di kode berbeda dari ambang di PRD.

Kesalahan AI pada tahap ini: pada pembacaan pertama, penomoran fitur di PRD dan di rencana eksekusi tertukar. F6 di PRD berarti koreksi lapangan, sedangkan F6 di rencana eksekusi berarti kopling pemadaman. Ketidakcocokan ini ditemukan sebelum kode ditulis dan diperbaiki dengan memakai spesifikasi rencana eksekusi F10 sebagai rujukan implementasi.

### Tahap 7, koreksi lapangan berbantuan AI

Status catatan: dicatat saat tahap berjalan.

| Aspek | Isi |
| --- | --- |
| Prompt inti | Membangun fitur koreksi lapangan sesuai spesifikasi F10 rencana eksekusi, termasuk endpoint, validasi skema, panel tinjau, dan penanda sumber nilai |
| Dihasilkan AI | Server route, skema validasi, komponen panel segmen dan panel koreksi, pemilihan segmen di peta, unit test |
| Diubah manual | Diisi setelah tinjauan pemilik repo |

Kesalahan yang dibuat pada tahap ini dan cara memperbaikinya:

1. Pada percobaan pertama, sumber petak gang diberi `promoteId` supaya `segmentId` dipakai sebagai id fitur. Ini justru mematikan pemilihan segmen: tippecanoe sudah memakai `--use-attribute-for-id segmentId` saat membangun PMTiles, sehingga atribut itu berpindah menjadi id fitur dan hilang dari properti. `promoteId` lalu menimpa id yang sudah benar dengan properti yang sudah tidak ada, dan seluruh klik pada gang berakhir tanpa hasil. Ditemukan lewat pemeriksaan Playwright, bukan lewat pembacaan kode, karena berkas tetap lolos typecheck dan build. Perbaikannya membuang `promoteId`.
2. Setelah koreksi disetujui, panel menampilkan lebar minimum 2,00 meter berdampingan dengan lebar rata rata 15,16 meter tanpa penjelasan. Koreksi lapangan memang hanya menyentuh lebar minimum, jadi labelnya diubah menjadi lebar rata rata, masih satelit, supaya angka yang belum dikoreksi tidak terbaca seolah sudah diverifikasi.
3. Pesan commit pertama untuk berkas pelaporan sempat memuat kata yang dilarang muncul di riwayat git menurut Bagian C2. Pesan diperbaiki sebelum didorong ke remote.

Keputusan rancangan yang diambil pada tahap ini beserta alasannya:

1. Usulan koreksi tidak pernah langsung mengubah data. Usulan masuk ke panel tinjau dan baru berlaku setelah disetujui manusia. Menolak usulan mengembalikan nilai semula.
2. Kalimat asli pengguna selalu disimpan dan ditampilkan di samping usulan, supaya penilai dapat membandingkan tafsir model terhadap kalimat aslinya.
3. Keluaran model divalidasi ulang di sisi server terhadap skema sebelum dipakai. Keluaran yang tidak sesuai skema ditolak dan pengguna diberi tahu, bukan dipaksakan masuk.
4. Kunci API hanya hidup di variabel lingkungan server dan tidak pernah dikirim ke klien.
5. Batas laju permintaan per sesi dipasang supaya endpoint tidak dapat disalahgunakan.
6. Segmen yang nilainya berasal dari koreksi lapangan diberi penanda visual yang berbeda dari nilai asal satelit, di panel maupun di peta.

### Tahap 8, redesain menurut arah desain kanonik

Status catatan: dicatat saat tahap berjalan.

| Aspek | Isi |
| --- | --- |
| Prompt inti | Menyelaraskan seluruh lapis tampilan dengan Bagian B arah desain kanonik |
| Dihasilkan AI | Penyetelan token warna dan tipografi, penulisan ulang label di seluruh panel dan halaman |
| Diubah manual | Diisi setelah tinjauan pemilik repo |

Pelanggaran terhadap arah desain yang ditemukan pada tampilan lama dan diperbaiki pada tahap ini:

1. Label eyebrow huruf besar dengan tracking lebar dipasang di atas hampir setiap judul, persis yang dilarang Bagian B6 nomor 5. Seluruh kelas `stencil` diganti menjadi `field-label` berhuruf kalimat biasa tanpa tracking.
2. Huruf besar semua dipakai di luar peta pada judul beranda, masthead, nama kelurahan, judul Kartu Siaga, dan judul tahap pipeline. Bagian B3 hanya mengizinkan huruf besar untuk label di atas peta. Huruf besar kini tersisa hanya di legenda peta dan pesan status di atas peta, lewat kelas `map-label`.
3. Dua puluh empat rangkaian meta disambung titik tengah, dilarang Bagian B6 nomor 6. Seluruhnya ditulis ulang jadi kalimat atau baris terpisah.
4. Penomoran hias dipasang pada konten yang bukan urutan: nomor lembar di beranda, indeks panel A1 sampai B1, huruf tab A sampai G, dan penanda D5 di panel kalibrasi. Semuanya dibuang sesuai Bagian B6 nomor 9. Penomoran yang memang urutan, yaitu tujuh seksi Kartu Siaga dan lima tahap metode, tetap dipertahankan karena dirujuk dari tempat lain.
5. Token `paper` yang diminta Bagian B2 belum ada. Ditambahkan dan dipakai untuk seluruh permukaan naik: panel lembar kerja, tabel metode, lembar cetak, dan kotak di dalam panel.
6. Rel ukur Bagian B4 belum ada. Ditambahkan sebagai garis tepi kiri bertanda centang pada lebar 1024 piksel ke atas, dan berubah jadi penanda mendatar tipis di bawah lebar itu.
7. Warna `alarm` dipakai pada pesan instruksi di atas peta, padahal Bagian B2 mengunci merah hanya untuk status api dan bahaya. Diganti ke `ink`.

Penyimpangan yang disengaja dari tabel palet Bagian B2, beserta alasannya:

Token `graphite` diubah dari `#6E6E73` menjadi `#656569`. Nilai lama menghasilkan rasio kontras 4,07 banding 1 di atas `concrete` dan 4,46 banding 1 di atas permukaan naik, dua-duanya di bawah ambang 4,5 banding 1 untuk teks biasa. PRD bagian 4.2 menetapkan nol pelanggaran aksesibilitas otomatis sebagai ukuran keberhasilan, dan ukuran itu tidak dapat dipenuhi tanpa menggelapkan token ini. Nilai baru menghasilkan 4,65 dan 5,10 banding 1, dan perbedaan rupanya nyaris tidak terlihat. Token `graphite-pale` tetap `#9B9BA1` tetapi pemakaiannya dibatasi hanya di atas latar gelap, karena di atas permukaan terang rasionya hanya 2,51 banding 1.

Hasil pemindaian setelah tahap ini: nol pelanggaran axe-core di keempat halaman, turun dari 46 sampai 58 node per halaman sebelum redesain.

## Yang tidak dikerjakan AI

Penentuan masalah, pemilihan wilayah uji, penyusunan PRD, arah desain, pengukuran lapangan dengan meteran, dan keputusan lingkup fitur adalah pekerjaan manusia. AI tidak menentukan apa yang dibangun, hanya membantu membangunnya.
