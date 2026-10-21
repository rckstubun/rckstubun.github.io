# Menu Rocket Chicken KS Tubun

Website katalog menu dan harga Rocket Chicken outlet KS Tubun, Rejasari, Purwokerto. Pengunjung dapat mencari menu, menyusun keranjang, lalu mengirim detail pesanan ke outlet melalui WhatsApp. Data menu dikelola dari halaman admin dan disimpan di Supabase.

## Fitur

### Katalog publik

- Memuat menu aktif dari tabel `menus` di Supabase.
- Mengelompokkan menu berdasarkan kategori, dengan urutan kategori yang ditentukan di aplikasi.
- Mendukung pencarian pada nama, deskripsi, kategori, dan kata pencarian tambahan.
- Menampilkan harga rupiah, foto menu, jumlah item, dan subtotal keranjang.
- Menyediakan tombol muat ulang untuk mengambil data terbaru.
- Menyediakan tampilan responsif untuk ponsel dan desktop.

### Keranjang dan pemesanan

- Jumlah setiap menu dapat ditambah atau dikurangi.
- Formulir checkout meminta nama, nomor HP/WhatsApp, alamat pemesan, metode pemenuhan, tanggal, dan jam pesanan.
- Mendukung pesanan diantar atau diambil di outlet. Alamat pengantaran hanya diwajibkan untuk pesanan yang diantar.
- Mendukung catatan tambahan dan uang muka (DP), serta menghitung sisa pembayaran.
- Tombol checkout membuka WhatsApp dengan rincian pesanan yang sudah dirangkai. Ongkos kirim dibahas langsung dengan outlet.
- Tombol kontak juga membuka percakapan WhatsApp outlet.

### Admin (`admin.html`)

- Login dan logout menggunakan Supabase Authentication.
- Menambah dan mengubah nama, kategori, deskripsi, URL gambar, harga, serta kata pencarian menu.
- Mencari data menu, memuat ulang daftar, mengaktifkan atau menonaktifkan menu, dan mengekspor daftar yang dimuat sebagai JSON.
- Perubahan harga dan menu baru tampil pada katalog setelah berhasil disimpan ke Supabase.

## Struktur proyek

```text
.
|-- index.html
|-- admin.html
|-- package.json
|-- vite.config.js
|-- src/
|   |-- main.jsx      # Katalog, kategori, keranjang, dan checkout
|   |-- admin.jsx     # Panel autentikasi dan pengelolaan menu
|   |-- supabase.js   # Klien Supabase dan kontak outlet
|   `-- index.css     # Tailwind CSS dan gaya global
`-- img/              # Dokumentasi dan aset gambar lokal
```

## Prasyarat Supabase

Aplikasi menggunakan Supabase JavaScript v2 melalui dependensi npm. Siapkan proyek Supabase dengan tabel `public.menus` dan kolom yang digunakan oleh aplikasi:

| Kolom              | Kegunaan                                                       |
| ------------------ | -------------------------------------------------------------- |
| `id`               | ID unik menu; digunakan untuk mengurutkan dan memperbarui item |
| `name`             | Nama menu                                                      |
| `price`            | Harga dalam rupiah, berupa angka bulat                         |
| `category`         | Kategori sumber                                                |
| `display_category` | Kategori yang ditampilkan pada katalog dan admin               |
| `description`      | Deskripsi menu                                                 |
| `image_url`        | URL publik gambar menu, opsional                               |
| `search_terms`     | Kata tambahan untuk pencarian                                  |
| `active`           | Status menu; hanya baris aktif ditampilkan pada katalog        |
| `sort_order`       | Urutan menu dalam kategori                                     |
| `updated_at`       | Waktu perubahan terakhir                                       |

Pastikan tabel dan tipe kolom sesuai data yang disimpan: `id` harus unik, `price` numerik, `active` boolean, `sort_order` numerik, dan kolom teks menyimpan nilai teks atau `NULL` bila sesuai. Admin menulis `name`, `price`, `category`, `display_category`, `description`, `image_url`, `search_terms`, `active`, dan `updated_at`.

### Autentikasi dan kebijakan akses

