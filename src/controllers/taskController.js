const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');

/**
 * @route GET /api/v1/tasks
 */
const getTasks = (req, res) => {
  const { status, priority, page = 1, limit = 10, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const isAdmin = req.user.role === 'admin';

  let baseQuery = isAdmin
    ? 'SELECT t.*, u.username as owner FROM tasks t JOIN users u ON t.user_id = u.id'
    : 'SELECT * FROM tasks WHERE user_id = ?';

  const conditions = [];
  const params = [];

  if (!isAdmin) params.push(req.user.id);
  if (status) { conditions.push(`t.status = ?`); params.push(status); }
  if (priority) { conditions.push(`t.priority = ?`); params.push(priority); }
  if (search) { conditions.push(`t.title LIKE ?`); params.push(`%${search}%`); }

  if (conditions.length) {
    baseQuery += (isAdmin ? ' WHERE ' : ' AND ') + conditions.join(' AND ');
  }

  const countQuery = baseQuery.replace('SELECT t.*, u.username as owner', 'SELECT COUNT(*) as count').replace('SELECT *', 'SELECT COUNT(*) as count');
  const total = db.prepare(countQuery).get(...params).count;

  const tasks = db.prepare(`${baseQuery} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);

  res.status(200).json({
    success: true,
    data: {
      tasks,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    },
  });
};

/**
 * @route GET /api/v1/tasks/:id
 */
const getTaskById = (req, res) => {
  const { id } = req.params;
  const isAdmin = req.user.role === 'admin';

  const task = isAdmin
    ? db.prepare('SELECT t.*, u.username as owner FROM tasks t JOIN users u ON t.user_id = u.id WHERE t.id = ?').get(id)
    : db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id, req.user.id);

  if (!task) return res.status(404).json({ success: false, error: 'NotFound', message: 'Task not found' });
  res.status(200).json({ success: true, data: { task } });
};

/**
 * @route POST /api/v1/tasks
 */
const createTask = (req, res) => {
  const { title, description, status, priority, due_date } = req.body;
  const id = uuidv4();

  db.prepare(
    'INSERT INTO tasks (id, title, description, status, priority, due_date, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, title.trim(), description?.trim() || null, status || 'pending', priority || 'medium', due_date || null, req.user.id);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.status(201).json({ success: true, message: 'Task created successfully', data: { task } });
};

/**
 * @route PUT /api/v1/tasks/:id
 */
const updateTask = (req, res) => {
  const { id } = req.params;
  const isAdmin = req.user.role === 'admin';

  const existing = isAdmin
    ? db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
    : db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id, req.user.id);

  if (!existing) return res.status(404).json({ success: false, error: 'NotFound', message: 'Task not found' });

  const { title, description, status, priority, due_date } = req.body;
  db.prepare(
    `UPDATE tasks SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      status = COALESCE(?, status),
      priority = COALESCE(?, priority),
      due_date = COALESCE(?, due_date),
      updated_at = datetime('now')
    WHERE id = ?`
  ).run(title?.trim() || null, description?.trim() || null, status || null, priority || null, due_date || null, id);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.status(200).json({ success: true, message: 'Task updated successfully', data: { task } });
};

/**
 * @route DELETE /api/v1/tasks/:id
 */
const deleteTask = (req, res) => {
  const { id } = req.params;
  const isAdmin = req.user.role === 'admin';

  const task = isAdmin
    ? db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
    : db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id, req.user.id);

  if (!task) return res.status(404).json({ success: false, error: 'NotFound', message: 'Task not found' });

  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  res.status(200).json({ success: true, message: 'Task deleted successfully' });
};

/**
 * @route GET /api/v1/tasks/stats  (admin only)
 */
const getTaskStats = (req, res) => {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high_priority
    FROM tasks
  `).get();
  res.status(200).json({ success: true, data: { stats } });
};

module.exports = { getTasks, getTaskById, createTask, updateTask, deleteTask, getTaskStats };
