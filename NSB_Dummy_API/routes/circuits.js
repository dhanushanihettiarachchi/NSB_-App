// routes/circuits.js
const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../db');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ------------------------------
// Helpers
// ------------------------------
function getCurrentUserId(req) {
  // 1) if you have auth middleware later (req.user)
  if (req.user && (req.user.user_id || req.user.id)) {
    return req.user.user_id || req.user.id;
  }

  // 2) from header (frontend will send this)
  const headerId = req.headers['x-user-id'];
  const headerNum = headerId ? Number(headerId) : NaN;
  if (Number.isFinite(headerNum) && headerNum > 0) return headerNum;

  // 3) fallback from body (if you send createdBy in JSON)
  if (req.body && (req.body.createdBy || req.body.created_by)) {
    const bodyNum = Number(req.body.createdBy || req.body.created_by);
    if (Number.isFinite(bodyNum) && bodyNum > 0) return bodyNum;
  }

  return null;
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

const MAIN_DIR = path.join(__dirname, '..', 'uploads', 'main');
const EXTRA_DIR = path.join(__dirname, '..', 'uploads', 'extra');
ensureDir(MAIN_DIR);
ensureDir(EXTRA_DIR);

// ------------------------------
// Multer storage
// ------------------------------
const storageMain = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MAIN_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.jpg') || '.jpg';
    cb(null, `main_${Date.now()}${ext}`);
  },
});

const storageExtra = multer.diskStorage({
  destination: (req, file, cb) => cb(null, EXTRA_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.jpg') || '.jpg';
    cb(null, `extra_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`);
  },
});

const uploadMain = multer({ storage: storageMain });
const uploadExtra = multer({ storage: storageExtra });

// ------------------------------
// Upload Routes
// ------------------------------
router.post('/upload/main', uploadMain.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const imagePath = `/uploads/main/${req.file.filename}`;
    return res.json({ imagePath });
  } catch (err) {
    console.error('Upload main error:', err);
    return res.status(500).json({ message: 'Upload failed' });
  }
});

router.post('/upload/extra', uploadExtra.array('images', 10), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ message: 'No files uploaded' });

    const imagePaths = files.map((f) => `/uploads/extra/${f.filename}`);
    return res.json({ imagePaths });
  } catch (err) {
    console.error('Upload extra error:', err);
    return res.status(500).json({ message: 'Upload failed' });
  }
});

// ------------------------------
// GET all active circuits
// ------------------------------
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        circuit_Id,
        circuit_Name,
        city,
        street,
        imagePath,
        createdBy,
        createdDate,
        updatedDate,
        is_active
      FROM Circuits
      WHERE is_active = 1
      ORDER BY createdDate DESC;
    `);

    // ✅ prevent browser cache (important on web)
    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');

    res.json(result.recordset);
  } catch (err) {
    console.error('Error getting circuits:', err);
    res.status(500).json({ message: 'Error getting circuits', error: err.message });
  }
});

// ------------------------------
// GET single room details (optional - for debugging)
// ✅ IMPORTANT: put this ABOVE "/:id" route, otherwise "/:id" captures "rooms"
// ------------------------------
router.get('/rooms/:roomId', async (req, res) => {
  const roomId = parseInt(req.params.roomId, 10);
  if (isNaN(roomId)) return res.status(400).json({ message: 'Invalid room id' });

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('room_Id', sql.Int, roomId)
      .query(`
        SELECT 
          room_Id,
          circuit_Id,
          room_Name,
          room_Count,
          max_Persons,
          price_per_person,
          description,
          createdBy,
          createdDate,
          updatedDate,
          removeDate,
          removed_by,
          is_active
        FROM CircuitRooms
        WHERE room_Id = @room_Id;
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // ✅ prevent browser cache
    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');

    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error getting room details:', err);
    res.status(500).json({ message: 'Error getting room details', error: err.message });
  }
});

