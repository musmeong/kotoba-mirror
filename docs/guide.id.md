# Kotoba Mirror

Extension Chrome untuk belajar dari satu halaman dalam dua bahasa. Terjemahan tampil di jendela kiri, halaman asli di jendela kanan. Pilihan awal: Inggris → Jepang.

Versi **0.3.3** menambahkan popover yang dapat digulir untuk teks panjang, baik saat hover paragraf maupun saat memilih teks. Tampilan stabil, furigana, dan sinkronisasi tetap tersedia.

## Pasang dalam satu menit

1. Ekstrak `kotoba-mirror.zip` ke folder permanen. Jangan hapus folder ini sesudah dipasang.
2. Buka `chrome://extensions` di Google Chrome desktop.
3. Nyalakan **Developer mode / Mode pengembang** di kanan atas.
4. Klik **Load unpacked / Muat yang belum dipaketkan**.
5. Pilih folder **kotoba-mirror** yang langsung berisi `manifest.json`.
6. Pin Kotoba Mirror lewat ikon puzzle di toolbar Chrome agar mudah dibuka.

Tidak perlu Node.js, npm, API key, atau akun baru untuk memakai extension. Ini paket lokal yang dipasang manual, belum dipublikasikan ke Chrome Web Store.

## Mulai belajar

1. Buka dan login ke situs belajar seperti biasa. Untuk Dataquest, buka halaman materi pelajarannya terlebih dahulu.
2. Klik ikon **Kotoba Mirror** pada tab itu.
3. Pilih bahasa asli dan bahasa belajar. Default: **English → 日本語 — Jepang**.
4. Klik **Buka kiri–kanan**. Jendela Chrome asli akan dipindahkan ke kanan; mirror terbuka di kiri.
5. Di jendela kiri, klik **Aktifkan terjemahan Jepang**. Pada pemakaian pertama, tunggu paket bahasa selesai diunduh. Internet diperlukan saat mengunduh paket.
6. Baca, scroll, dan klik dari salah satu sisi. Perubahan halaman asli tampil di mirror. Arahkan mouse ke teks terjemahan untuk melihat teks aslinya sebagai tooltip.
7. Gunakan editor, kolom jawaban, dropdown, unggah file, dan pemutar media di **halaman asli sebelah kanan**. Blok kode tetap dalam bahasa aslinya.
8. Klik **Selesai**, atau tutup jendela mirror, untuk mengakhiri sesi dan memulihkan posisi serta ukuran jendela Chrome asli.

Kotak **Scroll** dan **Klik** dapat mematikan masing-masing sinkronisasi. Tombol **↻** mengambil ulang tampilan halaman, tanpa memuat ulang situs aslinya. Saat mengganti bahasa di mirror, klik tombol aktivasi lagi.

## Blok teks lalu hover

1. Di **jendela terjemahan sebelah kiri**, blok kata, frasa, atau kalimat yang ingin diketahui artinya.
2. Arahkan pointer ke teks yang masih diblok. Setelah jeda singkat, tooltip menampilkan arti **pilihan itu saja** dalam bahasa asli. Contoh Jepang → Inggris: `プログラミング` → `Programming`.
3. Arahkan pointer ke dalam popover untuk membaca atau menggulir teks panjang. Gunakan scrollbar, roda mouse, atau fokuskan isi popover lalu tekan PageDown.
4. Klik **×** atau tekan **Esc** untuk menutup. Saat pointer menjauh, popover juga akan menutup setelah jeda singkat.

Furigana tidak ikut dikirim sebagai bagian dari teks pilihan. Memblok teks tidak meneruskan klik ke halaman asli. Pilihan dapat mencakup beberapa paragraf; batas paragraf tetap dipisahkan. Batas panjang pilihan adalah 2.000 karakter. Blok kode dan input tidak masuk ke fitur ini.

