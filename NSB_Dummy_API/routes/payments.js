// routes/payments.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { getPool, sql } = require("../db");

const router = express.Router();

// ensure upload folder exists
const uploadDir = path.join(__dirname, "..", "uploads", "payments");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadDir);
  },

  // ✅ STRONG sanitize: remove ALL unsafe chars (spaces, commas, brackets, etc.)
  filename: function (_req, file, cb) {
    const original = file.originalname || "file";

    const ext = path.extname(original); // ".png" / ".pdf"
    const base = path
      .basename(original, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_"); // ✅ keep only safe chars

    cb(null, `${Date.now()}_${base}${ext}`);
  },
});

const upload = multer({ storage });

// ✅ quick test
router.get("/test", (_req, res) => {
  res.json({ ok: true, message: "payments route works" });
});

// ✅ used by UserBookings.tsx
router.get("/status-bulk", async (req, res) => {
  try {
    const idsStr = String(req.query.ids || "");
    const ids = idsStr
      .split(",")
      .map((x) => parseInt(x.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (!ids.length) return res.json({ map: {} });

    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT booking_id, status, payment_slip_path
      FROM Payments
      WHERE booking_id IN (${ids.join(",")})
    `);

    const map = {};
    for (const row of result.recordset) {
      map[String(row.booking_id)] = {
        hasSlip: !!row.payment_slip_path,
        status: row.status,
        slipPath: row.payment_slip_path,
      };
    }

    return res.json({ map });
  } catch (e) {
    console.log("status-bulk error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Get latest payment row for a booking
router.get("/booking/:bookingId/latest", async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId, 10);
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      return res.status(400).json({ message: "Invalid bookingId" });
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input("booking_id", sql.Int, bookingId)
      .query(`
        SELECT TOP 1
          payment_id,
          booking_id,
          amount,
          payment_method,
          status,
          transaction_id,
          created_date,
          payment_reference,
          payment_slip_path,
          payment_slip_uploaded_date
        FROM Payments
        WHERE booking_id = @booking_id
          AND payment_slip_path IS NOT NULL
        ORDER BY payment_slip_uploaded_date DESC, created_date DESC, payment_id DESC;
      `);

    if (!result.recordset.length) {
      return res.json({ payment: null });
    }

    const row = result.recordset[0];

    return res.json({
      payment: {
        ...row,
        proof_url: row.payment_slip_path,
      },
    });
  } catch (e) {
    console.log("latest payment error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Upload payment slip and insert row into Payments
router.post("/upload-slip", upload.single("file"), async (req, res) => {
  try {
    const { bookingId, amount, payment_method } = req.body;

    if (!bookingId)
      return res.status(400).json({ message: "bookingId is required" });
    if (!amount)
      return res.status(400).json({ message: "amount is required" });
    if (!payment_method)
      return res.status(400).json({ message: "payment_method is required" });
    if (!req.file)
      return res.status(400).json({ message: "file is required" });

    const booking_id = parseInt(bookingId, 10);
    const amt = parseFloat(amount);

    const slipPath = `/uploads/payments/${req.file.filename}`;
    const paymentReference = `REF-${booking_id}-${Date.now()}`;

    const pool = await getPool();

    await pool
      .request()
      .input("booking_id", sql.Int, booking_id)
      .input("amount", sql.Decimal(10, 2), amt)
      .input("payment_method", sql.NVarChar(50), payment_method)
      .input("payment_reference", sql.NVarChar(100), paymentReference)
      .input("payment_slip_path", sql.NVarChar(255), slipPath)
      .query(`
        INSERT INTO Payments
          (booking_id, amount, payment_method, status, payment_reference, payment_slip_path, payment_slip_uploaded_date)
        VALUES
          (@booking_id, @amount, @payment_method, 'Pending', @payment_reference, @payment_slip_path, GETDATE())
      `);

    return res.json({
      ok: true,
      booking_id,
      amount: amt,
      payment_reference: paymentReference,
      payment_slip_path: slipPath,
      proof_url: slipPath,
    });
  } catch (e) {
    console.log("upload-slip error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
