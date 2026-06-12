import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root_password',
  database: 'schedule_db',
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
      console.log('✅ Connected to MySQL schedule_db pool successfully');
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

const ASSET_SVC_URL = process.env.ASSET_SVC_URL || 'http://asset-service:4002/';

// Fetch assets via GraphQL
async function getAssets() {
  const query = `
    query {
      assets {
        id
        nama
        tipe
        status
        deskripsi
      }
    }
  `;
  try {
    const res = await fetch(ASSET_SVC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const json = await res.json();
    return json.data?.assets || [];
  } catch (err) {
    console.error('Failed to fetch assets via GraphQL:', err.message);
    return [];
  }
}

const typeDefs = `#graphql
  type Asset {
    id: ID!
    nama: String!
    tipe: String!
    status: String!
    deskripsi: String
  }

  type Schedule {
    id: ID!
    asset_id: ID!
    date: String!
    event_name: String!
    deskripsi: String
    asset: Asset
  }

  type Query {
    schedules: [Schedule]
  }

  type Mutation {
    addSchedule(asset_id: ID!, date: String!, event_name: String!, deskripsi: String): Schedule
    deleteSchedule(id: ID!): Boolean
  }
`;

const resolvers = {
  Query: {
    schedules: async () => {
      try {
        const [rows] = await pool.query('SELECT * FROM schedule ORDER BY date ASC');
        const assets = await getAssets();
        return rows.map(s => ({
          ...s,
          asset: assets.find(a => String(a.id) === String(s.asset_id)) || null
        }));
      } catch (err) {
        throw new Error(err.message);
      }
    }
  },
  Mutation: {
    addSchedule: async (_, { asset_id, date, event_name, deskripsi }) => {
      // Validate asset
      const assets = await getAssets();
      const assetExists = assets.some(a => String(a.id) === String(asset_id));
      if (!assetExists) {
        throw new Error('Aset tidak ditemukan');
      }

      try {
        const [result] = await pool.query(
          'INSERT INTO schedule (asset_id, date, event_name, deskripsi) VALUES (?, ?, ?, ?)',
          [asset_id, date, event_name, deskripsi || '']
        );
        return { id: result.insertId, asset_id, date, event_name, deskripsi };
      } catch (err) {
        throw new Error(err.message);
      }
    },
    deleteSchedule: async (_, { id }) => {
      try {
        const [result] = await pool.query('DELETE FROM schedule WHERE id = ?', [id]);
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
    port: process.env.PORT || 4004,
    host: '0.0.0.0'
  }
});

console.log(`🚀 Schedule Service ready at ${url}`);
