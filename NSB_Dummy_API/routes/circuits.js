const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../db');

// Helper to get current logged-in user id (adjust to your auth)
function getCurrentUserId(req) {
  if (req.user && (req.user.user_id || req.user.id)) {
    return req.user.user_id || req.user.id;
  }
  if (req.body && req.body.createdBy) {
    return req.body.createdBy;
  }
  return null;
}

//
// GET /circuits  → list all ACTIVE circuits
//
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

    res.json(result.recordset);
  } catch (err) {
    console.error('Error getting circuits:', err);
    res
      .status(500)
      .json({ message: 'Error getting circuits', error: err.message });
  }
});

//
// GET /circuits/:id  → circuit + active rooms + images
//
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ message: 'Invalid circuit id' });
  }

  try {
    const pool = await getPool();

    // 1) Circuit
    const circuitRequest = pool.request();
    circuitRequest.input('circuit_Id', sql.Int, id);

    const circuitResult = await circuitRequest.query(`
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
      LEFT JOIN Users u
        ON c.createdBy = u.user_id
      WHERE c.circuit_Id = @circuit_Id;
    `);

    if (circuitResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Circuit not found' });
    }

    const circuit = circuitResult.recordset[0];

    // 2) ACTIVE Rooms
    const roomsRequest = pool.request();
    roomsRequest.input('circuit_Id', sql.Int, id);

    const roomsResult = await roomsRequest.query(`
      SELECT 
        room_Id,
        circuit_Id,
        room_Name,
        room_Count,
        max_Persons,
        price_per_person,
        description,
        is_active,
        createdDate,
        updatedDate,
        removeDate,
        removed_by
      FROM CircuitRooms
      WHERE circuit_Id = @circuit_Id
        AND is_active = 1
      ORDER BY room_Name;
    `);

    // 3) Images (simple table: image_Id, circuit_Id, imagePath)
    const imagesRequest = pool.request();
    imagesRequest.input('circuit_Id', sql.Int, id);

    const imagesResult = await imagesRequest.query(`
      SELECT 
        image_Id,
        circuit_Id,
        imagePath
      FROM CircuitImages
      WHERE circuit_Id = @circuit_Id
      ORDER BY image_Id DESC;
    `);

    res.json({
      circuit,
      rooms: roomsResult.recordset,
      images: imagesResult.recordset,
    });
  } catch (err) {
    console.error('Error getting circuit details:', err);
    res
      .status(500)
      .json({ message: 'Error getting circuit details', error: err.message });
  }
});

