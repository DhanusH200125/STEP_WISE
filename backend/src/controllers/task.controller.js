// backend/src/controllers/task.controller.js
const { validationResult } = require('express-validator');
const { createTask, getTasks, getTaskById, updateTask, deleteTask } = require('../models/task.model');

const VALID_DURATIONS = [15, 30, 60, 120];

const addTask = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });

    const task = await createTask(req.user.id, req.body);
    return res.status(201).json({ message: 'Task created', task });
  } catch (err) { next(err); }
};

const listTasks = async (req, res, next) => {
  try {
    const { status, domain, priority } = req.query;
    const tasks = await getTasks(req.user.id, { status, domain, priority });
    return res.status(200).json({ tasks, count: tasks.length });
  } catch (err) { next(err); }
};

const getTask = async (req, res, next) => {
  try {
    const task = await getTaskById(req.params.id, req.user.id);
    if (!task) return res.status(404).json({ error: { message: 'Task not found' } });
    return res.status(200).json({ task });
  } catch (err) { next(err); }
};

const editTask = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });

    const task = await getTaskById(req.params.id, req.user.id);
    if (!task) return res.status(404).json({ error: { message: 'Task not found' } });

    const updated = await updateTask(req.params.id, req.user.id, req.body);
    return res.status(200).json({ message: 'Task updated', task: updated });
  } catch (err) { next(err); }
};

const removeTask = async (req, res, next) => {
  try {
    const deleted = await deleteTask(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ error: { message: 'Task not found' } });
    return res.status(200).json({ message: 'Task deleted' });
  } catch (err) { next(err); }
};

const completeTask = async (req, res, next) => {
  try {
    const task = await getTaskById(req.params.id, req.user.id);
    if (!task) return res.status(404).json({ error: { message: 'Task not found' } });

    const updated = await updateTask(req.params.id, req.user.id, {
      status: 'completed',
      actualMinutes: req.body.actualMinutes,
    });
    return res.status(200).json({ message: 'Task marked as completed', task: updated });
  } catch (err) { next(err); }
};

module.exports = { addTask, listTasks, getTask, editTask, removeTask, completeTask };