// routes/auth.js
const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../db');
const bcrypt = require('bcryptjs');
const { isAllowed } = require('../utils/nsbAllowlist');

// ✅ change this if your NSB domain is different
const NSB_DOMAIN = '@nsb.lk';

//
// ---------- SIGN UP (EndUser) ----------
// only allow if (epf_number + nsb email) match CSV
//
router.post('/signup', async (req, res) => {
  try {
    const { first_name, last_name, email, phone, password, epf_number } = req.body;

    // basic required fields
    if (!first_name || !last_name || !email || !password || !epf_number) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanEpf = String(epf_number).trim();

    // ✅ enforce NSB email domain
    if (!cleanEmail.endsWith(NSB_DOMAIN)) {
      return res.status(403).json({ message: `Only NSB email accounts (${NSB_DOMAIN}) can sign up.` });
    }

    // ✅ EPF format check (optional but good)
    if (!/^[0-9]{3,20}$/.test(cleanEpf)) {
      return res.status(400).json({ message: 'Invalid EPF number format.' });
    }

    // ✅ validate EPF+Email pair exists in CSV
    let allowed = false;
    try {
      allowed = isAllowed(cleanEpf, cleanEmail);
    } catch (csvErr) {
      console.error('Allowlist CSV error >>>', csvErr);
      return res.status(500).json({ message: 'Allowlist file error (CSV missing/invalid).' });
    }

    if (!allowed) {
      return res.status(403).json({ message: 'EPF number and NSB email do not match our records.' });
    }

    const pool = await getPool();

    // ✅ check email already exists
    const existingEmail = await pool.request()
      .input('email', sql.NVarChar, cleanEmail)
      .query('SELECT user_id FROM Users WHERE email = @email');

    if (existingEmail.recordset.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // ✅ check EPF already exists
    const existingEpf = await pool.request()
      .input('epf_number', sql.NVarChar, cleanEpf)
      .query('SELECT user_id FROM Users WHERE epf_number = @epf_number');

    if (existingEpf.recordset.length > 0) {
      return res.status(400).json({ message: 'EPF number already registered' });
    }

    const hashed = await bcrypt.hash(password, 10);

    // ✅ insert user including epf_number
    const result = await pool.request()
      .input('first_name', sql.NVarChar, first_name)
      .input('last_name', sql.NVarChar, last_name)
      .input('email', sql.NVarChar, cleanEmail)
      .input('phone', sql.NVarChar, phone || null)
      .input('epf_number', sql.NVarChar, cleanEpf)
      .input('password', sql.NVarChar, hashed)
      .query(`
        INSERT INTO Users (first_name, last_name, email, phone, epf_number, password, role, is_active)
        OUTPUT INSERTED.user_id, INSERTED.role
        VALUES (@first_name, @last_name, @email, @phone, @epf_number, @password, 'EndUser', 1)
      `);

    const user = result.recordset[0];

    return res.status(201).json({
      message: 'User registered successfully',
      user: {
        user_id: user.user_id,
        email: cleanEmail,
        epf_number: cleanEpf,
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
// (unchanged - can stay the same)
//
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const pool = await getPool();

    const result = await pool.request()
      .input('email', sql.NVarChar, String(email).trim().toLowerCase())
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