//
// POST /circuits  → add circuit + many rooms + extra images
//
router.post('/', async (req, res) => {
  console.log('POST /circuits body >>>', JSON.stringify(req.body, null, 2));

  const {
    circuit_Name,
    city,
    street,
    imagePath,

    // optional old single-room style
    room_Name,
    room_Count,
    max_Persons,
    price_per_person,
    description,

    // new style
    rooms,
    imagesText,
    images,
  } = req.body;

  const createdBy = getCurrentUserId(req);

  if (!circuit_Name || !city || !street) {
    return res.status(400).json({
      message: 'circuit_Name, city, and street are required',
    });
  }

  let transaction;

  try {
    const pool = await getPool();
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    // 1) INSERT INTO Circuits
    const circuitRequest = new sql.Request(transaction);
    circuitRequest.input('circuit_Name', sql.NVarChar(100), circuit_Name);
    circuitRequest.input('city', sql.NVarChar(100), city);
    circuitRequest.input('street', sql.NVarChar(100), street);
    circuitRequest.input('imagePath', sql.NVarChar(255), imagePath || null);
    circuitRequest.input('createdBy', sql.Int, createdBy || null);

    const circuitResult = await circuitRequest.query(`
      INSERT INTO Circuits (
        circuit_Name,
        city,
        street,
        imagePath,
        createdBy,
        is_active
      )
      VALUES (
        @circuit_Name,
        @city,
        @street,
        @imagePath,
        @createdBy,
        1
      );

      SELECT SCOPE_IDENTITY() AS circuit_Id;
    `);

    const circuit_Id = circuitResult.recordset[0].circuit_Id;
    console.log('NEW CIRCUIT_ID:', circuit_Id);

    // 2) INSERT rooms (is_active = 1)
    let roomsToInsert = [];

    if (Array.isArray(rooms) && rooms.length > 0) {
      roomsToInsert = rooms;
    } else if (room_Name) {
      roomsToInsert = [
        {
          room_Name,
          room_Count,
          max_Persons,
          price_per_person,
          description,
        },
      ];
    }

    for (const r of roomsToInsert) {
      const name =
        r.room_Name !== undefined ? r.room_Name : r.roomName;
      const count =
        r.room_Count !== undefined
          ? Number(r.room_Count)
          : r.roomCount !== undefined
          ? Number(r.roomCount)
          : 1;
      const max =
        r.max_Persons !== undefined
          ? Number(r.max_Persons)
          : r.maxPersons !== undefined
          ? Number(r.maxPersons)
          : 1;
      const price =
        r.price_per_person !== undefined
          ? Number(r.price_per_person)
          : r.pricePerPerson !== undefined
          ? Number(r.pricePerPerson)
          : 0;
      const desc =
        r.description !== undefined ? r.description : null;

      if (!name) {
        console.log('Skipping room without name:', r);
        continue;
      }

      const roomRequest = new sql.Request(transaction);
      roomRequest.input('circuit_Id', sql.Int, circuit_Id);
      roomRequest.input('room_Name', sql.NVarChar(100), name);
      roomRequest.input('room_Count', sql.Int, count || 1);
      roomRequest.input('max_Persons', sql.Int, max || 1);
      roomRequest.input('price_per_person', sql.Decimal(10, 2), price || 0);
      roomRequest.input('description', sql.VarChar(255), desc);
      roomRequest.input('createdBy', sql.Int, createdBy || null);

      await roomRequest.query(`
        INSERT INTO CircuitRooms (
          circuit_Id,
          room_Name,
          room_Count,
          max_Persons,
          price_per_person,
          description,
          createdBy,
          is_active
        )
        VALUES (
          @circuit_Id,
          @room_Name,
          @room_Count,
          @max_Persons,
          @price_per_person,
          @description,
          @createdBy,
          1
        );
      `);
    }

    // 3) INSERT images (CircuitImages only has: image_Id, circuit_Id, imagePath)
    let imageList = [];

    if (typeof imagesText === 'string') {
      imageList = imagesText
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    } else if (Array.isArray(images)) {
      imageList = images
        .map((s) => (s || '').trim())
        .filter((s) => s.length > 0);
    }

    for (const imgPath of imageList) {
      const trimmedPath = (imgPath || '').trim();
      if (!trimmedPath) continue;

      const imgRequest = new sql.Request(transaction);
      imgRequest.input('circuit_Id', sql.Int, circuit_Id);
      imgRequest.input('imagePath', sql.NVarChar(255), trimmedPath);

      await imgRequest.query(`
        INSERT INTO CircuitImages (
          circuit_Id,
          imagePath
        )
        VALUES (
          @circuit_Id,
          @imagePath
        );
      `);
    }

    await transaction.commit();

    res.status(201).json({
      message: 'Circuit (rooms and images if provided) created successfully',
      circuit_Id,
    });
  } catch (err) {
    console.error('Error creating circuit:', err);

    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        console.error('Rollback failed:', rollbackErr);
      }
    }

    res.status(500).json({
      message: 'Error creating circuit',
      error: err.message,
    });
  }
});

//
// PATCH /circuits/:id  → update circuit basic info (sets updatedDate)
// ONLY affects Circuits table
//
router.patch('/:id', async (req, res) => {
  const circuit_Id = parseInt(req.params.id, 10);

  if (isNaN(circuit_Id)) {
    return res.status(400).json({ message: 'Invalid circuit id' });
  }

  const { circuit_Name, city, street, imagePath } = req.body;

  if (!circuit_Name || !city || !street) {
    return res.status(400).json({
      message: 'circuit_Name, city and street are required to update',
    });
  }

  try {
    const pool = await getPool();
    const request = pool.request();

    request.input('circuit_Id', sql.Int, circuit_Id);
    request.input('circuit_Name', sql.NVarChar(100), circuit_Name);
    request.input('city', sql.NVarChar(100), city);
    request.input('street', sql.NVarChar(100), street);
    request.input('imagePath', sql.NVarChar(255), imagePath || null);

    const result = await request.query(`
      UPDATE Circuits
      SET
        circuit_Name = @circuit_Name,
        city         = @city,
        street       = @street,
        imagePath    = @imagePath,
        updatedDate  = GETDATE()
      WHERE
        circuit_Id = @circuit_Id
        AND is_active = 1;

      SELECT @@ROWCOUNT AS rowsAffected;
    `);

    const rowsAffected = result.recordset[0]?.rowsAffected || 0;

    if (rowsAffected === 0) {
      return res
        .status(404)
        .json({ message: 'Circuit not found or inactive' });
    }

    res.json({ message: 'Circuit updated successfully' });
  } catch (err) {
    console.error('Error updating circuit:', err);
    res.status(500).json({
      message: 'Error updating circuit',
      error: err.message,
    });
  }
});

