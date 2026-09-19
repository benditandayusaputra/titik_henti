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

Catatan koreksi yang ditambahkan kemudian: klaim keberhasilan di paragraf ini salah, dan kesalahannya lebih serius daripada error yang hendak diperbaiki. Konsol memang menjadi bersih, tetapi karena tidak ada satu layer deck.gl pun yang tergambar lagi. Rinciannya dicatat di tahap 16.

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

### Tahap 15, keadaan, galat, dan satu benda satu nama

Status catatan: dicatat saat tahap berjalan.

| Aspek | Isi |
| --- | --- |
| Prompt inti | Memastikan tidak ada layar yang bisa diam tanpa penjelasan, dan tidak ada benda yang punya dua nama |
| Dihasilkan AI | Protokol kegagalan worker, keadaan data gagal dan kerangka memuat, daftar istilah beserta tes penegaknya, penulisan ulang teks |
| Diubah manual | Diisi setelah tinjauan pemilik repo |

Audit sebelum membangun menemukan empat cara antarmuka bisa diam tanpa penjelasan:

1. Penanganan galat pada worker simulasi tidak ada sama sekali. Tidak ada `onerror` di klien dan tidak ada `try` di worker, jadi galat di tengah perhitungan mematikan worker diam-diam dan tombol tertahan di keadaan menghitung selamanya.
2. Tombol Jalankan tidak memeriksa kesiapan worker. Ini regresi yang berasal dari tahap kinerja sebelumnya: sejak data jarak antarbangunan dimuat di latar, menekan Jalankan sebelum data itu tiba membuat permintaan ke worker tidak terkirim dan tombol tertahan selamanya.
3. Kartu siaga RT tertahan di keadaan menyiapkan kartu selamanya bila data gagal dimuat, karena cabang galatnya tidak ada.
4. Halaman peta menampilkan nama berkas mentah saat data gagal, tanpa menawarkan jalan lain.

Yang dibangun: worker kini melaporkan kegagalan dengan penyebab yang dibedakan, yaitu belum siap atau berhenti di tengah perhitungan. Klien menangkap galat worker di tiga jalur, yaitu pesan kegagalan, `onerror`, dan `onmessageerror`, dan setiap pemanggil menghentikan keadaan menghitung lalu menampilkan penyebabnya. Simulasi yang gagal menawarkan tombol mengulang dengan parameter awal. Tombol Jalankan dinonaktifkan sampai worker siap, dengan kalimat yang menjelaskan alasannya. Halaman peta dan kartu siaga RT menjelaskan bahwa data wilayah belum tersedia dan menawarkan muat ulang serta tautan ke panduan siaga.

Kerangka memuat sengaja dibuat statis. Bagian B5 melarang gerak berulang tanpa dipicu, jadi efek berdenyut yang lazim dipakai pada kerangka memuat tidak dipakai.

Satu benda satu nama: audit menemukan benda yang punya lebih dari satu nama, antara lain kartu siaga yang ditulis dengan tiga cara, tapak bangunan yang juga disebut footprint, dan hidran uji coba yang disebut hidran usulan, hidran hipotetis, dan hidran percobaan. Nama hidran usulan paling berbahaya karena kata usulan juga dipakai untuk usulan koreksi lapangan, sehingga dua benda berbeda berbagi satu kata. Seluruh nama baku dikumpulkan di `src/lib/ui/istilah.ts`, dan sebuah unit test memindai seluruh teks antarmuka, artikel, dan metadata lalu gagal bila varian terlarang muncul kembali.

Sapuan teks menurut Bagian B7 juga menemukan istilah teknis berbahasa Inggris di panel untuk warga, seperti mode batch pada worker, jalankan optimizer, dan terjemahan harfiah lari untuk run. Judul tahap pipeline Ingest dan Emit diterjemahkan. Seed diganti benih acak, sesuai istilah yang dipakai arah desain sendiri.

Dua kesalahan yang ditemukan sambil jalan, di luar soal istilah:

1. Sebuah label berbunyi kandidat dievaluasi tetapi menampilkan jumlah intervensi yang terpilih. Label dan angkanya tidak cocok, dan labelnya diganti menjadi intervensi terpilih.
2. Catatan biaya di panel intervensi menyebut nama berkas kode `constants.ts` kepada warga.

Kesalahan yang dibuat pada tahap ini dan cara memperbaikinya:

1. Teks keadaan memuat kartu siaga RT sempat menjanjikan bahwa tombol cetak aktif setelah kartu tersusun, padahal tombol itu tidak pernah dinonaktifkan. Tombolnya kini benar-benar menunggu kartu tersusun.
2. Petunjuk simulasi sempat memakai kata tentukan titik api, padahal tombolnya berbunyi tetapkan titik api. Diseragamkan, dan varian itu ditambahkan ke daftar terlarang.
3. Teks keadaan memuat diganti, dan lima berkas spec lain ternyata menunggu teks lama itu hilang. Akibatnya spec itu diam-diam berhenti menunggu data. Seluruhnya diperbarui ke teks baru.
4. Pemindaian aksesibilitas pada keadaan data gagal menemukan kartu siaga RT kehilangan judul tingkat satu, karena judulnya hanya ada di cabang data berhasil dimuat. Pelanggaran ini tidak pernah muncul pada pemindaian biasa karena data selalu berhasil dimuat di sana. Judul ditambahkan pada setiap keadaan, dan spec aksesibilitas khusus keadaan gagal ditambahkan.
5. Tangkapan layar keadaan data gagal menunjukkan pesan yang sama tampil dua kali, di area peta dan di panel samping, sehingga pembaca layar mendengar dua peringatan berturut-turut. Salinan di panel samping dibuang, dan spec kini menuntut tepat satu pesan.

### Tahap 16, regresi yang lolos ke produksi dan uji yang seharusnya sudah ada

Status catatan: dicatat saat tahap berjalan.

| Aspek | Isi |
| --- | --- |
| Prompt inti | Memeriksa situs yang sudah ter-deploy dari sisi pengunjung, memperbaiki temuan, lalu commit dan push ulang |
| Dihasilkan AI | Diagnosis regresi, perbaikan pelacakan dependensi efek, uji render peta, perapian dua istilah |
| Diubah manual | Diisi setelah tinjauan pemilik repo |

Temuan utama: di situs produksi, tidak ada satu pun layer deck.gl yang tergambar. Sumber air, garis selang, titik henti, penjalaran api di peta, jangkauan air, dan kantong tak terjangkau semuanya hilang dari peta. Seluruh panel dan angka tetap benar, hanya gambarnya di peta yang tidak muncul.

Cara ketahuannya: tangkapan layar lokal dari tahap pemindahan ke Palmerah memuat 1.470 piksel berwarna air di area peta. Tangkapan layar produksi memuat nol. Pembacaan langsung isi kanvas WebGL tidak dapat dipercaya untuk pemeriksaan ini, karena tanpa `preserveDrawingBuffer` buffer sudah dikosongkan setelah bingkai tampil, sehingga pengukuran dilakukan pada tangkapan layar.

Penyebabnya adalah perbaikan deck.gl pada tahap 11 itu sendiri. Efek yang menyerahkan layer berbunyi `if (overlay && styleReady)`. Karena `overlay` bukan state reaktif dan bernilai null saat efek pertama berjalan, operator `&&` berhenti sebelum `styleReady` sempat terbaca. Svelte 5 hanya melacak nilai reaktif yang benar-benar dibaca, sehingga efek tidak pernah berlangganan ke `styleReady` dan tidak berjalan lagi ketika peta siap. Instrumentasi sementara memastikannya: `setProps` tidak pernah dipanggil sekali pun, dan deck.gl berisi nol layer. Kode asli selamat dari masalah ini hanya karena layer juga diserahkan lewat konstruktor. Ketika jalur konstruktor itu dibuang, tidak tersisa satu jalur pun yang benar-benar mengirim layer.

