# Hasil pengujian — 23 Oktober 2026

Lingkungan: Windows, Google Chrome 147.0.7727.138, Playwright, profil browser pengujian terpisah. Tidak memakai akun atau sesi Dataquest pengguna.

## Penerjemah Chrome asli

Penerjemah `Translator` asli dipanggil dari klik tombol di halaman extension. Paket Inggris → Jepang berhasil diunduh hingga 100%.

- Input: `Group your data by category.`
- Output: `データをカテゴリ別にグループ化します。`

Pengujian tambahan membuka mirror lengkap dengan penerjemah asli, menerjemahkan pelajaran demo, dan memeriksa:

- Judul `From rows to insight.` menjadi `行から洞察へ。`.
- Halaman Inggris asli tetap tidak berubah.
- Blok kode tetap identik dengan aslinya.
- Klik tombol petunjuk pada mirror membuka petunjuk pada halaman asli.

Gambar pratinjau yang disertakan di luar folder extension berasal dari sesi penerjemah asli ini.

## Pengujian integrasi: 21 pemeriksaan lulus

Suite ini memakai penerjemah pengganti yang deterministik untuk menguji DOM dan event tanpa bergantung pada hasil bahasa atau unduhan model. Penerjemah pengganti hanya ada dalam skrip pengujian, tidak ada di extension yang dikirim.

1. Popup memiliki pilihan awal Inggris → Jepang.
2. Snapshot halaman tampil di sandbox mirror.
3. Jendela terjemahan ada di kiri dan halaman asli di kanan.
4. Hasil penerjemahan diterapkan pada teks.
5. Blok kode dan halaman asli dipertahankan.
6. Scroll halaman asli diteruskan ke mirror.
7. Scroll mirror diteruskan ke halaman asli.
8. Klik tombol di mirror memperbarui halaman asli dan hasilnya kembali tampil.
9. Kontrol native `details/summary` bekerja melalui mirror.
10. Jawaban diklik tepat satu kali dan feedback diterjemahkan.
11. State checkbox mengikuti halaman asli.
12. Teks yang diketik pada sumber tampil sebagai input baca saja di mirror.
13. Panel scroll di dalam halaman tersinkron dua arah.
14. Sinkronisasi klik dapat dimatikan.
15. Sinkronisasi scroll dapat dimatikan.
16. Skrip, handler inline, password, dan iframe aktif tidak masuk ke salinan.
17. Navigasi penuh pada origin yang sama tersambung kembali.
18. Koneksi runtime tersambung kembali setelah port diputus.
19. Bahasa bisa diganti dan pengaturan tersimpan.
20. Sesi berakhir dan ukuran jendela asli pulih.
21. Tidak ada uncaught page error.

Semua file JavaScript juga lolos `node --check`.

## Pembaruan 0.2.0: furigana

Pengujian browser memakai **penerjemah Chrome asli dan kamus Kuromoji asli**, tanpa pengganti untuk furigana. Semua pemeriksaan berikut lulus:

- Popup mengaktifkan furigana secara default.
- Hasil terjemahan Jepang diberi ruby dengan bacaan hiragana.
- `学習` memperoleh bacaan `がくしゅう` dari kamus lokal.
- Mematikan/menyalakan furigana mempertahankan teks Jepang dan menyimpan pengaturannya.
- Tidak muncul ruby bersarang setelah pergantian mode dan pembaruan DOM.
- Blok kode tetap identik dan tidak diberi ruby.
- Klik pada bacaan `rt` meneruskan aksi ke tombol asli.
- Teks yang berisi markup literal tetap menjadi teks dan tidak menjadi elemen HTML aktif.
- Opsi furigana disembunyikan ketika bahasa target diganti dari Jepang.

Suite 21 pemeriksaan sebelumnya juga dijalankan ulang dengan furigana dimatikan untuk memeriksa regresi pada perilaku dasar. Akurasi bacaan untuk semua kanji, nama, dan konteks tidak dijamin oleh pengujian ini.

## Pembaruan 0.3.0: konteks kalimat dan hover pilihan

Kasus pengguna direproduksi dengan model Chrome asli. Input potongan `When we give instructions to a computer, it's called ` menghasilkan `コンピュータに指示を出すと、それは と呼ばれます`. Input kalimat utuh beserta kata tebal menempatkan `プログラミング` sebelum `と呼ばれます`.

Pengujian browser tambahan memakai penerjemah asli dalam kedua arah dan memeriksa:

- Kalimat pengguna diterjemahkan utuh dan kata tebal dipertahankan di posisi Jepang yang benar.
- Penanda `&#x20;` tidak tertinggal dalam tampilan, dan inline code tetap identik.
- Output berisi script ditolak. Atribut/URL dari output model tidak disalin; elemen asli yang sudah disanitasi dipakai kembali.
- Seleksi kata dilakukan dengan mouse. Tooltip hanya menerjemahkan `プログラミング` menjadi `Programming`, dan penghitung klik halaman asli tetap nol.
- Menjauhkan pointer menutup tooltip seleksi dan mengembalikan tooltip hover biasa.
- Pilihan melintasi ruby tidak menyertakan furigana.
- Pilihan melintasi paragraf mempertahankan batas kalimat.
- Escape menutup tooltip dan menghapus pilihan.
- Tautan inline hasil terjemahan tetap mengarah ke elemen asli dan diklik tepat satu kali.
- Tidak ada uncaught browser error.