//
// PATCH /circuits/:id/deactivate  → soft delete circuit + rooms, hard delete images
//
router.patch('/:id/deactivate', async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ message: 'Invalid circuit id' });
  }

  const currentUserId = getCurrentUserId(req) || 1;

  try {
    const pool = await getPool();
    const request = pool.request();
    request.input('circuit_Id', sql.Int, id);
    request.input('removed_by', sql.Int, currentUserId);

    const result = await request.query(`
      DECLARE @rows INT;

      -- 1) soft delete circuit
      UPDATE c
      SET 
        is_active  = 0,
        removeDate = GETDATE(),
        removed_by = @removed_by
      FROM Circuits c
      WHERE c.circuit_Id = @circuit_Id
        AND c.is_active = 1;

      SET @rows = @@ROWCOUNT;

      -- 2) if circuit was active, also soft delete rooms
      IF @rows > 0
      BEGIN
        UPDATE cr
        SET 
          is_active  = 0,
          removeDate = GETDATE(),
          removed_by = @removed_by
        FROM CircuitRooms cr
        WHERE cr.circuit_Id = @circuit_Id
          AND cr.is_active = 1;

        -- 3) hard delete images (CircuitImages has no soft-delete columns)
        DELETE FROM CircuitImages
        WHERE circuit_Id = @circuit_Id;
      END

      SELECT @rows AS rowsAffected;
    `);

    const rowsAffected = result.recordset[0]?.rowsAffected || 0;

    if (rowsAffected === 0) {
      return res
        .status(404)
        .json({ message: 'Circuit not found or already inactive' });
    }

    res.json({
      message:
        'Circuit and related rooms/images deactivated successfully',
    });
  } catch (err) {
    console.error('Error deactivating circuit:', err);
    res
      .status(500)
      .json({ message: 'Error deactivating circuit', error: err.message });
  }
});