Perbaikannya menjadikan `overlay` state reaktif memakai `$state.raw`, supaya objek deck.gl tidak dibungkus proxy, dan membaca ketiga dependensi tanpa hubung singkat. Pemeriksaan interaktif memastikan dua hal sekaligus: layer benar-benar tergambar, dan galat instance layer yang sudah final tidak kembali, termasuk sepanjang siklus menambah, membuang, dan menambah ulang layer saat berpindah tab.

Kenapa lolos sampai produksi: suite uji end to end berisi 50 uji dan seluruhnya lolos, padahal peta rusak. Tidak ada satu uji pun yang memeriksa bahwa layer deck.gl tergambar. Uji yang ada hanya memeriksa konsol bersih, dan versi yang rusak justru lolos pemeriksaan itu karena layer yang tidak pernah dibuat tentu tidak pernah melempar galat. Bukti yang tampak meyakinkan, yaitu konsol bersih, dibaca sebagai tanda berhasil tanpa diperiksa apa yang sebenarnya tergambar di layar.

Uji baru `tests/e2e/peta-tergambar.spec.ts` menghitung piksel berwarna air pada tangkapan layar area peta. Uji ini tidak diterima hanya karena lolos pada kode yang benar. Bug hubung singkat itu dikembalikan sementara, dan uji gagal dengan hasil 0 dari minimum 300 piksel, yaitu persis ciri regresinya. Setelah perbaikan dipulihkan, uji kembali lolos.

Temuan lain dari tangkapan layar produksi, yang juga lolos dari uji istilah pada tahap 15:

1. Tombol hapus pada panel air masih berbunyi hapus sekian usulan untuk hidran uji coba. Tabrakan kata usulan dengan usulan koreksi lapangan ternyata masih tersisa di tombol ini, karena pola terlarang hanya menangkap frasa hidran usulan.
2. Label posisi unit berdampingan dengan catatan posisi mobil pemadam pada panel yang sama.

Keduanya diseragamkan dan ditambahkan ke daftar varian terlarang.

Pemeriksaan produksi yang lolos: seluruh halaman menjawab 200 dan jalur yang tidak ada menjawab 404, pengalihan garis miring bekerja, berkas PMTiles melayani range request dengan jawaban 206 dan tanda tangan berkas yang sah, data dikirim terkompresi Brotli, header cache dari `vercel.json` terpasang, peta tergambar dalam kurang dari setengah detik, dan tidak ada galat konsol maupun permintaan yang gagal.

### Tahap 17, kinerja dan pengerasan produksi

Status catatan: dicatat saat tahap berjalan.

| Aspek | Isi |
| --- | --- |
| Prompt inti | Menyelesaikan fase kinerja dan pengerasan produksi dari rencana eksekusi, mengukur setiap anggaran, lalu commit dan push |
| Dihasilkan AI | Audit terhadap sebelas butir fase, pemindahan berkas data, pramuat huruf, huruf cadangan bermetrik setara, kebijakan keamanan konten, meta per halaman, gambar Open Graph, peta situs, alur kerja CI, uji unit simulasi, spec end to end produksi |
| Diubah manual | Diisi setelah tinjauan pemilik repo |

Audit sebelum membangun menemukan sebagian besar butir sudah tersentuh, tetapi ada empat masalah yang tidak kelihatan dari luar:

1. Beranda, halaman metode, dan kartu siaga RT memanggil pemuat data lengkap hanya untuk menampilkan angka dari `meta.json`. Beranda mengunduh `graph.json` 1,6 MB dan `buildings.bin` 424 KB demi empat angka, dan angka itu baru muncul setelah unduhan selesai, bukan di HTML hasil build.
2. Berkas data dilayani dengan header cache satu tahun `immutable`, padahal namanya tetap, misalnya `/data/gangs.pmtiles`. Setelah pipeline dijalankan ulang, pengunjung lama akan terus memakai data lama selama setahun tanpa cara memaksanya berganti.
3. Tidak ada kebijakan keamanan konten, meta Open Graph, peta situs, maupun robots.txt.
4. `package-lock.json` tidak sinkron dengan `package.json`, sehingga `npm ci` gagal. Ini tidak pernah ketahuan karena Vercel memakai `npm install` yang toleran.

Yang dibangun:

1. Berkas data dipindah dari `static/data/` ke `src/lib/data/files/` dan diimpor lewat `?url`. Vite memberi sidik jari pada namanya, misalnya `gangs.ZoQ9Ye4Q.pmtiles`, dan adapter Vercel sudah melayani `/_app/immutable/` dengan cache panjang. Aturan cache manual di `vercel.json` dibuang. `meta.json` diimpor sebagai modul, sehingga angka beranda dan tabel sumber data di halaman metode sudah ada di HTML hasil build tanpa unduhan apa pun. Keluaran pipeline ikut dipindah.
2. Hanya tiga huruf yang tampil di layar pertama setiap halaman yang dipramuat, yaitu Plex Sans Condensed 600 serta Plex Sans 400 dan 500, lewat `hooks.server.ts`.
3. Kebijakan keamanan konten dipasang lewat `kit.csp` dengan hash skrip, karena halaman hasil prerender tidak bisa diberi nonce. `frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`, dan `Permissions-Policy` dipasang sebagai header di `vercel.json`, karena `frame-ancestors` diabaikan bila ditulis lewat tag meta.
4. Komponen `PageMeta` memberi setiap halaman judul, deskripsi, tautan kanonik, dan Open Graph sendiri. Gambar Open Graph dihasilkan saat build dari `print.json` asli dengan proyeksi yang sama dengan denah kartu siaga RT, lalu dienkode ke PNG memakai `zlib` bawaan Node tanpa pustaka tambahan. Gambar itu dan peta situs ditulis sebagai endpoint yang dirender saat build, sehingga keduanya menjadi berkas statis. Server route yang benar-benar berjalan di server tetap hanya `/api/koreksi`.
5. Alur kerja GitHub Actions menjalankan cek komentar paling awal, lalu instalasi bersih, cek tipe, build, uji unit, dan uji Playwright.
6. Delapan modul di `src/lib/sim` yang belum punya uji unit kini punya: geo, heap, hoseReach, network, optimizer, random, spatialGrid, dan waterArrival. Jumlah uji unit naik dari 47 ke 80.

Pengukuran:

| Ukuran | Sebelum | Sesudah | Anggaran |
| --- | --- | --- | --- |
| JavaScript beranda setelah gzip | 38,7 KB | 38,7 KB | di bawah 180 KB |
| Unduhan data saat membuka beranda | 2,0 MB | 0 | tidak ditetapkan |
| LCP beranda, 4G lambat dan CPU 4 kali lebih lambat, produksi | 1.664 ms, sekali ukur | 1.676 sampai 1.804 ms pada 380 px, 1.708 ms pada 1440 px, pencilan dicatat di bawah | di bawah 2 detik |
| CLS beranda, kondisi sama | 0,0183 | 0,0016 pada 380 px, 0,0043 pada 1440 px | di bawah 0,02 |
| CLS artikel pada 380 px, kondisi sama | 0,0402 | 0,0015 | tidak ditetapkan |

LCP tidak membaik, dan angka sesudah tidak boleh dibaca sebagai satu nilai pasti. Pengukuran sebelum hanya diambil sekali. Pengukuran beranda sesudah pada 380 piksel diulang tiga kali dan menghasilkan 1.804, 5.040, dan 1.676 milidetik. Nilai 5.040 dan satu nilai 3.984 pada kartu siaga RT muncul saat deploy baru sedang ditayangkan, jadi dugaannya cache CDN yang masih dingin, tetapi dugaan itu belum dibuktikan. Di luar dua pencilan itu, seluruh halaman berada di 1.676 sampai 1.804 milidetik, di bawah anggaran 2 detik dengan sisa yang tipis.

MapLibre dan deck.gl hanya ada di bundel rute peta. Bundel itu 481 KB setelah gzip dan tidak pernah dimuat oleh beranda maupun artikel.

