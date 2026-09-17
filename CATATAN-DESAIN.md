# Catatan desain

Catatan ini merekam kritik diri terhadap tampilan Titik Henti: apa yang diperiksa, apa yang dicabut, apa yang sengaja dipertahankan, dan alasannya. Rujukannya Bagian B di `CLAUDE.md`, terutama tesis B0, palet B2, tipografi B3, dan daftar larangan B6.

## Cara memeriksa

Setiap halaman difoto pada lebar 380, 768, dan 1440 piksel: beranda, lembar kerja, kartu siaga RT, daftar artikel, keempat artikel, dan metode. Lembar kerja juga difoto dalam tiga keadaan, yaitu tab Akses, tab Air, dan tab Api setelah simulasi api selesai. Seluruh tangkapan layar ada di `bukti/f16/`.

Setiap foto diperiksa satu per satu terhadap sepuluh larangan B6. Luas warna alarm dihitung dari piksel, bukan ditaksir dengan mata.

## Luas warna alarm

Arah desain membatasi merah alarm sekitar sepersepuluh luas satu layar. Hasil ukur setelah perbaikan, diambil dari layar dengan merah terbanyak di tiap halaman:

| Halaman | 380 px | 768 px | 1440 px |
| --- | --- | --- | --- |
| Beranda | 0,83 % | 0,25 % | 0,20 % |
| Lembar kerja, tab Akses | 2,6 % | 3,2 % | 2,5 % |
| Lembar kerja, tab Api tanpa api | 0 % | 0 % | 0 % |
| Artikel tabung gas bocor | 0,29 % | 0,06 % | 0,04 % |
| Kartu siaga RT, daftar artikel, metode | 0,01 % | 0 % | 0 % |

Tidak ada layar yang mendekati batas. Butir ini tidak memaksa pencabutan apa pun, tetapi pengukurannya membuka masalah lain yang dicatat di bawah.

Satu kesalahan ukur perlu dicatat. Pengukuran pertama hanya menghitung piksel yang mirip persis dengan `#D6202A` dan menghasilkan 0,16 persen untuk peta pada 380 piksel, padahal foto yang sama terlihat didominasi garis merah. Garis gang yang tipis di atas latar gelap tercampur dengan warna latar, sehingga warnanya bergeser jauh dari hex aslinya. Setelah penghitungan diganti ke rona merah, angka yang sama menjadi 2,4 persen, lima belas kali lebih besar. Uji permanen memakai penghitungan rona.

## Yang dicabut

### 1. Merah kelas gang selang saja di tab Api

Di tab Akses, garis gang kelas selang saja berwarna merah, dan itu sah karena gang itu memang kategori bahaya. Masalahnya muncul di tab Api. Tangkapan layar setelah simulasi menunjukkan bangunan yang menyala tenggelam di antara ribuan garis gang yang sama merahnya. Luas merahnya tidak melanggar batas, tetapi melanggar tesis B0 secara langsung: merah yang muncul di tempat lain melemahkan merah yang muncul saat api menjalar.

Di tab Api, warna kelas gang kini diredam menjadi tiga tingkat abu. Kelas tetap terbaca dari tebal garis dan terang gelapnya, dan legenda menyatakan bahwa warna sedang diredam. Sebelum perubahan, tab Api memakai warna kelas yang sama persis dengan tab Akses, yaitu 2,5 persen merah pada 1440 piksel. Sesudahnya, tab Api tanpa api berisi nol piksel merah pada ketiga lebar, jadi merah yang muncul kemudian hanya bangunan yang menyala.

### 2. Kotak merah di tanda nama produk

Tanda di kepala halaman berisi kotak kecil merah yang tidak mewakili apa pun. B2 menyatakan alarm tidak pernah dekoratif, dan kotak itu tampil di setiap halaman, termasuk artikel yang tidak membahas api sama sekali. Kotaknya dicabut, tanda tetap hitam.

### 3. Tanda potong di kartu angka beranda dan legenda peta

Ini elemen murni hiasan yang dipilih untuk dicabut. Tanda potong adalah dua siku kecil di pojok, meniru tanda potong pada lembar cetak. Di beranda, tanda itu hanya menempel pada satu dari empat kartu angka, jadi pembaca yang memperhatikannya malah mencari arti yang tidak ada. Uji penghapusan B0 jelas: setelah dicabut, tidak ada informasi yang hilang. Utilitas CSS-nya ikut dibuang.

Hiasan lain yang dipertimbangkan tetapi dipertahankan tercatat di bagian berikutnya.

### 4. Penomoran daftar batasan di halaman metode

Enam batasan model diberi nomor 01 sampai 06, padahal urutannya tidak bermakna. Ini persis larangan B6 nomor 9. Nomornya dicabut.

### 5. Hitam bersemu

Token `ink-deep` bernilai `#0D0D0F` dipakai sebagai isian kotak rantai sebab akibat di beranda dan latar wadah peta. Latar peta sendiri bernilai `#101013`. Keduanya jenis hitam pengganti yang dilarang B6 nomor 3. Keduanya diganti `ink`, dan token `ink-deep` dihapus. Kotak rantai kini hanya bergaris tepi di atas latar `ink`.

### 6. Nomor revisi fiktif

