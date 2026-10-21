import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { outletWhatsApp, supabase } from './supabase.js';
import './index.css';

const categoryOrder = [
  'Paket Promo', 'Paket Catering', 'Paket Segar', 'Lainnya', 'Chicken Produk',
  'Paket Bucket', 'Ayam Utuh', 'Paket Rocket', 'Paket Sehat', 'Paket Roma',
  'Paket Geprek', 'Paket Geprek Kosek', 'Paket Geprek Matah',
  'Paket Geprek Terasi', 'Paket Hot Cheesy', 'Minuman',
];

const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function normalizeMenuItem(item) {
  const categoryText = `${item.name || ''} ${item.description || ''} ${item.display_category || ''} ${item.category || ''}`.toLocaleLowerCase('id-ID');
  let category = String(item.display_category || item.category || 'Lainnya').trim() || 'Lainnya';
  if (/geprek/.test(categoryText)) {
    if (/kosek|bawang/.test(categoryText)) category = 'Paket Geprek Kosek';
    else if (/matah/.test(categoryText)) category = 'Paket Geprek Matah';
    else if (/terasi/.test(categoryText)) category = 'Paket Geprek Terasi';
  }
  return {
    ...item,
    name: String(item.name || '').trim(),
    description: String(item.description || '').trim(),
    category,
    price: Number(item.price) || 0,
    image_url: safeImageUrl(item.image_url || ''),
    search_terms: String(item.search_terms || '').trim(),
    sort_order: Number(item.sort_order) || 0,
  };
}

