// src/pages/Sprint.jsx
import { useState, useEffect } from 'react';
import { Calendar, Lock, Unlock, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { getSprint, generateSprint, acceptSprint, toggleSlotLock } from '../services/sprint.service';
import { getMonday, formatDate, formatTime, getDayLabel } from '../utils/date';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';

const statusColors = {
  scheduled:   'bg-blue-50 border-blue-200 text-blue-800',
  completed:   'bg-green-50 border-green-200 text-green-800',
  missed:      'bg-red-50 border-red-200 text-red-800',
  rescheduled: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  skipped:     'bg-gray-50 border-gray-200 text-gray-500',
};

const domainColors = {
  work_study:      'bg-blue-100 text-blue-700',
  personal_growth: 'bg-purple-100 text-purple-700',
  health:          'bg-green-100 text-green-700',
  life_admin:      'bg-amber-100 text-amber-700',
};

const Sprint = () => {
  const [sprint, setSprint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [weekStart, setWeekStart] = useState(getMonday());

  const fetchSprint = async () => {
    setLoading(true);
    try {
      const { data } = await getSprint(weekStart);
      setSprint(data.sprint);
    } catch (err) {
      if (err.response?.status === 404) setSprint(null);
      else toast.error('Failed to load sprint');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchSprint(); }, [weekStart]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data } = await generateSprint(weekStart);
      toast.success(`Sprint generated! ${data.summary.tasksScheduled} tasks, ${data.summary.plannedHours}h planned`);
      fetchSprint();
    } catch { toast.error('Failed to generate sprint'); }
    finally { setGenerating(false); }
  };

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await acceptSprint(sprint.id);
      toast.success('Sprint activated!');
      fetchSprint();
    } catch { toast.error('Failed to accept sprint'); }
    finally { setAccepting(false); }
  };

  const handleToggleLock = async (slotId, currentLocked) => {
    try {
      await toggleSlotLock(sprint.id, slotId, !currentLocked);
      toast.success(currentLocked ? 'Slot unlocked' : 'Slot locked');
      fetchSprint();
    } catch { toast.error('Failed to update slot'); }
  };

  // Group slots by date
  const slotsByDay = {};
  if (sprint?.slots) {
    for (const slot of sprint.slots) {
      const date = new Date(slot.scheduled_date).toISOString().split('T')[0];
      if (!slotsByDay[date]) slotsByDay[date] = [];
      slotsByDay[date].push(slot);
    }
  }
  const sortedDays = Object.keys(slotsByDay).sort();

  // Week navigation
  const goToPrevWeek = () => {
    const d = new Date(weekStart + 'T12:00:00Z');
    d.setDate(d.getDate() - 7);
    setWeekStart(d.toISOString().split('T')[0]);
  };
  const goToNextWeek = () => {
    const d = new Date(weekStart + 'T12:00:00Z');
    d.setDate(d.getDate() + 7);
    setWeekStart(d.toISOString().split('T')[0]);
  };
  const goToThisWeek = () => setWeekStart(getMonday());

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Weekly Sprint</h1>
          <div className="flex items-center gap-3 mt-2">
            <button onClick={goToPrevWeek}
              className="p-1 hover:bg-gray-100 rounded text-gray-500">‹</button>
            <span className="text-gray-600 text-sm font-medium">
              Week of {formatDate(weekStart)}
            </span>
            <button onClick={goToNextWeek}
              className="p-1 hover:bg-gray-100 rounded text-gray-500">›</button>
            <button onClick={goToThisWeek}
              className="text-xs text-indigo-600 hover:underline">This week</button>
          </div>
        </div>
        <div className="flex gap-2">
          {sprint?.status === 'draft' && (
            <Button variant="secondary" onClick={handleAccept} loading={accepting}>
              <CheckCircle className="w-4 h-4" /> Accept Sprint
            </Button>
          )}
          <Button onClick={handleGenerate} loading={generating}>
            <RefreshCw className="w-4 h-4" />
            {sprint ? 'Regenerate' : 'Generate Sprint'}
          </Button>
        </div>
      </div>

      {/* Sprint status bar */}
      {sprint && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium
              ${sprint.status === 'active' ? 'bg-green-100 text-green-700'
              : sprint.status === 'draft' ? 'bg-yellow-100 text-yellow-700'
              : 'bg-gray-100 text-gray-600'}`}>
              {sprint.status}
            </span>
          </div>
          <div className="text-sm text-gray-500">
            <span className="font-medium text-gray-900">{sprint.planned_minutes} min</span> planned
          </div>
          <div className="text-sm text-gray-500">
            <span className="font-medium text-gray-900">{sprint.computed_capacity_minutes} min</span> capacity
          </div>
          <div className="text-sm text-gray-500">
            <span className="font-medium text-gray-900">
              {Math.round((sprint.planned_minutes / sprint.computed_capacity_minutes) * 100)}%
            </span> capacity used
          </div>
          {sprint.status === 'draft' && (
            <span className="text-xs text-yellow-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Review and accept to activate
            </span>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : !sprint ? (
        <div className="text-center py-20 text-gray-400">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">No sprint for this week</p>
          <p className="text-sm mt-1">Click "Generate Sprint" to plan your week</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {sortedDays.length === 0 ? (
            <p className="text-center text-gray-400 py-10">No slots scheduled</p>
          ) : (
            sortedDays.map(date => (
              <div key={date}>
                {/* Day header */}
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-sm font-semibold text-gray-700">
                    {getDayLabel(date)}
                  </h2>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">
                    {slotsByDay[date].length} slot{slotsByDay[date].length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Slots */}
                <div className="flex flex-col gap-2">
                  {slotsByDay[date]
                    .sort((a, b) => a.start_time?.localeCompare(b.start_time))
                    .map(slot => (
                      <div key={slot.slot_id || slot.id}
                        className={`flex items-start gap-4 p-4 rounded-xl border
                          ${statusColors[slot.status] || statusColors.scheduled}`}>
                        {/* Time */}
                        <div className="text-xs font-mono text-gray-500 w-24 shrink-0 pt-0.5">
                          {formatTime(slot.start_time)}<br />
                          <span className="text-gray-400">→ {formatTime(slot.end_time)}</span>
                        </div>

                        {/* Task info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm">{slot.title}</p>
                          {slot.recommendation_reason && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                              💡 {slot.recommendation_reason}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                              ${domainColors[slot.domain] || 'bg-gray-100 text-gray-600'}`}>
                              {slot.domain?.replace('_', ' ')}
                            </span>
                            <span className="text-xs text-gray-400">
                              {slot.estimated_minutes} min
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full capitalize
                            ${slot.status === 'completed' ? 'text-green-700'
                            : slot.status === 'missed' ? 'text-red-600'
                            : 'text-gray-500'}`}>
                            {slot.status}
                          </span>
                          <button
                            onClick={() => handleToggleLock(slot.slot_id || slot.id, slot.is_locked)}
                            className="p-1.5 hover:bg-white/50 rounded-lg transition-colors"
                            title={slot.is_locked ? 'Unlock slot' : 'Lock slot'}>
                            {slot.is_locked
                              ? <Lock className="w-4 h-4 text-indigo-600" />
                              : <Unlock className="w-4 h-4 text-gray-400" />}
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Sprint;