// db.js
const sql = require('mssql');
require('dotenv').config();

const hasInstance = !!process.env.SQL_INSTANCE;

const config = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DB,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: process.env.SQL_ENCRYPT === 'true',
    trustServerCertificate: process.env.SQL_TRUST_CERT === 'true'
  }
};

// If using SQLEXPRESS instance (like yours)
if (hasInstance) {
  config.options.instanceName = process.env.SQL_INSTANCE;
}

let pool;

async function getPool() {
  if (pool) return pool;
  pool = await sql.connect(config);
  return pool;
}

module.exports = { sql, getPool };
