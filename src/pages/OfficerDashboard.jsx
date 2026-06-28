import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  ShieldAlert, Clock, CheckCircle2, Users,
  MapPin, AlertCircle, Check, Loader,
  Search, Filter
} from 'lucide-react';
import { formatDate } from '../utils/helpers';
import { addComment, fetchReports, resolveReport, verifyReport } from '../services/api';

const severityStyles = {
  Critical: 'bg-rose-500/10 text-rose-450 border-rose-500/30 animate-pulse',
  High: 'bg-amber-500/10 text-amber-450 border-amber-500/30',
  Medium: 'bg-blue-500/10 text-blue-450 border-blue-500/30',
  Low: 'bg-slate-800 text-slate-400 border-slate-700'
};

function scoreToPoints(priorityScore, severity) {
  // Keep it simple: reward scales with priority.
  // Critical/High give higher base.
  const base = severity === 'Critical' ? 120 : severity === 'High' ? 90 : severity === 'Medium' ? 60 : 30;
  const scaled = Math.round((priorityScore / 100) * base);
  return Math.max(10, scaled);
}

export default function OfficerDashboard() {
  const { user, loading } = useAuth();

  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);

  const [tab, setTab] = useState('pending'); // pending | assigned | resolved
  const [processingId, setProcessingId] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  const [query, setQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All');

  useEffect(() => {
    if (!user) return;
    let alive = true;

    async function load() {
      setReportsLoading(true);
      try {
        const data = await fetchReports();
        if (alive) setReports(data);
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setReportsLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [user]);

  const pendingQueue = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = reports.filter(r => r.status === 'Pending');
    if (severityFilter !== 'All') list = list.filter(r => r.severity === severityFilter);
    if (q) {
      list = list.filter(r => {
        const reporter = r.reporterName || '';
        return (
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.location.toLowerCase().includes(q) ||
          reporter.toLowerCase().includes(q)
        );
      });
    }
    return [...list].sort((a, b) => b.priorityScore - a.priorityScore);
  }, [reports, query, severityFilter]);

  const assignedQueue = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = reports.filter(r => r.status === 'Assigned');
    if (severityFilter !== 'All') list = list.filter(r => r.severity === severityFilter);
    if (q) {
      list = list.filter(r => {
        const reporter = r.reporterName || '';
        return (
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.location.toLowerCase().includes(q) ||
          reporter.toLowerCase().includes(q)
        );
      });
    }
    return [...list].sort((a, b) => b.priorityScore - a.priorityScore);
  }, [reports, query, severityFilter]);

  const resolvedQueue = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = reports.filter(r => r.status === 'Resolved');
    if (severityFilter !== 'All') list = list.filter(r => r.severity === severityFilter);
    if (q) {
      list = list.filter(r => {
        const reporter = r.reporterName || '';
        return (
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.location.toLowerCase().includes(q) ||
          reporter.toLowerCase().includes(q)
        );
      });
    }
    // For resolved, oldest first looks better for history
    return [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [reports, query, severityFilter]);

  const visibleQueue = tab === 'pending' ? pendingQueue : tab === 'assigned' ? assignedQueue : resolvedQueue;

  const totals = useMemo(() => {
    const pending = reports.filter(r => r.status === 'Pending').length;
    const assigned = reports.filter(r => r.status === 'Assigned').length;
    const resolved = reports.filter(r => r.status === 'Resolved').length;
    const totalApproved = resolved;
    return { pending, assigned, resolved, totalApproved };
  }, [reports]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== 'officer') {
    return (
      <div className="glass p-12 text-center rounded-2xl max-w-md mx-auto border border-rose-500/30 bg-rose-950/10 text-rose-450 mt-12 animate-fade-in">
        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
        <h3 className="font-bold text-xl text-white">Officer Access Denied</h3>
        <p className="text-slate-400 text-sm mt-2">
          This portal requires official municipal credentials. Please sign in as a Government Officer.
        </p>
      </div>
    );
  }

  const refresh = async () => {
    const data = await fetchReports();
    setReports(data);
  };

  const handleVerifyReport = async (reportId) => {
    setProcessingId(reportId);
    try {
      const res = await verifyReport(reportId, user.name || 'Officer', user.avatar);
      setSuccessMsg(res.success ? `Report verified successfully.` : res.message);
      setTimeout(() => setSuccessMsg(''), 4000);
      await refresh();
    } catch (e) {
      console.error(e);
      setSuccessMsg('Failed to verify report.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } finally {
      setProcessingId(null);
    }
  };

  const handleResolveReport = async (reportId) => {
    setProcessingId(reportId);
    try {
      const report = reports.find(r => r.id === reportId);
      const points = scoreToPoints(report?.priorityScore || 50, report?.severity || 'Medium');
      const res = await resolveReport(reportId, user.name || 'Officer', points, user.avatar);
      setSuccessMsg(res.success ? `Report resolved! Disbursed +${res.disbursedPoints} points.` : res.message);
      setTimeout(() => setSuccessMsg(''), 4000);
      await refresh();
    } catch (e) {
      console.error(e);
      setSuccessMsg('Failed to resolve report.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } finally {
      setProcessingId(null);
    }
  };

  const TabButton = ({ id, label, count, tone }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
        tab === id
          ? `bg-${tone}/10 border-${tone}/30 text-${tone}-400`
          : 'bg-slate-900/40 border-slate-800 text-slate-300 hover:bg-slate-800/60'
      }`}
    >
      <span className="uppercase tracking-wider">{label}</span>
      <span className="ml-2 px-2 py-0.5 rounded-lg bg-slate-800/60 text-slate-200 border border-slate-700">{count}</span>
    </button>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-fade-in relative">
      {successMsg && (
        <div className="fixed top-20 right-4 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border border-emerald-500/30 text-emerald-400 bg-emerald-950/20 glass animate-slide-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-xs font-semibold">{successMsg}</span>
        </div>
      )}

      <section className="glass rounded-3xl p-6 md:p-8 border border-slate-800/60 shadow-xl relative overflow-hidden">
        <div className="absolute top-1/2 right-10 -translate-y-1/2 w-48 h-48 bg-blue-600/10 rounded-full blur-[80px] pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center gap-5 relative z-10 text-center sm:text-left">
          <div className="p-4 bg-slate-900 border border-slate-800 text-blue-400 rounded-2xl">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold tracking-wider uppercase mb-1">
              Officer Console: {user.department || 'General Administration'}
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Welcome back, Officer {user.name?.split(' ')[0] || '—'}!
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm">
              Verify reports, assign work, and resolve incidents with point disbursement.
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass p-5 rounded-2xl border border-slate-800/60 flex items-center gap-4 hover:border-blue-500/20 transition-all">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Awaiting Review</span>
            <span className="text-xl md:text-2xl font-extrabold text-white block mt-0.5">{totals.pending} claims</span>
          </div>
        </div>

        <div className="glass p-5 rounded-2xl border border-slate-800/60 flex items-center gap-4 hover:border-emerald-500/20 transition-all">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Approved</span>
            <span className="text-xl md:text-2xl font-extrabold text-white block mt-0.5">{totals.totalApproved} items</span>
          </div>
        </div>

        <div className="glass p-5 rounded-2xl border border-slate-800/60 flex items-center gap-4 hover:border-purple-500/20 transition-all">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Assigned Work</span>
            <span className="text-xl md:text-2xl font-extrabold text-white block mt-0.5">{totals.assigned}</span>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Gemini Priority Queue</h2>
            <p className="text-slate-400 text-xs mt-0.5">
              Reports are auto-ranked by Gemini priority score (highest risk first).
            </p>
          </div>
          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest bg-blue-500/5 px-3 py-1 rounded-lg border border-blue-500/10">
            🤖 Gemini Auto-Sorted
          </span>
        </div>

        {/* Tabs + Search/Filter */}
        <div className="glass p-4 rounded-2xl border border-slate-800/60">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setTab('pending')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  tab === 'pending' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-slate-900/40 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <span className="uppercase tracking-wider">Pending</span>
                <span className="ml-2 px-2 py-0.5 rounded-lg bg-slate-800/60 text-slate-200 border border-slate-700">{totals.pending}</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('assigned')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  tab === 'assigned' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-900/40 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <span className="uppercase tracking-wider">Assigned</span>
                <span className="ml-2 px-2 py-0.5 rounded-lg bg-slate-800/60 text-slate-200 border border-slate-700">{totals.assigned}</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('resolved')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  tab === 'resolved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-900/40 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <span className="uppercase tracking-wider">Resolved</span>
                <span className="ml-2 px-2 py-0.5 rounded-lg bg-slate-800/60 text-slate-200 border border-slate-700">{totals.resolved}</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative flex-1 sm:flex-none sm:w-72">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search title, location, reporter..."
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="px-3 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500 cursor-pointer"
                >
                  <option value="All">All Severities</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {reportsLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader className="w-8 h-8 text-brand-500 animate-spin" />
          </div>
        ) : visibleQueue.length === 0 ? (
          <div className="glass p-12 text-center rounded-2xl border border-slate-800/60">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <h3 className="font-bold text-base text-white">No reports found</h3>
            <p className="text-slate-400 text-xs mt-1">Try changing your search/filter or switching tabs.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleQueue.map((report) => {
              const points = scoreToPoints(report.priorityScore, report.severity);
              return (
                <div
                  key={report.id}
                  className="glass p-6 rounded-2xl border border-slate-800/60 hover:border-slate-700/60 transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-blue-400 font-bold tracking-wider uppercase">{report.category}</span>
                        <span
                          className={`px-2 py-0.2 rounded-full text-[8px] font-extrabold tracking-wider uppercase border ${severityStyles[report.severity] || severityStyles.Low}`}
                        >
                          {report.severity}
                        </span>
                        <span className="px-2 py-0.2 rounded-full text-[8px] font-extrabold tracking-wider uppercase border border-slate-700 bg-slate-800/60 text-slate-300">
                          {report.status}
                        </span>
                      </div>
                      <h3 className="font-bold text-base text-white mt-0.5">{report.title}</h3>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      {tab === 'pending' && (
                        <button
                          onClick={() => handleVerifyReport(report.id)}
                          disabled={processingId === report.id}
                          className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl text-xs font-bold transition-all hover:scale-[1.01] cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10"
                        >
                          {processingId === report.id ? (
                            <>
                              <Loader className="w-3.5 h-3.5 animate-spin" />
                              <span>Verifying...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Verify & Assign</span>
                            </>
                          )}
                        </button>
                      )}

                      {tab === 'assigned' && (
                        <button
                          onClick={() => handleResolveReport(report.id)}
                          disabled={processingId === report.id}
                          className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl text-xs font-bold transition-all hover:scale-[1.01] cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10"
                        >
                          {processingId === report.id ? (
                            <>
                              <Loader className="w-3.5 h-3.5 animate-spin" />
                              <span>Resolving...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Resolve & Disburse</span>
                            </>
                          )}
                        </button>
                      )}

                      {tab === 'resolved' && (
                        <div className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20">
                          Resolved
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-slate-350 text-xs leading-relaxed">{report.description}</p>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5 border-t border-slate-800/40 text-[10px] text-slate-400 font-semibold">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        <span>{report.location}</span>
                      </span>
                      <span>•</span>
                      <span>Reported by: <span className="text-slate-200">{report.reporterName}</span></span>
                      <span>•</span>
                      <span>{formatDate(report.date)}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-slate-400 font-semibold">Priority: <span className="text-blue-400 font-bold">{report.priorityScore}/100</span></span>
                      <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold">
                        +{points} XP Reward
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