Penyebab CLS ditelusuri lewat sumber pergeseran, bukan ditebak. Tautan di kepala halaman terbungkus tiga baris saat huruf cadangan tampil dan dua baris setelah Plex Condensed tiba, sehingga seluruh isi halaman bergeser 13 piksel. Pramuat saja tidak cukup pada 4G lambat. Perbaikannya permukaan huruf cadangan `IBM Plex Sans Condensed Fallback` dari Arial atau Roboto dengan `size-adjust` 88 persen, angka yang diukur dari rasio lebar teks kepala halaman pada kedua huruf. Tinggi setiap tautan dan judul dibandingkan dengan huruf diblokir dan dengan huruf termuat pada tiga halaman dan tujuh lebar dari 320 sampai 1440 piksel, dan hasilnya identik di seluruh 21 kombinasi.

Kesalahan yang dibuat pada tahap ini dan cara memperbaikinya:

1. Pramuat huruf pertama kali ikut memuat berkas `.woff` cadangan di samping `.woff2`, sehingga setiap huruf terunduh dua kali. Ketahuan dari HTML hasil build, lalu dibatasi ke `.woff2`.
2. Percobaan pertama memperbaiki CLS mengunci label kepala halaman agar tidak terbungkus. Pengukuran menunjukkan label Metode terpotong 30 piksel pada lebar 380 karena Plex pun sudah terbungkus di lebar itu. Percobaan itu dibatalkan sebelum di-commit.
3. Skrip perapian indentasi di halaman metode mencari tabel pertama di berkas, bukan tabel sumber data, sehingga menggeser indentasi rentang yang salah. Berkas dipulihkan dari git lalu diubah ulang dengan pencarian yang tepat.
4. Deskripsi kartu siaga RT sempat ditulis kartu siaga tanpa RT. Uji istilah dari tahap 15 menangkapnya.
5. Uji kebijakan keamanan konten menemukan pelanggaran `script-src eval` di halaman peta. Sumbernya bukan kode produk, melainkan pemeriksaan `new Function` milik zod v4 yang dilempar lalu ditelan, tetapi tetap tercatat sebagai pelanggaran. Kebijakannya tidak dilonggarkan dengan `unsafe-eval`. Zod diimpor lewat satu modul yang menyalakan mode `jitless`, dan pelanggaran hilang di keenam halaman.
6. Global gitignore di mesin pengembang mengabaikan folder `.github`, sehingga berkas alur kerja pertama kali gagal ditambahkan tanpa ketahuan sampai perintah commit berhenti. Berkas itu ditambahkan paksa, konfigurasi global tidak diubah.
7. Jalankan CI pertama gagal di `npm ci` karena lockfile tidak sinkron. Direproduksi di klon bersih dengan Node 22 dan Node 24. `npm install --package-lock-only` tidak memperbaikinya, `npm install` penuh memperbaikinya. Perbandingan isi lockfile per paket menunjukkan hanya dua entri `@emnapi` yang ditambahkan dan penanda `peer` yang dibuang, tanpa satu versi pun berubah.
8. Jalankan CI kedua lolos sampai uji unit, tetapi enam uji koreksi lapangan gagal karena waktu habis, sementara 54 uji lain lolos, termasuk uji piksel peta. Log tidak bisa dibaca tanpa akun, jadi reporter Playwright di CI diganti ke format anotasi GitHub supaya kegagalan terbaca di halaman run. Penyebabnya ada di uji, bukan produk. Helper uji memilih segmen dengan mengeklik grid 31 kali 21 titik secara buta sampai panel segmen muncul, dan di mesin CI yang menggambar WebGL dengan perangkat lunak, loop itu melewati batas 30 detik. Helper kini memotret area peta, mencari piksel berwarna gang unit kecil yang benar-benar tergambar, lalu mengeklik di sana. Menunggu piksel itu muncul sekaligus menjadi tanda peta siap, bukan jeda tetap. Keenam uji turun dari waktu habis di CI menjadi sekitar 2 detik per uji di lokal. Uji ini dibuktikan gagal saat pembacaan nomor segmen dari klik peta dirusak sementara. Percobaan pertama merusak fungsi yang salah, yaitu pembacaan nomor bangunan yang baris pertamanya identik, dan uji justru tetap lolos karena klik lalu jatuh ke segmen. Setelah sasaran perusakan dibetulkan, uji gagal dengan pesan yang menyebut penyebabnya.
9. Polling status CI lewat API GitHub tanpa autentikasi menghabiskan kuota 60 permintaan per jam. Pemantauan dipindah ke halaman HTML run.

Jalankan CI keempat hijau: cek komentar, instalasi bersih, cek tipe, build, 80 uji unit, dan 60 uji end to end, total 5 menit 8 detik.

Uji unit baru tidak diterima hanya karena lolos. Setiap modul dirusak sementara di satu titik yang menjadi inti perilakunya, dan uji harus gagal. Tiga mutan awalnya lolos:

1. `spatialGrid` dengan jangkauan pencarian nol tetap lolos, karena titik uji dan bangunan terdekatnya berada di sel yang sama. Titik uji digeser supaya bangunan terdekat berada di sel tetangga.
2. `optimizer` yang mengabaikan anggaran yang sudah terpakai tetap lolos, karena pada skenario uji hanya satu intervensi yang pernah memberi manfaat. Skenario diganti menjadi rantai gang unit kecil, tempat dua pelebaran berturut-turut sama-sama berguna tetapi anggaran hanya cukup untuk dua dari tiga.
3. `hoseReach` tanpa pengurutan kantong tetap lolos, karena kantong terbesar kebetulan ditemukan lebih dulu. Data uji diubah supaya kantong kecil ditemukan lebih dulu.

Dua mutan lain lolos karena memang setara dengan kode asli, bukan karena ujinya lemah. Pengaman benih nol di `SeededRandom` tidak diperlukan karena generator kongruensial linear tidak macet di nol, dan pengecekan manfaat tidak positif di optimizer sudah tercakup oleh syarat rasio harus lebih besar dari nol.

Spec baru `tests/e2e/produksi.spec.ts` memeriksa angka beranda ada di HTML hasil build, beranda tidak mengunduh berkas data dan JavaScript-nya di bawah anggaran, berkas data peta bernama bersidik jari, hanya tiga huruf yang dipramuat, tidak ada pelanggaran kebijakan keamanan konten di keenam halaman termasuk peta yang sudah tergambar, setiap halaman punya meta sendiri, serta gambar Open Graph, peta situs, dan robots.txt tersedia.

Pemeriksaan produksi setelah deploy: berkas PMTiles bersidik jari menjawab range request dengan 206, tanda tangan berkas yang sah, dan cache `immutable`. `graph.json` dikirim dengan Brotli. Keempat header keamanan terpasang. Nol pelanggaran kebijakan keamanan konten di keenam halaman. Lapisan deck.gl tergambar di peta produksi.

Temuan yang belum diselesaikan: halaman peta memunculkan peringatan driver GPU `GPU stall due to ReadPixels` sekali per proses browser. Peringatan yang sama muncul pada build sebelum tahap ini, jadi bukan regresi. Instrumentasi menunjukkan tidak ada satu pun panggilan `readPixels` WebGL maupun `getImageData` dari JavaScript halaman, sehingga sumbernya kemungkinan pembacaan balik internal browser atau worker pustaka peta. Penyebab pastinya belum ditemukan.

Riwayat git diperiksa dengan `git log --format=%B`, dan tidak ada penyebutan nama alat, AI, atau kalimat pembuatan otomatis.

### Tahap 18, kritik diri dan pencabutan

Status catatan: dicatat saat tahap berjalan.

| Aspek | Isi |
| --- | --- |
| Prompt inti | Memotret setiap halaman pada tiga lebar, memeriksanya terhadap larangan desain, mengukur luas warna alarm, mencabut hiasan yang tidak berguna, lalu menulis catatan desain |
| Dihasilkan AI | Tangkapan layar dan pengukuran piksel, daftar pelanggaran, perbaikan dan pencabutan, spec end to end, `CATATAN-DESAIN.md` |
| Diubah manual | Diisi setelah tinjauan pemilik repo |

