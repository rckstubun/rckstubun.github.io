import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from './supabase.js';
import './index.css';

const categories = [
  'Paket Promo', 'Paket Catering', 'Paket Segar', 'Lainnya', 'Chicken Produk',
  'Paket Bucket', 'Ayam Utuh', 'Paket Rocket', 'Paket Sehat', 'Paket Roma',
  'Paket Geprek', 'Paket Geprek Kosek', 'Paket Geprek Matah',
  'Paket Geprek Terasi', 'Paket Hot Cheesy', 'Minuman',
];

const emptyForm = {
  id: '', name: '', category: 'Paket Promo', sourceCategory: '',
  description: '', imageUrl: '', price: '', searchTerms: '',
};

const formatPrice = (value) => `Rp${Number(value || 0).toLocaleString('id-ID')}`;
const fieldClass = 'mt-1 min-h-11 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#c8102e] focus:ring-2 focus:ring-[#c8102e]/15';

function AdminApp() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [menu, setMenu] = useState([]);
  const [filter, setFilter] = useState('');
  const [authStatus, setAuthStatus] = useState('Memeriksa sesi admin...');
  const [listStatus, setListStatus] = useState('Belum dimuat.');
  const [saveStatus, setSaveStatus] = useState('Belum ada perubahan.');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data, error }) => {
      if (cancelled) return;
      if (error) setAuthStatus(`Gagal membaca sesi: ${error.message}`);
      else {
        setSession(data.session);
        if (!data.session) setAuthStatus('Masukkan email dan password admin Supabase.');
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) setAuthStatus('Kamu sudah logout.');
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return undefined;
    let cancelled = false;
    async function loadMenu() {
      setListStatus('Memuat menu...');
      const { data, error } = await supabase
        .from('menus')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name');
      if (cancelled) return;
      if (error) setListStatus(`Gagal membaca menu: ${error.message}\nPeriksa SQL, RLS, dan koneksi.`);
      else {
        setMenu(data || []);
        setListStatus(`Berhasil memuat ${(data || []).length} baris menu.`);
      }
    }
    loadMenu();
    return () => { cancelled = true; };
  }, [session, refreshVersion]);

  const visibleMenu = menu.filter((item) =>
    `${item.name} ${item.display_category || item.category} ${item.description || ''}`
      .toLocaleLowerCase('id-ID')
      .includes(filter.trim().toLocaleLowerCase('id-ID')),
  );

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function login(event) {
    event.preventDefault();
    setAuthStatus('Menghubungkan...');
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setAuthStatus(`Login gagal: ${error.message}`);
    else {
      setSession(data.session);
      setAuthStatus(`Login sebagai ${data.user.email}. Jika UID bukan admin yang diizinkan RLS, operasi database akan ditolak.`);
      setPassword('');
    }
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) setAuthStatus(`Gagal logout: ${error.message}`);
    else setSession(null);
  }

  function editItem(item) {
    setForm({
      id: item.id,
      name: item.name || '',
      category: item.display_category || item.category || 'Paket Promo',
      sourceCategory: item.category || '',
      description: item.description || '',
      imageUrl: item.image_url || '',
      price: String(item.price ?? ''),
      searchTerms: item.search_terms || '',
    });
    setSaveStatus('Mengubah menu yang dipilih.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function clearForm() {
    setForm(emptyForm);
    setSaveStatus('Form dikosongkan.');
  }

  async function saveItem(event) {
    event.preventDefault();
    const price = Number(form.price);
    if (!form.name.trim() || form.price === '' || !Number.isSafeInteger(price) || price < 0) {
      setSaveStatus('Nama wajib diisi dan harga harus bilangan bulat nol atau lebih.');
      return;
    }
    if (form.imageUrl.trim()) {
      try {
        const parsed = new URL(form.imageUrl.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
      } catch {
        setSaveStatus('URL gambar harus berupa alamat publik HTTP atau HTTPS yang valid.');
        return;
      }
    }
    const payload = {
      name: form.name.trim(),
      price,
      category: form.sourceCategory.trim() || form.category,
      display_category: form.category,
      description: form.description.trim(),
      image_url: form.imageUrl.trim() || null,
      search_terms: form.searchTerms.trim(),
      active: true,
      updated_at: new Date().toISOString(),
    };
    setSaving(true);
    setSaveStatus('Menyimpan...');
    const result = form.id
      ? await supabase.from('menus').update(payload).eq('id', form.id).select().single()
      : await supabase.from('menus').insert(payload).select().single();
    setSaving(false);
    if (result.error) {
      setSaveStatus(`Gagal menyimpan: ${result.error.message}`);
      return;
    }
    setSaveStatus(`Berhasil disimpan: ${result.data.name} — ${formatPrice(result.data.price)}`);
    setForm(emptyForm);
    setRefreshVersion((value) => value + 1);
  }

  async function toggleActive(item) {
    const nextActive = !item.active;
    const action = nextActive ? 'aktifkan' : 'nonaktifkan';
    if (!window.confirm(`${action[0].toUpperCase()}${action.slice(1)} "${item.name}"?`)) return;
    const { error } = await supabase.from('menus').update({
      active: nextActive,
      updated_at: new Date().toISOString(),
    }).eq('id', item.id);
    if (error) setListStatus(`Gagal: ${error.message}`);
    else setRefreshVersion((value) => value + 1);
  }

  function exportJson() {
    const file = new Blob([JSON.stringify(menu, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rc-ks-tubun-menu-backup.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#171717]">
      <header className="bg-gradient-to-r from-[#9f0d24] to-[#c8102e] px-4 py-5 text-white">
        <div className="mx-auto max-w-5xl">
          <h1 className="display-font text-2xl font-semibold">Admin Price List RC KS Tubun</h1>
          <p className="mt-1 text-sm text-white/85">Panel khusus admin utama · Perubahan tersimpan di Supabase</p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-4 px-3 py-5 sm:px-5">
        <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <strong>Login admin</strong>
            {session && <button className="rounded bg-gray-100 px-3 py-2 text-sm font-bold hover:bg-gray-200" type="button" onClick={logout}>Logout</button>}
          </div>
          {!session && <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={login}>
            <label className="text-sm font-bold">Email admin<input className={fieldClass} type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label className="text-sm font-bold">Password<input className={fieldClass} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            <div className="sm:col-span-2"><button className="rounded bg-[#c8102e] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#9f0b22]" type="submit">Login</button></div>
          </form>}
          <p className="mt-3 whitespace-pre-wrap rounded bg-[#fff8d9] px-3 py-2 text-sm" role="status">{authStatus}</p>
        </section>

        {session && <>
          <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="font-bold">Tambah / ubah menu</h2>
            <p className="mt-1 text-sm text-gray-600">Harga diisi angka saja, misalnya 13000. Perubahan tidak langsung tayang sebelum tombol Simpan ditekan.</p>
            <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={saveItem}>
              <label className="text-sm font-bold">Nama menu<input className={fieldClass} maxLength="120" value={form.name} onChange={(event) => updateForm('name', event.target.value)} required /></label>
              <label className="text-sm font-bold">Kategori tampilan<select className={fieldClass} value={form.category} onChange={(event) => updateForm('category', event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
              <label className="text-sm font-bold">Kategori sumber (opsional)<input className={fieldClass} maxLength="120" value={form.sourceCategory} onChange={(event) => updateForm('sourceCategory', event.target.value)} /></label>
              <label className="text-sm font-bold">Harga (Rp)<input className={fieldClass} type="number" min="0" step="500" value={form.price} onChange={(event) => updateForm('price', event.target.value)} required /></label>
              <label className="text-sm font-bold sm:col-span-2">Deskripsi<input className={fieldClass} maxLength="300" value={form.description} onChange={(event) => updateForm('description', event.target.value)} /></label>
              <label className="text-sm font-bold sm:col-span-2">URL gambar (opsional)<input className={fieldClass} type="url" maxLength="2048" placeholder="https://..." value={form.imageUrl} onChange={(event) => updateForm('imageUrl', event.target.value)} /></label>
              <label className="text-sm font-bold sm:col-span-2">Kata pencarian tambahan<input className={fieldClass} maxLength="300" value={form.searchTerms} onChange={(event) => updateForm('searchTerms', event.target.value)} /></label>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button className="rounded bg-[#c8102e] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#9f0b22] disabled:opacity-50" type="submit" disabled={saving}>{saving ? 'Menyimpan...' : form.id ? 'Simpan perubahan' : 'Simpan menu'}</button>
                <button className="rounded bg-gray-100 px-4 py-2.5 text-sm font-bold hover:bg-gray-200" type="button" onClick={clearForm}>Kosongkan form</button>
              </div>
            </form>
            <p className="mt-3 whitespace-pre-wrap rounded bg-[#fff8d9] px-3 py-2 text-sm" role="status">{saveStatus}</p>
          </section>

          <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><h2 className="font-bold">Daftar menu</h2><p className="mt-1 text-sm text-gray-600">Klik Edit untuk memuat data ke form.</p></div>
              <label className="text-sm font-bold">Cari menu<input className={fieldClass} placeholder="Ketik nama/kategori..." value={filter} onChange={(event) => setFilter(event.target.value)} /></label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded bg-gray-100 px-3 py-2 text-sm font-bold hover:bg-gray-200" type="button" onClick={() => setRefreshVersion((value) => value + 1)}>Muat ulang data</button>
              <button className="rounded bg-gray-100 px-3 py-2 text-sm font-bold hover:bg-gray-200" type="button" onClick={exportJson}>Ekspor JSON cadangan</button>
            </div>
            <p className="mt-3 whitespace-pre-wrap rounded bg-[#fff8d9] px-3 py-2 text-sm" role="status">{listStatus}</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <thead><tr className="text-xs text-gray-500"><th className="border-b p-2">Menu</th><th className="border-b p-2">Kategori</th><th className="border-b p-2">Harga</th><th className="border-b p-2">Terakhir diubah</th><th className="border-b p-2">Aksi</th></tr></thead>
                <tbody>{visibleMenu.map((item) => <tr key={item.id}>
                  <td className="whitespace-pre-line border-b p-2">{item.name}{item.description ? `\n${item.description}` : ''}</td>
                  <td className="border-b p-2">{item.display_category || item.category}</td>
                  <td className="border-b p-2">{formatPrice(item.price)}</td>
                  <td className="border-b p-2">{item.updated_at ? new Date(item.updated_at).toLocaleString('id-ID') : '—'}</td>
                  <td className="border-b p-2"><div className="flex gap-2"><button className="rounded bg-[#c8102e] px-2.5 py-1.5 text-xs font-bold text-white" type="button" onClick={() => editItem(item)}>Edit</button><button className={`rounded px-2.5 py-1.5 text-xs font-bold text-white ${item.active ? 'bg-[#8b1024]' : 'bg-gray-500'}`} type="button" onClick={() => toggleActive(item)}>{item.active ? 'Nonaktifkan' : 'Aktifkan'}</button></div></td>
                </tr>)}</tbody>
              </table>
            </div>
          </section>
        </>}

        <p className="px-1 text-xs leading-relaxed text-gray-600">Keamanan: database RLS adalah penjaga utama. Menyembunyikan tombol saja bukan keamanan. Pastikan UUID admin pada SQL cocok dengan UID akun admin kamu.</p>
      </main>
    </div>
  );
}

createRoot(document.getElementById('admin-root')).render(<AdminApp />);