function safeImageUrl(value) {
  if (!value) return '';
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

function ProductImage({ src, name }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className="grid aspect-[1.35] place-items-center bg-[#e8e3d9] text-sm font-semibold text-[#825b3d]">Foto menu</div>;
  }
  return (
    <img
      className="aspect-[1.35] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function QuantityControl({ quantity, name, onChange }) {
  return (
    <div className="inline-flex items-center gap-2">
      <button
        className="grid size-9 place-items-center rounded border border-[#deded8] bg-white text-lg disabled:cursor-not-allowed disabled:opacity-40"
        type="button"
        aria-label={`Kurangi ${name}`}
        disabled={quantity === 0}
        onClick={() => onChange(-1)}
      >−</button>
      <span className="min-w-5 text-center text-sm font-bold" aria-label={`Jumlah ${name}`}>{quantity}</span>
      <button
        className="grid size-9 place-items-center rounded border border-[#deded8] bg-white text-lg"
        type="button"
        aria-label={`Tambah ${name}`}
        onClick={() => onChange(1)}
      >+</button>
    </div>
  );
}

function CheckoutDialog({ open, onClose, entries, subtotal, onQuantityChange }) {
  const dialogRef = useRef(null);
  const [fulfillment, setFulfillment] = useState('delivery');
  const [downPayment, setDownPayment] = useState('0');
  const [notice, setNotice] = useState('');
  const [minimumDate] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  });
  const [orderDate, setOrderDate] = useState(minimumDate);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const paid = Math.min(Number(downPayment) || 0, subtotal);

  function submitOrder(event) {
    event.preventDefault();
    if (!entries.length) return;
    const values = new FormData(event.currentTarget);
    const customerPhone = String(values.get('customer_phone') || '').trim();
    const phoneDigits = customerPhone.replace(/\D/g, '');
    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      setNotice('Periksa kembali nomor HP / WhatsApp pemesan.');
      return;
    }
    const payment = Number(values.get('down_payment')) || 0;
    if (!Number.isSafeInteger(payment) || payment < 0 || payment > subtotal) {
      setNotice('DP harus berupa angka antara Rp0 dan total pemesanan.');
      return;
    }
    const date = new Date(`${values.get('order_date')}T00:00:00`).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    const isDelivery = fulfillment === 'delivery';
    const orderLines = entries.map(({ item, quantity }, index) =>
      `${index + 1}. Nama paket/menu: ${item.name}\n    Jumlah: ${quantity}\n    Harga per box: ${rupiah.format(item.price)}`,
    );
    const message = [
      'Halo Rocket Chicken KS Tubun', '',
      'Saya ingin melakukan pemesanan dengan rincian berikut:', '',
      'DATA PEMESAN',
      `Nama: ${String(values.get('customer_name')).trim()}`,
      `No. HP: ${customerPhone}`,
      `Alamat: ${String(values.get('customer_address')).trim()}`, '',
      'DETAIL PESANAN', ...orderLines, '',
      'TOTAL PEMESANAN',
      `Total: ${rupiah.format(subtotal)}`,
      `DP: ${rupiah.format(payment)}`,
      `Sisa pembayaran: ${rupiah.format(subtotal - payment)}`, '',
      'JADWAL PESANAN',
      `Tanggal pesanan: ${date}`,
      `Jam pesanan: ${values.get('order_time')}`, '',
      'PENGAMBILAN/PENGANTARAN',
      `Metode: ${isDelivery ? 'Diantar' : 'Ambil sendiri'}`,
      `Alamat pengantaran: ${isDelivery ? String(values.get('delivery_address')).trim() : '-'}`,
      ...(isDelivery ? ['Ongkir: dibahas melalui WhatsApp'] : []),
      `Catatan tambahan: ${String(values.get('order_note')).trim() || '-'}`, '',
      'Terima kasih.',
    ].join('\n');
    window.location.href = `https://wa.me/${outletWhatsApp}?text=${encodeURIComponent(message)}`;
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog-backdrop m-auto max-h-[94dvh] w-[min(760px,calc(100%-24px))] overflow-hidden rounded-lg bg-[#f5f4f0] p-0 text-[#20211f] shadow-2xl backdrop:bg-black/60"
      aria-labelledby="checkout-title"
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}
    >
      <div className="flex max-h-[94dvh] flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-[#deded8] bg-white px-5 py-4 sm:px-7">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase text-[#c72e25]">Pesanan Anda</p>
            <h2 className="display-font text-2xl font-semibold">Keranjang &amp; checkout</h2>
            <p className="mt-1 text-xs text-[#70716d]">Periksa pesanan sebelum melanjutkan ke WhatsApp.</p>
          </div>
          <button className="size-9 rounded border border-[#deded8] bg-white text-xl" type="button" aria-label="Tutup keranjang" onClick={() => dialogRef.current?.close()}>×</button>
        </div>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submitOrder}>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-7">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="display-font text-lg font-semibold">Ringkasan pesanan</h3>
              <span className="text-[11px] text-[#70716d]">Harga dalam rupiah</span>
            </div>
            <div className="mt-2 grid gap-2">
              {entries.length ? entries.map(({ item, quantity }) => (
                <div className="flex items-center justify-between gap-3 border-b border-[#deded8] py-2" key={item.id}>
                  <div className="min-w-0">
                    <strong className="block text-sm">{item.name}</strong>
                    <span className="text-xs text-[#70716d]">{quantity} × {rupiah.format(item.price)} = {rupiah.format(quantity * item.price)}</span>
                  </div>
                  <QuantityControl quantity={quantity} name={item.name} onChange={(delta) => onQuantityChange(item, delta)} />
                </div>
              )) : <p className="py-3 text-sm text-[#70716d]">Keranjang masih kosong. Tambahkan menu dari daftar terlebih dahulu.</p>}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-[#deded8] py-3 text-sm font-bold">
              <strong>Total pesanan</strong><strong className="text-xl text-[#c72e25]">{rupiah.format(subtotal)}</strong>
            </div>
            <p className="mb-5 text-[11px] text-[#70716d]">Ongkos kirim untuk pesanan diantar akan dikonfirmasi melalui WhatsApp.</p>
            <h3 className="display-font border-t border-[#deded8] pt-4 text-lg font-semibold">Detail pemesan</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Nama pemesan"><input className={inputClass} name="customer_name" autoComplete="name" maxLength="100" placeholder="Contoh: Rani" required /></Field>
              <Field label="Nomor HP / WhatsApp"><input className={inputClass} name="customer_phone" type="tel" autoComplete="tel" inputMode="tel" maxLength="24" placeholder="08xx xxxx xxxx" required /></Field>
              <Field className="sm:col-span-2" label="Alamat pemesan"><textarea className={inputClass} name="customer_address" autoComplete="street-address" maxLength="400" rows="2" placeholder="Nama jalan, nomor rumah, dan wilayah" required /></Field>
              <fieldset className="sm:col-span-2">
                <legend className="mb-2 text-xs font-bold">Metode pesanan</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className={fulfillmentClass(fulfillment === 'delivery')}><input type="radio" name="fulfillment" value="delivery" checked={fulfillment === 'delivery'} onChange={() => setFulfillment('delivery')} /> Diantar ke alamat</label>
                  <label className={fulfillmentClass(fulfillment === 'pickup')}><input type="radio" name="fulfillment" value="pickup" checked={fulfillment === 'pickup'} onChange={() => setFulfillment('pickup')} /> Ambil di outlet</label>
                </div>
              </fieldset>
              {fulfillment === 'delivery' && <Field className="sm:col-span-2" label="Alamat pengantaran"><textarea className={inputClass} name="delivery_address" autoComplete="shipping street-address" maxLength="400" rows="2" placeholder="Alamat lengkap tujuan pengantaran" required /></Field>}
              <Field label="Tanggal pesanan"><input className={inputClass} name="order_date" type="date" min={minimumDate} value={orderDate} onChange={(event) => setOrderDate(event.target.value)} required /></Field>
              <Field label="Jam pesanan"><input className={inputClass} name="order_time" type="time" required /></Field>
              <Field className="sm:col-span-2" label="Keterangan lainnya (opsional)"><textarea className={inputClass} name="order_note" maxLength="500" rows="2" placeholder="Level pedas, catatan lokasi, atau permintaan khusus" /></Field>
              <Field label="Uang muka (Rp, opsional)"><input className={inputClass} name="down_payment" type="number" min="0" max={subtotal} step="500" value={downPayment} onChange={(event) => setDownPayment(event.target.value)} inputMode="numeric" /></Field>
              <div className="flex items-center justify-between self-end border-t border-[#deded8] py-3 text-sm sm:col-span-1"><strong>Sisa pembayaran</strong><strong>{rupiah.format(Math.max(0, subtotal - paid))}</strong></div>
            </div>
            {notice && <p className="mt-3 text-sm font-semibold text-[#a9231c]" role="alert">{notice}</p>}
          </div>
          <div className="border-t border-[#deded8] bg-white p-4 sm:px-7">
            <button className="min-h-12 w-full rounded bg-[#c72e25] px-4 font-bold text-white transition hover:bg-[#a9231c] disabled:opacity-50" type="submit" disabled={!entries.length}>Lanjut ke WhatsApp ↗</button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

const inputClass = 'mt-1 min-h-11 w-full rounded border border-[#d7d7d1] bg-white px-3 py-2 text-sm outline-none focus:border-[#c72e25] focus:ring-2 focus:ring-[#c72e25]/15';

function Field({ label, className = '', children }) {
  return <label className={`block min-w-0 text-xs font-bold ${className}`}>{label}{children}</label>;
}

function fulfillmentClass(active) {
  return `flex min-h-11 items-center gap-2 rounded border px-3 text-sm ${active ? 'border-[#c72e25] bg-[#fff5f3]' : 'border-[#deded8] bg-white'}`;
}

function App() {
  const [items, setItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState({});
  const [status, setStatus] = useState('Menghubungkan ke menu...');
  const [loading, setLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadMenu() {
      setLoading(true);
      setStatus('Memuat menu...');
      const { data, error } = await supabase
        .from('menus')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true });
      if (cancelled) return;
      if (error) {
        setItems([]);
        setStatus('Gagal memuat menu');
        setToast(`Menu belum dapat dimuat: ${error.message}`);
      } else {
        const nextItems = (data || []).map(normalizeMenuItem);
        setItems(nextItems);
        setStatus('Menu diperbarui langsung');
        setCart((current) => Object.fromEntries(
          Object.entries(current).filter(([id]) => nextItems.some((item) => String(item.id) === id)),
        ));
      }
      setLoading(false);
    }
    loadMenu();
    return () => { cancelled = true; };
  }, [refreshVersion]);

  const categories = useMemo(() => {
    const found = [...new Set(items.map((item) => item.category).filter(Boolean))];
    return found.sort((first, second) => {
      const firstRank = categoryOrder.indexOf(first);
      const secondRank = categoryOrder.indexOf(second);
      if (firstRank !== -1 && secondRank !== -1) return firstRank - secondRank;
      if (firstRank !== -1) return -1;
      if (secondRank !== -1) return 1;
      return first.localeCompare(second, 'id', { sensitivity: 'base' });
    });
  }, [items]);

  useEffect(() => {
    if (!categories.includes(activeCategory) && categories.length) setActiveCategory(categories[0]);
  }, [activeCategory, categories]);

  const filteredItems = items.filter((item) => {
    const categoryMatch = item.category === activeCategory;
    const text = `${item.name} ${item.description} ${item.category} ${item.search_terms}`.toLocaleLowerCase('id-ID');
    return categoryMatch && text.includes(query.trim().toLocaleLowerCase('id-ID'));
  });

  const entries = Object.values(cart);
  const itemCount = entries.reduce((total, entry) => total + entry.quantity, 0);
  const subtotal = entries.reduce((total, entry) => total + entry.quantity * entry.item.price, 0);

  function changeQuantity(item, delta) {
    const key = String(item.id);
    setCart((current) => {
      const quantity = Math.max(0, (current[key]?.quantity || 0) + delta);
      const next = { ...current };
      if (quantity === 0) delete next[key];
      else next[key] = { item, quantity };
      return next;
    });
  }

  function contactOutlet(event) {
    if (!outletWhatsApp) {
      event.preventDefault();
      setToast('Nomor WhatsApp outlet belum dikonfigurasi.');
      return;
    }
    event.currentTarget.href = `https://wa.me/${outletWhatsApp}?text=${encodeURIComponent('Halo Rocket Chicken KS Tubun, saya ingin bertanya tentang menu.')}`;
    event.currentTarget.target = '_blank';
    event.currentTarget.rel = 'noopener noreferrer';
  }

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <div className="min-h-screen bg-[#f5f4f0] text-[#20211f]">
      <div className="mx-auto w-[min(1160px,calc(100%_-_28px))] sm:w-[min(1160px,calc(100%_-_48px))]">
        <header className="flex h-[66px] items-center justify-between border-b border-[#deded8] sm:h-[76px]">
          <a className="flex items-center gap-3 no-underline" href="#top" aria-label="Rocket Chicken KS Tubun, beranda">
            <img className="size-10 rounded-full object-cover sm:size-[42px]" src="https://scontent-cgk2-2.cdninstagram.com/v/t51.82787-19/727287239_18030453479821656_8415184296205694350_n.jpg?stp=dst-jpg_s150x150_tt6&amp;_nc_cat=101&amp;ccb=7-5&amp;_nc_sid=f7ccc5&amp;efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy4zMjAuQzMifQ%3D%3D&amp;_nc_ohc=LyHMPoP-JWAQ7kNvwEpL54x&amp;_nc_oc=AdqLtrVqcAsP9pPmF4AAe7qjE9DuBwMsdtVmfuqInDEsGlHqMFRN2InOtUdc0ZkbKgM&amp;_nc_zt=24&amp;_nc_ht=scontent-cgk2-2.cdninstagram.com&amp;_nc_gid=yX8QXLAgBLjT5ktVDnhmew&amp;_nc_ss=7ba8c&amp;oh=00_AQOwGr5IcjdnjyMMSA2Nzu8nDNz0mb-qifPIrOmmAuYT2w&amp;oe=6AD7D740" alt="" aria-hidden="true" />
            <span className="flex flex-col">
              <span className="display-font text-base font-bold leading-none">ROCKET CHICKEN</span>
              <span className="mt-1 text-[10px] text-[#70716d] sm:text-[11px]">Outlet Ks Tubun-Rejasari-Purwokerto</span>
            </span>
          </a>
          <a className="rounded bg-[#c72e25] px-3 py-2 text-xs font-bold text-white hover:bg-[#a9231c]" href="#kontak">Hubungi outlet</a>
        </header>

        <main id="top">
          <section className="my-[18px] grid overflow-hidden rounded-lg bg-[#c72e25] text-white sm:my-[30px] sm:min-h-[354px] sm:grid-cols-[1.02fr_.98fr]">
            <div className="self-center px-6 py-7 sm:px-12 sm:py-10 lg:px-16">
              <p className="text-[11px] font-bold uppercase">Rocket Chicken · KS Tubun</p>
              <h1 className="display-font my-4 text-[47px] font-semibold leading-[.98] sm:max-w-[510px] sm:text-6xl">Pengin Makan Enakk?</h1>
              <p className="mb-5 max-w-[390px] text-xs leading-relaxed text-[#ffe9e5] sm:text-sm">Temukan menu favoritmu, cek harga terbaru, lalu pesan langsung ke outlet KS Tubun.</p>
              <a className="inline-flex min-h-11 items-center gap-2 rounded bg-[#f5c748] px-4 font-bold text-[#20211f] hover:bg-[#ffda65]" href="#menu">Lihat menu ↓</a>
            </div>
            <div className="relative h-[210px] overflow-hidden bg-[#741b15] sm:h-auto sm:min-h-[354px]">
              <img className="h-full min-h-full w-full object-cover object-left" src="https://storage.googleapis.com/rocketchicken-2019.appspot.com/home/foto-sampul/1779352362_produk%20rc.png" alt="Produk Rocket Chicken" fetchPriority="high" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#c72e25]/30 to-transparent" />
            </div>
          </section>

          <section id="menu" aria-labelledby="menuTitle">
            <div className="mb-4 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase text-[#c72e25]">Pilih yang kamu suka</p>
                <h2 id="menuTitle" className="display-font text-[31px] font-semibold leading-tight sm:text-[34px]">Menu Rocket Chicken</h2>
              </div>
              <span className="text-xs text-[#70716d]" role="status">{status}</span>
            </div>
            <div className="border-y border-[#deded8] py-3">
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="category-rail flex min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto pb-1" role="group" aria-label="Kategori menu">
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      aria-pressed={activeCategory === category}
                      onClick={() => setActiveCategory(category)}
                      className={`display-font min-h-10 shrink-0 snap-start rounded px-3 text-sm font-semibold transition ${activeCategory === category ? 'bg-[#20211f] text-white' : 'border border-transparent text-[#70716d] hover:bg-white hover:text-[#20211f]'}`}
                    >{category}</button>
                  ))}
                </div>
                <label className="flex min-h-10 shrink-0 items-center gap-2 rounded border border-[#deded8] bg-white px-3 sm:w-[230px]">
                  <span aria-hidden="true" className="text-lg text-[#70716d]">⌕</span>
                  <input className="w-full min-w-0 border-0 bg-transparent text-sm outline-none" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari menu..." aria-label="Cari menu" />
                </label>
              </div>
            </div>
            <div className="my-4 flex items-center justify-between text-xs text-[#70716d]">
              <span>{loading ? 'Memuat menu' : `${filteredItems.length} menu`}</span>
              <button className="rounded border border-[#deded8] bg-white px-3 py-2 font-bold text-[#20211f] hover:bg-[#eeede8]" type="button" onClick={() => setRefreshVersion((value) => value + 1)}>Muat ulang</button>
            </div>
            {loading ? (
              <div className="grid min-h-64 place-items-center rounded bg-gradient-to-r from-[#e9e8e2] via-[#f3f2ee] to-[#e9e8e2] text-sm text-[#70716d]">Memuat menu...</div>
            ) : !items.length ? (
              <div className="grid min-h-52 place-items-center rounded border border-dashed border-[#c8c6be] p-6 text-center">
                <div><h3 className="display-font text-2xl font-semibold">Menu sedang disiapkan</h3><p className="mt-2 text-sm text-[#70716d]">Daftar menu outlet KS Tubun belum tersedia. Coba muat ulang setelah beberapa saat.</p></div>
              </div>
            ) : !filteredItems.length ? (
              <div className="grid min-h-52 place-items-center rounded border border-dashed border-[#c8c6be] p-6 text-center">
                <div><h3 className="display-font text-2xl font-semibold">Menu tidak ditemukan</h3><p className="mt-2 text-sm text-[#70716d]">Coba kata pencarian atau kategori yang berbeda.</p></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pb-10 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {filteredItems.map((item, index) => {
                  const key = String(item.id);
                  const quantity = cart[key]?.quantity || 0;
                  return (
                    <article className="menu-card group overflow-hidden rounded-md border border-[#deded8] bg-white" key={key} style={{ animationDelay: `${Math.min(index * 35, 210)}ms` }}>
                      <div className="relative overflow-hidden bg-[#e8e3d9]"><ProductImage src={item.image_url} name={item.name} /><span className="absolute left-2 top-2 rounded-sm bg-[#35734f] px-2 py-1 text-[10px] font-bold text-white">Tersedia</span></div>
                      <div className="p-3 sm:p-4">
                        <p className="mb-1 text-[10px] font-bold uppercase text-[#c72e25]">{item.category || 'Menu'}</p>
                        <h3 className="display-font text-lg font-semibold leading-tight sm:text-xl">{item.name}</h3>
                        <p className="mt-1 min-h-9 text-[11px] leading-relaxed text-[#70716d]">{item.description || 'Menu Rocket Chicken favoritmu.'}</p>
                        <div className="mt-3 flex flex-col items-start justify-between gap-2 border-t border-[#ecebe6] pt-3 sm:flex-row sm:items-center">
                          <strong className="text-sm">{rupiah.format(item.price)}</strong>
                          <QuantityControl quantity={quantity} name={item.name} onChange={(delta) => changeQuantity(item, delta)} />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section id="kontak" className="mb-9 flex flex-col items-start justify-between gap-4 border-l-4 border-[#f5c748] bg-[#e8e7e1] p-5 sm:flex-row sm:items-center sm:p-7">
            <div><h2 className="display-font text-2xl font-semibold">Sudah tahu mau pesan apa?</h2><p className="mt-1 text-xs text-[#70716d]">Hubungi Rocket Chicken KS Tubun untuk menanyakan pesanan dan ketersediaan menu.</p></div>
            <a className="rounded bg-[#c72e25] px-4 py-3 text-sm font-bold text-white hover:bg-[#a9231c]" href="#kontak" onClick={contactOutlet}>Chat outlet ↗</a>
          </section>
        </main>
        <footer className="flex flex-col gap-1 border-t border-[#deded8] py-5 text-[11px] text-[#70716d] sm:flex-row sm:justify-between">
          <span>Rocket Chicken KS Tubun</span><span>Menu dan harga dapat berubah secara berkala.</span>
        </footer>
      </div>

      {itemCount > 0 && <aside className="fixed inset-x-3 bottom-3 z-20 mx-auto flex min-h-16 w-[min(520px,calc(100%_-_24px))] items-center justify-between gap-4 rounded-md border border-[#deded8] bg-white p-3 shadow-xl sm:inset-x-5 sm:bottom-5">
        <div className="grid gap-0.5"><span className="text-[11px] text-[#70716d]">{itemCount} item</span><strong className="text-sm">{rupiah.format(subtotal)}</strong></div>
        <button className="min-h-11 rounded bg-[#c72e25] px-4 text-sm font-bold text-white hover:bg-[#a9231c]" type="button" onClick={() => setCheckoutOpen(true)}>Lihat keranjang</button>
      </aside>}

      <CheckoutDialog
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        entries={entries}
        subtotal={subtotal}
        onQuantityChange={changeQuantity}
      />
      {toast && <div className="fixed bottom-5 right-5 z-30 max-w-sm rounded bg-[#20211f] px-4 py-3 text-sm text-white shadow-lg" role="status">{toast}</div>}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
