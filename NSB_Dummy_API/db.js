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
    trustServerCertificate: process.env.SQL_TRUST_CERT === 'true',
  },
};

// If using SQLEXPRESS instance
if (hasInstance) {
  config.options.instanceName = process.env.SQL_INSTANCE;
}

// ✅ ALWAYS show what .env values are being used (at server start)
console.log('✅ ENV LOADED:', {
  SQL_SERVER: process.env.SQL_SERVER,
  SQL_INSTANCE: process.env.SQL_INSTANCE,
  SQL_DB: process.env.SQL_DB,
  SQL_USER: process.env.SQL_USER,
  SQL_ENCRYPT: process.env.SQL_ENCRYPT,
  SQL_TRUST_CERT: process.env.SQL_TRUST_CERT,
});

// ✅ ALWAYS show final config used by mssql
console.log('✅ DB CONNECT CONFIG:', {
  server: config.server,
  instance: config.options.instanceName,
  database: config.database,
  user: config.user,
  encrypt: config.options.encrypt,
  trustServerCertificate: config.options.trustServerCertificate,
});

let pool;

async function getPool() {
  try {
    if (pool) return pool;

    console.log('⏳ Connecting to SQL Server...');
    pool = await sql.connect(config);

    // ✅ confirm real DB + server
    const r = await pool.request().query(
      'SELECT DB_NAME() AS db, @@SERVERNAME AS server;'
    );
    console.log('✅ CONNECTED OK:', r.recordset[0]);

    return pool;
  } catch (err) {
    console.log('❌ DB CONNECTION FAILED:', err.message);
    throw err;
  }
}

module.exports = { sql, getPool };
