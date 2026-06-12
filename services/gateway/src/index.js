import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import jwt from 'jsonwebtoken';

const SERVICES = {
  user: process.env.USER_SVC_URL || 'http://user-service:4005/',
  category: process.env.CATEGORY_SVC_URL || 'http://category-service:4001/',
  asset: process.env.ASSET_SVC_URL || 'http://asset-service:4002/',
  booking: process.env.BOOKING_SVC_URL || 'http://booking-service:4003/',
  schedule: process.env.SCHEDULE_SVC_URL || 'http://schedule-service:4004/'
};

const JWT_SECRET = process.env.JWT_SECRET || 'jwt_super_secret_key_123';

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

  type Schedule {
    id: ID!
    asset_id: ID!
    date: String!
    event_name: String!
    deskripsi: String
    asset: Asset
  }

  type Query {
    me: User
    users: [User]
    kategoriList: [Kategori]
    assets: [Asset]
    asset(id: ID!): Asset
    searchAssets(query: String!): [Asset]
    bookings: [Booking]
    historyBookings(user_id: ID): [Booking]
    bookingsByStatus(status: String!): [Booking]
    schedules: [Schedule]
  }

  type Mutation {
    register(username: String!, name: String!, role: String!, sandi: String!): User
    login(username: String!, sandi: String!): AuthResponse
    addKategori(nama: String!, deskripsi: String): Kategori
    deleteKategori(id: ID!): Boolean
    addAsset(kategori_id: ID!, nama: String!, tipe: String!, deskripsi: String, status: String, image_url: String): Asset
    deleteAsset(id: ID!): Boolean
    addBooking(asset_id: ID!, user_id: ID!, user_name: String!, user_role: String!, deskripsi: String!, start_time: String!, end_time: String!): Booking
    updateBookingStatus(id: ID!, status: String!): Booking
    deleteBooking(id: ID!): Boolean
    addSchedule(asset_id: ID!, date: String!, event_name: String!, deskripsi: String): Schedule
    deleteSchedule(id: ID!): Boolean
  }