// ------------------------------
// GET circuit details
// ------------------------------
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid circuit id' });

  try {
    const pool = await getPool();

    const circuitResult = await pool
      .request()
      .input('circuit_Id', sql.Int, id)
      .query(`
        SELECT 
          c.circuit_Id,
          c.circuit_Name,
          c.city,
          c.street,
          c.imagePath,
          c.createdBy,
          c.createdDate,
          c.updatedDate,
          c.is_active,
          c.removeDate,
          c.removed_by,
          u.first_name,
          u.last_name,
          u.name AS createdByName
        FROM Circuits c
        LEFT JOIN Users u ON c.createdBy = u.user_id
        WHERE c.circuit_Id = @circuit_Id;
      `);

    if (circuitResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Circuit not found' });
    }

    const roomsResult = await pool
      .request()
      .input('circuit_Id', sql.Int, id)
      .query(`
        SELECT 
          room_Id,
          circuit_Id,
          room_Name,
          room_Count,
          max_Persons,
          price_per_person,
          description,
          createdBy,
          createdDate,
          updatedDate,
          removeDate,
          removed_by,
          is_active
        FROM CircuitRooms
        WHERE circuit_Id = @circuit_Id
          AND is_active = 1
        ORDER BY room_Name;
      `);

    const imagesResult = await pool
      .request()
      .input('circuit_Id', sql.Int, id)
      .query(`
        SELECT 
          image_Id,
          circuit_Id,
          imagePath
        FROM CircuitImages
        WHERE circuit_Id = @circuit_Id
        ORDER BY image_Id DESC;
      `);

    // ✅ prevent browser cache (important on web)
    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');

    res.json({
      circuit: circuitResult.recordset[0],
      rooms: roomsResult.recordset,
      images: imagesResult.recordset,
    });
  } catch (err) {
    console.error('Error getting circuit details:', err);
    res.status(500).json({ message: 'Error getting circuit details', error: err.message });
  }
});