Suite 21 pemeriksaan dasar juga lulus kembali setelah perubahan pengelompokan kalimat. Tes ini memverifikasi regresi yang dilaporkan dan perilaku UI; kualitas semua kalimat tidak dijamin setara dengan Google Translate.

## Perbaikan 0.3.1 — 25 Oktober 2026

Kalimat dari screenshot pengguna direproduksi persis: `All of the applications mentioned above have something in common: They were all built with the support of Python.`, dengan bagian kedua di dalam elemen tebal. Sebelum perbaikan, tes gagal karena kalimat Inggris dan terjemahan Jepangnya muncul bersamaan.

Setelah perbaikan, pengujian dengan penerjemah Chrome asli memverifikasi:

- Paragraf yang sama hanya menampilkan terjemahan Jepang, tanpa duplikat prosa Inggris.
- Kegagalan format dipaksakan secara terpisah; retry memakai model asli dan tetap mengganti paragraf sumber.
- Kode `print("hello")` dipertahankan tepat satu kali, tanpa meninggalkan kalimat Inggris di sekitarnya.
- Tautan pada bagian yang memakai retry tetap menjalankan aksi tautan asli.
- Halaman sumber tidak berubah dan markup model yang berisi script tidak dijalankan.

Kasus paksa hanya mengganti hasil model untuk permintaan berformat; terjemahan ulang teks biasa tetap memakai penerjemah asli. Ini memeriksa jalur kegagalan secara sengaja, bukan hanya hasil saat format berhasil.

## Perbaikan 0.3.2 — tampilan stabil, 25 Oktober 2026

Tes render memakai penerjemah deterministik dengan jeda 160 ms per permintaan dan mengambil sampel tampilan pada setiap `requestAnimationFrame`. Sebelum perbaikan, tes gagal karena teks Inggris sempat terpasang pada frame yang terlihat.

Setelah perbaikan, tes memeriksa:

- Pemuatan awal tidak menampilkan teks sumber sebelum terjemahan siap.
- Snapshot identik mempertahankan dokumen dan node yang sama.
- Versi Jepang sebelumnya tetap terlihat selama terjemahan baru dipersiapkan.
- Klik pada konten lama tidak diteruskan ke isi halaman asli yang sudah berubah.
- Pembaruan cepat hanya menampilkan hasil terbaru.
- Pembaruan yang dibatalkan tidak mengganti tampilan yang sudah benar.
- Kegagalan penerjemahan mempertahankan versi Jepang terakhir.
- Retry berhasil menampilkan hasil siap pakai dan mempertahankan posisi scroll independen.
- Tidak ada uncaught browser error dari dokumen persiapan atau pergantian frame.

Penerjemah pengganti hanya dipakai untuk mengendalikan jeda/kegagalan dan menguji tampilan. Pemeriksaan penerjemah Chrome asli, furigana, tooltip pilihan, paragraf dari screenshot, serta suite interaksi dijalankan terpisah.

## Perbaikan 0.3.3 — popover teks panjang

Popover hover biasa dan terjemahan pilihan memakai wilayah isi yang dapat digulir. Batas tinggi yang menyembunyikan sisa teks sumber/hasil dihapus. Pointer dapat masuk ke popover untuk membaca, memilih teks, atau menggulirnya; tombol tutup dan Escape tetap tersedia.

Tes UI memakai hasil terjemahan deterministik agar panjang teks dan penanda kata terakhir dapat diperiksa tepat. Semua pemeriksaan berikut lulus:

- Teks asli sepanjang beberapa ribu karakter tetap utuh pada ukuran viewport 683×403, 360×430, dan 1000×300.
- Popover tidak melewati batas layar, termasuk saat pemicu hover berada di dekat sudut bawah.
- Pointer yang masuk ke popover tidak membuatnya langsung tertutup.
- PageDown menggulir isi; kata terakhir benar-benar berada dalam area baca setelah menggulir ke akhir.
- Teks pilihan Jepang dan hasil terjemahan panjang keduanya utuh, tanpa batas 90/220 piksel yang memotong isi.
- Escape menutup popover ketika area isi sedang memiliki fokus.
- Tidak ada uncaught browser error.

Untuk otomatisasi, salinan manifest uji diberi izin **localhost saja**, agar pengujian dapat memanggil popup tanpa mengoperasikan tombol toolbar browser. Manifest yang dikirim tetap hanya memakai `activeTab`, `scripting`, dan `storage`, tanpa `host_permissions`.

## Perbaikan 0.3.4 — format kode inline dan shortcut

