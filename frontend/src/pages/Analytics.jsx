// src/pages/Analytics.jsx
import { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, Clock, Target } from 'lucide-react';
import { getWeeklyReport, getSummary, getGrowthReport } from '../services/analytics.service';
import { getMonday, formatDate } from '../utils/date';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';

const domainColors = {
  work_study:      'bg-blue-500',
  personal_growth: 'bg-purple-500',
  health:          'bg-green-500',
  life_admin:      'bg-amber-500',
};

const domainTextColors = {
  work_study:      'text-blue-700',
  personal_growth: 'text-purple-700',
  health:          'text-green-700',
  life_admin:      'text-amber-700',
};

const StatBox = ({ label, value, sub, color = 'text-gray-900' }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-5">
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
    <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
  </div>
);

const Analytics = () => {
  const [weekStart, setWeekStart] = useState(getMonday());
  const [report, setReport] = useState(null);
  const [summary, setSummary] = useState(null);
  const [growth, setGrowth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const [sumRes, growthRes] = await Promise.allSettled([
          getSummary(), getGrowthReport(),
        ]);
        if (sumRes.status === 'fulfilled') setSummary(sumRes.value.data.summary);
        if (growthRes.status === 'fulfilled') setGrowth(growthRes.value.data.report);
      } finally { setLoading(false); }
    };
    fetchSummary();
  }, []);

  const fetchReport = async () => {
    setReportLoading(true);
    try {
      const { data } = await getWeeklyReport(weekStart);
      setReport(data.report);
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error('No sprint found for this week. Generate a sprint first.');
        setReport(null);
      } else toast.error('Failed to load report');
    } finally { setReportLoading(false); }
  };

  const goToPrevWeek = () => {
    const d = new Date(weekStart + 'T12:00:00Z');
    d.setDate(d.getDate() - 7);
    setWeekStart(d.toISOString().split('T')[0]);
    setReport(null);
  };
  const goToNextWeek = () => {
    const d = new Date(weekStart + 'T12:00:00Z');
    d.setDate(d.getDate() + 7);
    setWeekStart(d.toISOString().split('T')[0]);
    setReport(null);
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent" />
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 mt-1">Your productivity insights</p>
      </div>

      {/* All-time summary */}
      {summary && (
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">All-Time Summary</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatBox
              label="Tasks completed"
              value={summary.tasks.completed}
              sub={`${summary.tasks.completionRate}% completion rate`}
              color="text-green-600"
            />
            <StatBox
              label="Minutes tracked"
              value={`${Math.round(summary.tasks.totalMinutesTracked / 60)}h`}
              sub={`Across ${summary.tasks.completed} tasks`}
            />
            <StatBox
              label="Avg time variance"
              value={`${summary.tasks.avgVarianceMinutes > 0 ? '+' : ''}${summary.tasks.avgVarianceMinutes} min`}
              sub="vs estimated"
              color={summary.tasks.avgVarianceMinutes > 10 ? 'text-red-500' : 'text-green-600'}
            />
            <StatBox
              label="Current streak"
              value={`${summary.productivity.currentStreakWeeks}w`}
              sub="Weeks at 50%+ completion"
              color="text-indigo-600"
            />
          </div>

          {/* Domain breakdown */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Completion by Domain</h3>
            <div className="flex flex-col gap-3">
              {summary.byDomain.map(d => (
                <div key={d.domain}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${domainTextColors[d.domain] || 'text-gray-700'}`}>
                      {d.domain.replace('_', ' ')}
                    </span>
                    <span className="text-sm text-gray-500">
                      {d.completed}/{d.total} · {d.completionRate}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${domainColors[d.domain] || 'bg-gray-400'}`}
                      style={{ width: `${d.completionRate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Growth tracking */}
      {growth && (
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Growth Tracking</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Consistency */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">Consistency Score</h3>
                <span className={`text-xs px-2 py-1 rounded-full font-medium
                  ${growth.consistency.status === 'on_track' ? 'bg-green-100 text-green-700'
                  : growth.consistency.status === 'needs_attention' ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'}`}>
                  {growth.consistency.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-4xl font-bold text-gray-900 mb-1">
                {growth.consistency.score}%
              </p>
              <p className="text-sm text-gray-500">
                {growth.consistency.weeksMetTarget}/{growth.consistency.weeksChecked} weeks met target
              </p>

              {/* Week breakdown */}
              <div className="flex gap-2 mt-4">
                {growth.consistency.weekBreakdown.map((w, i) => (
                  <div key={i} className="flex-1 text-center">
                    <div className={`h-8 rounded ${w.metTarget ? 'bg-green-400' : 'bg-gray-200'}`} />
                    <p className="text-xs text-gray-400 mt-1">W{i + 1}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* This week's growth */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">This Week</h3>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Target</span>
                  <span className="font-medium">{growth.target.weeklyMinutes} min</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Planned</span>
                  <span className="font-medium">{growth.currentWeek.plannedMinutes} min</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Completed</span>
                  <span className="font-medium text-green-600">
                    {growth.currentWeek.completedMinutes} min
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
                  <div
                    className="h-2 rounded-full bg-purple-500"
                    style={{ width: `${Math.min(100, growth.currentWeek.completionRate)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400">
                  {growth.currentWeek.remainingMinutes} min remaining to hit target
                </p>
              </div>

              {/* Pending growth tasks */}
              {growth.pendingGrowthTasks?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-600 mb-2">Pending growth tasks</p>
                  {growth.pendingGrowthTasks.map(t => (
                    <div key={t.id} className="flex justify-between text-sm py-1">
                      <span className="text-gray-700">{t.title}</span>
                      <span className="text-gray-400">{t.estimated_minutes} min</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Suggestions */}
          {growth.suggestions?.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 mt-4">
              <h3 className="text-sm font-semibold text-indigo-800 mb-3">💡 Recommendations</h3>
              <div className="flex flex-col gap-2">
                {growth.suggestions.map((s, i) => (
                  <div key={i} className="flex gap-2 text-sm text-indigo-700">
                    <span className="mt-0.5">•</span>
                    <span>{s.message || s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Weekly report */}
      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-gray-800">Weekly Report</h2>
          <div className="flex items-center gap-3">
            <button onClick={goToPrevWeek}
              className="p-1 hover:bg-gray-100 rounded text-gray-500">‹</button>
            <span className="text-sm text-gray-600">Week of {formatDate(weekStart)}</span>
            <button onClick={goToNextWeek}
              className="p-1 hover:bg-gray-100 rounded text-gray-500">›</button>
            <Button size="sm" onClick={fetchReport} loading={reportLoading}>
              Load Report
            </Button>
          </div>
        </div>

        {!report ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">
            <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Click "Load Report" to see this week's breakdown</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Slot stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatBox label="Total slots" value={report.slots.total} />
              <StatBox label="Completed" value={report.slots.completed}
                color="text-green-600" />
              <StatBox label="Missed" value={report.slots.missed}
                color={report.slots.missed > 0 ? 'text-red-500' : 'text-gray-900'} />
              <StatBox label="Completion rate" value={`${report.slots.completionRate}%`}
                color={report.slots.completionRate >= 70 ? 'text-green-600' : 'text-amber-500'} />
            </div>

            {/* Minutes by domain */}
            {Object.keys(report.minutesByDomain).length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Time by Domain</h3>
                <div className="flex flex-col gap-3">
                  {Object.entries(report.minutesByDomain).map(([domain, data]) => (
                    <div key={domain}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className={`font-medium ${domainTextColors[domain] || 'text-gray-700'}`}>
                          {domain.replace('_', ' ')}
                        </span>
                        <span className="text-gray-500">
                          {data.completedMinutes}/{data.plannedMinutes} min
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${domainColors[domain] || 'bg-gray-400'}`}
                          style={{
                            width: `${data.plannedMinutes > 0
                              ? (data.completedMinutes / data.plannedMinutes) * 100
                              : 0}%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {report.suggestions?.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-amber-800 mb-3">📊 This Week's Insights</h3>
                {report.suggestions.map((s, i) => (
                  <div key={i} className="flex gap-2 text-sm text-amber-700">
                    <span>•</span><span>{s}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default Analytics;