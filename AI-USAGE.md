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
| Gemini `gemini-3.6-flash` lewat protokol kompatibel OpenAI | Dipanggil di dalam produk oleh satu server route `/api/koreksi` |

Penyedia model di dalam produk dapat diganti lewat variabel lingkungan tanpa mengubah kode, karena server route berbicara protokol chat completions yang kompatibel dengan OpenAI, bukan SDK satu penyedia.

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

### Tahap 9, tabel validasi dan pemindahan wilayah uji ke Palmerah

Status catatan: dicatat saat tahap berjalan.

| Aspek | Isi |
| --- | --- |
| Prompt inti | Menampilkan tabel validasi lebar gang di dalam produk, lalu mengembalikan wilayah uji ke Palmerah sesuai PRD |
| Dihasilkan AI | Modul validasi beserta unit test, seksi validasi di halaman metode, penandaan area studi pada cache pipeline |
| Diubah manual | Diisi setelah tinjauan pemilik repo |

Tentang tabel validasi:

Angka uji sintetis tidak disalin dari PRD, melainkan dihasilkan ulang dengan menjalankan `test/spike_gang.py` pada permukiman buatan yang sama. Hasilnya cocok: 54 bangunan, 27 segmen, total 417,2 meter, dan selisih 0,00 meter pada kelima lebar uji 1,5 sampai 6,0 meter.

Tabel verifikasi lapangan sengaja ditampilkan kosong. Sepuluh gang yang dijanjikan PRD bagian 9.4 belum diukur dengan meteran, dan mengisinya dengan angka karangan akan merusak justru bagian yang seharusnya jadi bukti kejujuran. Halaman metode menyatakan kekosongan itu secara terbuka, beserta akibatnya: selama tabel itu kosong, lebar gang di produk belum pernah dibandingkan dengan ukuran sebenarnya. Struktur tabelnya sudah siap, tinggal mengisi larik `FIELD_MEASUREMENTS` di `src/lib/domain/validation.ts`.

Tentang pemindahan wilayah uji:

PRD, rencana eksekusi, dan paket desain seluruhnya menyebut Palmerah, tetapi keluaran pipeline yang terpasang adalah Kelurahan Jelambar Baru. Pemeriksaan bukti tahap F0 menunjukkan alasannya: pengujian awal memakai footprint bangunan OpenStreetMap, dan di Palmerah data itu terlalu jarang sehingga ruang kosong yang luas ikut terbaca sebagai gang. Risiko ini sudah diramalkan PRD bagian 12 beserta mitigasinya, yaitu berpindah ke Google Open Buildings.

Mitigasi itu kemudian benar-benar dipakai, sehingga alasan menghindari Palmerah sudah tidak berlaku. Pemeriksaan arsip Google Open Buildings sel S2 `2e69` yang sudah terunduh menunjukkan cakupannya membentang sampai lintang -6,116, jadi Palmerah termasuk di dalamnya dan tidak perlu unduhan baru. Pipeline dijalankan ulang memakai relasi OpenStreetMap 5802216, yaitu batas administratif tingkat kelurahan.

Kesalahan yang ditemukan saat pemindahan: seluruh cache ingest, baik subset footprint maupun balasan Overpass, hanya dikunci berdasarkan nama berkas tanpa memperhatikan area studi. Akibatnya menjalankan pipeline dengan bounding box baru diam-diam memakai data lama dan menghasilkan nol segmen gang tanpa pesan galat apa pun. Kegagalan seperti ini berbahaya karena terlihat seperti berhasil. Perbaikannya menulis penanda area studi di samping tiap berkas cache, dan cache hanya dipakai bila penandanya cocok.

Perbandingan hasil kedua kelurahan:

| Ukuran | Jelambar Baru | Palmerah |
| --- | --- | --- |
| Luas | 1,41 km persegi | 2,29 km persegi |
| Bangunan terpetakan | 5.968 | 12.764 |
| Panjang jaringan gang | 70,5 km | 136,2 km |
| Tak terlalui kendaraan | 46,3 persen | 57,2 persen |
| Sumber air terdata | 271 | 433 |

