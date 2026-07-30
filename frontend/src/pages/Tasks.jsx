// src/pages/Tasks.jsx
import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle, Filter } from 'lucide-react';
import { getTasks, createTask, deleteTask, completeTask } from '../services/task.service';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import toast from 'react-hot-toast';

const DOMAINS = ['work_study', 'personal_growth', 'health', 'life_admin'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const ENERGIES = ['low', 'medium', 'high'];

const domainColors = {
  work_study:      'bg-blue-100 text-blue-700',
  personal_growth: 'bg-purple-100 text-purple-700',
  health:          'bg-green-100 text-green-700',
  life_admin:      'bg-amber-100 text-amber-700',
};

const priorityColors = {
  low:      'bg-gray-100 text-gray-600',
  medium:   'bg-yellow-100 text-yellow-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const emptyForm = {
  title: '', description: '', domain: 'work_study',
  priority: 'medium', estimatedMinutes: 30, energyLevel: 'medium',
  deadline: '', deadlineType: '', preferredDate: '',
  preferredStartTime: '', preferredEndTime: '',
};

const Tasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState({ status: '', domain: '', priority: '' });

  const fetchTasks = async () => {
    try {
      const params = {};
      if (filter.status) params.status = filter.status;
      if (filter.domain) params.domain = filter.domain;
      if (filter.priority) params.priority = filter.priority;
      const { data } = await getTasks(params);
      setTasks(data.tasks);
    } catch { toast.error('Failed to load tasks'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, [filter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (!payload.deadline) { delete payload.deadline; delete payload.deadlineType; }
      if (!payload.preferredDate) {
        delete payload.preferredDate;
        delete payload.preferredStartTime;
        delete payload.preferredEndTime;
      }
      await createTask(payload);
      toast.success('Task created!');
      setShowForm(false);
      setForm(emptyForm);
      fetchTasks();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to create task');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this task?')) return;
    try {
      await deleteTask(id);
      toast.success('Task deleted');
      fetchTasks();
    } catch { toast.error('Failed to delete'); }
  };

  const handleComplete = async (id) => {
    const mins = prompt('How many minutes did it take?');
    if (!mins) return;
    try {
      await completeTask(id, { actualMinutes: parseInt(mins) });
      toast.success('Task completed! 🎉');
      fetchTasks();
    } catch { toast.error('Failed to complete task'); }
  };

  const field = (key, value) => setForm(f => ({ ...f, [key]: value }));

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Task Backlog</h1>
          <p className="text-gray-500 mt-1">{tasks.length} tasks</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4" /> Add Task
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">New Task</h2>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <Input label="Title" value={form.title}
              onChange={e => field('title', e.target.value)} required />
            <Input label="Description (optional)" value={form.description}
              onChange={e => field('description', e.target.value)} />

            <div className="grid grid-cols-2 gap-4">
              {/* Domain */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Domain</label>
                <select value={form.domain} onChange={e => field('domain', e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {DOMAINS.map(d => (
                    <option key={d} value={d}>{d.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              {/* Priority */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Priority</label>
                <select value={form.priority} onChange={e => field('priority', e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {PRIORITIES.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              {/* Duration */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Duration (minutes)</label>
                <select value={form.estimatedMinutes}
                  onChange={e => field('estimatedMinutes', parseInt(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {[15, 30, 60, 90, 120].map(m => (
                    <option key={m} value={m}>{m} min</option>
                  ))}
                </select>
              </div>
              {/* Energy */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Energy Required</label>
                <select value={form.energyLevel} onChange={e => field('energyLevel', e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {ENERGIES.map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
              {/* Deadline */}
              <Input label="Deadline (optional)" type="date" value={form.deadline}
                onChange={e => field('deadline', e.target.value)} />
              {/* Deadline type */}
              {form.deadline && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Deadline Type</label>
                  <select value={form.deadlineType} onChange={e => field('deadlineType', e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">Select type</option>
                    <option value="hard">Hard (must finish by)</option>
                    <option value="soft">Soft (ideally by)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Preferred time hint */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">
                Preferred Time (optional — if you know when you want to do this)
              </p>
              <div className="grid grid-cols-3 gap-3">
                <Input label="Date" type="date" value={form.preferredDate}
                  onChange={e => field('preferredDate', e.target.value)} />
                <Input label="Start time" type="time" value={form.preferredStartTime}
                  onChange={e => field('preferredStartTime', e.target.value)} />
                <Input label="End time" type="time" value={form.preferredEndTime}
                  onChange={e => field('preferredEndTime', e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={submitting}>Create Task</Button>
              <Button type="button" variant="secondary"
                onClick={() => { setShowForm(false); setForm(emptyForm); }}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        {['', 'backlog', 'planned', 'in_progress', 'completed'].map(s => (
          <button key={s} onClick={() => setFilter(f => ({ ...f, status: s }))}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors
              ${filter.status === s
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s || 'All'}
          </button>
        ))}
        <div className="w-px h-4 bg-gray-300" />
        {DOMAINS.map(d => (
          <button key={d} onClick={() => setFilter(f => ({ ...f, domain: filter.domain === d ? '' : d }))}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors
              ${filter.domain === d
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {d.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Task list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No tasks yet. Add one above!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map(task => (
            <div key={task.id}
              className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-4
                hover:border-gray-300 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-medium text-gray-900">{task.title}</span>
                  {task.is_time_hinted && (
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                      📌 time-hinted
                    </span>
                  )}
                </div>
                {task.description && (
                  <p className="text-sm text-gray-500 mb-2">{task.description}</p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${domainColors[task.domain]}`}>
                    {task.domain.replace('_', ' ')}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[task.priority]}`}>
                    {task.priority}
                  </span>
                  <span className="text-xs text-gray-400">
                    {task.estimated_minutes} min · {task.energy_level} energy
                  </span>
                  {task.deadline && (
                    <span className="text-xs text-gray-400">
                      Due {new Date(task.deadline).toLocaleDateString()}
                      {task.deadline_type === 'hard' ? ' ⚠️' : ''}
                    </span>
                  )}
                  {task.preferred_start_time && (
                    <span className="text-xs text-indigo-500">
                      🕐 {task.preferred_start_time?.slice(0,5)} – {task.preferred_end_time?.slice(0,5)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {task.status !== 'completed' && (
                  <button onClick={() => handleComplete(task.id)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Mark complete">
                    <CheckCircle className="w-4 h-4" />
                  </button>
                )}
                {task.status === 'completed' && (
                  <span className="text-xs text-green-600 font-medium px-2">✓ Done</span>
                )}
                <button onClick={() => handleDelete(task.id)}
                  className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete task">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Tasks;