// routes/auth.js
const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../db');
const bcrypt = require('bcryptjs');

//
// ---------- SIGN UP (EndUser) ----------
//
router.post('/signup', async (req, res) => {
  try {
    const { first_name, last_name, email, phone, password } = req.body;

    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const pool = await getPool();

    // check email already exists
    const existing = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT user_id FROM Users WHERE email = @email');

    if (existing.recordset.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(password, 10);

    const result = await pool.request()
      .input('first_name', sql.NVarChar, first_name)
      .input('last_name', sql.NVarChar, last_name)
      .input('email', sql.NVarChar, email)
      .input('phone', sql.NVarChar, phone || null)
      .input('password', sql.NVarChar, hashed)
      .query(`
        INSERT INTO Users (first_name, last_name, email, phone, password, role, is_active)
        OUTPUT INSERTED.user_id, INSERTED.role
        VALUES (@first_name, @last_name, @email, @phone, @password, 'EndUser', 1)
      `);

    const user = result.recordset[0];

    return res.status(201).json({
      message: 'User registered successfully',
      user: {
        user_id: user.user_id,
        email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Signup error >>>', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

//
// ---------- LOGIN (email + password) ----------
//
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const pool = await getPool();

    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query(`
        SELECT user_id, first_name, last_name, email, password, role, is_active
        FROM Users
        WHERE email = @email
      `);

    if (result.recordset.length === 0) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const user = result.recordset[0];

    if (!user.is_active) {
      return res.status(403).json({ message: 'Your account is disabled.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    return res.json({
      message: 'Login successful',
      user: {
        user_id: user.user_id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error >>>', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
