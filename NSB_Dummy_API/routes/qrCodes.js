// NSB_Dummy_API/routes/qrCodes.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { sql, getPool } = require('../db');

/**
 * MUST be reachable from phone scanner.
 * - Emulator: http://localhost:3001
 * - Real phone: http://192.168.x.x:3001 OR ngrok https url
 */
const PUBLIC_API_BASE = process.env.PUBLIC_API_BASE;

/**
 * Must match your Expo deep link scheme and path.
 * Example: nsbbooking://UserBookings
 */
const APP_DEEPLINK_BASE = process.env.APP_DEEPLINK_BASE || 'nsbbooking://UserBookings';

// POST /qr-codes/for-booking
// body: { booking_id }
router.post('/for-booking', async (req, res) => {
  try {
    const booking_id = Number(req.body.booking_id);
    if (!Number.isInteger(booking_id) || booking_id <= 0) {
      return res.status(400).json({ message: 'Invalid booking_id' });
    }
    if (!PUBLIC_API_BASE) {
      return res.status(500).json({ message: 'PUBLIC_API_BASE is not set in .env' });
    }

    const pool = await getPool();

    // If already exists, return it
    const existing = await pool.request()
      .input('booking_id', sql.Int, booking_id)
      .query(`
        SELECT TOP 1
          qr_id, booking_id, qr_code_data, qr_token, generated_at, is_used, used_at
        FROM QR_Codes
        WHERE booking_id = @booking_id;
      `);

    if (existing.recordset.length) {
      const row = existing.recordset[0];

      // if older row has null token, create and update once
      if (!row.qr_token) {
        const qr_token = crypto.randomBytes(24).toString('hex');
        const qr_code_data = `${PUBLIC_API_BASE}/qr-codes/r/${qr_token}`;

        const updated = await pool.request()
          .input('booking_id', sql.Int, booking_id)
          .input('qr_token', sql.NVarChar(80), qr_token)
          .input('qr_code_data', sql.NVarChar(500), qr_code_data)
          .query(`
            UPDATE QR_Codes
            SET qr_token = @qr_token,
                qr_code_data = @qr_code_data
            OUTPUT
              INSERTED.qr_id,
              INSERTED.booking_id,
              INSERTED.qr_code_data,
              INSERTED.qr_token,
              INSERTED.generated_at,
              INSERTED.is_used,
              INSERTED.used_at
            WHERE booking_id = @booking_id;
          `);

        return res.json({ qr: updated.recordset[0] });
      }

      return res.json({ qr: row });
    }

    // New token
    const qr_token = crypto.randomBytes(24).toString('hex');

    // QR data is a http/https link (camera can open)
    const qr_code_data = `${PUBLIC_API_BASE}/qr-codes/r/${qr_token}`;

    const inserted = await pool.request()
      .input('booking_id', sql.Int, booking_id)
      .input('qr_token', sql.NVarChar(80), qr_token)
      .input('qr_code_data', sql.NVarChar(500), qr_code_data)
      .query(`
        INSERT INTO QR_Codes (booking_id, qr_token, qr_code_data)
        OUTPUT
          INSERTED.qr_id,
          INSERTED.booking_id,
          INSERTED.qr_code_data,
          INSERTED.qr_token,
          INSERTED.generated_at,
          INSERTED.is_used,
          INSERTED.used_at
        VALUES (@booking_id, @qr_token, @qr_code_data);
      `);

    return res.status(201).json({ qr: inserted.recordset[0] });
  } catch (err) {
    console.error('QR create error >>>', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /qr-codes/by-booking/:bookingId
router.get('/by-booking/:bookingId', async (req, res) => {
  try {
    const booking_id = Number(req.params.bookingId);
    if (!Number.isInteger(booking_id) || booking_id <= 0) {
      return res.status(400).json({ message: 'Invalid bookingId' });
    }

    const pool = await getPool();
    const r = await pool.request()
      .input('booking_id', sql.Int, booking_id)
      .query(`
        SELECT TOP 1
          qr_id, booking_id, qr_code_data, qr_token, generated_at, is_used, used_at
        FROM QR_Codes
        WHERE booking_id = @booking_id;
      `);

    if (!r.recordset.length) return res.status(404).json({ message: 'QR not found' });
    return res.json({ qr: r.recordset[0] });
  } catch (err) {
    console.error('QR get error >>>', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /qr-codes/r/:token
// scanner opens http(s)://.../qr-codes/r/<token> then backend redirects to app deep link
router.get('/r/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '');
    if (!token || token.length < 20) return res.status(400).send('Invalid token');

    const pool = await getPool();
    const result = await pool.request()
      .input('qr_token', sql.NVarChar(80), token)
      .query(`
        SELECT TOP 1 booking_id
        FROM QR_Codes
        WHERE qr_token = @qr_token;
      `);

    if (!result.recordset.length) return res.status(404).send('QR not found');

    const booking_id = result.recordset[0].booking_id;

    // Redirect to app route
    const deepLink =
      `${APP_DEEPLINK_BASE}?bookingId=${encodeURIComponent(String(booking_id))}&qrToken=${encodeURIComponent(token)}`;

    return res.redirect(302, deepLink);
  } catch (e) {
    console.error('QR redirect error >>>', e);
    return res.status(500).send('Server error');
  }
});

module.exports = router;