Penerjemah balik berjalan lokal di Chrome. Pada penggunaan pertama, Chrome mungkin perlu menyiapkan paket bahasa balik saat kamu selesai memilih teks. Arti frasa adalah **terjemahan ulang**, sehingga tidak selalu identik dengan kata-kata persis pada kalimat Inggris aslinya. Hover biasa tanpa pilihan juga memakai popover yang menampilkan teks asli secara utuh. Popover mengikuti batas layar dan tetap terbuka saat pointer berada di dalamnya; teks panjang dapat digulir sampai akhir.

## Perbaikan konteks terjemahan

Versi lama mengirim setiap text node secara terpisah. Kalimat yang terpecah oleh `<strong>` dapat menghasilkan urutan Jepang yang salah. Versi ini mengirim paragraf atau kalimat beserta penanda inline sebagai satu unit, lalu mempertahankan elemen tebal, tautan, dan kode aslinya setelah penerjemahan.

Contoh yang diuji dengan penerjemah Chrome asli:

- Sumber: `When we give instructions to a computer, it's called programming.` dengan `programming` di dalam elemen tebal.
- Hasil: `コンピューターに指示を出すと、プログラミングと呼ばれます。`

Penanda spasi literal seperti `&#x20;` dibersihkan pada teks biasa. Blok kode tetap dipertahankan. Jika model gagal mempertahankan penanda format, paragraf asli **diganti** dengan satu terjemahan kalimat utuh. Teks Inggris tidak ditambahkan lagi di atas terjemahan. Pada bagian tersebut, format tebal dapat hilang; kode/media tetap dipertahankan, dan tautan tersedia lewat ikon ↗ yang meneruskan klik ke tautan asli. Mesin penerjemah lokal Chrome tetap dapat menghasilkan pilihan kata atau gaya yang berbeda dari Google Translate pada menu klik kanan.

Hanya satu pasangan jendela aktif pada satu waktu. Memulai sesi baru akan mengakhiri sesi sebelumnya. Penataan jendela asli juga memengaruhi tab lain dalam jendela yang sama. Tampilan berdampingan paling nyaman pada layar lebar.

## Tampilan terjemahan yang stabil

Pada pemuatan pertama, panel menampilkan indikator persiapan sampai terjemahan siap. Saat halaman asli berubah, versi terjemahan yang sudah selesai tetap terlihat selama pembaruan diterjemahkan di latar belakang. Halaman baru ditampilkan sekaligus setelah siap; versi Inggris tidak dipasang di panel yang terlihat selama proses itu.

Snapshot halaman yang identik diabaikan agar tidak menghapus pilihan teks atau mengganti ulang tampilan. Jika beberapa pembaruan datang berurutan, tampilan hanya memakai hasil terbaru. Jika pembaruan gagal diterjemahkan, versi terakhir tetap terlihat dan status meminta kamu mencoba kembali lewat **Terjemahkan**.

Selama isi halaman asli sudah berubah tetapi terjemahannya belum siap, klik pada konten lama menunggu pembaruan. Ini mencegah tombol lama menjalankan aksi pada isi halaman asli yang sudah berbeda. Kamu tetap dapat membaca tampilan sebelumnya atau memakai situs asli di kanan.

## Furigana

- Saat bahasa belajar **Jepang**, furigana aktif secara default. Contoh: `学習` diberi bacaan `がくしゅう` di atasnya.
- Matikan atau nyalakan kotak **Furigana** di jendela mirror. Pilihan ini juga tersedia di popup sebelum memulai dan disimpan untuk pemakaian berikutnya.
- Furigana dipasang per kata, dengan awalan kana dan okurigana dipisahkan bila cocok. Kanji yang tidak memiliki bacaan di kamus dibiarkan tanpa anotasi.
- Kamus dimuat hanya ketika dibutuhkan dan diproses di worker agar jendela tetap responsif. Isi pelajaran tidak dikirim ke layanan furigana eksternal. ZIP kini sekitar **16 MB** karena sudah memuat kamus bacaannya.
- Bacaan bersifat otomatis. Kata dengan beberapa bacaan, nama orang/tempat, dan istilah khusus dapat diberi bacaan yang keliru; ini alat bantu, bukan jaminan pelafalan yang benar dalam semua konteks.
- Furigana tidak ditambahkan pada blok kode, kolom input, atau ruby yang sudah ada. Kontrol furigana disembunyikan ketika bahasa belajar selain Jepang.