Rincian desainnya, termasuk apa yang dicabut, apa yang dipertahankan, dan alasannya, ada di `CATATAN-DESAIN.md`. Bagian ini mencatat cara kerja dan kesalahannya.

Hasil utama: tujuh hal dicabut, yaitu merah kelas gang di tab Api, kotak merah hiasan di tanda nama, tanda potong di kartu angka dan legenda, penomoran daftar batasan, hitam bersemu, nomor revisi fiktif, dan monospasi di luar angka terukur. Luas alarm di setiap layar tidak pernah melewati 3,3 persen, jauh di bawah batas sepersepuluh, jadi pencabutan merah di tab Api didasarkan pada tesis desain, bukan pada batas luas.

Dua kerusakan nyata ditemukan dari tangkapan layar, bukan dari kode:

1. Angka ringkasan kartu siaga RT bertumpuk tidak terbaca pada lebar 380 piksel.
2. Legenda peta tidak pernah terlihat tanpa menggulir pada lebar 1024 piksel ke atas, karena panel samping memanjangkan seluruh lembar kerja. Kode panel sebenarnya sudah dirancang bergulir sendiri, tetapi induknya tidak pernah dibatasi tinggi. Kesalahan ini sudah ada sebelum tahap ini. Tangkapan layar peta produksi pada tahap 17 pun tidak memuat legenda, tetapi tidak ada yang memperhatikan ketidakhadirannya, karena memeriksa gambar hanya menangkap apa yang salah tergambar, bukan apa yang tidak tergambar.

Kesalahan yang dibuat pada tahap ini dan cara memperbaikinya:

1. Pengukuran luas alarm pertama hanya menghitung piksel yang mirip persis dengan hex alarm, dan meremehkan merah di peta sampai lima belas kali, karena garis tipis di atas latar gelap tercampur warna latar. Ketahuan karena angka 0,16 persen tidak cocok dengan foto yang terlihat merah. Penghitungan diganti ke rona.
2. Membatasi tinggi lembar kerja membuat panel samping benar-benar bergulir, dan pemindaian axe langsung menemukan wilayah gulir yang tidak dapat dijangkau papan ketik. `tabindex="0"` statis ditolak Svelte dengan peringatan, dan `tabindex="-1"` menghilangkan peringatan tanpa menyelesaikan masalah. Solusinya lampiran Svelte yang memasang `tabindex="0"` hanya selama isi panel melebihi tingginya.
3. Panel sempat diubah menjadi elemen `section`, dan uji papan ketik gagal karena pemilihnya menangkap dua elemen. Panel dikembalikan menjadi `div` berperan wilayah.
4. Uji tumpukan angka kartu siaga RT versi pertama lolos pada kode yang rusak, karena mengukur kotak elemen, sedangkan yang meluber hanya teksnya. Uji diganti mengukur batas teks dan dibuktikan gagal pada kode lama dengan dua tumpukan.
5. Draf pertama `CATATAN-DESAIN.md` mencantumkan percobaan meredam warna kelas gang di semua tab sebagai hal yang dicoba lalu dibuang, padahal percobaan itu tidak pernah dilakukan. Tabelnya juga mencantumkan angka tab Api pada 380 dan 768 piksel yang belum diukur. Keduanya ketahuan saat draf dibaca ulang terhadap riwayat kerja. Butir palsu diganti dengan percobaan yang benar-benar terjadi, dan angka yang kosong diukur lebih dulu sebelum ditulis.

Pembuktian uji: spec baru `tests/e2e/kritik-diri.spec.ts` dijalankan terhadap kode sebelum tahap ini. Lima dari enam uji gagal, yaitu redaman merah tab Api, legenda di dalam layar, tumpukan angka kartu, larangan rupa di kepala halaman, dan penomoran batasan. Uji luas alarm lolos pada kedua versi, dan itu memang sesuai hasil ukur, karena luasnya tidak pernah melewati batas.

Pemecahan commit: perubahan tahap ini dikerjakan sekaligus lalu diuji utuh. Perubahan itu kemudian diterapkan ulang dari HEAD per tema dengan skrip, dikomit per tema, dan hasil akhirnya dibandingkan per berkas dengan keadaan yang sudah diuji. Kelima belas berkas identik.

Putaran verifikasi di server dev: enam halaman pada tiga lebar, dengan dan tanpa reduced motion, termasuk tab Api di lembar kerja. Nol gulir mendatar, nol pelanggaran axe, dan konsol bersih kecuali peringatan driver GPU yang sudah dicatat pada tahap 17. Seluruh suite end to end lolos, 66 uji.

### Tahap 19, audit definition of done keseluruhan

Status catatan: dicatat saat tahap berjalan.

| Aspek | Isi |
| --- | --- |
| Prompt inti | Memeriksa kedua puluh satu butir definition of done keseluruhan di rencana eksekusi satu per satu, lalu menutup celahnya |
| Dihasilkan AI | Pemeriksaan otomatis per butir, tabel pembanding akurasi di beranda, perbaikan penyimpanan kalimat koreksi, spec end to end, tangkapan layar susulan |
| Diubah manual | Diisi setelah tinjauan pemilik repo |

Hasil per butir:

| Butir | Isi singkat | Status dan bukti |
| --- | --- | --- |
| 1 | cek komentar, check, build | Lolos |
| 2 | Tanpa gulir mendatar di 380, 768, 1024, 1440, 1920 | Sebelumnya hanya tiga lebar yang diuji. Spec aksesibilitas kini mencakup kelima lebar dan kesembilan halaman, termasuk keempat artikel. Lolos |
| 3 | Navigasi papan ketik penuh, fokus selalu terlihat | Uji lama hanya memeriksa gaya garis fokus di satu halaman. Uji baru menekan Tab di enam halaman pada dua lebar dan mengukur kontras garis fokus terhadap latarnya, minimal 3 banding 1. Lolos |
| 4 | Nol pelanggaran aksesibilitas otomatis di seluruh halaman | Lolos di 9 halaman dan 5 lebar |
| 5 | Reduced motion dihormati dan diuji | Sebelumnya tidak ada uji permanen. Uji baru merekam angka penggaris selang setiap 16 milidetik: dengan reduced motion hanya muncul nilai akhir, tanpa reduced motion muncul lebih dari dua nilai. Lolos |
| 6 | Isi peta dapat dipahami tanpa melihat peta | Tab Daftar dan uji alur tanpa tetikus dari tahap 12. Lolos |
| 7 | Sumber data dan lisensi disebut di antarmuka | Halaman metode dan catatan data peta, diuji sejak tahap 9. Lolos |
| 8 | Penanda estimasi satelit | Catatan data peta, diuji. Lolos |
| 9 | Tabel pembanding ukur lapangan di beranda | Belum ada. Kini beranda memuat tabel pembanding tiga uji: permukiman sintetis, ukur meteran lapangan yang ditulis belum dilakukan, dan pembanding OpenStreetMap, dengan tautan ke halaman metode |
| 10 | Ter-deploy publik tanpa login | Lolos |
| 11 | Repo publik tanpa kunci atau kredensial | Seluruh riwayat dipindai untuk pola kunci API dan berkas `.env`. Tidak ditemukan |
| 12 | Riwayat git bersih dari nama alat | Lolos |
| 13 | Nol komentar di kode | Lolos, termasuk berkas konfigurasi di akar yang tidak dipindai skrip |
| 14 | AI-USAGE lengkap sampai fase terakhir | Tahap ini |
| 15 | Catatan desain berisi minimal tiga pencabutan | Tujuh pencabutan di `CATATAN-DESAIN.md` |
| 16 | Spec hijau, bukti tiap fase pada ketiga lebar | Spec hijau, 98 uji end to end dan 80 uji unit. Bukti fase lama tidak lengkap di ketiga lebar. Kekurangannya ditambal dengan tangkapan layar berakhiran `-susulan`, diambil dari build sekarang, bukan dari saat fase itu dikerjakan. Namanya sengaja dibedakan supaya tidak terbaca sebagai bukti asli fase tersebut |
| 17 | Tanpa gamifikasi | Dipindai. Satu-satunya kata peringkat adalah judul hasil optimizer yang mengurutkan intervensi menurut manfaat per rupiah, bukan papan peringkat pengguna |
| 18 | Api hanya perubahan warna bangunan | Lapisan api hanya titik berwarna per status bangunan. Lolos |
| 19 | Nol emoji di produk | Dipindai di sumber, konten, README, dan dokumen. Nol |
| 20 | Seluruh ikon lewat satu pembungkus Lucide | Produk tidak memakai pustaka ikon sama sekali. Satu-satunya glyph berbentuk ikon, tanda seru dalam kotak di catatan data, adalah hiasan karena kalimat di sebelahnya sudah menyampaikan maksudnya, jadi dicabut. Tombol perbesar dan perkecil peta memakai glyph bawaan kontrol MapLibre, dan ini dicatat sebagai pengecualian |
| 21 | Seluruh kode di dalam `titik_henti/` | Di luar folder hanya ada `test/spike_gang.py` dan `bukti/f0/` dari tahap validasi data F0 yang dikerjakan pemilik repo, serta log alat Playwright. Tidak dipindahkan tanpa persetujuan pemilik |