//
// POST /circuits/:id/rooms/replace
//  → update existing rooms + add new rooms + soft-delete removed rooms
// ONLY affects CircuitRooms table
//
router.post('/:id/rooms/replace', async (req, res) => {
  const circuit_Id = parseInt(req.params.id, 10);
  if (isNaN(circuit_Id)) {
    return res.status(400).json({ message: 'Invalid circuit id' });
  }

  const { rooms } = req.body;
  const createdBy = getCurrentUserId(req);
  const safeRooms = Array.isArray(rooms) ? rooms : [];

  try {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    // 0) Get current active room ids in DB for this circuit
    const existingReq = new sql.Request(tx);
    existingReq.input('circuit_Id', sql.Int, circuit_Id);
    const existingResult = await existingReq.query(`
      SELECT room_Id
      FROM CircuitRooms
      WHERE circuit_Id = @circuit_Id
        AND is_active = 1;
    `);
    const existingIds = existingResult.recordset.map((r) => r.room_Id);

    // room ids coming from the client (rooms we KEEP)
    const payloadIds = safeRooms
      .map((r) => r.room_Id ?? r.roomId)
      .filter((v) => v !== undefined && v !== null && !isNaN(parseInt(v, 10)))
      .map((v) => parseInt(v, 10));

    // ids that exist in DB but are NOT in payload → delete these
    const idsToDelete = existingIds.filter(
      (id) => !payloadIds.includes(id)
    );

    // 1) Soft-delete missing rooms
    for (const delId of idsToDelete) {
      const delReq = new sql.Request(tx);
      delReq.input('room_Id', sql.Int, delId);
      delReq.input('circuit_Id', sql.Int, circuit_Id);
      delReq.input('removed_by', sql.Int, createdBy || null);

      await delReq.query(`
        UPDATE CircuitRooms
        SET
          is_active  = 0,
          removeDate = GETDATE(),
          removed_by = @removed_by
        WHERE
          room_Id    = @room_Id
          AND circuit_Id = @circuit_Id
          AND is_active = 1;
      `);
    }

    // 2) Update existing rooms + insert new rooms
    for (const r of safeRooms) {
      const room_IdRaw = r.room_Id ?? r.roomId;
      const room_Id = room_IdRaw !== undefined ? parseInt(room_IdRaw, 10) : NaN;

      const name = (r.room_Name ?? r.roomName ?? '').trim();
      if (!name) continue;

      const count = Number(r.room_Count ?? r.roomCount ?? 1);
      const max = Number(r.max_Persons ?? r.maxPersons ?? 1);
      const price = Number(r.price_per_person ?? r.pricePerPerson ?? 0);
      const desc = r.description ?? null;

      if (!isNaN(room_Id)) {
        // UPDATE existing room
        const updReq = new sql.Request(tx);
        updReq.input('room_Id', sql.Int, room_Id);
        updReq.input('circuit_Id', sql.Int, circuit_Id);
        updReq.input('room_Name', sql.NVarChar(100), name);
        updReq.input('room_Count', sql.Int, count);
        updReq.input('max_Persons', sql.Int, max);
        updReq.input('price_per_person', sql.Decimal(10, 2), price);
        updReq.input('description', sql.VarChar(255), desc);

        await updReq.query(`
          UPDATE CircuitRooms
          SET
            room_Name        = @room_Name,
            room_Count       = @room_Count,
            max_Persons      = @max_Persons,
            price_per_person = @price_per_person,
            description      = @description,
            updatedDate      = GETDATE()
          WHERE
            room_Id    = @room_Id
            AND circuit_Id = @circuit_Id;
        `);
      } else {
        // INSERT new room
        const insReq = new sql.Request(tx);
        insReq.input('circuit_Id', sql.Int, circuit_Id);
        insReq.input('room_Name', sql.NVarChar(100), name);
        insReq.input('room_Count', sql.Int, count);
        insReq.input('max_Persons', sql.Int, max);
        insReq.input('price_per_person', sql.Decimal(10, 2), price);
        insReq.input('description', sql.VarChar(255), desc);
        insReq.input('createdBy', sql.Int, createdBy || null);

        await insReq.query(`
          INSERT INTO CircuitRooms (
            circuit_Id,
            room_Name,
            room_Count,
            max_Persons,
            price_per_person,
            description,
            createdBy,
            is_active
          )
          VALUES (
            @circuit_Id,
            @room_Name,
            @room_Count,
            @max_Persons,
            @price_per_person,
            @description,
            @createdBy,
            1
          );
        `);
      }
    }

    await tx.commit();
    res.json({
      message: 'Rooms updated (and removed ones soft-deleted) successfully',
    });
  } catch (err) {
    console.error('Error updating rooms:', err);
    res.status(500).json({
      message: 'Error updating rooms',
      error: err.message,
    });
  }
});

//
// POST /circuits/:id/images/replace
//  → delete old images & insert new ones
// ONLY affects CircuitImages table
//
router.post('/:id/images/replace', async (req, res) => {
  const circuit_Id = parseInt(req.params.id, 10);
  if (isNaN(circuit_Id)) {
    return res.status(400).json({ message: 'Invalid circuit id' });
  }

  const { images } = req.body;
  const safeImages = Array.isArray(images) ? images : [];

  try {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    // 1) Delete existing images for this circuit
    const delReq = new sql.Request(tx);
    delReq.input('circuit_Id', sql.Int, circuit_Id);

    await delReq.query(`
      DELETE FROM CircuitImages
      WHERE circuit_Id = @circuit_Id;
    `);

    // 2) Insert new images
    for (const raw of safeImages) {
      const path = (raw || '').trim();
      if (!path) continue;

      const imgReq = new sql.Request(tx);
      imgReq.input('circuit_Id', sql.Int, circuit_Id);
      imgReq.input('imagePath', sql.NVarChar(255), path);

      await imgReq.query(`
        INSERT INTO CircuitImages (
          circuit_Id,
          imagePath
        )
        VALUES (
          @circuit_Id,
          @imagePath
        );
      `);
    }

    await tx.commit();
    res.json({ message: 'Images replaced successfully' });
  } catch (err) {
    console.error('Error replacing images:', err);
    res.status(500).json({
      message: 'Error replacing images',
      error: err.message,
    });
  }
});

module.exports = router;