Untuk memperbarui pemasangan lama: akhiri sesi, ganti isi folder extension lama dengan isi paket baru, buka `chrome://extensions`, lalu klik **Reload / Muat ulang** pada Kotoba Mirror. Setelah itu mulai sesi baru. Jika folder baru berbeda, hapus pemasangan lama dan gunakan Load unpacked pada folder baru.

## Cara kerjanya

Situs asli tetap menjadi satu-satunya halaman yang menjalankan login, editor, navigasi, dan pengiriman jawaban. Extension mengambil salinan DOM beserta stylesheet untuk ditampilkan di iframe sandbox tanpa JavaScript di jendela mirror. Penerjemah lokal Chrome menerjemahkan teks di salinan itu.

Klik pada mirror diteruskan sekali ke elemen asli. Extension tidak membuka sesi situs kedua dan tidak mengirim jawaban dua kali. Klik langsung di halaman asli cukup memperbarui salinannya. Posisi scroll memakai elemen yang bersesuaian, dengan rasio scroll sebagai cadangan karena panjang terjemahan bisa berbeda.

Pengaturan bahasa disimpan lokal. Isi halaman dan cache terjemahan berada di memori selama sesi; extension tidak menyimpannya sebagai riwayat dan tidak mengirimkannya ke layanan penerjemah eksternal. Situs asal, gambar, stylesheet, dan font tetap dapat membuat permintaan jaringan biasa untuk merender tampilan.

## Dukungan dan batas versi pertama

- Memerlukan **Google Chrome desktop 138 atau lebih baru** dengan `Translator` API tersedia. Paket diuji di Chrome **147.0.7727.138** pada Windows.
- Dukungan pasangan bahasa diperiksa Chrome saat aktivasi; pilihan dalam dropdown tidak menjamin semua pasangan tersedia pada setiap perangkat.
- **Dataquest pada akun pengguna belum diuji langsung.** Pengujian memakai halaman pelajaran demo, termasuk editor sederhana, soal, navigasi, dan panel scroll. Situs belajar lain dapat mempunyai struktur berbeda.
- Isi iframe lintas domain, Shadow DOM, canvas, editor khusus, video, dan teks di gambar tidak diterjemahkan. Tempatnya ditandai agar digunakan di halaman asli.
- Input teks ditampilkan sebagai salinan baca saja. Password dan nilai input file/hidden tidak disalin. Teks di blok `pre`, `code`, dan elemen `translate="no"` tidak diterjemahkan.
- Beberapa situs hanya menerima interaksi pengguna yang tepercaya (`isTrusted`) atau menggunakan event pointer khusus. Untuk kontrol itu, klik langsung pada halaman asli.
- Perpindahan halaman pada domain yang sama tersambung kembali otomatis. Jika pindah domain, klik ikon extension di situs baru untuk mulai lagi. Link yang membuka tab baru perlu sesi baru pada tab tersebut.
- Halaman internal Chrome, Chrome Web Store, penampil PDF bawaan, dan halaman `file://` tidak didukung. Situs yang melarang pemuatan aset dari luar origin dapat menghasilkan tampilan mirror yang berbeda.
- Scroll mengikuti isi, tetapi posisi baris bisa sedikit berbeda karena panjang teks Jepang, wrapping, atau konten virtual yang berubah saat scroll.
- Paragraf dengan struktur inline diterjemahkan utuh. Bagian layout yang lebih rumit atau konten yang berada di beberapa blok terpisah masih dapat kehilangan sebagian konteks. Terjemahan mesin tetap dapat keliru.

