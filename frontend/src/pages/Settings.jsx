// src/pages/Settings.jsx
import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Moon, Sun } from 'lucide-react';
import { getSleep, setSleep, getBlocks, addBlock, deleteBlock } from '../services/routine.service';
import api from '../services/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import toast from 'react-hot-toast';

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

const Settings = () => {
  // Preferences
  const [prefs, setPrefs] = useState({
    growth_target_hours_weekly: 5,
    realism_factor: 0.7,
    notification_pref: 'none',
    working_days: ['monday','tuesday','wednesday','thursday','friday'],
  });

  // Sleep
  const [sleep, setSleepState] = useState({ sleepTime: '23:00', wakeTime: '07:00' });

  // Blocks
  const [blocks, setBlocks] = useState([]);
  const [newBlock, setNewBlock] = useState({
    title: '', dayOfWeek: 'monday', startTime: '09:00', endTime: '10:00',
  });

  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savingSleep, setSavingSleep] = useState(false);
  const [addingBlock, setAddingBlock] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [prefRes, sleepRes, blocksRes] = await Promise.allSettled([
          api.get('/users/me'),
          getSleep(),
          getBlocks(),
        ]);
        if (prefRes.status === 'fulfilled') {
          const u = prefRes.value.data.user;
          setPrefs({
            growth_target_hours_weekly: parseFloat(u.growth_target_hours_weekly) || 5,
            realism_factor: parseFloat(u.realism_factor) || 0.7,
            notification_pref: u.notification_pref || 'none',
            working_days: Array.isArray(u.working_days)
              ? u.working_days
              : (u.working_days || '').replace(/[{}"]/g, '').split(',').filter(Boolean),
          });
        }
        if (sleepRes.status === 'fulfilled' && sleepRes.value.data.schedule) {
          const s = sleepRes.value.data.schedule;
          setSleepState({
            sleepTime: s.sleep_time?.slice(0, 5) || '23:00',
            wakeTime: s.wake_time?.slice(0, 5) || '07:00',
          });
        }
        if (blocksRes.status === 'fulfilled') {
          setBlocks(blocksRes.value.data.blocks || []);
        }
      } finally { setLoading(false); }
    };
    fetchAll();
  }, []);

  const handleSavePrefs = async () => {
    setSavingPrefs(true);
    try {
      await api.patch('/users/me/preferences', prefs);
      toast.success('Preferences saved!');
    } catch { toast.error('Failed to save preferences'); }
    finally { setSavingPrefs(false); }
  };

  const handleSaveSleep = async () => {
    setSavingSleep(true);
    try {
      await setSleep(sleep);
      toast.success('Sleep schedule saved!');
    } catch { toast.error('Failed to save sleep schedule'); }
    finally { setSavingSleep(false); }
  };

  const handleAddBlock = async (e) => {
    e.preventDefault();
    setAddingBlock(true);
    try {
      const { data } = await addBlock(newBlock);
      setBlocks(b => [...b, data.block]);
      setNewBlock({ title: '', dayOfWeek: 'monday', startTime: '09:00', endTime: '10:00' });
      toast.success('Routine block added!');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to add block');
    } finally { setAddingBlock(false); }
  };

  const handleDeleteBlock = async (id) => {
    if (!confirm('Remove this routine block?')) return;
    try {
      await deleteBlock(id);
      setBlocks(b => b.filter(bl => bl.id !== id));
      toast.success('Block removed');
    } catch { toast.error('Failed to remove block'); }
  };

  const toggleDay = (day) => {
    setPrefs(p => ({
      ...p,
      working_days: p.working_days.includes(day)
        ? p.working_days.filter(d => d !== day)
        : [...p.working_days, day],
    }));
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent" />
    </div>
  );

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your schedule and preferences</p>
      </div>

      {/* Preferences */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">Preferences</h2>
        <div className="flex flex-col gap-5">

          {/* Working days */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Working Days</label>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map(day => (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors
                    ${prefs.working_days.includes(day)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Growth target */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Weekly Growth Target: <span className="text-indigo-600 font-semibold">
                {prefs.growth_target_hours_weekly}h
              </span>
            </label>
            <input
              type="range" min="1" max="20" step="0.5"
              value={prefs.growth_target_hours_weekly}
              onChange={e => setPrefs(p => ({ ...p, growth_target_hours_weekly: parseFloat(e.target.value) }))}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>1h</span><span>20h</span>
            </div>
          </div>

          {/* Realism factor */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Realism Factor: <span className="text-indigo-600 font-semibold">
                {Math.round(prefs.realism_factor * 100)}%
              </span>
              <span className="text-gray-400 font-normal ml-1">
                (how much of free time is productive)
              </span>
            </label>
            <input
              type="range" min="0.1" max="1.0" step="0.05"
              value={prefs.realism_factor}
              onChange={e => setPrefs(p => ({ ...p, realism_factor: parseFloat(e.target.value) }))}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>10% (very conservative)</span><span>100% (all free time)</span>
            </div>
          </div>

          {/* Notification */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Notifications</label>
            <div className="flex gap-2">
              {['none', 'email', 'push'].map(n => (
                <button
                  key={n}
                  onClick={() => setPrefs(p => ({ ...p, notification_pref: n }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors
                    ${prefs.notification_pref === n
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleSavePrefs} loading={savingPrefs} className="self-start">
            <Save className="w-4 h-4" /> Save Preferences
          </Button>
        </div>
      </section>

      {/* Sleep schedule */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">Sleep Schedule</h2>
        <div className="flex gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1">
            <Moon className="w-5 h-5 text-indigo-400 shrink-0" />
            <Input
              label="Bedtime"
              type="time"
              value={sleep.sleepTime}
              onChange={e => setSleepState(s => ({ ...s, sleepTime: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-3 flex-1">
            <Sun className="w-5 h-5 text-amber-400 shrink-0" />
            <Input
              label="Wake time"
              type="time"
              value={sleep.wakeTime}
              onChange={e => setSleepState(s => ({ ...s, wakeTime: e.target.value }))}
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Sleep duration: {(() => {
            const s = sleep.sleepTime.split(':').map(Number);
            const w = sleep.wakeTime.split(':').map(Number);
            const sm = s[0]*60+s[1], wm = w[0]*60+w[1];
            const diff = wm > sm ? wm - sm : (24*60 - sm) + wm;
            return `${Math.floor(diff/60)}h ${diff%60}m`;
          })()}
        </p>
        <Button onClick={handleSaveSleep} loading={savingSleep} className="mt-4 self-start">
          <Save className="w-4 h-4" /> Save Sleep Schedule
        </Button>
      </section>

      {/* Routine blocks */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">Routine Blocks</h2>

        {/* Existing blocks */}
        {blocks.length === 0 ? (
          <p className="text-sm text-gray-400 mb-4">No routine blocks yet.</p>
        ) : (
          <div className="flex flex-col gap-2 mb-6">
            {blocks.map(block => (
              <div key={block.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-900">{block.title}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {block.day_of_week} · {block.start_time?.slice(0,5)} – {block.end_time?.slice(0,5)}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteBlock(block.id)}
                  className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add block form */}
        <form onSubmit={handleAddBlock} className="border-t border-gray-100 pt-5">
          <p className="text-sm font-medium text-gray-700 mb-3">Add New Block</p>
          <div className="flex flex-col gap-3">
            <Input
              label="Title (e.g. Morning Lecture)"
              value={newBlock.title}
              onChange={e => setNewBlock(b => ({ ...b, title: e.target.value }))}
              required
            />
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Day</label>
                <select
                  value={newBlock.dayOfWeek}
                  onChange={e => setNewBlock(b => ({ ...b, dayOfWeek: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {DAYS.map(d => (
                    <option key={d} value={d} className="capitalize">{d}</option>
                  ))}
                </select>
              </div>
              <Input label="Start" type="time" value={newBlock.startTime}
                onChange={e => setNewBlock(b => ({ ...b, startTime: e.target.value }))} />
              <Input label="End" type="time" value={newBlock.endTime}
                onChange={e => setNewBlock(b => ({ ...b, endTime: e.target.value }))} />
            </div>
            <Button type="submit" loading={addingBlock} className="self-start">
              <Plus className="w-4 h-4" /> Add Block
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default Settings;