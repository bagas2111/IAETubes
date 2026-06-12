import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { 
  Building, Calendar, Layers, Search, Users, 
  CheckCircle2, XCircle, Clock, Plus, Trash2, 
  ShieldCheck, User, Info, FileText, MapPin, Tag, LogOut, Lock, Key,
  Edit
} from 'lucide-react';

const GATEWAY_URL = 'http://localhost:4000/';

// Pure GraphQL Request helper
async function graphqlRequest(query, variables = {}) {
  const token = localStorage.getItem('sipemfa_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  try {
    const res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables })
    });
    const json = await res.json();
    if (json.errors) {
      throw new Error(json.errors[0].message);
    }
    return json.data;
  } catch (err) {
    console.error('GraphQL Request Error:', err.message);
    throw err;
  }
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  
  // Auth Form Fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [userRole, setUserRole] = useState('mahasiswa');

  // App Data State
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Verify JWT token on load
  useEffect(() => {
    const checkUser = async () => {
      const token = localStorage.getItem('sipemfa_token');
      if (!token) return;
      try {
        const query = `
          query {
            me {
              id
              username
              name
              role
            }
          }
        `;
        const data = await graphqlRequest(query);
        if (data && data.me) {
          setUser(data.me);
        } else {
          localStorage.removeItem('sipemfa_token');
        }
      } catch (err) {
        localStorage.removeItem('sipemfa_token');
      }
    };
    checkUser();
  }, []);

  // Fetch all system data
  const loadData = async () => {
    try {
      const query = `
        query {
          kategoriList {
            id
            nama
            deskripsi
          }
          assets {
            id
            kategori_id
            nama
            tipe
            deskripsi
            status
            image_url
            stok
            kategori {
              nama
            }
          }
          bookings {
            id
            asset_id
            user_id
            user_name
            user_role
            deskripsi
            start_time
            end_time
            status
            asset {
              nama
            }
          }
          schedules {
            id
            asset_id
            date
            event_name
            deskripsi
            asset {
              nama
            }
          }
        }
      `;
      const data = await graphqlRequest(query);
      if (data) {
        if (data.assets) setAssets(data.assets);
        if (data.kategoriList) setCategories(data.kategoriList);
        if (data.bookings) setBookings(data.bookings);
        if (data.schedules) setSchedules(data.schedules);
      }
    } catch (err) {
      console.error("Gagal mengambil data via GraphQL:", err.message);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Handle Login
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!username || !password) {
      Swal.fire('Error', 'Username dan password wajib diisi!', 'warning');
      return;
    }
    try {
      const query = `
        mutation Login($username: String!, $sandi: String!) {
          login(username: $username, sandi: $sandi) {
            success
            token
            user {
              id
              username
              name
              role
            }
            message
          }
        }
      `;
      const data = await graphqlRequest(query, { username, sandi: password });
      const auth = data.login;
      
      if (auth.success) {
        localStorage.setItem('sipemfa_token', auth.token);
        setUser(auth.user);
        Swal.fire({
          title: 'Login Berhasil',
          text: `Selamat datang kembali, ${auth.user.name}!`,
          icon: 'success',
          timer: 2000,
          background: '#0f172a',
          color: '#f8fafc',
          confirmButtonColor: '#6366f1'
        });
      } else {
        Swal.fire({
          title: 'Login Gagal',
          text: auth.message,
          icon: 'error',
          background: '#0f172a',
          color: '#f8fafc',
          confirmButtonColor: '#ef4444'
        });
      }
    } catch (err) {
      Swal.fire('Gagal', err.message || 'Gagal login ke server', 'error');
    }
  };

  // Handle Quick Login
  const handleQuickLogin = (uname) => {
    setUsername(uname);
    setPassword('password123');
    setTimeout(() => {
      // Direct trigger
      const query = `
        mutation Login($username: String!, $sandi: String!) {
          login(username: $username, sandi: $sandi) {
            success
            token
            user { id username name role }
            message
          }
        }
      `;
      graphqlRequest(query, { username: uname, sandi: 'password123' }).then(data => {
        const auth = data.login;
        if (auth.success) {
          localStorage.setItem('sipemfa_token', auth.token);
          setUser(auth.user);
          Swal.fire({
            title: 'Quick Login Sukses',
            text: `Masuk sebagai ${auth.user.name}`,
            icon: 'success',
            timer: 1500,
            background: '#0f172a',
            color: '#f8fafc',
            confirmButtonColor: '#6366f1'
          });
        }
      });
    }, 100);
  };

  // Handle Register
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!username || !password || !fullName) {
      Swal.fire('Error', 'Semua field pendaftaran wajib diisi!', 'warning');
      return;
    }
    try {
      const query = `
        mutation Register($username: String!, $name: String!, $role: String!, $sandi: String!) {
          register(username: $username, name: $name, role: $role, sandi: $sandi) {
            id
            username
          }
        }
      `;
      await graphqlRequest(query, { username, name: fullName, role: userRole, sandi: password });
      Swal.fire({
        title: 'Pendaftaran Berhasil',
        text: 'Silakan masuk menggunakan akun baru Anda.',
        icon: 'success',
        background: '#0f172a',
        color: '#f8fafc',
        confirmButtonColor: '#6366f1'
      });
      setAuthMode('login');
      setPassword('');
    } catch (err) {
      Swal.fire('Gagal', err.message || 'Pendaftaran gagal', 'error');
    }
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('sipemfa_token');
    setUser(null);
    setUsername('');
    setPassword('');
    setFullName('');
    Swal.fire({
      title: 'Keluar Berhasil',
      text: 'Sesi Anda telah diakhiri.',
      icon: 'info',
      timer: 1500,
      background: '#0f172a',
      color: '#f8fafc',
      showConfirmButton: false
    });
  };

  // Live client-side filter
  const filteredAssets = assets.filter(asset => {
    const matchesCategory = activeCategory === 'all' || String(asset.kategori_id) === String(activeCategory);
    const matchesSearch = asset.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          asset.deskripsi.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Handle GraphQL Live Search
  const handleSearchChange = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.trim() === '') {
      loadData();
      return;
    }
    try {
      const searchGql = `
        query SearchAssets($query: String!) {
          searchAssets(query: $query) {
            id
            kategori_id
            nama
            tipe
            deskripsi
            status
            image_url
            stok
            kategori {
              nama
            }
          }
        }
      `;
      const data = await graphqlRequest(searchGql, { query });
      if (data && data.searchAssets) {
        setAssets(data.searchAssets);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle User Booking Request
  const handleBookingRequest = (asset) => {
    if (asset.status === 'dipelihara') {
      Swal.fire({
        title: 'Fasilitas Tidak Tersedia',
        text: 'Aset ini sedang dalam pemeliharaan.',
        icon: 'warning',
        background: '#0f172a',
        color: '#f8fafc',
        confirmButtonColor: '#ef4444'
      });
      return;
    }

    Swal.fire({
      title: `<span class="text-indigo-400 font-bold text-2xl">Pesan: ${asset.nama}</span>`,
      html: `
        <div class="text-left text-sm text-slate-300 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Nama Peminjam</label>
            <input id="swal-user-name" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white opacity-80 cursor-not-allowed" value="${user.name}" disabled>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Peran</label>
            <input id="swal-user-role" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white opacity-80 uppercase cursor-not-allowed" value="${user.role}" disabled>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Tujuan Peminjaman</label>
            <textarea id="swal-desc" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500" placeholder="Contoh: Rapat Koordinasi Himpunan"></textarea>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-400 mb-1">Waktu Mulai</label>
              <input type="datetime-local" id="swal-start" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-400 mb-1">Waktu Selesai</label>
              <input type="datetime-local" id="swal-end" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500">
            </div>
          </div>
        </div>
      `,
      background: '#0f172a',
      color: '#f8fafc',
      showCancelButton: true,
      confirmButtonText: 'Ajukan Pemesanan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#475569',
      preConfirm: () => {
        const deskripsi = document.getElementById('swal-desc').value;
        const start_time = document.getElementById('swal-start').value;
        const end_time = document.getElementById('swal-end').value;

        if (!deskripsi || !start_time || !end_time) {
          Swal.showValidationMessage('Semua input wajib diisi!');
          return false;
        }
        return { asset_id: asset.id, user_id: user.id, user_name: user.name, user_role: user.role, deskripsi, start_time, end_time };
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const mutation = `
            mutation AddBooking($asset_id: ID!, $user_id: ID!, $user_name: String!, $user_role: String!, $deskripsi: String!, $start_time: String!, $end_time: String!) {
              addBooking(asset_id: $asset_id, user_id: $user_id, user_name: $user_name, user_role: $user_role, deskripsi: $deskripsi, start_time: $start_time, end_time: $end_time) {
                id
              }
            }
          `;
          await graphqlRequest(mutation, result.value);
          Swal.fire({
            title: 'Berhasil Diajukan!',
            text: 'Peminjaman Anda sedang menunggu persetujuan admin.',
            icon: 'success',
            background: '#0f172a',
            color: '#f8fafc',
            confirmButtonColor: '#6366f1'
          });
          loadData();
        } catch (err) {
          Swal.fire('Error', err.message || 'Gagal mengajukan booking', 'error');
        }
      }
    });
  };

  // Handle Admin Booking Status Update
  const handleUpdateBookingStatus = async (id, status) => {
    try {
      const mutation = `
        mutation UpdateBookingStatus($id: ID!, $status: String!) {
          updateBookingStatus(id: $id, status: $status) {
            id
            status
          }
        }
      `;
      await graphqlRequest(mutation, { id, status });
      Swal.fire({
        title: `Booking ${status === 'approved' ? 'Disetujui' : 'Ditolak'}`,
        text: `Status booking telah berhasil diubah menjadi ${status}.`,
        icon: 'success',
        background: '#0f172a',
        color: '#f8fafc',
        confirmButtonColor: '#6366f1'
      });
      loadData();
    } catch (err) {
      Swal.fire('Gagal', err.message || 'Gagal mengubah status', 'error');
    }
  };

  // Add Category
  const handleAddCategory = () => {
    Swal.fire({
      title: 'Tambah Kategori Aset Baru',
      html: `
        <input id="cat-name" class="swal2-input bg-slate-900 border border-slate-700 text-white" placeholder="Nama Kategori">
        <input id="cat-desc" class="swal2-input bg-slate-900 border border-slate-700 text-white" placeholder="Deskripsi Kategori">
      `,
      background: '#0f172a',
      color: '#f8fafc',
      showCancelButton: true,
      confirmButtonText: 'Simpan',
      confirmButtonColor: '#6366f1',
      preConfirm: () => {
        const nama = document.getElementById('cat-name').value;
        const deskripsi = document.getElementById('cat-desc').value;
        if (!nama) {
          Swal.showValidationMessage('Nama Kategori wajib diisi!');
          return false;
        }
        return { nama, deskripsi };
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const mutation = `
            mutation AddKategori($nama: String!, $deskripsi: String) {
              addKategori(nama: $nama, deskripsi: $deskripsi) {
                id
              }
            }
          `;
          await graphqlRequest(mutation, result.value);
          Swal.fire('Tersimpan!', 'Kategori aset berhasil ditambahkan.', 'success');
          loadData();
        } catch (err) {
          Swal.fire('Error', err.message, 'error');
        }
      }
    });
  };

  // Delete Category
  const handleDeleteCategory = async (id) => {
    const confirm = await Swal.fire({
      title: 'Apakah Anda yakin?',
      text: 'Kategori ini akan dihapus secara permanen.',
      icon: 'warning',
      background: '#0f172a',
      color: '#f8fafc',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#475569',
      confirmButtonText: 'Ya, Hapus'
    });

    if (confirm.isConfirmed) {
      try {
        const mutation = `
          mutation DeleteKategori($id: ID!) {
            deleteKategori(id: $id)
          }
        `;
        await graphqlRequest(mutation, { id });
        Swal.fire('Terhapus!', 'Kategori berhasil dihapus.', 'success');
        loadData();
      } catch (err) {
        Swal.fire('Gagal', err.message, 'error');
      }
    }
  };

  // Add Asset
  const handleAddAsset = () => {
    Swal.fire({
      title: 'Tambah Aset Fasilitas Baru',
      html: `
        <div class="text-left text-sm text-slate-300 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Nama Fasilitas</label>
            <input id="ast-name" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500" placeholder="Contoh: Lab Komputer C">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Kategori</label>
            <select id="ast-cat" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500">
              ${categories.map(c => `<option value="${c.id}">${c.nama}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Tipe</label>
            <select id="ast-type" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500">
              <option value="ruangan">Ruangan</option>
              <option value="laboratorium">Laboratorium</option>
              <option value="peralatan">Peralatan</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Deskripsi</label>
            <textarea id="ast-desc" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500" placeholder="Detail spesifikasi fasilitas"></textarea>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Stok Fasilitas</label>
            <input id="ast-stock" type="number" min="1" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500" value="1">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">URL Gambar (Opsional)</label>
            <input id="ast-image" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500" placeholder="https://example.com/image.jpg">
          </div>
        </div>
      `,
      background: '#0f172a',
      color: '#f8fafc',
      showCancelButton: true,
      confirmButtonText: 'Simpan Aset',
      confirmButtonColor: '#6366f1',
      preConfirm: () => {
        const nama = document.getElementById('ast-name').value;
        const kategori_id = document.getElementById('ast-cat').value;
        const tipe = document.getElementById('ast-type').value;
        const deskripsi = document.getElementById('ast-desc').value;
        const image_url = document.getElementById('ast-image').value;
        const stok = parseInt(document.getElementById('ast-stock').value) || 1;

        if (!nama || !kategori_id || !tipe) {
          Swal.showValidationMessage('Nama, Kategori, dan Tipe wajib diisi!');
          return false;
        }
        return { nama, kategori_id: String(kategori_id), tipe, deskripsi, status: 'tersedia', image_url, stok };
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const mutation = `
            mutation AddAsset($kategori_id: ID!, $nama: String!, $tipe: String!, $deskripsi: String, $status: String, $image_url: String, $stok: Int) {
              addAsset(kategori_id: $kategori_id, nama: $nama, tipe: $tipe, deskripsi: $deskripsi, status: $status, image_url: $image_url, stok: $stok) {
                id
              }
            }
          `;
          await graphqlRequest(mutation, result.value);
          Swal.fire('Tersimpan!', 'Fasilitas baru berhasil ditambahkan.', 'success');
          loadData();
        } catch (err) {
          Swal.fire('Error', err.message, 'error');
        }
      }
    });
  };

  // Edit Asset
  const handleEditAsset = (asset) => {
    Swal.fire({
      title: 'Edit Aset Fasilitas',
      html: `
        <div class="text-left text-sm text-slate-300 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Nama Fasilitas</label>
            <input id="edit-ast-name" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500" value="${asset.nama}">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Kategori</label>
            <select id="edit-ast-cat" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500">
              ${categories.map(c => `<option value="${c.id}" ${String(c.id) === String(asset.kategori_id) ? 'selected' : ''}>${c.nama}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Tipe</label>
            <select id="edit-ast-type" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500">
              <option value="ruangan" ${asset.tipe === 'ruangan' ? 'selected' : ''}>Ruangan</option>
              <option value="laboratorium" ${asset.tipe === 'laboratorium' ? 'selected' : ''}>Laboratorium</option>
              <option value="peralatan" ${asset.tipe === 'peralatan' ? 'selected' : ''}>Peralatan</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Deskripsi</label>
            <textarea id="edit-ast-desc" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500">${asset.deskripsi || ''}</textarea>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Status</label>
            <select id="edit-ast-status" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500">
              <option value="tersedia" ${asset.status === 'tersedia' ? 'selected' : ''}>Tersedia</option>
              <option value="dipelihara" ${asset.status === 'dipelihara' ? 'selected' : ''}>Pemeliharaan (Under Maintenance)</option>
              <option value="dipakai" ${asset.status === 'dipakai' ? 'selected' : ''}>Sedang Dipakai</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Stok Fasilitas</label>
            <input id="edit-ast-stock" type="number" min="1" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500" value="${asset.stok || 1}">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">URL Gambar (Opsional)</label>
            <input id="edit-ast-image" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500" value="${asset.image_url || ''}">
          </div>
        </div>
      `,
      background: '#0f172a',
      color: '#f8fafc',
      showCancelButton: true,
      confirmButtonText: 'Simpan Perubahan',
      confirmButtonColor: '#6366f1',
      preConfirm: () => {
        const nama = document.getElementById('edit-ast-name').value;
        const kategori_id = document.getElementById('edit-ast-cat').value;
        const tipe = document.getElementById('edit-ast-type').value;
        const deskripsi = document.getElementById('edit-ast-desc').value;
        const status = document.getElementById('edit-ast-status').value;
        const image_url = document.getElementById('edit-ast-image').value;
        const stok = parseInt(document.getElementById('edit-ast-stock').value) || 1;

        if (!nama || !kategori_id || !tipe) {
          Swal.showValidationMessage('Nama, Kategori, dan Tipe wajib diisi!');
          return false;
        }
        return { id: asset.id, nama, kategori_id: String(kategori_id), tipe, deskripsi, status, image_url, stok };
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const mutation = `
            mutation UpdateAsset($id: ID!, $kategori_id: ID, $nama: String, $tipe: String, $deskripsi: String, $status: String, $image_url: String, $stok: Int) {
              updateAsset(id: $id, kategori_id: $kategori_id, nama: $nama, tipe: $tipe, deskripsi: $deskripsi, status: $status, image_url: $image_url, stok: $stok) {
                id
              }
            }
          `;
          await graphqlRequest(mutation, result.value);
          Swal.fire('Terupdate!', 'Fasilitas berhasil diperbarui.', 'success');
          loadData();
        } catch (err) {
          Swal.fire('Error', err.message, 'error');
        }
      }
    });
  };

  // Delete Asset
  const handleDeleteAsset = async (id) => {
    const confirm = await Swal.fire({
      title: 'Hapus Fasilitas?',
      text: 'Aset ini akan dihapus secara permanen.',
      icon: 'warning',
      background: '#0f172a',
      color: '#f8fafc',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#475569',
      confirmButtonText: 'Hapus'
    });

    if (confirm.isConfirmed) {
      try {
        const mutation = `
          mutation DeleteAsset($id: ID!) {
            deleteAsset(id: $id)
          }
        `;
        await graphqlRequest(mutation, { id });
        Swal.fire('Terhapus!', 'Aset berhasil dihapus.', 'success');
        loadData();
      } catch (err) {
        Swal.fire('Gagal', err.message, 'error');
      }
    }
  };

  // Delete Schedule
  const handleDeleteSchedule = async (id) => {
    const confirm = await Swal.fire({
      title: 'Hapus Jadwal?',
      text: 'Jadwal kegiatan aset ini akan dihapus.',
      icon: 'warning',
      background: '#0f172a',
      color: '#f8fafc',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#475569',
      confirmButtonText: 'Hapus'
    });

    if (confirm.isConfirmed) {
      try {
        const mutation = `
          mutation DeleteSchedule($id: ID!) {
            deleteSchedule(id: $id)
          }
        `;
        await graphqlRequest(mutation, { id });
        Swal.fire('Terhapus!', 'Jadwal berhasil dihapus.', 'success');
        loadData();
      } catch (err) {
        Swal.fire('Gagal', err.message, 'error');
      }
    }
  };

  // Helper date formatting
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isAdmin = user && user.role === 'admin';

  // ----------------------------------------------------
  // RENDER LOGIN / REGISTER VIEW
  // ----------------------------------------------------
  if (!user) {
    return (
      <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center relative overflow-hidden font-sans px-4">
        {/* Background decorative elements */}
        <div class="absolute w-[400px] height-[400px] rounded-full bg-indigo-500/10 blur-[100px] top-[-100px] left-[-100px]"></div>
        <div class="absolute w-[500px] height-[500px] rounded-full bg-emerald-500/10 blur-[120px] bottom-[-150px] right-[-150px]"></div>

        <div class="max-w-md w-full bg-slate-900/55 border border-slate-800/80 rounded-3xl p-8 backdrop-blur-xl shadow-2xl z-10 transition duration-300">
          <div class="text-center mb-8">
            <div class="inline-flex bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-600/30 text-white mb-4">
              <Building class="h-8 w-8" />
            </div>
            <h1 class="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-300 to-indigo-500 bg-clip-text text-transparent">SIPEMFA</h1>
            <p class="text-xs text-slate-400 mt-1">Sistem Peminjaman Fasilitas Kampus Terdistribusi</p>
          </div>

          {authMode === 'login' ? (
            <form onSubmit={handleLogin} class="space-y-5">
              <div>
                <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Username</label>
                <div class="relative">
                  <User class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 h-4.5 w-4.5" />
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username" 
                    class="w-full bg-slate-950/80 border border-slate-850 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Kata Sandi</label>
                <div class="relative">
                  <Lock class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 h-4.5 w-4.5" />
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password" 
                    class="w-full bg-slate-950/80 border border-slate-850 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl text-sm transition shadow-lg shadow-indigo-600/20"
              >
                Masuk ke Aplikasi
              </button>

              <div class="text-center text-xs text-slate-400 mt-4">
                Belum punya akun?{' '}
                <button 
                  type="button" 
                  onClick={() => setAuthMode('register')} 
                  class="text-indigo-400 hover:underline font-semibold"
                >
                  Daftar Sekarang
                </button>
              </div>

              {/* Quick Login Section */}
              <div class="border-t border-slate-800/80 pt-6 mt-6">
                <span class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 text-center mb-3">Login Cepat (Uji Coba)</span>
                <div class="grid grid-cols-3 gap-2">
                  <button 
                    type="button"
                    onClick={() => handleQuickLogin('admin')}
                    class="bg-slate-950 hover:bg-indigo-950 border border-slate-850 hover:border-indigo-700/40 text-[10px] font-semibold py-2 px-1 rounded-lg text-slate-300 transition"
                  >
                    🔐 Admin
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleQuickLogin('budi')}
                    class="bg-slate-950 hover:bg-indigo-950 border border-slate-850 hover:border-indigo-700/40 text-[10px] font-semibold py-2 px-1 rounded-lg text-slate-300 transition"
                  >
                    🎓 Mahasiswa
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleQuickLogin('irwan')}
                    class="bg-slate-950 hover:bg-indigo-950 border border-slate-850 hover:border-indigo-700/40 text-[10px] font-semibold py-2 px-1 rounded-lg text-slate-300 transition"
                  >
                    👨‍🏫 Dosen
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Nama Lengkap</label>
                <input 
                  type="text" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Contoh: Budi Santoso" 
                  class="w-full bg-slate-950/80 border border-slate-850 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Username</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Contoh: budi123" 
                  class="w-full bg-slate-950/80 border border-slate-850 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Peran</label>
                <select 
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  class="w-full bg-slate-950/80 border border-slate-850 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="mahasiswa">Mahasiswa</option>
                  <option value="dosen">Dosen</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Kata Sandi</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter" 
                  class="w-full bg-slate-950/80 border border-slate-850 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <button 
                type="submit" 
                class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl text-sm transition shadow-lg shadow-indigo-600/20 mt-2"
              >
                Buat Akun
              </button>

              <div class="text-center text-xs text-slate-400 mt-3">
                Sudah punya akun?{' '}
                <button 
                  type="button" 
                  onClick={() => setAuthMode('login')} 
                  class="text-indigo-400 hover:underline font-semibold"
                >
                  Masuk di sini
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER APP CORE VIEW (WHEN LOGGED IN)
  // ----------------------------------------------------
  return (
    <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* HEADER NAVBAR */}
      <header class="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-600/30 text-white">
              <Building class="h-6 w-6" />
            </div>
            <div>
              <h1 class="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                SIPEMFA <span class="text-xs bg-indigo-500/20 text-indigo-400 font-medium px-2 py-0.5 rounded-full">Pure GraphQL</span>
              </h1>
              <p class="text-xs text-slate-400">Sistem Peminjaman Fasilitas Kampus Terdistribusi</p>
            </div>
          </div>

          <div class="flex items-center gap-4">
            {/* User profile info */}
            <div class="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-300">
              <User class="h-3.5 w-3.5 text-indigo-400" />
              <span>{user.name}</span>
              <span class="font-bold text-indigo-400 uppercase text-[9px] bg-indigo-500/10 px-1.5 py-0.5 rounded">
                {user.role}
              </span>
            </div>

            <button 
              onClick={handleLogout}
              class="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-red-700 hover:text-white text-slate-300 text-xs font-semibold transition"
            >
              <LogOut class="h-3.5 w-3.5" />
              Keluar
            </button>
          </div>
        </div>
      </header>

      {/* DASHBOARD STATS */}
      <section class="max-w-7xl mx-auto px-6 w-full pt-8 grid grid-cols-2 md:grid-cols-4 gap-6">
        <div class="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4">
          <div class="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <Building class="h-6 w-6" />
          </div>
          <div>
            <div class="text-2xl font-bold text-white">{assets.length}</div>
            <div class="text-xs text-slate-400">Total Fasilitas</div>
          </div>
        </div>
        <div class="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4">
          <div class="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <Layers class="h-6 w-6" />
          </div>
          <div>
            <div class="text-2xl font-bold text-white">{categories.length}</div>
            <div class="text-xs text-slate-400">Kategori Aset</div>
          </div>
        </div>
        <div class="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4">
          <div class="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
            <Clock class="h-6 w-6" />
          </div>
          <div>
            <div class="text-2xl font-bold text-white">{bookings.filter(b => b.status === 'pending').length}</div>
            <div class="text-xs text-slate-400">Menunggu Review</div>
          </div>
        </div>
        <div class="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4">
          <div class="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Calendar class="h-6 w-6" />
          </div>
          <div>
            <div class="text-2xl font-bold text-white">{schedules.length}</div>
            <div class="text-xs text-slate-400">Jadwal Aktif</div>
          </div>
        </div>
      </section>

      {/* MAIN LAYOUT */}
      <main class="max-w-7xl mx-auto px-6 w-full py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT / MAIN PANEL: ASSET MANAGEMENT & BROWSER */}
        <div class="lg:col-span-8 flex flex-col gap-6">
          
          {/* SEARCH & FILTERS */}
          <div class="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="relative flex-1">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <input 
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Cari ruangan, lab, atau proyektor..."
                class="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            
            <div class="flex items-center gap-2 overflow-x-auto">
              <button 
                onClick={() => setActiveCategory('all')}
                class={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  activeCategory === 'all' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400'
                }`}
              >
                Semua Kategori
              </button>
              {categories.map(cat => (
                <button 
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  class={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    activeCategory === cat.id 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  {cat.nama}
                </button>
              ))}
            </div>
          </div>

          {/* ASSET CARDS GRID */}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredAssets.length > 0 ? (
              filteredAssets.map(asset => (
                <div key={asset.id} class="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden flex flex-col transition hover:border-slate-700/80">
                  <div class="h-44 bg-slate-950 relative">
                    <img 
                      src={asset.image_url || 'https://images.unsplash.com/photo-1397825222-38612140410d?w=800'} 
                      alt={asset.nama} 
                      class="w-full h-full object-cover opacity-80"
                    />
                    <div class="absolute top-3 right-3 flex gap-2">
                      <span class={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        asset.status === 'tersedia' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : asset.status === 'dipakai'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {asset.status === 'tersedia' ? 'Tersedia' : asset.status === 'dipakai' ? 'Sedang Dipakai' : 'Pemeliharaan'}
                      </span>
                      <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {asset.tipe}
                      </span>
                      <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-500/10 text-slate-400 border border-slate-500/20">
                        Stok: {asset.stok || 1}
                      </span>
                    </div>
                  </div>

                  <div class="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 class="text-lg font-bold text-white mb-2">{asset.nama}</h3>
                      <p class="text-xs text-slate-400 line-clamp-3 mb-4 leading-relaxed">{asset.deskripsi}</p>
                    </div>

                    <div class="pt-4 border-t border-slate-800/60 flex items-center justify-between gap-4">
                      {isAdmin ? (
                        <div class="flex items-center gap-2 w-full">
                          <button 
                            onClick={() => handleEditAsset(asset)}
                            class="flex items-center justify-center gap-1.5 flex-1 bg-amber-600/10 hover:bg-amber-600 text-amber-400 hover:text-white border border-amber-500/20 py-2 rounded-xl text-xs font-semibold transition"
                          >
                            <Edit class="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteAsset(asset.id)}
                            class="flex items-center justify-center gap-1.5 flex-1 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 py-2 rounded-xl text-xs font-semibold transition"
                          >
                            <Trash2 class="h-3.5 w-3.5" />
                            Hapus
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => handleBookingRequest(asset)}
                          disabled={asset.status !== 'tersedia'}
                          class={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                            asset.status === 'tersedia'
                              ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          <Calendar class="h-3.5 w-3.5" />
                          Booking Sekarang
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div class="col-span-full bg-slate-900/20 border border-slate-800 border-dashed rounded-2xl p-12 text-center text-slate-400">
                <Info class="mx-auto h-8 w-8 text-slate-500 mb-3" />
                <p class="text-sm">Tidak ada fasilitas ditemukan yang cocok dengan kriteria pencarian.</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: BOOKINGS, SCHEDULE & ADMIN MANAGE */}
        <div class="lg:col-span-4 flex flex-col gap-6">
          
          {/* ADMIN MANAGEMENT PANEL */}
          {isAdmin && (
            <div class="bg-indigo-950/20 border border-indigo-800/40 rounded-2xl p-6 flex flex-col gap-4">
              <h3 class="text-sm font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck class="h-4 w-4" />
                Manajemen Admin
              </h3>
              <div class="grid grid-cols-2 gap-4">
                <button 
                  onClick={handleAddAsset}
                  class="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold p-3 rounded-xl transition"
                >
                  <Plus class="h-4 w-4" />
                  Tambah Aset
                </button>
                <button 
                  onClick={handleAddCategory}
                  class="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold p-3 rounded-xl transition"
                >
                  <Plus class="h-4 w-4" />
                  Tambah Kategori
                </button>
              </div>
            </div>
          )}

          {/* ACTIVE BOOKINGS LIST (PENDING / APPROVED) */}
          <div class="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6">
            <h3 class="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileText class="h-4 w-4 text-indigo-400" />
              {isAdmin ? 'Persetujuan Peminjaman' : 'Daftar Pengajuan Saya'}
            </h3>
            
            <div class="space-y-4 max-h-[300px] overflow-y-auto pr-1">
              {bookings.length > 0 ? (
                bookings.map(book => (
                  <div key={book.id} class="p-4 bg-slate-950 border border-slate-800/60 rounded-xl flex flex-col gap-3">
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <h4 class="text-sm font-bold text-white">{book.asset ? book.asset.nama : 'Aset'}</h4>
                        <div class="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
                          <User class="h-3 w-3" />
                          <span>{book.user_name} ({book.user_role})</span>
                        </div>
                      </div>
                      
                      <span class={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        book.status === 'approved' 
                          ? 'bg-emerald-500/10 text-emerald-400' 
                          : book.status === 'rejected'
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {book.status}
                      </span>
                    </div>

                    <p class="text-xs text-slate-400 italic">"{book.deskripsi}"</p>

                    <div class="text-[11px] text-slate-500 border-t border-slate-800/50 pt-2 flex flex-col gap-1">
                      <div>Mulai: {formatDateTime(book.start_time)}</div>
                      <div>Selesai: {formatDateTime(book.end_time)}</div>
                    </div>

                    {isAdmin && book.status === 'pending' && (
                      <div class="flex items-center gap-2 pt-2">
                        <button 
                          onClick={() => handleUpdateBookingStatus(book.id, 'approved')}
                          class="flex items-center justify-center gap-1 flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold py-1.5 rounded-lg transition"
                        >
                          <CheckCircle2 class="h-3.5 w-3.5" />
                          Setujui
                        </button>
                        <button 
                          onClick={() => handleUpdateBookingStatus(book.id, 'rejected')}
                          class="flex items-center justify-center gap-1 flex-1 bg-red-600/15 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/10 text-[11px] font-bold py-1.5 rounded-lg transition"
                        >
                          <XCircle class="h-3.5 w-3.5" />
                          Tolak
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p class="text-xs text-slate-500 text-center py-6">Belum ada pemesanan diajukan.</p>
              )}
            </div>
          </div>

          {/* CAMPUS SCHEDULES */}
          <div class="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6">
            <h3 class="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Calendar class="h-4 w-4 text-indigo-400" />
              Kalender Kegiatan Fasilitas
            </h3>

            <div class="space-y-4 max-h-[300px] overflow-y-auto pr-1">
              {schedules.length > 0 ? (
                schedules.map(sched => (
                  <div key={sched.id} class="p-3.5 bg-slate-950 border border-slate-800/60 rounded-xl flex items-start justify-between gap-3">
                    <div class="flex gap-3">
                      <div class="bg-indigo-600/15 text-indigo-400 font-bold text-center px-2.5 py-1.5 rounded-lg text-xs self-start">
                        {new Date(sched.date).getDate()}
                        <div class="text-[9px] font-normal uppercase tracking-wider text-slate-400">
                          {new Date(sched.date).toLocaleString('id-ID', { month: 'short' })}
                        </div>
                      </div>

                      <div>
                        <h4 class="text-xs font-bold text-white">{sched.event_name}</h4>
                        <div class="text-[10px] text-indigo-400 mt-0.5">{sched.asset ? sched.asset.nama : 'Aset'}</div>
                        <div class="text-[10px] text-slate-500 mt-1">{sched.deskripsi}</div>
                      </div>
                    </div>

                    {isAdmin && (
                      <button 
                        onClick={() => handleDeleteSchedule(sched.id)}
                        class="text-slate-500 hover:text-red-400 transition p-1"
                      >
                        <Trash2 class="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p class="text-xs text-slate-500 text-center py-6">Belum ada kegiatan terjadwal.</p>
              )}
            </div>
          </div>

        </div>

      </main>

      {/* FOOTER */}
      <footer class="border-t border-slate-900 bg-slate-950 py-6 mt-12">
        <div class="max-w-7xl mx-auto px-6 text-center text-xs text-slate-500">
          <p>© 2026 SIPEMFA - Sistem Peminjaman Fasilitas Kampus Terdistribusi (Microservices).</p>
          <p class="mt-2 text-slate-600">Built using Node.js, Express, React, MySQL, Tailwind CSS, &amp; SweetAlert2.</p>
        </div>
      </footer>
    </div>
  );
}