Kepala halaman menulis Pra-rencana, revisi 0.1. Nomor revisi itu tidak terhubung ke apa pun: tidak ada riwayat revisi dan angkanya tidak pernah berubah. Bagian Pra-rencana tetap dipertahankan karena memberi tahu bahwa lembar ini bukan rencana resmi, sehingga teksnya menjadi Pra-rencana, bukan dokumen resmi.

### 7. Monospasi di luar angka terukur

B3 mengunci monospasi hanya untuk meter dan detik. Monospasi ternyata juga dipakai untuk kode lisensi di halaman metode dan catatan data peta, tanggal olah dan versi pipeline di kartu siaga RT, serta nomor urut tahap. Semuanya dipindah ke huruf isi. Koordinat di kartu siaga RT tetap monospasi karena koordinat adalah hasil ukur dan perlu rata kolom.

## Yang diperbaiki karena rusak, bukan karena selera

1. Pada lebar 380 piksel, keempat angka ringkasan di kartu siaga RT bertumpuk sampai tidak terbaca. Kartu dirancang untuk A4, dan kisinya dipaksa empat kolom di layar apa pun. Kisi kini dua kolom di layar sempit dan tetap empat kolom saat dicetak.
2. Pada lebar 1024 piksel ke atas, legenda peta berada di luar layar pertama. Isi panel samping memanjangkan seluruh lembar kerja menjadi 1.147 piksel, jadi legenda di pojok bawah peta tidak pernah terlihat tanpa menggulir. Lembar kerja kini setinggi layar dan panel samping bergulir sendiri, seperti yang sejak awal dimaksudkan kodenya.
3. Perbaikan nomor 2 langsung ditangkap pemindaian aksesibilitas: panel yang kini benar-benar bergulir tidak dapat dijangkau papan ketik. Panel kini menjadi wilayah berlabel yang dapat difokus, tetapi hanya selama isinya memang melebihi tinggi panel, supaya tidak ada perhentian Tab yang kosong.
4. Daftar pembaca artikel ditulis Warga dan Pengurus RT dan Relawan. Kini Warga, Pengurus RT, dan Relawan.
5. Teks atribusi sumber ubin peta memakai titik tengah sebagai pemisah, larangan B6 nomor 6. Kontrol atribusi bawaan peta dimatikan sehingga teks ini saat ini tidak tampil, tetapi akan tampil begitu kontrol itu dinyalakan. Diganti koma.

## Yang sengaja dipertahankan

1. **Penomoran rantai sebab akibat di beranda.** Delapan tautan itu benar-benar urutan: lebar gang menentukan kelas akses, kelas akses menentukan posisi titik henti, dan seterusnya. Nomornya membawa informasi.
2. **Penomoran tahap pipeline di halaman metode.** Tahapnya dijalankan berurutan.
3. **Nomor bagian 01 sampai 07 di kartu siaga RT.** Bagian kartu bukan urutan, tetapi nomornya dipakai sebagai rujukan. Catatan kaki kartu menyebut tabel 02, dan orang yang membaca kartu yang sudah difotokopi lewat telepon perlu cara menyebut bagian. Nomor ini alat rujuk, bukan hiasan.
4. **Kisi kertas milimeter di bagian pembuka beranda.** Uji penghapusan tidak kehilangan informasi. Kisi ini tetap dipertahankan karena satu-satunya penanda register jurnalisme data yang diminta B0b untuk beranda, dan kisinya hanya ada di satu bagian itu. Kalau harus mencabut satu hiasan lagi, ini kandidat berikutnya.
5. **Angka 57,2 persen berwarna merah di beranda.** Angka itu adalah bagian jaringan gang yang tidak dapat dilalui kendaraan pemadam, jadi merahnya menandai bahaya, bukan aksen.
6. **Merah kelas gang di tab Akses.** Di tab itu tidak ada api yang bersaing, dan kelas selang saja adalah kategori bahaya.

## Yang dicoba dan dibuang

1. Panel samping yang bergulir sempat dijadikan elemen `section`. Pemilih uji papan ketik `aside section` lalu menangkap dua elemen sekaligus, panel dan seksi di dalamnya, dan uji alur tanpa tetikus gagal. Karena panel memang wilayah, bukan seksi isi, panel dikembalikan menjadi `div` dengan peran wilayah.
2. Uji tumpukan angka kartu siaga RT versi pertama mengukur kotak elemen. Uji itu lolos pada kode yang rusak, karena kotak elemennya tidak bertumpuk, yang meluber hanya teksnya. Uji kini mengukur batas teks sebenarnya dan terbukti gagal pada kode lama.
3. Panel samping dengan `tabindex` statis. Svelte menolaknya dengan peringatan aksesibilitas, dan aturan repositori menuntut nol peringatan. Nilai `-1` menghilangkan peringatan tetapi tidak membuat panel dapat dijangkau Tab, jadi tidak menyelesaikan masalahnya.

## Temuan terbuka

Halaman lembar kerja memunculkan peringatan driver GPU `GPU stall due to ReadPixels` sekali per proses browser. Peringatan ini sudah ada sebelum pemeriksaan desain, dan instrumentasi tidak menemukan panggilan pembacaan piksel dari JavaScript halaman. Penyebab pastinya belum ditemukan. Rinciannya ada di tahap 17 `AI-USAGE.md`.