1. Buat pengguna admin di Supabase Authentication.
2. Aktifkan Row Level Security (RLS) pada `public.menus`.
3. Buat kebijakan `SELECT` untuk katalog publik yang hanya mengizinkan baris `active = true`.
4. Berikan `SELECT` semua baris serta `INSERT` dan `UPDATE` hanya kepada akun admin yang diizinkan. Batasi kebijakan berdasarkan `auth.uid()`/UID admin, bukan hanya karena pengguna berhasil login.
5. Uji akses menggunakan sesi anonim dan akun non-admin. Pastikan keduanya tidak dapat mengubah data atau membaca menu nonaktif.

Frontend memakai Supabase publishable key; key tersebut memang terlihat oleh browser dan bukan pengganti RLS. Jangan pernah menaruh `service_role` key atau kredensial rahasia di file frontend. Panel admin hanyalah antarmuka, sedangkan kebijakan RLS di database adalah batas keamanan yang sebenarnya.

## Konfigurasi

Pengaturan koneksi dan nomor WhatsApp outlet berada di kode frontend:

- URL Supabase, publishable key, dan nomor WhatsApp outlet: `src/supabase.js`.

Gunakan URL dan publishable key dari proyek Supabase yang sama pada kedua file. Nomor WhatsApp harus berupa nomor internasional tanpa tanda `+` atau pemisah, misalnya `62...`. Nomor yang saat ini tertanam adalah nomor outlet yang sudah dikonfigurasi di `app.js`.

Kategori tampilan di panel admin merupakan daftar opsi tetap yang didefinisikan pada `src/admin.jsx`. Kategori lain yang dimasukkan langsung ke database masih dapat muncul di katalog, tetapi tidak tersedia sebagai pilihan admin sampai opsi ditambahkan di sana.

## Menjalankan dan menerbitkan

Proyek menggunakan Vite, React, dan Tailwind CSS. Gunakan Node.js 20.19+ atau 22.12+.

Pasang dependensi dan jalankan server pengembangan:

```powershell
npm install
npm run dev
```

Vite menampilkan URL katalog lokal. Panel admin tersedia di `/admin.html`. Untuk memastikan hasil produksi, jalankan:

```powershell
npm run build
npm run preview
```

Hasil build berada di `dist/` dan dapat diterbitkan sebagai situs statis. Workflow GitHub Actions di `.github/workflows/deploy.yml` membangun dan menerbitkan folder ini ke GitHub Pages; atur Pages source ke **GitHub Actions**. Koneksi internet dibutuhkan untuk Supabase, Google Fonts, serta gambar yang di-host secara eksternal.

## Hasil audit dan batasan

- Harga dan katalog berasal dari Supabase; harga dalam pesan WhatsApp dihitung di browser. Konfirmasi akhir ketersediaan, harga, DP, dan ongkos kirim tetap dilakukan oleh outlet melalui WhatsApp.
- Checkout hanya membuka WhatsApp dengan teks pesanan. Aplikasi tidak menyimpan pesanan, pembayaran, atau data pelanggan ke database dan tidak menyediakan status pesanan.
- Keranjang berada di memori halaman. Isinya hilang ketika halaman dimuat ulang atau ditutup.
- Tidak ada ketersediaan stok per item. Katalog hanya menampilkan baris aktif dan memberi label “Tersedia”.
- Menyimpan perubahan pada item yang sebelumnya nonaktif akan mengirim `active: true`, sehingga item tersebut aktif kembali.
- Ekspor JSON mengunduh data menu yang sedang dimuat di panel admin, termasuk baris nonaktif bila RLS mengizinkannya. Simpan file ekspor dengan akses yang sesuai.
- Halaman admin dan katalog membutuhkan koneksi jaringan untuk Supabase, Google Fonts, dan gambar eksternal. Bila Supabase gagal diakses, katalog tidak dapat menampilkan data lokal sebagai fallback.

## Dependensi eksternal

- React dan React DOM untuk antarmuka.
- Tailwind CSS v4 melalui plugin Vite.
- Supabase JavaScript v2 untuk database dan autentikasi.
- Google Fonts (DM Sans dan Oswald).
- Gambar menu dan gambar hero dari URL yang disimpan/didefinisikan di aplikasi.

## Lisensi

Lihat [LICENSE](LICENSE). Aset, logo, dan merek Rocket Chicken tetap tunduk pada hak dan ketentuan pemiliknya.
