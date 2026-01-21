// routes/admin.js
const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../db');

// (Optional) test route – you can keep this for checking
router.get('/test', (req, res) => {
  res.send('admin test ok');
});

// GET all active users
router.get('/users', async (req, res) => {
  try {
    const pool = await getPool();

    // ✅ Added: circuit_id from active User_role_map (latest active mapping)
    const result = await pool.request().query(`
      SELECT 
        u.user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        u.is_active,
        urm.circuit_id
      FROM Users u
      OUTER APPLY (
        SELECT TOP 1 circuit_id
        FROM User_role_map
        WHERE user_id = u.user_id AND is_active = 1
        ORDER BY assigned_date DESC, user_map_id DESC
      ) urm
      WHERE u.is_active = 1
      ORDER BY u.create_date DESC
    `);

    return res.json({ users: result.recordset });
  } catch (err) {
    console.error('Get users error >>>', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET all roles
router.get('/roles', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT role_id, role_name, description
      FROM Roles
      ORDER BY role_name
    `);

    return res.json({ roles: result.recordset });
  } catch (err) {
    console.error('Get roles error >>>', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ASSIGN role to user (SuperAdmin action)
router.post('/assign-role', async (req, res) => {
  try {
    const { user_id, role_id, assigned_by, circuit_id } = req.body;

    if (!user_id || !role_id || !assigned_by) {
      return res.status(400).json({ message: 'user_id, role_id, assigned_by are required' });
    }

    const pool = await getPool();

    // ✅ Added: check role name to enforce circuit_id only for Branch Manager
    const roleRes = await pool.request()
      .input('role_id', sql.Int, role_id)
      .query(`SELECT role_name FROM Roles WHERE role_id = @role_id`);

    const roleName = roleRes.recordset[0]?.role_name || '';
    const isBranchManager = roleName.toLowerCase().includes('branch');

    if (isBranchManager && !circuit_id) {
      return res.status(400).json({ message: 'circuit_id is required for Branch Manager' });
    }

    // 1) Deactivate old mappings for this user
    await pool.request()
      .input('user_id', sql.Int, user_id)
      .input('assigned_by', sql.Int, assigned_by)
      .query(`
        UPDATE User_role_map
        SET 
          is_active = 0,
          removed_by = @assigned_by,
          removed_date = GETDATE()
        WHERE user_id = @user_id
          AND is_active = 1
      `);

    // 2) Insert new active mapping
    await pool.request()
      .input('user_id', sql.Int, user_id)
      .input('role_id', sql.Int, role_id)
      .input('assigned_by', sql.Int, assigned_by)
      .input('circuit_id', sql.Int, circuit_id || null)
      .query(`
        INSERT INTO User_role_map (user_id, role_id, assigned_by, circuit_id, is_active)
        VALUES (@user_id, @role_id, @assigned_by, @circuit_id, 1)
      `);

    // 3) Update Users.role string to match new role (for simple login)
    const updateUserResult = await pool.request()
      .input('user_id', sql.Int, user_id)
      .input('role_id', sql.Int, role_id)
      .query(`
        UPDATE u
        SET 
          u.role = r.role_name, 
          u.update_date = GETDATE()
        FROM Users u
        JOIN Roles r ON r.role_id = @role_id
        WHERE u.user_id = @user_id;

        SELECT 
          u.user_id,
          u.first_name,
          u.last_name,
          u.email,
          u.role
        FROM Users u
        WHERE u.user_id = @user_id;
      `);

    const updatedUser = updateUserResult.recordset[0];

    return res.json({
      message: 'Role assigned successfully',
      user: updatedUser,
    });
  } catch (err) {
    console.error('Assign role error >>>', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
