import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root_password',
  database: 'category_db',
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
      console.log('✅ Connected to MySQL category_db pool successfully');
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

const typeDefs = `#graphql
  type Kategori {
    id: ID!
    nama: String!
    deskripsi: String
  }

  type Query {
    kategoriList: [Kategori]
    kategori(id: ID!): Kategori
  }

  type Mutation {
    addKategori(nama: String!, deskripsi: String): Kategori
    deleteKategori(id: ID!): Boolean
  }
`;

const resolvers = {
  Query: {
    kategoriList: async () => {
      try {
        const [rows] = await pool.query('SELECT * FROM kategori');
        return rows;
      } catch (err) {
        throw new Error(err.message);
      }
    },
    kategori: async (_, { id }) => {
      try {
        const [rows] = await pool.query('SELECT * FROM kategori WHERE id = ?', [id]);
        return rows[0] || null;
      } catch (err) {
        throw new Error(err.message);
      }
    }
  },
  Mutation: {
    addKategori: async (_, { nama, deskripsi }) => {
      try {
        const [result] = await pool.query(
          'INSERT INTO kategori (nama, deskripsi) VALUES (?, ?)',
          [nama, deskripsi]
        );
        return { id: result.insertId, nama, deskripsi };
      } catch (err) {
        throw new Error(err.message);
      }
    },
    deleteKategori: async (_, { id }) => {
      try {
        const [result] = await pool.query('DELETE FROM kategori WHERE id = ?', [id]);
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
    port: process.env.PORT || 4001,
    host: '0.0.0.0'
  }
});

console.log(`🚀 Category Service ready at ${url}`);
