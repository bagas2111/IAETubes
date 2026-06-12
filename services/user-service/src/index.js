import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'jwt_super_secret_key_123';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root_password',
  database: 'user_db',
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
      console.log('✅ Connected to MySQL user_db pool successfully');
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

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

const typeDefs = `#graphql
  type User {
    id: ID!
    username: String!
    name: String!
    role: String!
  }

  type AuthResponse {
    success: Boolean!
    token: String
    user: User
    message: String
  }

  type Query {
    users: [User]
    user(id: ID!): User
    me: User
  }

  type Mutation {
    register(username: String!, name: String!, role: String!, sandi: String!): User
    login(username: String!, sandi: String!): AuthResponse
  }
`;

const resolvers = {
  Query: {
    users: async () => {
      try {
        const [rows] = await pool.query('SELECT id, username, name, role FROM users');
        return rows;
      } catch (err) {
        throw new Error(err.message);
      }
    },
    user: async (_, { id }) => {
      try {
        const [rows] = await pool.query('SELECT id, username, name, role FROM users WHERE id = ?', [id]);
        return rows[0] || null;
      } catch (err) {
        throw new Error(err.message);
      }
    },
    me: async (_, __, { currentUser }) => {
      return currentUser || null;
    }
  },
  Mutation: {
    register: async (_, { username, name, role, sandi }) => {
      try {
        const password_hash = hashPassword(sandi);
        const [result] = await pool.query(
          'INSERT INTO users (username, name, role, password_hash) VALUES (?, ?, ?, ?)',
          [username, name, role, password_hash]
        );
        return { id: result.insertId, username, name, role };
      } catch (err) {
        throw new Error(err.message);
      }
    },
    login: async (_, { username, sandi }) => {
      try {
        const password_hash = hashPassword(sandi);
        const [rows] = await pool.query(
          'SELECT * FROM users WHERE username = ? AND password_hash = ?',
          [username, password_hash]
        );
        if (rows.length === 0) {
          return { success: false, message: 'Username atau password salah' };
        }
        const user = rows[0];
        const token = jwt.sign(
          { id: user.id, username: user.username, role: user.role, name: user.name },
          JWT_SECRET,
          { expiresIn: '24h' }
        );
        return {
          success: true,
          token,
          user: { id: user.id, username: user.username, name: user.name, role: user.role },
          message: 'Login berhasil'
        };
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
    port: process.env.PORT || 4005,
    host: '0.0.0.0'
  },
  context: async ({ req }) => {
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return { currentUser: decoded };
      } catch (err) {
        // Invalid or expired token
      }
    }
    return {};
  }
});

console.log(`🚀 User Service ready at ${url}`);
