// config/database.js
const { Pool } = require('pg');

// Determine if the app is running in production (on Heroku)
const isProduction = process.env.NODE_ENV === 'production';

let poolConfig;

if (isProduction) {
  // On Heroku, use the DATABASE_URL environment variable
  poolConfig = {
    connectionString: 'postgres://udvb74arv87593:pd17a850ef3ed37a46956124e2cec257cd52f5ae89c6ea3cbb41c5c27ae5bf6ec@c3nv2ev86aje4j.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/da01nkrd86m7co',
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