// index.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { getPool } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// ROUTES
const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);

// Health check
app.get('/', (req, res) => {
  res.send('NSB Dummy API is running');
});

// Test DB connection: get all users
app.get('/users', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM Users');
    res.json(result.recordset);
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