Temuan di luar daftar butir:

1. Kolom kalimat koreksi lapangan dikosongkan sebelum hasil pengiriman diketahui. Bila layanan model gagal, kalimat yang diketik petugas di lapangan hilang dan harus diketik ulang. Ini ditemukan saat mengambil bukti susulan dengan model sungguhan di produksi: percobaan pertama pada lebar 768 piksel mendapat jawaban gagal dari layanan model, percobaan kedua berhasil. Kalimat kini hanya dikosongkan bila usulan berhasil dibuat, dan pesan galat yang bersifat sementara menyebut bahwa kalimat tetap tersimpan dan dapat dikirim ulang, sesuai Bagian B7. Uji baru dibuktikan gagal saat perilaku lama dikembalikan.
2. Pembuka halaman metode menulis dua pengujian, padahal ada tiga. Diperbaiki.
3. Penghitung karakter kolom koreksi memakai monospasi. Diganti huruf isi. Nilai di baris panel lewat komponen `ValueRow` juga memakai monospasi untuk jumlah dan persen, tidak hanya meter dan detik. Ini tidak diubah pada tahap ini karena menyentuh seluruh panel lembar kerja dan berada di luar daftar butir.

Kesalahan yang dibuat pada tahap ini dan cara memperbaikinya:

1. Pengukuran kontras garis fokus pertama melaporkan tiga tombol hitam dengan garis fokus tidak terlihat, rasio kontras sekitar 1. Tangkapan layar yang diambil saat itu seolah membenarkannya. Penyebabnya bukan tampilan, melainkan waktu ukur: tombol memakai transisi 100 milidetik pada warna garis, dan pengukuran diambil tepat setelah Tab, saat warna masih berangkat dari warna teks tombol. Diukur ulang setelah 250 milidetik, seluruh fokus terlihat. Uji permanen menunggu transisi selesai, dan dibuktikan gagal saat warna garis fokus sengaja diganti warna latar.
2. Uji reduced motion pertama memilih bangunan lewat tab Daftar, padahal daftar itu berisi 25 bangunan yang paling jauh dari air dan seluruhnya tidak terjangkau, sehingga penggaris selang tidak pernah muncul. Uji diganti memilih bangunan lewat klik peta.
3. Pengambilan bukti susulan pertama gagal karena peta lokal tidak pernah selesai dimuat. Build terakhir di folder keluaran saat itu berasal dari putaran uji mutan. Build diulang dari kode yang benar dan server preview dijalankan ulang sebelum bukti diambil ulang.

### Tahap 20, empat artikel tertunda dan pemeriksaan ulang artikel lama

Status catatan: dicatat saat tahap berjalan.

| Aspek | Isi |
| --- | --- |
| Prompt inti | Menulis empat artikel yang tertunda dengan mencari sumber resmi di internet, tanpa mengarang langkah keselamatan |
| Dihasilkan AI | Pencarian dan verifikasi sumber, empat artikel baru, penulisan ulang empat artikel lama, penyesuaian uji |
| Diubah manual | Diisi setelah tinjauan pemilik repo |

Cara kerja sumber: hasil pencarian dan ringkasan alat pengambil halaman tidak dipakai sebagai kutipan. Setiap halaman sumber diunduh utuh dan teksnya diekstrak sendiri, lalu setiap langkah di artikel dicocokkan dengan teks itu. Keputusan ini terbukti perlu tiga kali. Ringkasan halaman Damkar Kota Banda Aceh memotong separuh langkah pemeriksaan pintu, yaitu memeriksa gagang pintu dan pindah jalur bila panas. Ringkasan pencarian tentang Suku Dinas Gulkarmat Jakarta Timur menyebut imbauan agar warga menjauh dari lokasi kebakaran, padahal artikel aslinya tidak memuat imbauan itu. Pengekstrak teks buatan sendiri juga sempat membuang baris pendek, sehingga butir Lokasi lengkap dan Situasi kebakaran dari Damkar Kota Cirebon hilang, dan ekstraksi diulang tanpa batas panjang baris.

Empat artikel baru:

| Rencana | Yang terbit | Sumber |
| --- | --- | --- |
| Tiga menit pertama saat api muncul | Menit-menit pertama saat api muncul | Damkar Kota Cirebon, Damkar Kota Banda Aceh, BPBD Provinsi NTB, Biro Umum Setda DKI Jakarta |
| Langkah pertama setelah api padam | Setelah api padam, jangan dulu masuk | Damkar Kota Cirebon, Bakorwil Bojonegoro, Sudin Gulkarmat Jakarta Timur lewat Berita Jakarta |
| Menyiapkan jalur keluar di gang buntu | Menjaga jalur keluar dan titik kumpul di gang padat | Kota Administrasi Jakarta Barat tentang uji jalur evakuasi Kecamatan Palmerah, BPBD Kota Yogyakarta, Bakorwil Bojonegoro, Damkar Kota Banda Aceh |
| Estafet selang saat mobil pemadam tidak bisa masuk | Saat mobil pemadam tidak bisa masuk gang | Sudin Gulkarmat Jakarta Barat lewat Berita Jakarta tentang hidran mandiri Kemanggisan, Kota Administrasi Jakarta Barat |

Tiga judul diubah dari rencana karena isinya tidak didukung sumber. Tidak ada sumber resmi yang menyebut angka tiga menit, jadi angka itu dicabut dari judul. Tidak ada sumber yang membahas gang buntu secara khusus, jadi langkah di artikel jalur keluar bersifat umum, dan gang buntu hanya muncul sebagai penjelasan mengapa jalur yang sama dipakai untuk keluar, masuk, dan menggelar selang. Tidak ada sumber resmi yang dapat dijangkau tentang teknik estafet selang atau peran warga saat selang digelar. Beberapa laporan kejadian di situs Dinas Gulkarmat DKI yang muncul di pencarian ternyata sudah tidak tersedia di alamatnya. Artikel itu karena itu tidak menjelaskan teknik estafet, melainkan hidran mandiri yang dibangun khusus untuk lokasi yang tidak bisa dimasuki mobil pemadam dan menjaga jalur akses.

Setiap bagian yang mengaitkan artikel dengan peta ditulis sebagai penjelasan cara kerja produk, bukan langkah keselamatan. Angka 20 meter per gulung disebut sebagai asumsi model, dan dibedakan dari selang hidran mandiri Kemanggisan yang panjangnya 30 meter.