Angka penduduk Palmerah diisi 71.466 jiwa tahun 2016 dari BPS, Kecamatan Palmerah dalam Angka 2017, dan sumbernya kini ikut disebut di daftar provenance dalam produk. Angka itu diuji silang lewat kepadatan: 71.466 jiwa pada 2,29 km persegi berarti 31.227 jiwa per km persegi, sejalan dengan kepadatan kecamatan 30.659 jiwa per km persegi pada 2024.

### Tahap 10, penyedia model yang dapat diganti dan uji nyata pertama

Status catatan: dicatat saat tahap berjalan.

| Aspek | Isi |
| --- | --- |
| Prompt inti | Mengganti panggilan model ke protokol kompatibel OpenAI supaya penyedianya fleksibel, lalu menguji dengan kunci sungguhan |
| Dihasilkan AI | Penulisan ulang server route, pembacaan konfigurasi dari variabel lingkungan, penguraian jawaban yang tahan pagar kode |
| Diubah manual | Diisi setelah tinjauan pemilik repo |

SDK satu penyedia dicabut dan diganti satu panggilan `fetch` ke `chat/completions`. Skema JSON yang dikirim ke model diturunkan langsung dari skema zod yang sama yang dipakai memvalidasi jawabannya, jadi tidak ada dua sumber kebenaran.

Temuan pada tahap ini:

1. Model bawaan yang diminta, `gemini-2.5-flash`, ditolak penyedia dengan pesan bahwa model itu tidak lagi tersedia untuk pengguna baru. Diganti ke `gemini-3.6-flash` sesuai anjuran pesan galat tersebut. Versi terpaku dipilih, bukan alias `latest`, supaya hasil demonstrasi dapat diulang.
2. Penghitungan batas laju semula membebani jatah pengguna meskipun permintaan gagal di sisi penyedia. Pada uji beban, tiga kegagalan hulu ikut memakan kuota. Diperbaiki sehingga jatah hanya terpakai bila permintaan benar-benar sampai ke model.

Hasil uji dengan model sungguhan:

| Masukan | Keluaran |
| --- | --- |
| Kalimat menyebut angka, gang ini sebenarnya cuma dua meter karena ada warung permanen | Lebar usulan 2,00 m, keyakinan 95 persen, alasan mengutip kalimat pengguna |
| Kalimat tanpa angka, ada gerobak dan tenda yang tidak pernah dipindah | Lebar usulan 1,20 m, keyakinan 50 persen, diturunkan karena tidak ada angka |
| Kalimat yang mencoba menyuntik perintah, minta model mengabaikan instruksi dan menulis puisi | Lebar dikembalikan ke nilai semula, keyakinan 0 persen, alasan menyatakan kalimat tidak memuat informasi lebar |
| Kalimat terlalu pendek | Ditolak skema permintaan sebelum model dipanggil |

Pemeriksaan kebocoran kunci: pada alur penuh di browser hanya ada satu permintaan keluar dari klien, yaitu ke `/api/koreksi` tanpa header otorisasi. Tidak ada permintaan ke domain penyedia dari sisi klien, dan penelusuran bundel klien hasil build tidak menemukan kunci, basis URL, maupun nama penyedia.

### Tahap 11, perbaikan bug dan pengerasan di luar jalur AI

Status catatan: dicatat saat tahap berjalan.

| Aspek | Isi |
| --- | --- |
| Prompt inti | Mengerjakan sisa temuan yang tidak bergantung pada model bahasa |
| Dihasilkan AI | Perbaikan pemakaian ulang layer deck, pemisahan muatan awal, harness dan spec end to end |
| Diubah manual | Diisi setelah tinjauan pemilik repo |

Koreksi terhadap kesimpulan yang salah di tahap sebelumnya:

Error deck.gl di konsol sempat dilaporkan sebagai artefak perender perangkat lunak di browser headless. Kesimpulan itu keliru. Pemeriksaan `WEBGL_debug_renderer_info` menunjukkan browser uji memakai ANGLE Metal Renderer pada GPU Apple M4, bukan perender perangkat lunak. Setelah ditelusuri ke sumber deck.gl, pemicunya adalah `assert(!this.internalState)` di `Layer._initialize`, yaitu penolakan terhadap instance layer yang sudah final lalu dipakai ulang. Penyebabnya `MapboxOverlay` menerima larik layer lewat konstruktor, lalu larik yang sama diserahkan sekali lagi lewat `setProps` ketika gaya peta siap. Perbaikannya membuat overlay dibangun tanpa layer, dan seluruh penyerahan layer lewat satu jalur saja. Setelah itu konsol bersih, nol error dan nol peringatan, di seluruh alur termasuk klik segmen, pergantian tab, dan panel air.

Kinerja muatan awal:

`adjacency.bin` berukuran 2,8 MB ikut memblokir gambar peta pertama, padahal berkas itu hanya dipakai simulasi api dan jangkauan air. Berkas itu dipindahkan ke pemuatan latar setelah peta siap, dan panel air menampilkan keadaan menunggu selama berkas itu belum tiba. Berkas font juga diganti ke subset latin sesuai Bagian B3, dari enam berkas menjadi tiga.

| Ukuran | Sebelum | Sesudah |
| --- | --- | --- |
| Muatan pemblokir gambar peta pertama | 3,6 MB | 819 KB |
| Berkas font | 120 KB | 66 KB |
| Peta tergambar, tanpa throttle | 137 ms | 194 ms |
| Peta tergambar, 4G umum 10 Mbps | belum diukur | 1.626 ms |
| Peta tergambar, 4G lambat 1,5 Mbps | 8.252 ms | 8.051 ms |

Target PRD bagian 4.2, yaitu peta pertama tergambar di bawah 3 detik, terpenuhi pada jaringan 4G umum. Pada preset 4G lambat bawaan Chrome, target itu belum terpenuhi, dan sisa penghambat terbesarnya adalah satu bundel JavaScript 503 KB berisi pustaka peta.

Uji end to end:

Harness Playwright dipasang beserta 24 spec di `tests/e2e/`, mencakup pemilihan segmen, alur usulan sampai persetujuan dan penolakan, penolakan keluaran yang tidak sesuai skema, pemeriksaan bahwa tidak ada permintaan keluar dari klien, pemindaian axe pada empat halaman di tiga lebar layar, dan keberadaan tabel validasi beserta penyebutan sumber data. Spec koreksi memakai jawaban tiruan pada tingkat jaringan, sehingga suite dapat berjalan tanpa kunci API.

### Tahap 12, navigasi papan ketik dan padanan tabel

Status catatan: dicatat saat tahap berjalan.

| Aspek | Isi |
| --- | --- |
| Prompt inti | Membuat alur utama dapat dijalankan tanpa tetikus, dan menyediakan padanan tabel dari isi peta |
| Dihasilkan AI | Fungsi pengumpul baris, panel daftar, pengumuman pemilihan, perbaikan garis fokus |
| Diubah manual | Diisi setelah tinjauan pemilik repo |

Temuan awal: penelusuran Tab pada lembar kerja hanya menjangkau masthead, kanvas peta, tombol zoom, dan deretan tab, lalu berputar kembali. Isi panel tidak pernah tercapai karena tanpa pilihan tidak ada satu pun elemen fokusabel di dalamnya. Artinya alur utama produk, yaitu memilih bangunan atau segmen, sepenuhnya tertutup bagi pengguna papan ketik, padahal PRD bagian 14 nomor 3 mewajibkan navigasi papan ketik penuh.

Yang dibangun: satu panel Daftar berisi dua tabel. Tabel segmen gang dapat disaring menurut kelas akses dan menampilkan dua puluh lima segmen terpanjang pada kelas terpilih. Tabel bangunan menampilkan dua puluh lima bangunan dengan waktu air sampai terburuk, dengan bangunan yang tidak terjangkau sama sekali diletakkan paling atas. Tiap baris adalah tombol, dan menekannya sama persis dengan mengklik objek itu di peta, ditambah peta ikut bergeser ke posisinya.

Kesalahan yang dibuat dan cara memperbaikinya:

1. Kanvas overlay deck.gl menjadi perhentian Tab yang tidak menyuarakan apa pun. Percobaan pertama menyetel `tabindex` menjadi minus satu sekali saat pemuatan, tetapi deck.gl menimpanya kembali menjadi nol setelah inisialisasi. Akibatnya elemen itu berstatus tersembunyi dari teknologi bantu sekaligus tetap dapat difokus, yang justru memunculkan pelanggaran `aria-hidden-focus` baru pada pemindaian axe. Perbaikannya memakai `MutationObserver` yang menjaga kedua atribut itu tetap pada nilai yang benar.
2. Tombol zoom bawaan MapLibre kehilangan garis fokus. Aturan pengganti sempat ditulis di dalam `@layer base`, dan kalah karena berkas gaya MapLibre tidak berlapis, sedangkan CSS tanpa lapis selalu mengalahkan CSS berlapis berapa pun kekhususannya. Aturan dipindahkan keluar dari lapis, dengan warna garis yang dipilih terpisah untuk latar gelap peta dan latar terang tombol.
3. Memilih baris dari tabel semula tidak memunculkan detail apa pun, karena panel detail hidup di tab lain. Panel detail kini ikut ditampilkan di tab Daftar, dan setiap pemilihan diumumkan lewat wilayah `aria-live` supaya pembaca layar ikut mendengar hasilnya, bukan hanya pengguna yang melihat.

Hasil akhir: seluruh alur utama dapat dijalankan dengan Tab dan Enter saja, setiap elemen yang mendapat fokus punya garis fokus yang kontras terhadap latarnya, dan pemindaian axe tetap nol pelanggaran pada empat halaman di tiga lebar layar.

### Tahap 13, artikel siaga sebagai bagian produk

Status catatan: dicatat saat tahap berjalan.

| Aspek | Isi |
| --- | --- |
| Prompt inti | Membangun artikel sebagai bagian produk, bukan blog tempelan, dengan seluruh langkah keselamatan bersumber lembaga resmi |
| Dihasilkan AI | Model konten, halaman daftar dan halaman baca, mode cetak, sambungan peta ke artikel, naskah empat artikel |
| Diubah manual | Diisi setelah tinjauan pemilik repo |

Aturan isi yang mengikat pada tahap ini: seluruh prosedur keselamatan wajib bersumber dari lembaga resmi, dan bila sumber untuk suatu langkah tidak tersedia, langkah itu dihapus, bukan dikira-kira.

Aturan itu menentukan hasil akhirnya. Dari delapan artikel yang direncanakan, hanya empat yang diterbitkan, yaitu empat yang sumber resminya berhasil ditemukan dan dapat dikutip langsung:

| Artikel | Sumber |
| --- | --- |
| Cara memakai APAR dan di mana menaruhnya | BPBD Daerah Istimewa Yogyakarta |
| Tabung gas bocor, urutan tindakannya | Dinas Damkar dan Penyelamatan Kabupaten Bandung |
| Korsleting listrik dan cara memeriksanya lebih awal | Dinas Gulkarmat DKI Jakarta lewat Berita Jakarta |
| Relawan pemadam kelurahan dan hidran mandiri | Kota Administrasi Jakarta Barat |

Empat sisanya, yaitu tiga menit pertama saat api muncul, estafet selang, jalur keluar di gang buntu, dan langkah pertama setelah api padam, belum ditulis karena sumber resminya belum ditemukan. Halaman daftar menyatakan kekosongan ini secara terbuka, bukan menyembunyikannya.

Satu temuan yang perlu dicatat: sumber untuk artikel relawan ternyata membahas Palmerah secara langsung, termasuk posko di SDN Palmerah 13 Pagi dan tiga belas hidran mandiri di RW 08. Angka itu masuk ke artikel apa adanya, dan menghubungkan isi artikel dengan panel Air di lembar kerja.

Keputusan teknis: frontmatter ditulis sebagai JSON, bukan YAML, supaya tidak perlu menambah pustaka pengurai dan supaya skemanya dapat divalidasi dengan zod yang sudah dipakai di tempat lain. Validasi itu menolak artikel tanpa sumber pada waktu build, jadi artikel tanpa sumber tidak mungkin ikut terbit.