`;

// Helper for making GraphQL HTTP calls to microservices
async function callService(serviceUrl, graphqlPayload, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  try {
    const res = await fetch(serviceUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(graphqlPayload)
    });
    const json = await res.json();
    if (json.errors) {
      throw new Error(json.errors[0].message);
    }
    return json.data;
  } catch (err) {
    throw new Error(`Koneksi microservice gagal: ${err.message}`);
  }
}

const resolvers = {
  Query: {
    me: async (_, __, { token }) => {
      if (!token) return null;
      const payload = { query: `query { me { id username name role } }` };
      const data = await callService(SERVICES.user, payload, token);
      return data.me;
    },
    users: async (_, __, { token }) => {
      const payload = { query: `query { users { id username name role } }` };
      const data = await callService(SERVICES.user, payload, token);
      return data.users;
    },
    kategoriList: async () => {
      const payload = { query: `query { kategoriList { id nama deskripsi } }` };
      const data = await callService(SERVICES.category, payload);
      return data.kategoriList;
    },
    assets: async () => {
      const payload = { 
        query: `
          query { 
            assets { 
              id kategori_id nama tipe deskripsi status image_url 
              kategori { id nama deskripsi } 
            } 
          }
        ` 
      };
      const data = await callService(SERVICES.asset, payload);
      return data.assets;
    },
    asset: async (_, { id }) => {
      const payload = {
        query: `
          query($id: ID!) {
            asset(id: $id) {
              id kategori_id nama tipe deskripsi status image_url
              kategori { id nama deskripsi }
            }
          }
        `,
        variables: { id }
      };
      const data = await callService(SERVICES.asset, payload);
      return data.asset;
    },
    searchAssets: async (_, { query }) => {
      const payload = {
        query: `
          query($query: String!) {
            searchAssets(query: $query) {
              id kategori_id nama tipe deskripsi status image_url
              kategori { id nama deskripsi }
            }
          }
        `,
        variables: { query }
      };
      const data = await callService(SERVICES.asset, payload);
      return data.searchAssets;
    },
    bookings: async (_, __, { token }) => {
      const payload = {
        query: `
          query {
            bookings {
              id asset_id user_id user_name user_role deskripsi start_time end_time status
              asset { id nama tipe status deskripsi }
            }
          }
        `
      };
      const data = await callService(SERVICES.booking, payload, token);
      return data.bookings;
    },
    historyBookings: async (_, { user_id }, { token }) => {
      const payload = {
        query: `
          query($user_id: ID) {
            historyBookings(user_id: $user_id) {
              id asset_id user_id user_name user_role deskripsi start_time end_time status
              asset { id nama tipe status deskripsi }
            }
          }
        `,
        variables: { user_id }
      };
      const data = await callService(SERVICES.booking, payload, token);
      return data.historyBookings;
    },
    bookingsByStatus: async (_, { status }, { token }) => {
      const payload = {
        query: `
          query($status: String!) {
            bookingsByStatus(status: $status) {
              id asset_id user_id user_name user_role deskripsi start_time end_time status
              asset { id nama tipe status deskripsi }
            }
          }
        `,
        variables: { status }
      };
      const data = await callService(SERVICES.booking, payload, token);
      return data.bookingsByStatus;
    },
    schedules: async () => {
      const payload = {
        query: `
          query {
            schedules {
              id asset_id date event_name deskripsi
              asset { id nama tipe status deskripsi }
            }
          }
        `
      };
      const data = await callService(SERVICES.schedule, payload);
      return data.schedules;
    }
  },
  Mutation: {
    register: async (_, { username, name, role, sandi }) => {
      const payload = {
        query: `
          mutation($username: String!, $name: String!, $role: String!, $sandi: String!) {
            register(username: $username, name: $name, role: $role, sandi: $sandi) {
              id username name role
            }
          }
        `,
        variables: { username, name, role, sandi }
      };
      const data = await callService(SERVICES.user, payload);
      return data.register;
    },
    login: async (_, { username, sandi }) => {
      const payload = {
        query: `
          mutation($username: String!, $sandi: String!) {
            login(username: $username, sandi: $sandi) {
              success token user { id username name role } message
            }
          }
        `,
        variables: { username, sandi }
      };
      const data = await callService(SERVICES.user, payload);
      return data.login;
    },
    addKategori: async (_, { nama, deskripsi }, { token }) => {
      const payload = {
        query: `
          mutation($nama: String!, $deskripsi: String) {
            addKategori(nama: $nama, deskripsi: $deskripsi) {
              id nama deskripsi
            }
          }
        `,
        variables: { nama, deskripsi }
      };
      const data = await callService(SERVICES.category, payload, token);
      return data.addKategori;
    },
    deleteKategori: async (_, { id }, { token }) => {
      const payload = {
        query: `
          mutation($id: ID!) {
            deleteKategori(id: $id)
          }
        `,
        variables: { id }
      };
      const data = await callService(SERVICES.category, payload, token);
      return data.deleteKategori;
    },
    addAsset: async (_, args, { token }) => {
      const payload = {
        query: `
          mutation($kategori_id: ID!, $nama: String!, $tipe: String!, $deskripsi: String, $status: String, $image_url: String) {
            addAsset(kategori_id: $kategori_id, nama: $nama, tipe: $tipe, deskripsi: $deskripsi, status: $status, image_url: $image_url) {
              id kategori_id nama tipe deskripsi status image_url
            }
          }
        `,
        variables: args
      };
      const data = await callService(SERVICES.asset, payload, token);
      return data.addAsset;
    },
    deleteAsset: async (_, { id }, { token }) => {
      const payload = {
        query: `
          mutation($id: ID!) {
            deleteAsset(id: $id)
          }
        `,
        variables: { id }
      };
      const data = await callService(SERVICES.asset, payload, token);
      return data.deleteAsset;
    },
    addBooking: async (_, args, { token }) => {
      const payload = {
        query: `
          mutation($asset_id: ID!, $user_id: ID!, $user_name: String!, $user_role: String!, $deskripsi: String!, $start_time: String!, $end_time: String!) {
            addBooking(asset_id: $asset_id, user_id: $user_id, user_name: $user_name, user_role: $user_role, deskripsi: $deskripsi, start_time: $start_time, end_time: $end_time) {
              id asset_id user_id user_name user_role deskripsi start_time end_time status
            }
          }
        `,
        variables: args
      };
      const data = await callService(SERVICES.booking, payload, token);
      return data.addBooking;
    },
    updateBookingStatus: async (_, { id, status }, { token }) => {
      const payload = {
        query: `
          mutation($id: ID!, $status: String!) {
            updateBookingStatus(id: $id, status: $status) {
              id asset_id user_id user_name user_role deskripsi start_time end_time status
            }
          }
        `,
        variables: { id, status }
      };
      const data = await callService(SERVICES.booking, payload, token);
      return data.updateBookingStatus;
    },
    deleteBooking: async (_, { id }, { token }) => {
      const payload = {
        query: `
          mutation($id: ID!) {
            deleteBooking(id: $id)
          }
        `,
        variables: { id }
      };
      const data = await callService(SERVICES.booking, payload, token);
      return data.deleteBooking;
    },
    addSchedule: async (_, args, { token }) => {
      const payload = {
        query: `
          mutation($asset_id: ID!, $date: String!, $event_name: String!, $deskripsi: String) {
            addSchedule(asset_id: $asset_id, date: $date, event_name: $event_name, deskripsi: $deskripsi) {
              id asset_id date event_name deskripsi
            }
          }
        `,
        variables: args
      };
      const data = await callService(SERVICES.schedule, payload, token);
      return data.addSchedule;
    },
    deleteSchedule: async (_, { id }, { token }) => {
      const payload = {
        query: `
          mutation($id: ID!) {
            deleteSchedule(id: $id)
          }
        `,
        variables: { id }
      };
      const data = await callService(SERVICES.schedule, payload, token);
      return data.deleteSchedule;
    }
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const { url } = await startStandaloneServer(server, {
  listen: { 
    port: process.env.PORT || 4000,
    host: '0.0.0.0'
  },
  context: async ({ req }) => {
    const authHeader = req.headers.authorization || '';
    let token = null;
    let currentUser = null;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
      try {
        currentUser = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        // invalid token
      }
    }
    return { token, currentUser };
  }
});

console.log(`🚀 API/GraphQL Gateway ready at ${url}`);
