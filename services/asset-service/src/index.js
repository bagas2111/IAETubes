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
    kategori: Kategori
  }

  type Query {
    assets: [Asset]
    asset(id: ID!): Asset
    searchAssets(query: String!): [Asset]
  }

  type Mutation {
    addAsset(kategori_id: ID!, nama: String!, tipe: String!, deskripsi: String, status: String, image_url: String): Asset
    deleteAsset(id: ID!): Boolean
  }
`;

const resolvers = {
  Query: {
    assets: async () => {
      try {
        const [rows] = await pool.query('SELECT * FROM asset');
        const categories = await getCategories();
        return rows.map(asset => {
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
        const asset = rows[0];
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
        const categories = await getCategories();
        return rows.map(asset => {
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
    addAsset: async (_, { kategori_id, nama, tipe, deskripsi, status, image_url }) => {
      // Validate category exists
      const categories = await getCategories();
      const catExists = categories.some(c => String(c.id) === String(kategori_id));
      if (!catExists) {
        throw new Error('Kategori ID tidak ditemukan');
      }

      try {
        const [result] = await pool.query(
          'INSERT INTO asset (kategori_id, nama, tipe, deskripsi, status, image_url) VALUES (?, ?, ?, ?, ?, ?)',
          [kategori_id, nama, tipe, deskripsi || '', status || 'tersedia', image_url || '']
        );
        return {
          id: result.insertId,
          kategori_id,
          nama,
          tipe,
          deskripsi,
          status: status || 'tersedia',
          image_url
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
