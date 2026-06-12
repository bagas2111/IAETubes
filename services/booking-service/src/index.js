import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root_password',
  database: 'booking_db',
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
      console.log('✅ Connected to MySQL booking_db pool successfully');
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
const SCHEDULE_SVC_URL = process.env.SCHEDULE_SVC_URL || 'http://schedule-service:4004/';

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
        stok
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

// Create schedule via GraphQL Mutation
async function autoCreateSchedule(asset_id, date, event_name, deskripsi) {
  const query = `
    mutation AddSchedule($asset_id: ID!, $date: String!, $event_name: String!, $deskripsi: String) {
      addSchedule(asset_id: $asset_id, date: $date, event_name: $event_name, deskripsi: $deskripsi) {
        id
      }
    }
  `;
  try {
    const res = await fetch(SCHEDULE_SVC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { asset_id: String(asset_id), date, event_name, deskripsi }
      })
    });
    const json = await res.json();
    if (json.errors) {
      console.error('GraphQL errors creating schedule:', json.errors);
    } else {
      console.log('✅ Automatically created schedule entry via GraphQL');
    }
  } catch (err) {
    console.error('Failed to auto-create schedule via GraphQL:', err.message);
  }
}

const typeDefs = `#graphql
  type Asset {
    id: ID!
    nama: String!
    tipe: String!
    status: String!
    deskripsi: String
    stok: Int!
  }

  type Booking {
    id: ID!
    asset_id: ID!
    user_id: ID!
    user_name: String!
    user_role: String!
    deskripsi: String!
    start_time: String!
    end_time: String!
    status: String!
    asset: Asset
  }

  type Query {
    bookings: [Booking]
    historyBookings(user_id: ID): [Booking]
    bookingsByStatus(status: String!): [Booking]
  }

  type Mutation {
    addBooking(asset_id: ID!, user_id: ID!, user_name: String!, user_role: String!, deskripsi: String!, start_time: String!, end_time: String!): Booking
    updateBookingStatus(id: ID!, status: String!): Booking
    deleteBooking(id: ID!): Boolean
  }
`;

const resolvers = {
  Query: {
    bookings: async () => {
      try {
        const [rows] = await pool.query('SELECT * FROM booking ORDER BY start_time DESC');
        const assets = await getAssets();
        return rows.map(b => ({
          ...b,
          asset: assets.find(a => String(a.id) === String(b.asset_id)) || null
        }));
      } catch (err) {
        throw new Error(err.message);
      }
    },
    historyBookings: async (_, { user_id }) => {
      try {
        let queryStr = "SELECT * FROM booking WHERE status IN ('approved', 'rejected')";
        let params = [];
        if (user_id) {
          queryStr += " AND user_id = ?";
          params.push(user_id);
        }
        queryStr += " ORDER BY start_time DESC";
        const [rows] = await pool.query(queryStr, params);
        const assets = await getAssets();
        return rows.map(b => ({
          ...b,
          asset: assets.find(a => String(a.id) === String(b.asset_id)) || null
        }));
      } catch (err) {
        throw new Error(err.message);
      }
    },
    bookingsByStatus: async (_, { status }) => {
      try {
        const [rows] = await pool.query("SELECT * FROM booking WHERE status = ? ORDER BY start_time DESC", [status]);
        const assets = await getAssets();
        return rows.map(b => ({
          ...b,
          asset: assets.find(a => String(a.id) === String(b.asset_id)) || null
        }));
      } catch (err) {
        throw new Error(err.message);
      }
    }
  },
  Mutation: {
    addBooking: async (_, { asset_id, user_id, user_name, user_role, deskripsi, start_time, end_time }) => {
      // Validate asset exists and is available
      const assets = await getAssets();
      const asset = assets.find(a => String(a.id) === String(asset_id));
      if (!asset) {
        throw new Error('Aset tidak ditemukan');
      }
      if (asset.status !== 'tersedia') {
        throw new Error(`Aset sedang tidak tersedia (Status: ${asset.status})`);
      }

      try {
        const [result] = await pool.query(
          'INSERT INTO booking (asset_id, user_id, user_name, user_role, deskripsi, start_time, end_time, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [asset_id, user_id, user_name, user_role, deskripsi, start_time, end_time, 'pending']
        );
        return {
          id: result.insertId,
          asset_id,
          user_id,
          user_name,
          user_role,
          deskripsi,
          start_time,
          end_time,
          status: 'pending'
        };
      } catch (err) {
        throw new Error(err.message);
      }
    },
    updateBookingStatus: async (_, { id, status }) => {
      if (!['pending', 'approved', 'rejected'].includes(status)) {
        throw new Error('Status tidak valid');
      }
      try {
        const [result] = await pool.query('UPDATE booking SET status = ? WHERE id = ?', [status, id]);
        if (result.affectedRows === 0) {
          throw new Error('Booking tidak ditemukan');
        }

        const [bookingRows] = await pool.query('SELECT * FROM booking WHERE id = ?', [id]);
        const booking = bookingRows[0];

        // Trigger auto-schedule if approved
        if (status === 'approved') {
          const scheduleDate = new Date(booking.start_time).toISOString().split('T')[0];
          await autoCreateSchedule(
            booking.asset_id,
            scheduleDate,
            booking.deskripsi,
            `Dipesan oleh ${booking.user_name} (${booking.user_role})`
          );
        }

        const assets = await getAssets();
        return {
          ...booking,
          asset: assets.find(a => String(a.id) === String(booking.asset_id)) || null
        };
      } catch (err) {
        throw new Error(err.message);
      }
    },
    deleteBooking: async (_, { id }) => {
      try {
        const [result] = await pool.query('DELETE FROM booking WHERE id = ?', [id]);
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
    port: process.env.PORT || 4003,
    host: '0.0.0.0'
  }
});

console.log(`🚀 Booking Service ready at ${url}`);