Kasus dari screenshot direproduksi dengan paragraf lengkap yang memuat `print("Hello World")`, `Hello World`, `Shift + Enter`, `Alt + Enter`, dan `Ctrl + /`, serta teks tebal pada `code editor` dan `Run Code`. Sebelumnya, model dapat merusak atribut penanda HTML dan mengubah huruf besar/kecil kode. Jalur fallback kemudian meratakan format paragraf.

Penanda utama sekarang memakai tag bernomor tanpa atribut. Retry memakai penanda HTML pendek yang berbeda, termasuk alias `b` untuk `strong`; elemen akhir selalu dikembalikan dari salinan sumber yang telah disanitasi. Tidak ada fallback yang meratakan seluruh paragraf menjadi teks biasa.

`tests/format-preservation.cjs` dijalankan dengan respons deterministik dan secara terpisah dengan penerjemah lokal Chrome asli, Inggris → Jepang, serta furigana aktif. Keduanya lulus tujuh kelompok pemeriksaan:

- Kode dan shortcut identik, termasuk kapitalisasi, tag, kelas, susunan anak, font, warna, latar, padding, dan radius sudut. Kode tetap di posisi kalimatnya, tidak dikumpulkan di akhir paragraf. Teks tebal dipertahankan dan prosa Inggris diganti. Kode tidak diberi ruby; blok kode tidak berubah.
- Penanda yang hilang, berulang, memakai tag salah, atau menyisipkan script ditolak. Atribut/URL dari model diabaikan. Isi kode yang diubah model diganti dengan kode asli.
- Kerusakan penanda utama dipaksakan pada semua paragraf berformat. Retry tetap memakai model asli pada mode native dan mempertahankan seluruh format. Kasus lama `All of the applications mentioned above...` juga diperiksa agar tidak meninggalkan prosa Inggris.
- Tautan setelah retry mempertahankan label terjemahannya serta target aslinya dan menjalankan tepat satu klik pada sumber.
- Jika kedua penanda dipaksa gagal, dokumen Jepang terakhir tetap terlihat tanpa meratakan kode.
- Percobaan berikutnya berhasil tanpa mengulang hasil rusak dari cache.
- Markup halaman sumber tidak berubah dan tidak ada uncaught browser error.

Untuk menjalankan mode native, set `KOTOBA_NATIVE_TRANSLATOR=1`, lalu jalankan `npm run test:format`. `KOTOBA_TEST_PROFILE` dapat menunjuk profil uji khusus dengan model yang sudah diunduh. Mode native membutuhkan Chrome dengan Translator API dan paket bahasa yang tersedia. Suite popover dan render stabil juga dijalankan kembali. Sepuluh pemeriksaan terpisah dengan model asli turut lulus: konteks kalimat `programming`, seleksi mouse, furigana yang dikecualikan dari pilihan, tooltip, tautan, dan keamanan markup.

## Perbaikan 0.3.5 — situs Jepang dan rumus matematika

Masalah direproduksi langsung di `https://onlinemathcontest.com/contests/omcb086/tasks/12532` dengan bahasa sumber `ja` dan target `en`, memakai penerjemah lokal Chrome asli. Versi 0.3.4 berhenti dengan pesan `Format asli belum dapat dipertahankan`. Paragraf pertama mengirim 21 penanda bertingkat dari HTML dan MathML KaTeX; angka konteks seperti `2` terbaca sebagai `22` karena lapisan visual dan aksesibilitas digabung.

Setelah perbaikan, rumus KaTeX menjadi satu slot yang dilindungi, dengan satu representasi TeX untuk konteks. MathJax dan MathML juga dipertahankan sebagai satu subtree sumber. Halaman OMC yang sama berhasil mencapai status terhubung dan menampilkan kalimat soal berbahasa Inggris. Seluruh 11 subtree KaTeX identik dengan sumber, dan paragraf sumber tidak berubah. Pemeriksaan ini memakai halaman publik tanpa login, tidak mengirim jawaban.

`tests/math-translation.cjs` memeriksa:

- Dropdown Jepang → Inggris serta pratinjaunya sesuai, prosa diterjemahkan, dan seluruh subtree rumus identik dengan sumber.
- Satu rumus KaTeX menghasilkan satu slot tanpa pengulangan angka dari MathML dan HTML.
- Kerusakan penanda dipaksakan dan retry tetap mempertahankan KaTeX, SVG MathJax, serta MathML.
- Perubahan dropdown target ke Indonesia memanggil pasangan `ja` → `id` dan menampilkan teks Indonesia.
- Markup sumber tidak berubah dan tidak ada uncaught browser error.

Semua pemeriksaan tersebut lulus dengan penerjemah deterministik. Mode `KOTOBA_NATIVE_TRANSLATOR=1` turut lulus untuk arah Jepang → Inggris, preservasi rumus, serta halaman sumber yang tidak berubah. Tes UI target Indonesia memakai respons deterministik untuk memeriksa pemilihan pasangan bahasa; bukan penilaian kualitas model Jepang → Indonesia.

Pengujian ini tidak membuktikan kompatibilitas dengan semua situs, kontrol khusus, atau akun Dataquest yang memerlukan login. Batas kompatibilitas tercantum di README.
