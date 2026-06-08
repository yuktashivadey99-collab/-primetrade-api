const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const { getTasks, getTaskById, createTask, updateTask, deleteTask, getTaskStats } = require('../controllers/taskController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const VALID_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];

router.get('/stats', authenticate, authorize('admin'), getTaskStats);

router.get('/', authenticate,
  [
    query('status').optional().isIn(VALID_STATUSES),
    query('priority').optional().isIn(VALID_PRIORITIES),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate, getTasks
);

router.get('/:id', authenticate, getTaskById);

router.post('/', authenticate,
  [
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
    body('description').optional().trim().isLength({ max: 2000 }),
    body('status').optional().isIn(VALID_STATUSES).withMessage('Invalid status'),
    body('priority').optional().isIn(VALID_PRIORITIES).withMessage('Invalid priority'),
    body('due_date').optional().isISO8601().withMessage('due_date must be YYYY-MM-DD'),
  ],
  validate, createTask
);

router.put('/:id', authenticate,
  [
    body('title').optional().trim().notEmpty().isLength({ max: 200 }),
    body('description').optional().trim().isLength({ max: 2000 }),
    body('status').optional().isIn(VALID_STATUSES).withMessage('Invalid status'),
    body('priority').optional().isIn(VALID_PRIORITIES).withMessage('Invalid priority'),
    body('due_date').optional().isISO8601().withMessage('due_date must be YYYY-MM-DD'),
  ],
  validate, updateTask
);

router.delete('/:id', authenticate, deleteTask);

module.exports = router;
