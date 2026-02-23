// routes/bookings.js
const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../db');

// ------------------------------
// Helpers
// ------------------------------
function getCurrentUserId(req) {
  if (req.user && (req.user.user_id || req.user.id)) {
    return req.user.user_id || req.user.id;
  }

  const headerId = req.headers['x-user-id'];
  const headerNum = headerId ? Number(headerId) : NaN;
  if (Number.isFinite(headerNum) && headerNum > 0) return headerNum;

  if (req.body && (req.body.user_id || req.body.userId)) {
    const bodyNum = Number(req.body.user_id || req.body.userId);
    if (Number.isFinite(bodyNum) && bodyNum > 0) return bodyNum;
  }

  return null;
}

function isValidDateYYYYMMDD(s) {
  if (typeof s !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function normalizeTimeHHMM(s) {
  if (!s) return null;
  if (typeof s !== 'string') return null;
  if (!/^\d{2}:\d{2}$/.test(s)) return null;
  return s;
}

function todayYYYYMMDD() {
  const d = new Date();
  const pad2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// =====================================================
// ✅ Manager Notifications
// GET /bookings/manager-notifications?userId=123
// Returns APPROVED bookings for manager's circuit
// =====================================================
router.get('/manager-notifications', async (req, res) => {
  try {
    const userId = Number(req.query.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    const pool = await getPool();

    // 1) Get manager circuit_id from latest active role mapping
    const circuitRes = await pool
      .request()
      .input('user_id', sql.Int, userId)
      .query(`
        SELECT TOP 1 circuit_id
        FROM User_role_map
        WHERE user_id = @user_id AND is_active = 1
        ORDER BY assigned_date DESC, user_map_id DESC;
      `);

    const circuit_id = circuitRes.recordset[0]?.circuit_id;

    if (!circuit_id) {
      return res.json({ bookings: [] });
    }

    // 2) Get approved bookings for that circuit
    // NOTE: booking belongs to circuit if ANY BookingRooms line is in that circuit
    const result = await pool
      .request()
      .input('circuit_id', sql.Int, circuit_id)
      .query(`
        ;WITH Lines AS (
          SELECT
            br.booking_id,
            br.room_id,
            br.need_room_count,
            br.guest_count,
            r.room_Name,
            r.circuit_Id
          FROM BookingRooms br
          LEFT JOIN CircuitRooms r ON r.room_Id = br.room_id
          WHERE r.circuit_Id = @circuit_id
        )
        SELECT
          b.booking_id,
          b.user_id,

          COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(u.first_name, ' ', u.last_name))), ''), u.email, CONCAT('User ', b.user_id)) AS user_name,

          c.circuit_Id,
          c.circuit_Name,
          c.city,
          c.street,

          b.booking_date,
          b.check_in_date,
          b.check_out_date,
          b.booking_time,
          b.purpose,
          b.status,
          b.created_date,
          b.updated_date,
          b.approved_date,

          -- room summary for UI
          STRING_AGG(CONCAT(l.room_Name, ' × ', l.need_room_count), ' + ') WITHIN GROUP (ORDER BY l.room_Name) AS rooms_summary,
          SUM(l.need_room_count) AS total_rooms,
          SUM(l.guest_count) AS total_guests
        FROM Bookings b
        LEFT JOIN Users u ON u.user_id = b.user_id
        INNER JOIN Lines l ON l.booking_id = b.booking_id
        LEFT JOIN Circuits c ON c.circuit_Id = l.circuit_Id
        WHERE b.status = 'Approved'
        GROUP BY
          b.booking_id, b.user_id,
          u.first_name, u.last_name, u.email,
          c.circuit_Id, c.circuit_Name, c.city, c.street,
          b.booking_date, b.check_in_date, b.check_out_date, b.booking_time,
          b.purpose, b.status, b.created_date, b.updated_date, b.approved_date
        ORDER BY ISNULL(b.approved_date, b.updated_date) DESC, b.booking_id DESC;
      `);

    res.set('Cache-Control', 'no-store');
    return res.json({ bookings: result.recordset });
  } catch (err) {
    console.error('manager-notifications error >>>', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// =====================================================
// ✅ GET /bookings/unavailable?circuitId=123
// Returns approved booking ranges for circuit (ANY room line inside circuit)
// =====================================================
router.get('/unavailable', async (req, res) => {
  try {
    const circuitId = Number(req.query.circuitId);
    if (!Number.isInteger(circuitId) || circuitId <= 0) {
      return res.status(400).json({ message: 'Invalid circuitId' });
    }

    const pool = await getPool();

    const result = await pool.request()
      .input('circuit_Id', sql.Int, circuitId)
      .query(`
        SELECT DISTINCT
          b.booking_id,
          @circuit_Id AS circuit_id,
          b.check_in_date,
          b.check_out_date,
          b.booking_time,
          b.status
        FROM Bookings b
        INNER JOIN BookingRooms br ON br.booking_id = b.booking_id
        INNER JOIN CircuitRooms r ON r.room_Id = br.room_id
        WHERE
          r.circuit_Id = @circuit_Id
          AND b.status = 'Approved'
        ORDER BY b.check_in_date ASC, b.booking_time ASC;
      `);

    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');

    return res.json({ blocked: result.recordset });
  } catch (err) {
    console.error('Get unavailable ranges error >>>', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// =====================================================
// ✅ NEW: GET /bookings/availability?circuitId=123&checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&time=HH:mm
// Returns remaining rooms per room type based on APPROVED overlaps
// (Uses BookingRooms)
// =====================================================
router.get('/availability', async (req, res) => {
  try {
    const circuitId = Number(req.query.circuitId);
    const checkIn = String(req.query.checkIn || '');
    const checkOut = String(req.query.checkOut || '');
    const time = normalizeTimeHHMM(String(req.query.time || '')) || '10:00';

    if (!Number.isInteger(circuitId) || circuitId <= 0) {
      return res.status(400).json({ message: 'Invalid circuitId' });
    }
    if (!isValidDateYYYYMMDD(checkIn) || !isValidDateYYYYMMDD(checkOut)) {
      return res.status(400).json({ message: 'Invalid checkIn/checkOut format. Use YYYY-MM-DD.' });
    }
    if (checkOut <= checkIn) {
      return res.status(400).json({ message: 'checkOut must be after checkIn.' });
    }

    const pool = await getPool();

    const result = await pool.request()
      .input('circuit_Id', sql.Int, circuitId)
      .input('newCheckIn', sql.Date, checkIn)
      .input('newCheckOut', sql.Date, checkOut)
      .input('newTime', sql.VarChar(5), time)
      .query(`
        ;WITH Rooms AS (
          SELECT room_Id, room_Name, room_Count, max_Persons, price_per_person
          FROM CircuitRooms
          WHERE circuit_Id = @circuit_Id AND is_active = 1
        ),
        ApprovedLines AS (
          SELECT
            br.room_id,
            br.need_room_count,
            DATEADD(
              MINUTE,
              DATEDIFF(MINUTE, 0, CAST(ISNULL(b.booking_time,'10:00') AS time)),
              CAST(CAST(b.check_in_date AS date) AS datetime)
            ) AS OldStart,
            DATEADD(
              MINUTE,
              DATEDIFF(MINUTE, 0, CAST(ISNULL(b.booking_time,'10:00') AS time)),
              CAST(CAST(b.check_out_date AS date) AS datetime)
            ) AS OldEnd
          FROM Bookings b
          INNER JOIN BookingRooms br ON br.booking_id = b.booking_id
          INNER JOIN Rooms r ON r.room_Id = br.room_id
          WHERE b.status = 'Approved'
        ),
        NewRange AS (
          SELECT
            DATEADD(
              MINUTE,
              DATEDIFF(MINUTE, 0, CAST(@newTime AS time)),
              CAST(CAST(@newCheckIn AS date) AS datetime)
            ) AS NewStart,
            DATEADD(
              MINUTE,
              DATEDIFF(MINUTE, 0, CAST(@newTime AS time)),
              CAST(CAST(@newCheckOut AS date) AS datetime)
            ) AS NewEnd
        ),
        Overlapping AS (
          SELECT a.room_id, a.need_room_count
          FROM ApprovedLines a
          CROSS JOIN NewRange n
          WHERE a.OldStart < n.NewEnd
            AND a.OldEnd > n.NewStart
        )
        SELECT
          r.room_Id,
          r.room_Name,
          r.room_Count,
          ISNULL(SUM(o.need_room_count), 0) AS booked_count,
          (r.room_Count - ISNULL(SUM(o.need_room_count), 0)) AS remaining,
          r.max_Persons,
          r.price_per_person
        FROM Rooms r
        LEFT JOIN Overlapping o ON o.room_id = r.room_Id
        GROUP BY r.room_Id, r.room_Name, r.room_Count, r.max_Persons, r.price_per_person
        ORDER BY r.room_Name ASC;
      `);

    res.set('Cache-Control', 'no-store');
    return res.json({ availability: result.recordset });
  } catch (err) {
    console.error('Get availability error >>>', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// =====================================================
// ✅ NEW: GET /bookings/fully-booked-days?circuitId=123&from=YYYY-MM-DD&to=YYYY-MM-DD&time=HH:mm
// Uses BookingRooms
// =====================================================
router.get('/fully-booked-days', async (req, res) => {
  try {
    const circuitId = Number(req.query.circuitId);
    const from = String(req.query.from || '');
    const to = String(req.query.to || '');
    const time = normalizeTimeHHMM(String(req.query.time || '')) || '10:00';

    if (!Number.isInteger(circuitId) || circuitId <= 0) {
      return res.status(400).json({ message: 'Invalid circuitId' });
    }
    if (!isValidDateYYYYMMDD(from) || !isValidDateYYYYMMDD(to)) {
      return res.status(400).json({ message: 'Invalid from/to format. Use YYYY-MM-DD.' });
    }
    if (to < from) {
      return res.status(400).json({ message: 'to must be >= from.' });
    }

    const pool = await getPool();

    // If circuit has zero active rooms -> every day is fully booked.
    const roomCountRes = await pool.request()
      .input('circuit_Id', sql.Int, circuitId)
      .query(`
        SELECT COUNT(1) AS cnt
        FROM CircuitRooms
        WHERE circuit_Id = @circuit_Id AND is_active = 1;
      `);

    const activeRoomsCount = Number(roomCountRes.recordset?.[0]?.cnt || 0);
    if (activeRoomsCount <= 0) {
      const daysRes = await pool.request()
        .input('fromDate', sql.Date, from)
        .input('toDate', sql.Date, to)
        .query(`
          ;WITH Dates AS (
            SELECT CAST(@fromDate AS date) AS d
            UNION ALL
            SELECT DATEADD(day, 1, d)
            FROM Dates
            WHERE d < CAST(@toDate AS date)
          )
          SELECT CONVERT(varchar(10), d, 23) AS day
          FROM Dates
          OPTION (MAXRECURSION 400);
        `);

      res.set('Cache-Control', 'no-store');
      return res.json({ days: daysRes.recordset.map((x) => x.day) });
    }

    const result = await pool.request()
      .input('circuit_Id', sql.Int, circuitId)
      .input('fromDate', sql.Date, from)
      .input('toDate', sql.Date, to)
      .input('newTime', sql.VarChar(5), time)
      .query(`
        ;WITH Dates AS (
          SELECT CAST(@fromDate AS date) AS d
          UNION ALL
          SELECT DATEADD(day, 1, d)
          FROM Dates
          WHERE d < CAST(@toDate AS date)
        ),
        Rooms AS (
          SELECT room_Id, room_Count
          FROM CircuitRooms
          WHERE circuit_Id = @circuit_Id AND is_active = 1
        ),
        ApprovedLines AS (
          SELECT
            br.room_id,
            br.need_room_count,
            DATEADD(
              MINUTE,
              DATEDIFF(MINUTE, 0, CAST(ISNULL(b.booking_time,'10:00') AS time)),
              CAST(CAST(b.check_in_date AS date) AS datetime)
            ) AS OldStart,
            DATEADD(
              MINUTE,
              DATEDIFF(MINUTE, 0, CAST(ISNULL(b.booking_time,'10:00') AS time)),
              CAST(CAST(b.check_out_date AS date) AS datetime)
            ) AS OldEnd
          FROM Bookings b
          INNER JOIN BookingRooms br ON br.booking_id = b.booking_id
          INNER JOIN Rooms r ON r.room_Id = br.room_id
          WHERE b.status = 'Approved'
        ),
        DayRanges AS (
          SELECT
            d.d AS day,
            DATEADD(
              MINUTE,
              DATEDIFF(MINUTE, 0, CAST(@newTime AS time)),
              CAST(CAST(d.d AS date) AS datetime)
            ) AS NewStart,
            DATEADD(
              MINUTE,
              DATEDIFF(MINUTE, 0, CAST(@newTime AS time)),
              CAST(DATEADD(day, 1, CAST(d.d AS date)) AS datetime)
            ) AS NewEnd
          FROM Dates d
        ),
        Overlapping AS (
          SELECT
            dr.day,
            a.room_id,
            a.need_room_count
          FROM ApprovedLines a
          INNER JOIN DayRanges dr
            ON a.OldStart < dr.NewEnd
           AND a.OldEnd > dr.NewStart
        ),
        PerRoomPerDay AS (
          SELECT
            dr.day,
            r.room_Id,
            r.room_Count,
            ISNULL(SUM(o.need_room_count), 0) AS booked_count,
            (r.room_Count - ISNULL(SUM(o.need_room_count), 0)) AS remaining
          FROM DayRanges dr
          CROSS JOIN Rooms r
          LEFT JOIN Overlapping o
            ON o.day = dr.day AND o.room_id = r.room_Id
          GROUP BY dr.day, r.room_Id, r.room_Count
        ),
        DayStatus AS (
          SELECT
            day,
            SUM(CASE WHEN remaining > 0 THEN 1 ELSE 0 END) AS any_available_types
          FROM PerRoomPerDay
          GROUP BY day
        )
        SELECT CONVERT(varchar(10), day, 23) AS day
        FROM DayStatus
        WHERE any_available_types = 0
        ORDER BY day ASC
        OPTION (MAXRECURSION 400);
      `);

    res.set('Cache-Control', 'no-store');
    return res.json({ days: result.recordset.map((x) => x.day) });
  } catch (err) {
    console.error('fully-booked-days error >>>', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// =====================================================
// POST /bookings  ✅ ONE booking + MANY rooms (BookingRooms)
// =====================================================
router.post('/', async (req, res) => {
  try {
    const user_id = getCurrentUserId(req);
    const {
      circuit_id: circuit_id_from_body,
      booking_date,
      check_in_date,
      check_out_date,
      booking_time,
      purpose,
      items,
    } = req.body;

    if (!user_id) {
      return res.status(400).json({
        message: 'Missing user_id (send in body or x-user-id header)',
      });
    }

    const bDate = booking_date || todayYYYYMMDD();
    if (!isValidDateYYYYMMDD(bDate)) return res.status(400).json({ message: 'Invalid booking_date format. Use YYYY-MM-DD.' });
    if (!isValidDateYYYYMMDD(check_in_date)) return res.status(400).json({ message: 'Invalid check_in_date format. Use YYYY-MM-DD.' });
    if (!isValidDateYYYYMMDD(check_out_date)) return res.status(400).json({ message: 'Invalid check_out_date format. Use YYYY-MM-DD.' });
    if (check_out_date <= check_in_date) return res.status(400).json({ message: 'check_out_date must be after check_in_date' });

    const list = Array.isArray(items) ? items : [];
    if (list.length === 0) return res.status(400).json({ message: 'items[] is required (at least 1 room type)' });

    const safeItems = list.map((x) => ({
      room_id: Number(x.room_id),
      need_room_count: Number(x.need_room_count),
      guest_count: Number(x.guest_count),
    }));

    for (const it of safeItems) {
      if (!Number.isInteger(it.room_id) || it.room_id <= 0) return res.status(400).json({ message: 'Each item must have a valid room_id' });
      if (!Number.isInteger(it.need_room_count) || it.need_room_count <= 0) return res.status(400).json({ message: 'Each item must have need_room_count > 0' });
      if (!Number.isInteger(it.guest_count) || it.guest_count < 0) return res.status(400).json({ message: 'Each item must have guest_count >= 0' });
    }

    const timeHHMM = normalizeTimeHHMM(booking_time);      // keep null if empty
    const timeOrDefault = timeHHMM || '10:00';

    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      // -------------------------------------------------------
      // ✅ 1) Determine circuit_Id safely (from body or first room)
      // -------------------------------------------------------
      let circuit_Id = Number(circuit_id_from_body);
      if (!Number.isInteger(circuit_Id) || circuit_Id <= 0) {
        const firstRoomId = safeItems[0].room_id;
        const derived = await new sql.Request(tx)
          .input('room_id', sql.Int, firstRoomId)
          .query(`
            SELECT TOP 1 circuit_Id
            FROM CircuitRooms
            WHERE room_Id = @room_id;
          `);

        if (!derived.recordset.length) {
          await tx.rollback();
          return res.status(404).json({ message: `Room not found (room_id=${firstRoomId})` });
        }
        circuit_Id = Number(derived.recordset[0].circuit_Id);
      }

      // -------------------------------------------------------
      // ✅ 2) Validate availability PER ROOM TYPE (Approved overlaps)
      //    NOTE: use BookingRooms + Bookings for overlaps
      // -------------------------------------------------------
      for (const it of safeItems) {
        const availabilityCheck = await new sql.Request(tx)
          .input('room_id', sql.Int, it.room_id)
          .input('newCheckIn', sql.Date, check_in_date)
          .input('newCheckOut', sql.Date, check_out_date)
          .input('newTime', sql.VarChar(5), timeOrDefault)
          .query(`
            ;WITH RoomInfo AS (
              SELECT room_Id, room_Count, max_Persons, is_active, circuit_Id
              FROM CircuitRooms
              WHERE room_Id = @room_id AND is_active = 1
            ),
            Approved AS (
              SELECT
                br.need_room_count,
                DATEADD(
                  MINUTE,
                  DATEDIFF(MINUTE, 0, CAST(ISNULL(b.booking_time,'10:00') AS time)),
                  CAST(CAST(b.check_in_date AS date) AS datetime)
                ) AS OldStart,
                DATEADD(
                  MINUTE,
                  DATEDIFF(MINUTE, 0, CAST(ISNULL(b.booking_time,'10:00') AS time)),
                  CAST(CAST(b.check_out_date AS date) AS datetime)
                ) AS OldEnd
              FROM BookingRooms br
              INNER JOIN Bookings b ON b.booking_id = br.booking_id
              WHERE b.status = 'Approved'
                AND br.room_id = @room_id
            ),
            NewRange AS (
              SELECT
                DATEADD(
                  MINUTE,
                  DATEDIFF(MINUTE, 0, CAST(@newTime AS time)),
                  CAST(CAST(@newCheckIn AS date) AS datetime)
                ) AS NewStart,
                DATEADD(
                  MINUTE,
                  DATEDIFF(MINUTE, 0, CAST(@newTime AS time)),
                  CAST(CAST(@newCheckOut AS date) AS datetime)
                ) AS NewEnd
            ),
            Overlapping AS (
              SELECT a.need_room_count
              FROM Approved a
              CROSS JOIN NewRange n
              WHERE a.OldStart < n.NewEnd
                AND a.OldEnd > n.NewStart
            )
            SELECT
              ri.room_Count,
              ri.max_Persons,
              ri.circuit_Id,
              ISNULL(SUM(o.need_room_count), 0) AS booked_count
            FROM RoomInfo ri
            LEFT JOIN Overlapping o ON 1=1
            GROUP BY ri.room_Count, ri.max_Persons, ri.circuit_Id;
          `);

        if (!availabilityCheck.recordset.length) {
          await tx.rollback();
          return res.status(404).json({ message: `Room not found or inactive (room_id=${it.room_id})` });
        }

        const row = availabilityCheck.recordset[0];
        const roomCount = Number(row.room_Count) || 0;
        const booked = Number(row.booked_count) || 0;
        const remaining = roomCount - booked;

        const roomCircuit = Number(row.circuit_Id);
        if (Number.isInteger(roomCircuit) && roomCircuit > 0 && roomCircuit !== circuit_Id) {
          await tx.rollback();
          return res.status(400).json({ message: `Room does not belong to selected circuit (room_id=${it.room_id})` });
        }

        if (it.need_room_count > remaining) {
          await tx.rollback();
          return res.status(409).json({
            message: `Room not available for selected dates/time. Remaining=${remaining}, requested=${it.need_room_count}`,
          });
        }

        // capacity check
        const maxPersons = Number(row.max_Persons) || 0;
        const cap = it.need_room_count * maxPersons;
        if (it.guest_count > cap) {
          await tx.rollback();
          return res.status(400).json({
            message: `Guest count exceeds capacity for room_id=${it.room_id}. Capacity=${cap}, guests=${it.guest_count}`,
          });
        }
      }

      // -------------------------------------------------------
      // ✅ 3) Insert ONE booking row
      // -------------------------------------------------------
      const bookingInsert = await new sql.Request(tx)
        .input('user_id', sql.Int, user_id)
        .input('booking_date', sql.Date, bDate)
        .input('check_in_date', sql.Date, check_in_date)
        .input('check_out_date', sql.Date, check_out_date)
        .input('booking_time', sql.VarChar(5), timeHHMM) // keep null if empty
        .input('purpose', sql.NVarChar(500), purpose || null)
        .input('status', sql.NVarChar(50), 'Pending')
        .query(`
          INSERT INTO Bookings (
            user_id,
            booking_date,
            check_in_date,
            check_out_date,
            booking_time,
            purpose,
            status,
            created_date,
            updated_date
          )
          OUTPUT INSERTED.booking_id
          VALUES (
            @user_id,
            @booking_date,
            @check_in_date,
            @check_out_date,
            @booking_time,
            @purpose,
            @status,
            GETDATE(),
            NULL
          );
        `);

      const booking_id = bookingInsert.recordset[0].booking_id;

      // -------------------------------------------------------
      // ✅ 4) Insert MANY booking rooms
      // -------------------------------------------------------
      for (const it of safeItems) {
        await new sql.Request(tx)
          .input('booking_id', sql.Int, booking_id)
          .input('room_id', sql.Int, it.room_id)
          .input('need_room_count', sql.Int, it.need_room_count)
          .input('guest_count', sql.Int, it.guest_count)
          .query(`
            INSERT INTO BookingRooms (booking_id, room_id, need_room_count, guest_count, created_date)
            VALUES (@booking_id, @room_id, @need_room_count, @guest_count, GETDATE());
          `);
      }

      await tx.commit();

      return res.status(201).json({
        message: 'Booking request submitted (Pending)',
        booking_id,          // ✅ single id
        booking_ids: [booking_id], // ✅ keep for old UI compatibility
      });
    } catch (err) {
      try { await tx.rollback(); } catch {}
      console.error('Create booking TX error >>>', err);
      return res.status(500).json({ message: 'Server error', error: err.message });
    }
  } catch (err) {
    console.error('Create booking error >>>', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// =====================================================
// ✅ GET /bookings/user/:userId
// Returns booking headers + aggregated room info + items[]
// =====================================================
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    const pool = await getPool();

    // 1) headers
    const headers = await pool
      .request()
      .input('user_id', sql.Int, userId)
      .query(`
        SELECT
          b.booking_id,
          b.user_id,
          b.booking_date,
          b.check_in_date,
          b.check_out_date,
          b.booking_time,
          b.purpose,
          b.status,
          b.created_date,
          b.updated_date,
          b.approved_by,
          b.approved_date,
          b.rejected_by,
          b.rejected_date,
          b.rejection_reason,

          -- circuit info (best effort: first line)
          c.circuit_Name,
          c.city,
          c.street,

          -- room summary
          x.rooms_summary,
          x.total_rooms,
          x.total_guests,
          x.estimated_total
        FROM Bookings b
        OUTER APPLY (
          SELECT TOP 1 r.circuit_Id
          FROM BookingRooms br
          LEFT JOIN CircuitRooms r ON r.room_Id = br.room_id
          WHERE br.booking_id = b.booking_id
          ORDER BY br.booking_room_id ASC
        ) firstC
        LEFT JOIN Circuits c ON c.circuit_Id = firstC.circuit_Id
        OUTER APPLY (
          SELECT
            STRING_AGG(CONCAT(r.room_Name, ' × ', br.need_room_count), ' + ') WITHIN GROUP (ORDER BY r.room_Name) AS rooms_summary,
            SUM(br.need_room_count) AS total_rooms,
            SUM(br.guest_count) AS total_guests,
            CAST(SUM(CAST(br.guest_count AS decimal(10,2)) * CAST(r.price_per_person AS decimal(10,2))) AS decimal(10,2)) AS estimated_total
          FROM BookingRooms br
          LEFT JOIN CircuitRooms r ON r.room_Id = br.room_id
          WHERE br.booking_id = b.booking_id
        ) x
        WHERE b.user_id = @user_id
        ORDER BY b.created_date DESC;
      `);

    const bookingIds = headers.recordset.map((h) => h.booking_id);
    let itemsMap = {};
    if (bookingIds.length) {
      const lines = await pool.request().query(`
        SELECT
          br.booking_room_id,
          br.booking_id,
          br.room_id,
          br.need_room_count,
          br.guest_count,
          br.created_date,
          r.room_Name,
          r.max_Persons,
          r.price_per_person,
          r.circuit_Id
        FROM BookingRooms br
        LEFT JOIN CircuitRooms r ON r.room_Id = br.room_id
        WHERE br.booking_id IN (${bookingIds.join(',')})
        ORDER BY br.booking_id DESC, br.booking_room_id ASC;
      `);

      itemsMap = {};
      for (const row of lines.recordset) {
        const k = String(row.booking_id);
        if (!itemsMap[k]) itemsMap[k] = [];
        itemsMap[k].push(row);
      }
    }

    const bookings = headers.recordset.map((h) => ({
      ...h,
      items: itemsMap[String(h.booking_id)] || [],
    }));

    return res.json({ bookings });
  } catch (err) {
    console.error('Get user bookings error >>>', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// =====================================================
// ✅ PATCH /bookings/batch (user edits pending booking)
// Kept same endpoint, BUT now expects ONE booking_id (first in array)
// - updates header fields
// - replaces BookingRooms with provided items (if items provided)
// =====================================================
router.patch('/batch', async (req, res) => {
  try {
    const user_id = getCurrentUserId(req);
    if (!user_id) {
      return res.status(400).json({
        message: 'Missing user_id (send in body or x-user-id header)',
      });
    }

    const { booking_ids, check_in_date, check_out_date, booking_time, purpose, items } = req.body;

    const ids = Array.isArray(booking_ids)
      ? booking_ids.map(Number).filter((n) => Number.isInteger(n) && n > 0)
      : [];

    if (ids.length === 0) {
      return res.status(400).json({ message: 'booking_ids[] required' });
    }

    const bookingId = ids[0]; // ✅ single booking in new model

    if (check_in_date && !isValidDateYYYYMMDD(check_in_date)) {
      return res.status(400).json({ message: 'Invalid check_in_date format. Use YYYY-MM-DD.' });
    }
    if (check_out_date && !isValidDateYYYYMMDD(check_out_date)) {
      return res.status(400).json({ message: 'Invalid check_out_date format. Use YYYY-MM-DD.' });
    }
    if (check_in_date && check_out_date && check_out_date <= check_in_date) {
      return res.status(400).json({ message: 'check_out_date must be after check_in_date' });
    }

    const timeHHMM = normalizeTimeHHMM(booking_time);
    const safeItems = Array.isArray(items) ? items : null; // null means "do not change lines"

    // validate items if provided
    if (safeItems) {
      if (safeItems.length === 0) {
        return res.status(400).json({ message: 'items[] cannot be empty when provided' });
      }
      for (const x of safeItems) {
        const room_id = Number(x.room_id);
        const need_room_count = Number(x.need_room_count);
        const guest_count = Number(x.guest_count);

        if (!Number.isInteger(room_id) || room_id <= 0) {
          return res.status(400).json({ message: 'Each item must have a valid room_id' });
        }
        if (!Number.isInteger(need_room_count) || need_room_count <= 0) {
          return res.status(400).json({ message: 'Each item must have need_room_count > 0' });
        }
        if (!Number.isInteger(guest_count) || guest_count < 0) {
          return res.status(400).json({ message: 'Each item must have guest_count >= 0' });
        }
      }
    }

    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      // must own booking + must be pending
      const check = await new sql.Request(tx)
        .input('booking_id', sql.Int, bookingId)
        .input('user_id', sql.Int, user_id)
        .query(`
          SELECT booking_id, status
          FROM Bookings
          WHERE booking_id = @booking_id AND user_id = @user_id;
        `);

      if (check.recordset.length === 0) {
        await tx.rollback();
        return res.status(404).json({ message: `Booking not found (id=${bookingId})` });
      }

      const status = String(check.recordset[0].status || '').toLowerCase();
      if (status !== 'pending') {
        await tx.rollback();
        return res.status(403).json({
          message: `Only Pending bookings can be edited (id=${bookingId})`,
        });
      }

      // update header (only provided fields)
      await new sql.Request(tx)
        .input('booking_id', sql.Int, bookingId)
        .input('user_id', sql.Int, user_id)
        .input('check_in_date', sql.Date, check_in_date ? check_in_date : null)
        .input('check_out_date', sql.Date, check_out_date ? check_out_date : null)
        .input('booking_time', sql.VarChar(5), timeHHMM)
        .input('purpose', sql.NVarChar(500), purpose ?? null)
        .query(`
          UPDATE Bookings
          SET
            check_in_date   = COALESCE(@check_in_date, check_in_date),
            check_out_date  = COALESCE(@check_out_date, check_out_date),
            booking_time    = COALESCE(@booking_time, booking_time),
            purpose         = COALESCE(@purpose, purpose),
            updated_date    = GETDATE()
          WHERE booking_id = @booking_id
            AND user_id = @user_id
            AND status = 'Pending';
        `);

      // replace lines if items provided
      if (safeItems) {
        await new sql.Request(tx)
          .input('booking_id', sql.Int, bookingId)
          .query(`DELETE FROM BookingRooms WHERE booking_id = @booking_id;`);

        for (const x of safeItems) {
          await new sql.Request(tx)
            .input('booking_id', sql.Int, bookingId)
            .input('room_id', sql.Int, Number(x.room_id))
            .input('need_room_count', sql.Int, Number(x.need_room_count))
            .input('guest_count', sql.Int, Number(x.guest_count))
            .query(`
              INSERT INTO BookingRooms (booking_id, room_id, need_room_count, guest_count)
              VALUES (@booking_id, @room_id, @need_room_count, @guest_count);
            `);
        }
      }

      await tx.commit();
      return res.json({ message: 'Booking updated successfully' });
    } catch (err) {
      try { await tx.rollback(); } catch {}
      console.error('Edit booking TX error >>>', err);
      return res.status(500).json({ message: 'Server error', error: err.message });
    }
  } catch (err) {
    console.error('Edit booking error >>>', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// =====================================================
// ✅ ADMIN LIST: GET /bookings?status=Pending|Approved|Rejected|All
// Returns one row per booking (not per room), includes room summary + totals
// Keeps payment join logic unchanged (Payments keyed by booking_id)
// =====================================================
router.get('/', async (req, res) => {
  try {
    const status = String(req.query.status || 'All');
    const pool = await getPool();

    const where = status.toLowerCase() === 'all'
      ? ''
      : 'WHERE b.status = @status';

    const result = await pool
      .request()
      .input('status', sql.NVarChar(50), status)
      .query(`
        ;WITH RoomsAgg AS (
          SELECT
            br.booking_id,
            STRING_AGG(CONCAT(r.room_Name, ' × ', br.need_room_count), ' + ') WITHIN GROUP (ORDER BY r.room_Name) AS rooms_summary,
            SUM(br.need_room_count) AS total_rooms,
            SUM(br.guest_count) AS total_guests,
            CAST(SUM(CAST(br.guest_count AS decimal(10,2)) * CAST(r.price_per_person AS decimal(10,2))) AS decimal(10,2)) AS estimated_total,
            MAX(r.circuit_Id) AS circuit_Id -- best-effort
          FROM BookingRooms br
          LEFT JOIN CircuitRooms r ON r.room_Id = br.room_id
          GROUP BY br.booking_id
        )
        SELECT
          b.booking_id,
          b.user_id,
          u.name AS user_name,

          ra.rooms_summary,
          ra.total_rooms,
          ra.total_guests,
          ra.estimated_total,

          c.circuit_Name,
          c.city,
          c.street,

          b.booking_date,
          b.check_in_date,
          b.check_out_date,
          b.booking_time,
          b.purpose,
          b.status,
          b.created_date,
          b.updated_date,

          p.amount AS payment_amount,
          p.payment_slip_path,
          p.payment_slip_uploaded_date,

          CASE
            WHEN p.payment_slip_path IS NOT NULL THEN 1
            ELSE 0
          END AS has_payment_proof

        FROM Bookings b
        LEFT JOIN Users u ON u.user_id = b.user_id
        LEFT JOIN RoomsAgg ra ON ra.booking_id = b.booking_id
        LEFT JOIN Circuits c ON c.circuit_Id = ra.circuit_Id

        OUTER APPLY (
          SELECT TOP 1
            amount,
            payment_slip_path,
            payment_slip_uploaded_date
          FROM Payments
          WHERE booking_id = b.booking_id
          ORDER BY payment_slip_uploaded_date DESC, created_date DESC, payment_id DESC
        ) p

        ${where}
        ORDER BY b.created_date ASC;
      `);

    return res.json({ bookings: result.recordset });
  } catch (err) {
    console.error('Admin list bookings error >>>', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// =====================================================
// ✅ ADMIN: APPROVE booking (header)
// PATCH /bookings/:id/approve  body: { admin_id }
// =====================================================
router.patch('/:id/approve', async (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    const admin_id = Number(req.body.admin_id);

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({ message: 'Invalid booking id' });
    }
    if (!Number.isInteger(admin_id) || admin_id <= 0) {
      return res.status(400).json({ message: 'admin_id is required (int)' });
    }

    const pool = await getPool();
    const r = await pool.request()
      .input('booking_id', sql.Int, bookingId)
      .input('admin_id', sql.Int, admin_id)
      .query(`
        UPDATE Bookings
        SET
          status = 'Approved',
          approved_by = @admin_id,
          approved_date = GETDATE(),
          rejected_by = NULL,
          rejected_date = NULL,
          rejection_reason = NULL,
          updated_date = GETDATE()
        WHERE booking_id = @booking_id AND status = 'Pending';

        SELECT @@ROWCOUNT AS affected;
      `);

    if ((r.recordset?.[0]?.affected ?? 0) === 0) {
      return res.status(404).json({ message: 'Booking not found OR not Pending' });
    }

    return res.json({ message: 'Booking approved' });
  } catch (err) {
    console.error('Approve booking error >>>', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// =====================================================
// ✅ ADMIN: REJECT booking (header)
// PATCH /bookings/:id/reject body: { admin_id, reason }
// =====================================================
router.patch('/:id/reject', async (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    const admin_id = Number(req.body.admin_id);
    const reason = String(req.body.reason || '').trim();

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({ message: 'Invalid booking id' });
    }
    if (!Number.isInteger(admin_id) || admin_id <= 0) {
      return res.status(400).json({ message: 'admin_id is required (int)' });
    }
    if (!reason) {
      return res.status(400).json({ message: 'reason is required' });
    }

    const pool = await getPool();
    const r = await pool.request()
      .input('booking_id', sql.Int, bookingId)
      .input('admin_id', sql.Int, admin_id)
      .input('reason', sql.NVarChar(500), reason)
      .query(`
        UPDATE Bookings
        SET
          status = 'Rejected',
          rejected_by = @admin_id,
          rejected_date = GETDATE(),
          rejection_reason = @reason,
          approved_by = NULL,
          approved_date = NULL,
          updated_date = GETDATE()
        WHERE booking_id = @booking_id AND status = 'Pending';

        SELECT @@ROWCOUNT AS affected;
      `);

    if ((r.recordset?.[0]?.affected ?? 0) === 0) {
      return res.status(404).json({ message: 'Booking not found OR not Pending' });
    }

    return res.json({ message: 'Booking rejected' });
  } catch (err) {
    console.error('Reject booking error >>>', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;