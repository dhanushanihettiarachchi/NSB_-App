// routes/auth.js
const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const bcrypt = require('bcryptjs');

// LOGIN API
router.post('/login', async (req, res) => {
  try {
    const { epf, password } = req.body;

    if (!epf || !password) {
      return res.status(400).json({ error: 'EPF and password required' });
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input('epf', epf)
      .query('SELECT * FROM Users WHERE EPF_No = @epf');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.recordset[0];

    if (!user.password_hash) {
      return res
        .status(400)
        .json({ error: 'User has not set password yet' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Make sure role is a number (1, 2, 3)
    const roleId = Number(user.role);

    // Optional: if you EVER want to block unknown roles, you can uncomment this
    // if (![1, 2, 3].includes(roleId)) {
    //   return res.status(403).json({ error: 'Unauthorized role' });
    // }

    // Clean, consistent response for frontend
    return res.json({
      success: true,
      message: 'Login successful',
      user: {
        epf: user.EPF_No,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        roleId: user.role_id,
        grade: user.grade,
        registrationStatus: user.registration_status,
      },
    });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// SIGN UP API (full flow: check EPF + name, update email/phone, set password)
router.post('/signup', async (req, res) => {
  try {
    const { fullName, epf, email, phone, password } = req.body;

    if (!fullName || !epf || !email || !phone || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const pool = await getPool();

    // 1) Find user with matching EPF + full name
    const findResult = await pool
      .request()
      .input('epf', epf)
      .input('fullName', fullName)
      .query(
        'SELECT * FROM Users WHERE EPF_No = @epf AND full_name = @fullName'
      );

    if (findResult.recordset.length === 0) {
      return res.status(404).json({
        error:
          'No matching NSB employee found for this name and employee ID.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 2) Update email, phone, password, status
    await pool
      .request()
      .input('epf', epf)
      .input('email', email)
      .input('phone', phone)
      .input('password_hash', hashedPassword)
      .query(`
        UPDATE Users
        SET email = @email,
            phone = @phone,
            password_hash = @password_hash,
            registration_status = 'Active',
            updated_at = SYSDATETIME()
        WHERE EPF_No = @epf
      `);

    return res.json({
      success: true,
      message: 'Account created successfully. You can now sign in.',
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
