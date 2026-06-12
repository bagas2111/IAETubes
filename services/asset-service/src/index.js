import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root_password',
  database: 'asset_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool;

async function initDb() {
  let attempts = 15;
  while (attempts) {
    try {
      pool = mysql.createPool(dbConfig);
      const connection = await pool.getConnection();

      // Run database migrations/updates
      try {
        // Add stok column if missing
        const [columns] = await connection.query("SHOW COLUMNS FROM asset LIKE 'stok'");
        if (columns.length === 0) {
          console.log('Adding stok column to asset table...');
          await connection.query("ALTER TABLE asset ADD COLUMN stok INT NOT NULL DEFAULT 1");
        }
      } catch (migErr) {
        console.error('Migration error adding stok column:', migErr.message);
      }

      try {
        // Update status enum values to include 'dipakai'
        await connection.query("ALTER TABLE asset MODIFY COLUMN status ENUM('tersedia', 'dipelihara', 'dipakai') DEFAULT 'tersedia'");
      } catch (migErr) {
        console.error('Migration error modifying status enum:', migErr.message);
      }

      connection.release();
      console.log('✅ Connected to MySQL asset_db pool successfully');
      break;
    } catch (err) {
      console.log(`❌ DB connection failed, retrying... (${attempts} attempts left)`);
      attempts -= 1;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  if (!pool) {
    console.error('Could not connect to database, exiting');
    process.exit(1);
  }
}

const CATEGORY_SVC_URL = process.env.CATEGORY_SVC_URL || 'http://category-service:4001/';

// Fetch categories from Category Service using GraphQL
async function getCategories() {
  const query = `
    query {
      kategoriList {
        id
        nama
        deskripsi
      }
    }
  `;
  try {
    const res = await fetch(CATEGORY_SVC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const json = await res.json();
    return json.data?.kategoriList || [];
  } catch (err) {
    console.error('Failed to fetch categories via GraphQL:', err.message);
    return [];
  }
}

// Helper to determine dynamic asset statuses based on active schedules
async function resolveDynamicStatuses(assets, pool) {
  let schedules = [];
  try {
    const [rows] = await pool.query('SELECT asset_id, date FROM schedule_db.schedule');
    schedules = rows;
  } catch (err) {
    console.warn('⚠️ Could not fetch schedules for dynamic status:', err.message);
  }

  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  const getLocalDateString = (dateObj) => {
    if (!(dateObj instanceof Date)) return String(dateObj);
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dayVal = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayVal}`;
  };

  return assets.map(asset => {
    const activeSchedulesCount = schedules.filter(s => 
      String(s.asset_id) === String(asset.id) && 
      getLocalDateString(s.date) === todayStr
    ).length;

    let resolvedStatus = asset.status;
    if (asset.status === 'tersedia') {
      if (activeSchedulesCount >= (asset.stok || 1)) {
        resolvedStatus = 'dipakai';
      }
    }
    return {
      ...asset,
      status: resolvedStatus
    };
  });
}

const typeDefs = `#graphql
  type Kategori {
    id: ID!
    nama: String!
    deskripsi: String
  }

  type Asset {
    id: ID!
    kategori_id: ID!
    nama: String!
    tipe: String!
    deskripsi: String
    status: String!
    image_url: String
    stok: Int!
    kategori: Kategori
  }

  type Query {
    assets: [Asset]
    asset(id: ID!): Asset
    searchAssets(query: String!): [Asset]
  }

  type Mutation {
    addAsset(kategori_id: ID!, nama: String!, tipe: String!, deskripsi: String, status: String, image_url: String, stok: Int): Asset
    updateAsset(id: ID!, kategori_id: ID, nama: String, tipe: String, deskripsi: String, status: String, image_url: String, stok: Int): Asset
    deleteAsset(id: ID!): Boolean
  }
`;

const resolvers = {
  Query: {
    assets: async () => {
      try {
        const [rows] = await pool.query('SELECT * FROM asset');
        const resolvedRows = await resolveDynamicStatuses(rows, pool);
        const categories = await getCategories();
        return resolvedRows.map(asset => {
          const cat = categories.find(c => String(c.id) === String(asset.kategori_id));
          return {
            ...asset,
            kategori: cat || { id: asset.kategori_id, nama: 'Tidak Diketahui', deskripsi: '' }
          };
        });
      } catch (err) {
        throw new Error(err.message);
      }
    },
    asset: async (_, { id }) => {
      try {
        const [rows] = await pool.query('SELECT * FROM asset WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        const resolvedRows = await resolveDynamicStatuses(rows, pool);
        const asset = resolvedRows[0];
        const categories = await getCategories();
        const cat = categories.find(c => String(c.id) === String(asset.kategori_id));
        return {
          ...asset,
          kategori: cat || { id: asset.kategori_id, nama: 'Tidak Diketahui', deskripsi: '' }
        };
      } catch (err) {
        throw new Error(err.message);
      }
    },
    searchAssets: async (_, { query }) => {
      try {
        const [rows] = await pool.query(
          'SELECT * FROM asset WHERE nama LIKE ? OR deskripsi LIKE ?',
          [`%${query}%`, `%${query}%`]
        );
        const resolvedRows = await resolveDynamicStatuses(rows, pool);
        const categories = await getCategories();
        return resolvedRows.map(asset => {
          const cat = categories.find(c => String(c.id) === String(asset.kategori_id));
          return {
            ...asset,
            kategori: cat || { id: asset.kategori_id, nama: 'Tidak Diketahui', deskripsi: '' }
          };
        });
      } catch (err) {
        throw new Error(err.message);
      }
    }
  },
  Mutation: {
    addAsset: async (_, { kategori_id, nama, tipe, deskripsi, status, image_url, stok }) => {
      // Validate category exists
      const categories = await getCategories();
      const catExists = categories.some(c => String(c.id) === String(kategori_id));
      if (!catExists) {
        throw new Error('Kategori ID tidak ditemukan');
      }

      try {
        const [result] = await pool.query(
          'INSERT INTO asset (kategori_id, nama, tipe, deskripsi, status, image_url, stok) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [kategori_id, nama, tipe, deskripsi || '', status || 'tersedia', image_url || '', stok !== undefined ? stok : 1]
        );
        return {
          id: result.insertId,
          kategori_id,
          nama,
          tipe,
          deskripsi,
          status: status || 'tersedia',
          image_url,
          stok: stok !== undefined ? stok : 1
        };
      } catch (err) {
        throw new Error(err.message);
      }
    },
    updateAsset: async (_, { id, kategori_id, nama, tipe, deskripsi, status, image_url, stok }) => {
      const [rows] = await pool.query('SELECT * FROM asset WHERE id = ?', [id]);
      if (rows.length === 0) {
        throw new Error('Aset tidak ditemukan');
      }
      const current = rows[0];

      const newKategoriId = kategori_id !== undefined ? kategori_id : current.kategori_id;
      const newNama = nama !== undefined ? nama : current.nama;
      const newTipe = tipe !== undefined ? tipe : current.tipe;
      const newDeskripsi = deskripsi !== undefined ? deskripsi : current.deskripsi;
      const newStatus = status !== undefined ? status : current.status;
      const newImageUrl = image_url !== undefined ? image_url : current.image_url;
      const newStok = stok !== undefined ? stok : current.stok;

      if (kategori_id !== undefined) {
        const categories = await getCategories();
        const catExists = categories.some(c => String(c.id) === String(kategori_id));
        if (!catExists) {
          throw new Error('Kategori ID tidak ditemukan');
        }
      }

      try {
        await pool.query(
          'UPDATE asset SET kategori_id = ?, nama = ?, tipe = ?, deskripsi = ?, status = ?, image_url = ?, stok = ? WHERE id = ?',
          [newKategoriId, newNama, newTipe, newDeskripsi, newStatus, newImageUrl, newStok, id]
        );
        return {
          id,
          kategori_id: newKategoriId,
          nama: newNama,
          tipe: newTipe,
          deskripsi: newDeskripsi,
          status: newStatus,
          image_url: newImageUrl,
          stok: newStok
        };
      } catch (err) {
        throw new Error(err.message);
      }
    },
    deleteAsset: async (_, { id }) => {
      try {
        const [result] = await pool.query('DELETE FROM asset WHERE id = ?', [id]);
        return result.affectedRows > 0;
      } catch (err) {
        throw new Error(err.message);
      }
    }
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

await initDb();

const { url } = await startStandaloneServer(server, {
  listen: { 
    port: process.env.PORT || 4002,
    host: '0.0.0.0'
  }
});

console.log(`🚀 Asset Service ready at ${url}`);