Kalimat yang dicabut dari draf artikel baru saat dicocokkan ulang dengan sumber: larangan masuk kembali untuk mencari orang, karena sumbernya hanya melarang masuk kembali untuk mengambil barang. Anjuran menyebut bagian rumah tempat orang terakhir berada. Klaim bahwa panas dari rumah sebelah merusak kabel yang tidak terlihat terbakar. Klaim bahwa satu motor di mulut gang menghalangi selang digelar.

Pemeriksaan ulang empat artikel lama terhadap sumbernya menemukan bahwa aturan isi dilanggar oleh artikel yang sudah terbit sejak tahap 13:

1. Artikel APAR memuat anjuran menaruh APAR di jalur keluar dan tidak di dekat kompor, serta batas api yang sudah menjalar ke langit-langit. Keduanya tidak ada di sumber BPBD DIY. Sumber itu justru memuat empat aturan pemasangan yang tidak ditulis: mudah terlihat dan dijangkau, menggantung dan terlindungi, tinggi paling banyak 1,2 meter, dan suhu ruangan antara 4 dan 49 derajat Celsius. Artikel ditulis ulang dengan empat aturan itu, dan batas penggunaan APAR diambil dari Damkar Kota Cirebon.
2. Artikel tabung gas memuat alasan yang tidak ada di sumber, klaim bahwa saklar lampu paling sering menjadi pemicu, dan bagian kalau api sudah besar tanpa sumber. Artikel juga melewatkan langkah dari sumber untuk memastikan api benar-benar mati, dengan ciri keluar asap putih. Artikel ditulis ulang, bagian kalau api sudah besar kini bersumber dari Damkar Kota Cirebon dan Pemprov DKI.
3. Artikel korsleting memuat anjuran memeriksa colokan yang terasa hangat saat dipegang dan penjelasan tentang instalasi bertegangan yang tidak ada di sumber. Artikel itu juga tidak memuat lima langkah saat korsleting terjadi dari sumber yang sama, termasuk larangan memadamkan dengan air dan busa. Artikel ditulis ulang dengan tujuh tips, delapan penyebab, dan lima langkah dari sumber.
4. Artikel relawan memuat klaim bahwa yang pertama memadamkan api hampir tidak pernah petugas dan bahwa setiap hidran memotong belasan gulung selang. Keduanya dicabut. Tahun data sumber, Januari 2022, kini disebut.

Kesalahan ini lolos karena uji artikel hanya memeriksa bahwa setiap artikel menampilkan daftar sumber, bukan bahwa setiap langkahnya ada di sumber itu. Pencocokan langkah dengan sumber tidak dapat diotomatiskan dengan andal, jadi dilakukan dengan membaca teks sumber yang diunduh.

Temuan lain:

1. Catatan di halaman daftar artikel menampilkan tanggal pembaruan artikel pertama menurut urutan kategori, bukan tanggal terbaru. Diperbaiki.
2. Tombol di halaman artikel berbunyi cetak satu halaman A4, padahal seluruh delapan artikel tercetak dua sampai tiga halaman. Label tombol diganti menjadi cetak artikel supaya sesuai dengan yang terjadi, sesuai Bagian B7. Rencana eksekusi meminta mode cetak satu halaman A4 dengan huruf yang lebih besar. Artikel terpendek pun setinggi sekitar 1.269 piksel pada mode cetak, sedangkan satu halaman A4 dengan margin 14 milimeter memuat sekitar 1.017 piksel. Memenuhi permintaan itu berarti memangkas isi artikel atau mengecilkan huruf, dan keputusannya diserahkan kepada pemilik repo.

Verifikasi: uji unit istilah lolos untuk kedelapan artikel. Spec artikel kini menghitung jumlah artikel dari folder, bukan angka tetap. Pemindaian aksesibilitas mencakup keempat artikel baru pada kelima lebar. Seluruh suite end to end lolos, 118 uji. Tangkapan layar kedelapan artikel dan halaman daftar pada tiga lebar ada di `bukti/f22/`.

### Tahap 21, cetak artikel satu halaman A4

Status catatan: dicatat saat tahap berjalan.

| Aspek | Isi |
| --- | --- |
| Prompt inti | Pemilik repo memilih opsi pertama dari tiga pilihan: versi cetak hanya memuat langkah inti, penjelasan disembunyikan |
| Dihasilkan AI | Pasangan versi cetak untuk kedelapan artikel, pemuat yang mewajibkan pasangan itu, gaya cetak, uji jumlah halaman |
| Diubah manual | Diisi setelah tinjauan pemilik repo |

Menyembunyikan bagian artikel per judul bagian tidak dipilih. Artikel menit-menit pertama versi lengkap setinggi 2.572 piksel dalam mode cetak, dan hampir seluruh bagiannya berisi langkah yang ditulis bersama nama lembaga dan alasannya, sehingga membuang bagian penjelas saja diperkirakan tidak akan mendekati batas satu halaman. Perkiraan ini tidak diukur terpisah. Karena itu setiap artikel diberi pasangan versi cetak di `src/content/artikel/cetak/`. Isinya hanya langkah yang sudah ada di artikel lengkap, dipadatkan tanpa menambah langkah baru, dan setiap pasangan dibaca ulang terhadap artikel lengkapnya. Pada pembacaan ulang itu, versi cetak korsleting sempat menulis perbarui instalasi lima tahun sekali sebagai perintah, padahal sumbernya menyebut disarankan. Kalimat itu dikembalikan menjadi saran.

Pemuat artikel gagal saat build bila ada artikel tanpa versi cetak atau versi cetak tanpa artikel. Layar tetap menampilkan artikel lengkap. Saat dicetak, halaman menampilkan versi inti, alamat versi lengkapnya, daftar sumber, dan ruang catatan pos RT. Ringkasan dan keterangan waktu baca disembunyikan karena tidak berguna di kertas. Garis kutipan larangan dicetak hitam, bukan merah, sesuai register dokumen sipil yang dirancang untuk difotokopi.

Hasil: kedelapan artikel tercetak tepat satu halaman A4. Artikel terpanjang setinggi 969 piksel dari batas sekitar 1.017 piksel. Percobaan pertama masih menghasilkan dua halaman untuk artikel itu, lalu tiga butir peringatan digabung menjadi satu kalimat, bagian tidak dapat keluar dijadikan satu butir, dan ringkasan disembunyikan saat dicetak.

Uji baru mencetak setiap artikel ke PDF dan menuntut tepat satu halaman, serta memastikan versi inti hanya muncul saat dicetak. Uji itu dibuktikan gagal dengan hasil dua halaman saat ringkasan dikembalikan ke cetakan. Label tombol cetak yang pada tahap 20 diganti menjadi cetak artikel dikembalikan menjadi cetak satu halaman A4, karena kini sesuai dengan yang terjadi.

Satu penyimpangan dari rencana eksekusi tetap ada. Rencana meminta ukuran huruf naik pada mode cetak, sedangkan versi inti dicetak 10,5 poin dan daftar sumber 8 poin supaya muat satu halaman. Muat satu halaman diutamakan karena itu yang dipilih pemilik repo.

Seluruh suite end to end lolos, 119 uji. Hasil cetak kedelapan artikel ada di `bukti/f22/` dengan awalan `cetak-`.

### Tahap 22, uji alur utama dari sisi juri di ponsel dan laptop

Status catatan: dicatat saat tahap berjalan.

| Aspek | Isi |
| --- | --- |
| Prompt inti | Menjalankan alur utama seperti juri, langsung di produksi, pada ukuran ponsel dan laptop |
| Dihasilkan AI | Skrip penelusuran alur, diagnosis empat temuan, perbaikan, spec end to end |
| Diubah manual | Diisi setelah tinjauan pemilik repo |

Alur yang dijalankan: beranda, buka lembar kerja, pilih bangunan, tetapkan titik api dan jalankan simulasi, taruh hidran uji coba, cari intervensi, kartu siaga RT, saring artikel, buka artikel, lalu halaman metode. Ponsel diuji dengan emulasi iPhone 13 beserta sentuhan, laptop pada 1440 piksel.

Empat temuan, tiga di antaranya bug nyata:

1. **Mode pilih lokasi di peta terbajak oleh klik pada gang.** Saat mode titik api aktif, klik yang mengenai garis gang memilih segmen dan memindahkan tab ke Akses, sehingga mode titik api ditinggalkan tanpa pemberitahuan. Saat mode hidran uji coba aktif, hal yang sama terjadi dan hidran tidak pernah tertaruh, padahal gang justru tempat yang wajar untuk menaruh hidran. Penanganan klik kini memeriksa mode yang sedang aktif lebih dulu, dan klik pada gang maupun bangunan diperlakukan sebagai pemilihan lokasi selama mode itu menyala.
2. **Peta di luar layar saat memilih lokasi di ponsel.** Tombol taruh hidran uji coba berada jauh di bawah panel. Setelah ditekan, labelnya berubah menjadi permintaan mengklik peta, padahal peta sudah tidak terlihat. Kini halaman menggulir peta kembali ke bawah kepala halaman ketika mode pilih lokasi menyala, dan tidak menggulir apa pun di layar lebar karena peta selalu terlihat di sana.
3. **Sasaran sentuh baris daftar terlalu kecil.** Tombol nomor segmen dan nomor bangunan di tab Daftar hanya 51,6 kali 11,5 piksel, di bawah batas 24 kali 24 piksel pada WCAG 2.2. Tombolnya kini setinggi minimal 24 piksel dan selebar kolomnya. Pemindaian aksesibilitas yang biasa tidak menangkap ini karena aturan ukuran sasaran hanya berjalan bila diminta, dan uji baru menjalankannya.
4. **Istilah node di hasil pencarian intervensi.** Label berbunyi titik APAR di node 8887, sedangkan panel lain memakai simpul jaringan. Diseragamkan.

Temuan lingkungan uji yang mengubah cara mengukur kinerja:

Pengukuran pertama menunjukkan layar terblokir 1.619 milidetik saat bangunan pertama dipilih, dan blokir itu tidak berkurang walau CPU diperlambat. Pemilihan berikutnya hanya 60 milidetik. Profil CPU hampir kosong, dan satu-satunya jejak adalah pemanggilan status program WebGL, yang menunjuk ke kompilasi shader. Percobaan memanaskan shader lebih awal hanya memindahkan blokir ke saat pemuatan, jadi dibatalkan.

Penyebab sebenarnya ada di alat uji. Peramban bawaan Playwright, yaitu headless shell, menggambar dengan SwiftShader, yaitu perender perangkat lunak, dan tidak mendukung `KHR_parallel_shader_compile`. Tanpa ekstensi itu luma.gl menautkan shader secara sinkron di utas utama. Chrome sungguhan pada mesin yang sama memakai GPU Metal dan mendukung ekstensi itu. Diukur ulang di Chrome ber-GPU pada produksi, pemilihan bangunan pertama hanya 136 milidetik dan membuka tab Air 77 milidetik.

Temuan yang sama juga menutup satu temuan terbuka dari tahap 17. Peringatan driver GPU `GPU stall due to ReadPixels` hanya muncul di headless shell. Di Chrome ber-GPU, konsol bersih sepenuhnya di seluruh alur ini.

Pelajaran yang dipakai selanjutnya: pengukuran kinerja yang menyentuh peta harus dijalankan di Chrome ber-GPU, bukan di peramban bawaan Playwright. Uji end to end tetap berjalan di peramban bawaan, karena yang diuji perilakunya, bukan kecepatannya.

Kesalahan yang dibuat pada tahap ini dan cara memperbaikinya:

1. Penelusuran pertama di ponsel melaporkan bahwa 80 ketukan pada peta tidak pernah memilih bangunan. Itu artefak skrip: ketukan berjarak 120 milidetik pada titik berdekatan dibaca MapLibre sebagai ketukan ganda, sehingga peta terus diperbesar sampai skala 5 meter. Setelah jeda ketukan diperpanjang, pemilihan berhasil pada ketukan ke-22.
2. Kegagalan menaruh hidran pada penelusuran pertama sempat dikira artefak skrip yang sama. Ternyata itu bug nomor 1 di atas, dan baru terbukti setelah klik diarahkan tepat ke piksel garis gang.
3. Aturan istilah untuk kata node sempat ditambahkan ke daftar terlarang, padahal berkas yang memuatnya tidak ikut dipindai uji istilah dan tidak bisa ditambahkan karena nama variabel di dalamnya akan ikut tertangkap. Aturan yang tidak berguna itu dicabut, dan perbaikan labelnya tetap.

Verifikasi: seluruh suite end to end lolos, 123 uji. Spec baru `tests/e2e/alur-juri.spec.ts` menguji keempat perbaikan dan dibuktikan gagal pada kode sebelum tahap ini. Tangkapan layar alur di ponsel dan laptop ada di `bukti/f23/`.

### Tahap 23, waktu peta pertama tergambar di ponsel dan jaringan 4G

Status catatan: dicatat saat tahap berjalan.

| Aspek | Isi |
| --- | --- |
| Prompt inti | Menguji target PRD bagian 4.2, yaitu peta pertama tergambar di bawah 3 detik, pada kondisi yang disebutkan target itu |
| Dihasilkan AI | Pengukuran piksel peta di ponsel dan 4G, tiga perubahan jalur kritis, uji penjaga |
| Diubah manual | Diisi setelah tinjauan pemilik repo |

Cara mengukur: emulasi iPhone 13 di Chrome ber-GPU, jaringan diperlambat ke preset 4G lambat dan 4G biasa, CPU empat kali lebih lambat. Waktu dihitung dari mulai navigasi sampai area peta benar-benar berisi piksel yang bukan latar, diperiksa lewat tangkapan layar berulang, bukan lewat peristiwa di kode.

Hasil awal: 4G lambat 12.314 milidetik, 4G biasa 2.169 milidetik. Target 3 detik gagal jauh pada 4G lambat.

Tiga penyebab ditemukan dan diperbaiki:

1. **Peta menunggu data yang tidak dibutuhkannya.** Kanvas peta baru dipasang setelah `dataset.meta` ada, dan itu menunggu `graph.json` 1,6 MB serta `buildings.bin` 424 KB selesai diunduh. Padahal sejak tahap 17 metadata wilayah, termasuk bounding box, sudah tersedia langsung dari modul. Peta kini digambar seketika, dan keadaan memuat berubah dari layar penuh menjadi penanda kecil di atas peta yang menyebut peta sudah bisa digeser sambil menunggu. Teks penandanya sengaja dipertahankan sama supaya uji yang menunggu teks itu hilang tetap berlaku.
2. **deck.gl ikut di jalur kritis.** Pustaka lapisan hanya dibutuhkan untuk gambar di atas peta, bukan untuk peta itu sendiri, tetapi ikut dalam bundel rute. Sekarang dimuat setelah peta tampil. Bundel rute peta turun dari 483 KB menjadi 306 KB setelah gzip.
3. **Huruf ikut dipramuat di rute peta.** Tiga berkas huruf 66 KB bersaing dengan bundel peta, padahal teks di layar peta sedikit. Pramuat huruf kini dilewati khusus rute peta. Pergeseran tata letak di rute itu tetap 0,0009, karena huruf cadangan bermetrik setara dari tahap 17 sudah menahannya.

| Ukuran | Sebelum | Sesudah | Target |
| --- | --- | --- | --- |
| Peta tergambar, 4G lambat | 12.314 ms | 5.485 ms | di bawah 3 detik |
| Peta tergambar, 4G biasa | 2.169 ms | 986 ms | di bawah 3 detik |

Angka di atas adalah waktu sampai piksel peta pertama muncul. Ubin peta mengalir bertahap, dan pada 4G lambat area peta baru terisi sekitar sepertiganya pada detik ke-12. Pengukuran di produksi setelah deploy: piksel pertama 5.026 milidetik, terisi 35 persen pada 12.133 milidetik. Sebelum perubahan, piksel pertama pun baru muncul pada detik ke-12, jadi yang berubah adalah kapan pengguna melihat peta, bukan kecepatan seluruh ubin tiba.

