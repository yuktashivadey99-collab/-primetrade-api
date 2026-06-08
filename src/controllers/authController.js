const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * @route POST /api/v1/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { username, email, password, role } = req.body;

    // Only allow admin role if explicitly set (default user)
    const assignedRole = role === 'admin' ? 'admin' : 'user';

    const hashedPassword = await bcrypt.hash(password, 12);
    const id = uuidv4();

    const stmt = db.prepare(
      'INSERT INTO users (id, username, email, password, role) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(id, username.trim(), email.toLowerCase().trim(), hashedPassword, assignedRole);

    const user = db.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?').get(id);
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { user, token },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/v1/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ success: false, error: 'InvalidCredentials', message: 'Invalid email or password' });
    }
    if (!user.is_active) {
      return res.status(403).json({ success: false, error: 'AccountDeactivated', message: 'Your account has been deactivated' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'InvalidCredentials', message: 'Invalid email or password' });
    }

    const token = generateToken(user);
    const { password: _, ...safeUser } = user;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user: safeUser, token },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route GET /api/v1/auth/me
 */
const getMe = (req, res) => {
  const { password: _, ...safeUser } = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(req.user.id);
  res.status(200).json({ success: true, data: { user: safeUser } });
};

/**
 * @route GET /api/v1/auth/users  (admin only)
 */
const getAllUsers = (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const users = db
    .prepare('SELECT id, username, email, role, is_active, created_at FROM users LIMIT ? OFFSET ?')
    .all(parseInt(limit), offset);
  const total = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

  res.status(200).json({
    success: true,
    data: { users, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } },
  });
};

/**
 * @route PATCH /api/v1/auth/users/:id/role  (admin only)
 */
const updateUserRole = (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ success: false, error: 'NotFound', message: 'User not found' });

  db.prepare('UPDATE users SET role = ?, updated_at = datetime(\'now\') WHERE id = ?').run(role, id);
  const updated = db.prepare('SELECT id, username, email, role FROM users WHERE id = ?').get(id);
  res.status(200).json({ success: true, message: 'User role updated', data: { user: updated } });
};

/**
 * @route DELETE /api/v1/auth/users/:id  (admin only)
 */
const deleteUser = (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) {
    return res.status(400).json({ success: false, error: 'BadRequest', message: 'Cannot delete your own account' });
  }
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ success: false, error: 'NotFound', message: 'User not found' });

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.status(200).json({ success: true, message: 'User deleted successfully' });
};

module.exports = { register, login, getMe, getAllUsers, updateUserRole, deleteUser };