// ------------------------------
// POST create circuit
// ------------------------------
router.post('/', async (req, res) => {
  const { circuit_Name, city, street, imagePath, rooms, imagesText, images } = req.body;
  const createdBy = getCurrentUserId(req);

  if (!circuit_Name || !city || !street) {
    return res.status(400).json({ message: 'circuit_Name, city, and street are required' });
  }

  let transaction;
  try {
    const pool = await getPool();
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const circuitResult = await new sql.Request(transaction)
      .input('circuit_Name', sql.NVarChar(100), circuit_Name)
      .input('city', sql.NVarChar(100), city)
      .input('street', sql.NVarChar(100), street)
      .input('imagePath', sql.NVarChar(255), imagePath || null)
      .input('createdBy', sql.Int, createdBy || null)
      .query(`
        INSERT INTO Circuits (
          circuit_Name, city, street, imagePath, createdBy, is_active
        )
        VALUES (
          @circuit_Name, @city, @street, @imagePath, @createdBy, 1
        );

        SELECT SCOPE_IDENTITY() AS circuit_Id;
      `);

    const circuit_Id = circuitResult.recordset[0].circuit_Id;

    const roomsToInsert = Array.isArray(rooms) ? rooms : [];
    for (const r of roomsToInsert) {
      const name = (r.room_Name || '').trim();
      if (!name) continue;

      await new sql.Request(transaction)
        .input('circuit_Id', sql.Int, circuit_Id)
        .input('room_Name', sql.NVarChar(100), name)
        .input('room_Count', sql.Int, Number(r.room_Count) || 1)
        .input('max_Persons', sql.Int, Number(r.max_Persons) || 1)
        .input('price_per_person', sql.Decimal(10, 2), Number(r.price_per_person) || 0)
        .input('description', sql.VarChar(255), r.description || null)
        .input('createdBy', sql.Int, createdBy || null)
        .query(`
          INSERT INTO CircuitRooms (
            circuit_Id, room_Name, room_Count, max_Persons, price_per_person,
            description, createdBy, is_active
          )
          VALUES (
            @circuit_Id, @room_Name, @room_Count, @max_Persons, @price_per_person,
            @description, @createdBy, 1
          );
        `);
    }

    let imageList = [];
    if (typeof imagesText === 'string') {
      imageList = imagesText.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (Array.isArray(images)) {
      imageList = images.map((s) => (s || '').trim()).filter(Boolean);
    }

    for (const imgPath of imageList) {
      await new sql.Request(transaction)
        .input('circuit_Id', sql.Int, circuit_Id)
        .input('imagePath', sql.NVarChar(510), imgPath)
        .query(`
          INSERT INTO CircuitImages (circuit_Id, imagePath)
          VALUES (@circuit_Id, @imagePath);
        `);
    }

    await transaction.commit();
    res.status(201).json({ message: 'Circuit created successfully', circuit_Id });
  } catch (err) {
    console.error('Error creating circuit:', err);
    if (transaction) {
      try { await transaction.rollback(); } catch {}
    }
    res.status(500).json({ message: 'Error creating circuit', error: err.message });
  }
});

// ------------------------------
// PATCH update circuit info
// (your logic ok)
// ------------------------------
router.patch('/:id', async (req, res) => {
  const circuit_Id = parseInt(req.params.id, 10);
  if (isNaN(circuit_Id)) return res.status(400).json({ message: 'Invalid circuit id' });

  const { circuit_Name, city, street, imagePath } = req.body;

  if (!circuit_Name || !city || !street) {
    return res.status(400).json({ message: 'circuit_Name, city and street are required' });
  }

  let tx;
  try {
    const pool = await getPool();
    tx = new sql.Transaction(pool);
    await tx.begin();

    const result = await new sql.Request(tx)
      .input('circuit_Id', sql.Int, circuit_Id)
      .input('circuit_Name', sql.NVarChar(100), circuit_Name)
      .input('city', sql.NVarChar(100), city)
      .input('street', sql.NVarChar(100), street)
      .input('imagePath', sql.NVarChar(255), imagePath || null)
      .query(`
        UPDATE Circuits
        SET
          circuit_Name = @circuit_Name,
          city         = @city,
          street       = @street,
          imagePath    = @imagePath,
          updatedDate  = GETDATE()
        WHERE circuit_Id = @circuit_Id AND is_active = 1;

        SELECT @@ROWCOUNT AS rowsAffected;
      `);

    const rowsAffected = result.recordset[0]?.rowsAffected || 0;
    if (rowsAffected === 0) {
      await tx.rollback();
      return res.status(404).json({ message: 'Circuit not found or inactive' });
    }

    // Update all active rooms' updatedDate (optional)
    await new sql.Request(tx)
      .input('circuit_Id', sql.Int, circuit_Id)
      .query(`
        UPDATE CircuitRooms
        SET updatedDate = GETDATE()
        WHERE circuit_Id = @circuit_Id AND is_active = 1;
      `);

    await tx.commit();
    res.json({ message: 'Circuit updated successfully' });
  } catch (err) {
    console.error('Error updating circuit:', err);
    if (tx) {
      try { await tx.rollback(); } catch {}
    }
    res.status(500).json({ message: 'Error updating circuit', error: err.message });
  }
});

// ------------------------------
// POST replace rooms
// ------------------------------
router.post('/:id/rooms/replace', async (req, res) => {
  const circuit_Id = parseInt(req.params.id, 10);
  if (isNaN(circuit_Id)) return res.status(400).json({ message: 'Invalid circuit id' });

  const { rooms } = req.body;
  const userId = getCurrentUserId(req);

  const safeRooms = Array.isArray(rooms) ? rooms : [];

  let tx;
  try {
    const pool = await getPool();
    tx = new sql.Transaction(pool);
    await tx.begin();

    const existing = await new sql.Request(tx)
      .input('circuit_Id', sql.Int, circuit_Id)
      .query(`
        SELECT room_Id
        FROM CircuitRooms
        WHERE circuit_Id = @circuit_Id AND is_active = 1;
      `);

    const existingIds = existing.recordset.map((r) => r.room_Id);
    const incomingIds = safeRooms
      .map((r) => Number(r.room_Id))
      .filter((n) => Number.isInteger(n) && n > 0);

    // Soft-remove rooms not in incoming list
    for (const oldId of existingIds) {
      if (!incomingIds.includes(oldId)) {
        await new sql.Request(tx)
          .input('room_Id', sql.Int, oldId)
          .input('removed_by', sql.Int, userId || null)
          .query(`
            UPDATE CircuitRooms
            SET
              is_active   = 0,
              removeDate  = GETDATE(),
              removed_by  = @removed_by,
              updatedDate = GETDATE()
            WHERE room_Id = @room_Id;
          `);
      }
    }

    // Upsert incoming rooms
    for (const r of safeRooms) {
      const name = (r.room_Name || '').trim();
      if (!name) continue;

      const roomId = Number(r.room_Id);
      const room_Count = Number(r.room_Count) || 1;
      const max_Persons = Number(r.max_Persons) || 1;
      const price_per_person = Number(r.price_per_person) || 0;
      const description = (r.description || '').trim() || null;

      if (Number.isInteger(roomId) && roomId > 0) {
        await new sql.Request(tx)
          .input('room_Id', sql.Int, roomId)
          .input('circuit_Id', sql.Int, circuit_Id)
          .input('room_Name', sql.NVarChar(100), name)
          .input('room_Count', sql.Int, room_Count)
          .input('max_Persons', sql.Int, max_Persons)
          .input('price_per_person', sql.Decimal(10, 2), price_per_person)
          .input('description', sql.VarChar(255), description)
          .query(`
            UPDATE CircuitRooms
            SET
              room_Name        = @room_Name,
              room_Count       = @room_Count,
              max_Persons      = @max_Persons,
              price_per_person = @price_per_person,
              description      = @description,
              updatedDate      = GETDATE(),
              is_active        = 1,
              removeDate       = NULL,
              removed_by       = NULL
            WHERE room_Id = @room_Id AND circuit_Id = @circuit_Id;
          `);
      } else {
        await new sql.Request(tx)
          .input('circuit_Id', sql.Int, circuit_Id)
          .input('room_Name', sql.NVarChar(100), name)
          .input('room_Count', sql.Int, room_Count)
          .input('max_Persons', sql.Int, max_Persons)
          .input('price_per_person', sql.Decimal(10, 2), price_per_person)
          .input('description', sql.VarChar(255), description)
          .input('createdBy', sql.Int, userId || null)
          .query(`
            INSERT INTO CircuitRooms (
              circuit_Id, room_Name, room_Count, max_Persons, price_per_person,
              description, createdBy, is_active
            )
            VALUES (
              @circuit_Id, @room_Name, @room_Count, @max_Persons, @price_per_person,
              @description, @createdBy, 1
            );
          `);
      }
    }

    // Update circuit updatedDate
    await new sql.Request(tx)
      .input('circuit_Id', sql.Int, circuit_Id)
      .query(`
        UPDATE Circuits
        SET updatedDate = GETDATE()
        WHERE circuit_Id = @circuit_Id;
      `);

    await tx.commit();
    res.json({ message: 'Rooms updated successfully' });
  } catch (err) {
    console.error('Error replacing rooms:', err);
    if (tx) {
      try { await tx.rollback(); } catch {}
    }
    res.status(500).json({ message: 'Error replacing rooms', error: err.message });
  }
});

// ------------------------------
// POST replace extra images
// ------------------------------
router.post('/:id/images/replace', async (req, res) => {
  const circuit_Id = parseInt(req.params.id, 10);
  if (isNaN(circuit_Id)) return res.status(400).json({ message: 'Invalid circuit id' });

  const { images } = req.body;
  const safeImages = Array.isArray(images) ? images : [];

  let tx;
  try {
    const pool = await getPool();
    tx = new sql.Transaction(pool);
    await tx.begin();

    await new sql.Request(tx)
      .input('circuit_Id', sql.Int, circuit_Id)
      .query(`DELETE FROM CircuitImages WHERE circuit_Id = @circuit_Id;`);

    for (const p of safeImages) {
      const imagePath = (p || '').trim();
      if (!imagePath) continue;

      await new sql.Request(tx)
        .input('circuit_Id', sql.Int, circuit_Id)
        .input('imagePath', sql.NVarChar(510), imagePath)
        .query(`
          INSERT INTO CircuitImages (circuit_Id, imagePath)
          VALUES (@circuit_Id, @imagePath);
        `);
    }

    await new sql.Request(tx)
      .input('circuit_Id', sql.Int, circuit_Id)
      .query(`
        UPDATE Circuits
        SET updatedDate = GETDATE()
        WHERE circuit_Id = @circuit_Id;
      `);

    await tx.commit();
    res.json({ message: 'Images updated successfully' });
  } catch (err) {
    console.error('Error replacing images:', err);
    if (tx) {
      try { await tx.rollback(); } catch {}
    }
    res.status(500).json({ message: 'Error replacing images', error: err.message });
  }
});

// ------------------------------
// PATCH deactivate circuit
// ------------------------------
router.patch('/:id/deactivate', async (req, res) => {
  const circuit_Id = parseInt(req.params.id, 10);
  if (isNaN(circuit_Id)) return res.status(400).json({ message: 'Invalid circuit id' });

  const userId = getCurrentUserId(req);

  let tx;
  try {
    const pool = await getPool();
    tx = new sql.Transaction(pool);
    await tx.begin();

    const checkCircuit = await new sql.Request(tx)
      .input('circuit_Id', sql.Int, circuit_Id)
      .query(`
        SELECT circuit_Id, is_active
        FROM Circuits
        WHERE circuit_Id = @circuit_Id;
      `);

    if (checkCircuit.recordset.length === 0) {
      await tx.rollback();
      return res.status(404).json({ message: 'Circuit not found' });
    }

    if (checkCircuit.recordset[0].is_active === 0) {
      await tx.rollback();
      return res.status(400).json({ message: 'Circuit is already inactive' });
    }

    // Deactivate ALL rooms under this circuit
    await new sql.Request(tx)
      .input('circuit_Id', sql.Int, circuit_Id)
      .input('removed_by', sql.Int, userId || null)
      .query(`
        UPDATE CircuitRooms
        SET
          is_active   = 0,
          removeDate  = GETDATE(),
          removed_by  = @removed_by,
          updatedDate = GETDATE()
        WHERE circuit_Id = @circuit_Id;
      `);

    // Delete all images
    await new sql.Request(tx)
      .input('circuit_Id', sql.Int, circuit_Id)
      .query(`
        DELETE FROM CircuitImages
        WHERE circuit_Id = @circuit_Id;
      `);

    // Deactivate circuit
    await new sql.Request(tx)
      .input('circuit_Id', sql.Int, circuit_Id)
      .input('removed_by', sql.Int, userId || null)
      .query(`
        UPDATE Circuits
        SET
          is_active   = 0,
          removeDate  = GETDATE(),
          removed_by  = @removed_by,
          updatedDate = GETDATE()
        WHERE circuit_Id = @circuit_Id;
      `);

    await tx.commit();
    res.json({
      message: 'Circuit deactivated successfully',
      details: 'All associated rooms have been deactivated and images deleted',
    });
  } catch (err) {
    console.error('Error deactivating circuit:', err);
    if (tx) {
      try { await tx.rollback(); } catch {}
    }
    res.status(500).json({ message: 'Error deactivating circuit', error: err.message });
  }
});

module.exports = router;