## Coba demo lokal (opsional)

Jika Python tersedia, buka terminal di folder extension lalu jalankan:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Buka `http://127.0.0.1:8765/demo.html` di Chrome dan mulai Kotoba Mirror dari ikon extension. Demo berisi tombol petunjuk, soal dengan penghitung klik, checkbox, panel scroll, catatan, dan perpindahan ke pelajaran berikutnya. Hentikan server dengan Ctrl+C saat selesai. Jangan membuka file demo dengan klik ganda karena extension memakai situs HTTP/HTTPS.

## Jika ada kendala

- **Penerjemah belum tersedia:** perbarui Google Chrome, buka ulang browser, lalu coba lagi. Browser berbasis Chromium lain tidak selalu menyediakan API yang sama. Kebijakan kantor juga bisa menonaktifkannya.
- **Paket bahasa belum selesai:** biarkan jendela mirror terbuka dan pastikan internet aktif. Klik Terjemahkan untuk mencoba lagi bila muncul pesan gagal.
- **Tampilan terlambat berubah:** tekan ↻ di mirror. Halaman dengan perubahan DOM yang sangat sering dapat membuat proses penerjemahan lebih lambat.
- **Kontrol tidak merespons:** gunakan kontrol pada halaman asli; perubahan isinya tetap akan tercermin.
- **Domain berganti / halaman sudah ditutup:** mulai lagi dari ikon extension pada tab yang ingin dipelajari.
- **Extension diperbarui manual:** buka `chrome://extensions`, klik Reload pada Kotoba Mirror, lalu mulai sesi baru.

## Untuk pengembang

Semua kode sumber ada di folder ini. Manifest V3 dan JavaScript biasa, tanpa dependensi yang perlu diinstal pengguna, build step, remote JavaScript, host permission menyeluruh, atau backend. Kuromoji dan kamus IPADIC disertakan di dalam paket; tidak dimuat dari CDN.

| File | Peran |
| --- | --- |
| `manifest.json` | Izin `activeTab`, `scripting`, dan `storage` |
| `background.js` | Sesi, penataan jendela, penyambungan, dan pemulihan |
| `source.js` | Salinan DOM yang disanitasi, pemetaan elemen, scroll, dan penerusan klik |
| `mirror.html` / `mirror.js` | Tampilan mirror, penyiapan terjemahan tersembunyi, pergantian tampilan setelah siap, cache memori, dan Chrome Translator API |
| `furigana.js` / `furigana-worker.js` | Anotasi ruby dan pembacaan kanji di worker |
| `translation-blocks.js` | Pengelompokan kalimat, penanda inline, validasi hasil, dan perlindungan kode |
| `selection-translation.js` | Ekstraksi pilihan tanpa furigana, penerjemah balik, dan tooltip |
| `vendor/kuromoji/` | Kuromoji 0.1.2, kamus lokal, lisensi Apache 2.0, dan pemberitahuan lisensi IPADIC/dependensi |
| `popup.html` / `popup.js` | Pemilihan bahasa dan pembukaan sesi |
| `languages.js` / `ui.css` | Pilihan bahasa dan tampilan |
| `demo*` | Halaman latihan lokal |
| `TESTING.md` | Hasil dan cakupan pengujian |

Referensi resmi: [Chrome Translator API](https://developer.chrome.com/docs/ai/translator-api), [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [Windows API](https://developer.chrome.com/docs/extensions/reference/api/windows).

Pustaka bacaan: [Kuromoji.js](https://github.com/takuyaa/kuromoji.js). File distribusinya disertakan tanpa perubahan; tampilan furigana dan integrasinya dibuat oleh Kotoba Mirror. Lisensi lengkap ada di `vendor/kuromoji/LICENSE-2.0.txt`, `NOTICE.md`, dan `DEPENDENCY-LICENSES.txt`.
