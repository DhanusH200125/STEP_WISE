// src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle, Clock, TrendingUp, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSprint, generateSprint } from '../services/sprint.service';
import { getCapacity } from '../services/routine.service';
import { getGrowthReport } from '../services/analytics.service';
import { getMonday, formatDate, formatTime, getDayLabel } from '../utils/date';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';

const StatCard = ({ icon: Icon, label, value, sub, color = 'indigo' }) => {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
};

const domainColors = {
  work_study: 'bg-blue-100 text-blue-700',
  personal_growth: 'bg-purple-100 text-purple-700',
  health: 'bg-green-100 text-green-700',
  life_admin: 'bg-amber-100 text-amber-700',
};

const Dashboard = () => {
  const { user } = useAuth();
  const [sprint, setSprint] = useState(null);
  const [capacity, setCapacity] = useState(null);
  const [growth, setGrowth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const thisWeek = getMonday();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sprintRes, capacityRes, growthRes] = await Promise.allSettled([
          getSprint(thisWeek),
          getCapacity(),
          getGrowthReport(),
        ]);
        if (sprintRes.status === 'fulfilled') setSprint(sprintRes.value.data.sprint);
        if (capacityRes.status === 'fulfilled') setCapacity(capacityRes.value.data.capacity);
        if (growthRes.status === 'fulfilled') setGrowth(growthRes.value.data.report);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data } = await generateSprint(thisWeek);
      setSprint(data.sprint);
      toast.success(`Sprint generated! ${data.summary.tasksScheduled} tasks scheduled`);
    } catch (err) {
      toast.error('Failed to generate sprint');
    } finally {
      setGenerating(false);
    }
  };

  // Today's slots
  const today = new Date().toISOString().split('T')[0];
  const todaySlots = sprint?.slots?.filter(s => {
    const slotDate = new Date(s.scheduled_date).toISOString().split('T')[0];
    return slotDate === today;
  }) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
          {user?.full_name?.split(' ')[0] || user?.fullName?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-500 mt-1">Here's your week at a glance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Clock}
          label="Productive capacity"
          value={`${capacity?.productiveCapacityHours || 0}h`}
          sub="This week"
          color="indigo"
        />
        <StatCard
          icon={Calendar}
          label="Tasks scheduled"
          value={sprint?.slots ? [...new Set(sprint.slots.map(s => s.task_id))].length : '—'}
          sub={sprint ? 'This sprint' : 'No sprint yet'}
          color="amber"
        />
        <StatCard
          icon={CheckCircle}
          label="Growth target"
          value={`${growth?.target?.weeklyHours || 0}h`}
          sub={`${growth?.consistency?.score || 0}% consistency`}
          color="green"
        />
        <StatCard
          icon={TrendingUp}
          label="Growth status"
          value={growth?.consistency?.status?.replace('_', ' ') || '—'}
          sub="Last 4 weeks"
          color="purple"
        />
      </div>

      {/* Sprint section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">This Week's Sprint</h2>
            <p className="text-sm text-gray-500">
              Week of {formatDate(thisWeek)}
            </p>
          </div>
          <div className="flex gap-2">
            {sprint && (
              <Link to="/sprint">
                <Button variant="secondary" size="sm">
                  View full sprint <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            )}
            <Button size="sm" onClick={handleGenerate} loading={generating}>
              {sprint ? 'Regenerate' : 'Generate Sprint'}
            </Button>
          </div>
        </div>

        {!sprint ? (
          <div className="text-center py-10 text-gray-400">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No sprint for this week yet.</p>
            <p className="text-sm">Click "Generate Sprint" to get started.</p>
          </div>
        ) : (
          <div>
            {/* Today's schedule */}
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Today — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </h3>
            {todaySlots.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                Nothing scheduled for today 🎉
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {todaySlots.map(slot => (
                  <div
                    key={slot.slot_id || slot.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100"
                  >
                    <div className="text-xs text-gray-500 w-24 shrink-0 font-mono">
                      {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {slot.title}
                      </p>
                      {slot.recommendation_reason && (
                        <p className="text-xs text-gray-400 truncate">
                          {slot.recommendation_reason}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                      ${domainColors[slot.domain] || 'bg-gray-100 text-gray-600'}`}>
                      {slot.domain?.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Growth suggestions */}
      {growth?.suggestions?.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-indigo-800 mb-3">💡 Suggestions</h2>
          <ul className="flex flex-col gap-2">
            {growth.suggestions.map((s, i) => (
              <li key={i} className="text-sm text-indigo-700 flex gap-2">
                <span className="mt-0.5">•</span>
                <span>{s.message || s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Dashboard;