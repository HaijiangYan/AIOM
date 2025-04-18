// config/database.js
const { Pool } = require('pg');

// Determine if the app is running in production (on Heroku)
const isProduction = process.env.NODE_ENV === 'production';

let poolConfig;

if (isProduction) {
  // On Heroku, use the DATABASE_URL environment variable
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { 
      rejectUnauthorized: false // Required for Heroku PostgreSQL
    }
  };
} else {
  // For local development, use the individual environment variables
  poolConfig = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  };
}

const pool = new Pool(poolConfig);

module.exports = { pool };