Target tercapai pada 4G biasa dan belum tercapai pada 4G lambat. Sisa waktunya didominasi unduhan MapLibre sendiri: 306 KB setelah gzip pada 157 KB per detik berarti sekitar dua detik, ditambah beberapa perjalanan bolak-balik untuk ubin peta pada latensi 562 milidetik. Menurunkannya lagi berarti mengganti pustaka peta atau menampilkan gambar statis lebih dulu sebagai pengganti peta, dan keduanya keputusan pemilik repo, bukan penyetelan kecil.

Uji penjaga baru memastikan jalur kritis rute peta tetap ramping: tidak ada huruf yang dipramuat di sana, dan tidak ada potongan yang memuat pustaka lapisan di antara berkas yang dipramuat. Uji ini dibuktikan gagal pada kode sebelum tahap ini.

Verifikasi: seluruh suite end to end lolos, 124 uji.

### Tahap 24, ubin peta yang lebih ramping

Lanjutan tahap 23: area peta pada 4G lambat baru terisi sepertiganya pada detik ke-12. Pertama dicoba penyederhanaan geometri di tippecanoe, dan hematnya kecil. Pemborosan sebenarnya ada di atribut. Aplikasi hanya membaca `buildingIndex` dan `segmentId` sebagai id fitur serta `accessClass` untuk warna gang, sementara ubin ikut membawa lebar, panjang, tinggi, luas, dan material yang sudah ada di `graph.json` dan `buildings.bin`.

Pipeline kini memanggil tippecanoe dengan `--include accessClass` untuk gang dan `--exclude-all` untuk bangunan. Geometri tidak berubah, jadi tidak ada detail peta yang hilang.

| Ukuran | Sebelum | Sesudah |
| --- | --- | --- |
| Berkas ubin gang | 2.774.646 bita | 904.646 bita |
| Berkas ubin bangunan | 3.990.074 bita | 1.575.132 bita |
| Area peta terisi 35 persen, 4G lambat, produksi | 12.133 ms | 11.121 ms |
| Piksel peta pertama, 4G lambat, produksi | 5.026 ms | 5.070 ms |

Hasilnya jujur kecil: sekitar satu detik. Berkas yang diunduh di tampilan awal memang lebih sedikit, tetapi pada latensi 562 milidetik waktunya didominasi jumlah perjalanan bolak-balik permintaan ubin, bukan ukurannya. Target 3 detik pada 4G lambat tetap belum tercapai dan alasannya tidak berubah dari tahap 23.

Verifikasi: uji peta, koreksi lapangan, dan alur juri membuktikan klik gang, klik bangunan, dan warna kelas gang tetap bekerja tanpa atribut yang dicabut. Seluruh suite end to end lolos, 124 uji.

### Tahap 25, hasil titik henti di layar pertama ponsel

Temuan tahap 22 menyebut panel detail di ponsel tertutup di bawah layar setelah bangunan dipilih. Pengukuran di iPhone 13 menunjukkan masalahnya lebih sempit dari itu. Panjang selang sudah tampil di atas peta lewat penggaris selang. Yang tertutup adalah isi tab Titik henti sendiri: tab itu membuka dengan detail bangunan, sehingga judul hasilnya ada di piksel 864 dan tambahan waktu sebelum air sampai sekitar dua layar ke bawah, padahal tinggi layar 664.

Dua perubahan:

1. **Hasil lebih dulu.** Di tab Titik henti, panel titik henti kendaraan kini di atas detail bangunan. Judulnya turun ke piksel 536, bilah panjang selang masuk layar pertama, dan tambahan waktu ada tepat di bawah batas layar. Gulir otomatis sengaja tidak dipakai, karena akan menarik layar menjauh dari penggaris selang yang sedang menggambar dirinya di peta.
2. **Panel dibuka dari atas.** Di laptop, panel kerja punya gulir sendiri dan posisinya terbawa saat berganti tab, sehingga membuka Titik henti setelah menggulir Daftar memotong judul hasil. Posisi gulir panel kini kembali ke atas setiap kali tab berganti.

Satu kesalahan saat menulis uji: uji gulir panel pertama kali lolos pada kode yang belum diperbaiki, karena tanpa bangunan terpilih isi tab terlalu pendek untuk digulir. Uji diperbaiki dengan memilih bangunan lebih dulu, lalu dibuktikan gagal pada kode lama. Uji urutan panel juga dibuktikan gagal pada urutan lama.

Verifikasi: tangkapan layar 380, 768, dan 1440 di `bukti/titik-henti-hp/`, konsol bersih, tanpa gulir mendatar. Seluruh suite end to end lolos, 126 uji.

### Tahap 26, monospasi hanya untuk angka terukur di baris panel

Sisa temuan tahap 19: komponen `ValueRow` memakai monospasi untuk semua nilai, padahal B3 menguncinya untuk meter dan detik. Di panel detail bangunan, teks seperti Semi permanen dan Perkiraan pun tampil sebagai huruf mesin ketik.

`ValueRow` kini punya penanda `measured`. Sembilan belas baris ditandai terukur: panjang, lebar, luas, kecepatan, waktu, dan koordinat, dengan koordinat mengikuti keputusan tahap 18 bahwa koordinat adalah hasil ukur. Baris lain memakai utilitas baru `tally`, yaitu huruf isi dengan ukuran dan berat yang sama serta angka rata kolom.

Yang sengaja belum disentuh: angka hitungan besar di luar baris panel, misalnya jumlah bangunan terbakar di tab Api, angka ringkasan beranda, dan kartu siaga RT. Semuanya masih monospasi. Mengubahnya menggeser rupa angka utama di seluruh produk, jadi itu keputusan pemilik repo.

Uji baru memeriksa huruf hasil hitung peramban pada baris terukur dan tidak terukur, dan dibuktikan gagal pada komponen lama. Tangkapan layar di `bukti/monospasi-terukur/`, konsol bersih, tanpa gulir mendatar. Seluruh suite end to end lolos, 127 uji.

### Tahap 27, huruf cetak artikel membesar

Rencana F9 meminta mode cetak dengan huruf membesar, sementara versi cetak memakai 10,5 pt, lebih kecil dari huruf layar yang 1rem atau 12 pt. Isi cetak kini 13 pt dengan jarak baris 1,35, judul bagian 14 pt.

Menaikkan huruf membuat satu artikel, menit-menit pertama saat api muncul, meluber ke halaman kedua. Isinya langkah keselamatan dari sumber resmi, jadi yang dipangkas adalah tata letak, bukan langkah: margin halaman 14 mm menjadi 12 mm, jarak atas judul bagian dirapatkan, garis tulis tangan dari enam menjadi tiga, dan tautan sumber dicetak di baris yang sama dengan nama lembaganya. Varian yang dicoba lebih dulu, 12 pt, 12,5 pt, dan 13 pt dengan jarak baris 1,4, semuanya tetap dua halaman untuk artikel itu.

Sisa ruang artikel terpanjang hanya sekitar 18 piksel. Artikel lain bersisa 260 sampai 500 piksel, sehingga artikel pendek kini punya ruang kosong di bawah tiga garis tulis. Uji satu halaman A4 yang sudah ada akan gagal bila artikel terpanjang bertambah satu baris.

Uji baru memastikan huruf isi cetak lebih besar dari huruf isi layar, dan dibuktikan gagal pada gaya lama (14 piksel lawan 16 piksel). PDF dan gambar A4 artikel terpanjang dan terpendek disimpan di `bukti/cetak-artikel/`. Seluruh suite end to end lolos, 128 uji.

## Yang tidak dikerjakan AI

Penentuan masalah, pemilihan wilayah uji, penyusunan PRD, arah desain, pengukuran lapangan dengan meteran, dan keputusan lingkup fitur adalah pekerjaan manusia. AI tidak menentukan apa yang dibangun, hanya membantu membangunnya.