Kesalahan yang dibuat dan cara memperbaikinya: halaman daftar semula membaca parameter URL langsung saat render, dan build gagal karena parameter kueri tidak dapat diakses pada halaman yang di-prerender. Pembacaan parameter dibatasi ke sisi klien, sehingga HTML statisnya tetap memuat seluruh artikel dan saringan bekerja setelah halaman hidup di browser.

### Tahap 14, pembanding silang dengan OpenStreetMap

Status catatan: dicatat saat tahap berjalan.

| Aspek | Isi |
| --- | --- |
| Prompt inti | Mencari pembanding lebar gang dari sumber daring karena ukur meteran belum dilakukan |
| Dihasilkan AI | Skrip pencocokan `pipeline/cek_lebar_osm.py`, uji sensitivitas, seksi uji ketiga di halaman metode |
| Diubah manual | Diisi setelah tinjauan pemilik repo |

Latar belakang: pemilik repo bertanya apakah ukur meteran bisa digantikan data daring. Jawabannya tidak, karena penyempit gang yang paling menentukan, yaitu warung, gerobak, tenda, kanopi, dan jemuran, tidak terlihat dari atas dan tidak tercatat di sumber daring mana pun. Yang dapat dikerjakan adalah pembanding silang dengan sumber yang jalur asalnya berbeda, yaitu tanda lebar jalan yang dibuat kontributor OpenStreetMap.

Kesalahan pada percobaan pertama: pencocokan dilakukan dari titik tengah ruas OpenStreetMap ke titik tengah segmen kami dalam radius 12 meter. Hasilnya tampak meyakinkan, 310 pasangan, tetapi contoh pasangannya menunjukkan banyak ruas gang sempit yang tersambung ke jalan lebar di sebelahnya. Angka dari cara itu tidak layak dipakai. Cara itu diganti dengan pengambilan sampel titik setiap 4.0 meter di sepanjang ruas OpenStreetMap, lalu ruas hanya diterima bila sebagian besar sampelnya jatuh dekat satu segmen yang sama. Jumlah pasangan turun drastis, tetapi jarak pasangannya kini di bawah dua meter, artinya garisnya memang berimpit.

Hasil konfigurasi utama: dari 523 ruas bertanda lebar, 69 ruas tercocokkan dengan yakin. Median selisih lebar minimum kami terhadap lebar OpenStreetMap adalah +2.0 meter, dan angka kami lebih lebar pada 90 persen ruas.

Supaya temuan ini tidak bergantung pada aturan pencocokan yang kebetulan dipilih, pencocokan diulang pada 16 kombinasi batas jarak dan batas konsistensi. Median selisihnya selalu berada di antara +1.62 dan +3.29 meter, dan angka kami selalu lebih lebar pada 84 sampai 91 persen ruas. Arah temuannya stabil.

Cara membacanya: hasil ini tidak membuktikan angka kami benar. Yang dibuktikannya adalah kedua angka mengukur hal yang berbeda. OpenStreetMap mencatat lebar badan jalan, sedangkan kami mengukur ruang bebas di antara tapak bangunan, yang ikut menghitung teras, halaman, parkir, dan saluran air. Konsekuensinya penting bagi klaim utama produk: lebar gang kami adalah batas atas, sehingga pangsa gang yang tidak terlalui kendaraan kemungkinan besar lebih tinggi dari yang ditampilkan, bukan lebih rendah. Halaman metode menyatakan hal ini dengan kalimat yang sama.

Keputusan teknis: hasil skrip ditulis ke berkas JSON yang diimpor halaman metode saat build dan divalidasi dengan zod. Tidak ada angka yang disalin tangan dari keluaran skrip ke kode, sehingga angka di halaman tidak bisa melenceng dari hasil skripnya.

## Yang tidak dikerjakan AI

Penentuan masalah, pemilihan wilayah uji, penyusunan PRD, arah desain, pengukuran lapangan dengan meteran, dan keputusan lingkup fitur adalah pekerjaan manusia. AI tidak menentukan apa yang dibangun, hanya membantu membangunnya.
