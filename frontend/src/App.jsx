import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Calendar, User, Shield, Stethoscope, LogIn, UserPlus, Eye, EyeOff, Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// 1. Loading Spinner Component
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>
      <Loader2 className="h-12 w-12 text-brand-500 animate-spin mb-4" />
      <p className="text-slate-400 text-sm font-medium tracking-wide">Loading CareSync session...</p>
    </div>
  );
}

// 2. Protected Route Shield Component
function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading, getRedirectPath } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to their default dashboard if role is incorrect
    return <Navigate to={getRedirectPath(user.role)} replace />;
  }

  return children;
}

// 3. Login Redirect Shield Component
// Prevents authenticated users from seeing Login/Register pages
function LoginRedirect({ children }) {
  const { user, loading, getRedirectPath } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (user) {
    return <Navigate to={getRedirectPath(user.role)} replace />;
  }

  return children;
}

// Common Dashboard Header/Footer Layout
function DashboardLayout({ title, icon: Icon, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-brand-600/10 p-2 rounded-lg border border-brand-500/25">
              <Icon className="h-6 w-6 text-brand-500" />
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              CareSync
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-semibold text-white">{user?.name}</span>
              <span className="text-xs text-slate-400">{user?.role}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 px-4 py-2 rounded-lg transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">{title}</h1>
          <p className="text-slate-400 mt-1">Logged in as {user?.email}</p>
        </div>
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-600 bg-slate-950">
        &copy; {new Date().getFullYear()} CareSync. Built for Healthcare Appointment Guide Graded Assignment.
      </footer>
    </div>
  );
}

// 4. Login Page Component
function LoginPage() {
  const { login, getRedirectPath } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const loggedUser = await login(email, password);
      navigate(getRedirectPath(loggedUser.role));
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-brand-500/10 p-3 rounded-2xl border border-brand-500/20">
            <Stethoscope className="h-10 w-10 text-brand-500" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white">Sign in to CareSync</h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Or{' '}
          <Link to="/register" className="font-semibold text-brand-500 hover:text-brand-400 transition">
            create a new account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="glass-panel py-8 px-4 shadow sm:rounded-2xl sm:px-10">
          {error && (
            <div className="mb-4 bg-red-950/40 border border-red-800/80 text-red-200 px-4 py-2.5 rounded-lg text-xs font-medium">
              {error}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2.5 border border-slate-800 bg-slate-900 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm transition"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-3 py-2.5 border border-slate-800 bg-slate-900 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm transition pr-10"
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition disabled:opacity-50 glow-btn"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Local Testing Helper Credentials â€” only visible in dev builds, stripped in production */}
          {import.meta.env.DEV && (
            <div className="mt-8 border-t border-slate-800 pt-6">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-3">
                Testing Admin Credentials
              </span>
              <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg text-xs space-y-1 text-slate-300 font-mono">
                <div>Email: admin@caresync.com</div>
                <div>Password: AdminPassword123!</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 5. Register Page Component
function RegisterPage() {
  const { register, getRedirectPath } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const role = 'PATIENT';
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const loggedUser = await register(name, email, password, role, phone || null);
      navigate(getRedirectPath(loggedUser.role));
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-brand-500/10 p-3 rounded-2xl border border-brand-500/20">
            <UserPlus className="h-10 w-10 text-brand-500" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white">Create your account</h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-500 hover:text-brand-400 transition">
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="glass-panel py-8 px-4 shadow sm:rounded-2xl sm:px-10">
          {error && (
            <div className="mb-4 bg-red-950/40 border border-red-800/80 text-red-200 px-4 py-2.5 rounded-lg text-xs font-medium">
              {error}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-300">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-slate-800 bg-slate-900 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm transition"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-slate-800 bg-slate-900 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm transition"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-300">
                Phone (Optional)
              </label>
              <input
                id="phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-slate-800 bg-slate-900 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm transition"
                placeholder="+15550100"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-slate-800 bg-slate-900 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm transition"
                placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition disabled:opacity-50 glow-btn"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Register'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// 6. Patient Dashboard Page Component
function PatientDashboard() {
  const { fetchWithAuth } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [searchVal, setSearchVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Active Hold Flow
  const [heldSlot, setHeldSlot] = useState(null); // Slot metadata of active hold
  const [heldUntilTime, setHeldUntilTime] = useState(null); // Hold expiry Date object
  const [timeLeft, setTimeLeft] = useState(0); // seconds remaining on hold countdown
  const [symptomsText, setSymptomsText] = useState('');
  const [confirming, setConfirming] = useState(false);

  // Appointments List State
  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [expandedApptId, setExpandedApptId] = useState(null);

  // Google Calendar integration
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarConnecting, setCalendarConnecting] = useState(false);

  // Reschedule state
  const [reschedulingApptId, setReschedulingApptId] = useState(null);
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');

  const isAppointmentInFuture = (appt) => {
    const now = new Date();
    const [year, month, day] = appt.date.split('-').map(Number);
    const [hour, min] = appt.startTime.split(':').map(Number);
    const apptDate = new Date(year, month - 1, day, hour, min);
    return apptDate > now;
  };

  // Upcoming: CONFIRMED + still in the future (soonest first)
  const upcomingAppts = appointments
    .filter(a => a.status === 'CONFIRMED' && isAppointmentInFuture(a))
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

  // Past: COMPLETED, CANCELLED, or CONFIRMED that have already passed (most recent first)
  const pastAppts = appointments
    .filter(a => a.status === 'COMPLETED' || a.status === 'CANCELLED' || (a.status === 'CONFIRMED' && !isAppointmentInFuture(a)))
    .sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime));

  const loadAppointments = async () => {
    setAppointmentsLoading(true);
    try {
      const res = await fetchWithAuth('/api/patient/appointments');
      const data = await res.json();
      if (res.ok) {
        setAppointments(data.appointments || []);
      }
    } catch (err) {
      console.error('Error fetching patient appointments:', err);
    } finally {
      setAppointmentsLoading(false);
    }
  };

  // Search doctors on mount & user query
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetchWithAuth(`/api/patient/doctors?specialisation=${encodeURIComponent(searchVal)}`);
      const data = await res.json();
      if (res.ok) {
        setDoctors(data.doctors || []);
      } else {
        setError(data.error || 'Failed to search doctors');
      }
    } catch (err) {
      setError('Network error querying doctors.');
    } finally {
      setLoading(false);
    }
  };

  const checkCalendarStatus = async () => {
    try {
      const res = await fetchWithAuth('/api/auth/google/status');
      const data = await res.json();
      if (res.ok) setCalendarConnected(data.connected);
    } catch (_) {}
  };

  useEffect(() => {
    handleSearch();
    loadAppointments();
    checkCalendarStatus();
    // Check if we just returned from Google OAuth
    const params = new URLSearchParams(window.location.search);
    if (params.get('calendarConnected') === 'true') {
      setCalendarConnected(true);
      setSuccess('Google Calendar connected successfully!');
      window.history.replaceState({}, '', '/patient');
    }
    if (params.get('calendarError')) {
      setError('Google Calendar connection failed. Please try again.');
      window.history.replaceState({}, '', '/patient');
    }
  }, []);

  const { token } = useAuth();

  const handleCalendarConnect = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/auth/google/connect?token=${token}`;
  };

  const handleCalendarDisconnect = async () => {
    try {
      await fetchWithAuth('/api/auth/google/disconnect', { method: 'POST' });
      setCalendarConnected(false);
      setSuccess('Google Calendar disconnected.');
    } catch (_) {
      setError('Failed to disconnect calendar.');
    }
  };

  const handleReschedule = async (appt) => {
    setReschedulingApptId(appt.id);
    setRescheduleError('');
    setRescheduleSlots([]);
    setRescheduleSlotsLoading(true);
    try {
      const res = await fetchWithAuth(`/api/patient/doctors?specialisation=`);
      const data = await res.json();
      if (res.ok) {
        // Find the same doctor's open slots
        const doctor = (data.doctors || []).find(d => d.id === appt.doctorId);
        const openSlots = (doctor?.slots || []).filter(s => s.status === 'OPEN');
        setRescheduleSlots(openSlots);
      }
    } catch (_) {
      setRescheduleError('Failed to load available slots.');
    } finally {
      setRescheduleSlotsLoading(false);
    }
  };

  const handleConfirmReschedule = async (apptId, newSlotId) => {
    setError('');
    setSuccess('');
    try {
      const res = await fetchWithAuth(`/api/patient/appointments/${apptId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newSlotId })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Appointment rescheduled successfully!');
        setReschedulingApptId(null);
        setRescheduleSlots([]);
        loadAppointments();
      } else {
        setRescheduleError(data.error || 'Failed to reschedule.');
      }
    } catch (_) {
      setRescheduleError('Network error rescheduling.');
    }
  };


  // Hold slot endpoint trigger
  const handleSelectSlot = async (slot, doctor) => {
    setError('');
    setSuccess('');
    try {
      const res = await fetchWithAuth(`/api/patient/slots/${slot.id}/hold`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        setHeldSlot({
          ...slot,
          doctorName: doctor.name,
          specialisation: doctor.specialisation
        });
        setHeldUntilTime(new Date(data.slot.heldUntil));
        setSymptomsText('');
      } else {
        setError(data.error || 'Failed to secure a temporary hold on this slot.');
      }
    } catch (err) {
      setError('Network error holding slot.');
    }
  };

  // Live countdown timer hook
  useEffect(() => {
    if (!heldUntilTime) return;

    // Reset countdown initial tick
    const initialDiff = Math.max(0, Math.floor((heldUntilTime.getTime() - Date.now()) / 1000));
    setTimeLeft(initialDiff);

    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((heldUntilTime.getTime() - Date.now()) / 1000));
      setTimeLeft(diff);
      if (diff === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [heldUntilTime]);

  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    if (!heldSlot) return;
    setConfirming(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetchWithAuth(`/api/patient/slots/${heldSlot.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ symptomsText })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Booking confirmed successfully with Dr. ${heldSlot.doctorName}!`);
        setHeldSlot(null);
        setHeldUntilTime(null);
        handleSearch(); // Refresh list to remove booked slot
        loadAppointments(); // Reload patient's active appointments list
      } else {
        // Displays clear 409 conflict errors
        setError(data.error || 'This slot is no longer available. Please select another slot.');
        setHeldSlot(null);
        setHeldUntilTime(null);
      }
    } catch (err) {
      setError('Network error confirming appointment.');
    } finally {
      setConfirming(false);
    }
  };

  const formatTimeLeft = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <DashboardLayout title="Patient Portal" icon={User}>
      {/* Alerts */}
      {error && (
        <div className="mb-6 bg-red-950/40 border border-red-800/80 text-red-200 px-4 py-3 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 bg-emerald-950/40 border border-emerald-800/80 text-emerald-200 px-4 py-3 rounded-xl text-sm font-medium">
          {success}
        </div>
      )}

      {/* Hold Dialog / Symptom Wizard Panel */}
      {heldSlot && (
        <div className="mb-6 bg-slate-900 border border-brand-500/20 p-6 rounded-2xl relative shadow-2xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4 mb-4">
            <div>
              <span className="text-xs uppercase tracking-wider font-bold text-brand-500">Hold Active â€” Complete Form</span>
              <h4 className="text-lg font-bold text-white mt-0.5">Slot with {heldSlot.doctorName} ({heldSlot.specialisation})</h4>
              <p className="text-xs text-slate-400 mt-1 font-mono">{heldSlot.date} @ {heldSlot.startTime} - {heldSlot.endTime}</p>
            </div>
            
            <div className={`px-4 py-2 rounded-xl text-center border font-mono ${
              timeLeft > 30 ? 'bg-brand-950/30 text-brand-400 border-brand-500/30' : 'bg-red-950/30 text-red-400 border-red-500/30 animate-pulse'
            }`}>
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Time Remaining</div>
              <div className="text-xl font-bold">{formatTimeLeft(timeLeft)}</div>
            </div>
          </div>

          {timeLeft === 0 ? (
            <div className="text-center py-6 text-slate-400 space-y-3">
              <p className="text-sm">Your temporary hold on this slot has expired. The slot has been released back to other patients.</p>
              <button
                onClick={() => { setHeldSlot(null); setHeldUntilTime(null); }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-semibold"
              >
                Close & Select Another Slot
              </button>
            </div>
          ) : (
            <form onSubmit={handleConfirmBooking} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Briefly Describe Your Symptoms</label>
                <textarea
                  required
                  rows={3}
                  value={symptomsText}
                  onChange={(e) => setSymptomsText(e.target.value)}
                  placeholder="Describe your current symptoms, how long you've had them, or any pre-visit questions..."
                  className="block w-full px-3 py-2 border border-slate-800 bg-slate-950 rounded-lg text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setHeldSlot(null); setHeldUntilTime(null); }}
                  className="px-4 py-2 border border-slate-800 text-slate-400 hover:bg-slate-800/20 text-xs font-semibold rounded-lg"
                >
                  Release Hold
                </button>
                <button
                  type="submit"
                  disabled={confirming}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg transition"
                >
                  {confirming ? 'Confirming...' : 'Confirm Appointment'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* â”€â”€ Upcoming Appointments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="text-xl font-bold mb-4">Upcoming Appointments</h3>
            {appointmentsLoading ? (
              <div className="flex items-center justify-center py-6 text-slate-500 text-xs">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading appointments...
              </div>
            ) : upcomingAppts.length === 0 ? (
              <div className="border border-slate-800/85 rounded-xl p-4 text-slate-500 text-center text-sm py-8 bg-slate-950/20">
                No upcoming appointments scheduled.
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingAppts.map(appt => {
                  const isExpanded = expandedApptId === appt.id;
                  return (
                    <div
                      key={appt.id}
                      onClick={() => setExpandedApptId(isExpanded ? null : appt.id)}
                      className={`border border-slate-800 bg-slate-950 p-4 rounded-xl cursor-pointer hover:border-slate-700 transition ${isExpanded ? 'ring-1 ring-brand-500/50' : ''}`}
                    >
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                        <div>
                          <h4 className="font-bold text-white text-sm">{appt.doctorName}</h4>
                          <p className="text-xs text-brand-500 font-semibold">{appt.specialisation}</p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-xs text-slate-300 font-mono">{appt.date} @ {appt.startTime} - {appt.endTime}</p>
                          <span className="inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mt-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {appt.status}
                          </span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-900 text-xs text-slate-300 space-y-3">
                          <div>
                            <strong className="text-slate-500 block mb-1">Your Symptoms:</strong>
                            <p className="bg-slate-900 p-2.5 rounded-lg border border-slate-900 italic text-[11px] leading-relaxed">
                              {appt.symptomsText || 'No symptoms described.'}
                            </p>
                          </div>

                          {appt.preVisitSummaryJson && (
                            <div>
                              {appt.preVisitSummaryJson.aiError ? (
                                <div className="bg-red-950/20 border border-red-900/50 p-2.5 rounded-lg text-[11px] text-red-300 leading-relaxed">
                                  <strong>AI symptom summary unavailable</strong>: please review symptoms manually.
                                </div>
                              ) : (
                                <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-900 space-y-2">
                                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                                    <span className="font-bold tracking-wider">AI SYMPTOM BRIEFING</span>
                                    <span className={`px-2 py-0.5 rounded font-bold uppercase ${appt.urgencyLevel === 'High' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : appt.urgencyLevel === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                      Urgency: {appt.urgencyLevel || 'Low'}
                                    </span>
                                  </div>
                                  <div>
                                    <strong className="text-slate-500 text-[10px] uppercase">Chief Complaint:</strong>
                                    <p className="text-slate-300 text-xs mt-0.5">{appt.preVisitSummaryJson.chief_complaint}</p>
                                  </div>
                                  {appt.preVisitSummaryJson.questions?.length > 0 && (
                                    <div>
                                      <strong className="text-slate-500 text-[10px] uppercase">Suggested Questions:</strong>
                                      <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-xs text-slate-300">
                                        {appt.preVisitSummaryJson.questions.map((q, idx) => <li key={idx}>{q}</li>)}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Reschedule / Cancel buttons */}
                          <div className="flex flex-wrap gap-2 justify-end pt-3 border-t border-slate-900">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReschedule(appt); }}
                              className="px-3 py-1.5 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 text-brand-300 text-[10px] font-bold uppercase rounded-lg transition"
                            >
                              Reschedule
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                setError(''); setSuccess('');
                                if (window.confirm(`Are you sure you want to cancel this appointment with Dr. ${appt.doctorName}?`)) {
                                  try {
                                    const res = await fetchWithAuth(`/api/patient/appointments/${appt.id}/cancel`, { method: 'POST' });
                                    if (res.ok) { setSuccess('Appointment cancelled successfully.'); loadAppointments(); }
                                    else { const data = await res.json(); setError(data.error || 'Failed to cancel appointment'); }
                                  } catch { setError('Network error cancelling appointment.'); }
                                }
                              }}
                              className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900 border border-red-800 text-red-200 text-[10px] font-bold uppercase rounded-lg transition"
                            >
                              Cancel
                            </button>
                          </div>

                          {/* Reschedule slot picker */}
                          {reschedulingApptId === appt.id && (
                            <div className="mt-3 pt-3 border-t border-slate-900" onClick={e => e.stopPropagation()}>
                              <p className="text-xs text-slate-400 mb-2 font-medium">Select a new slot:</p>
                              {rescheduleError && <p className="text-xs text-red-400 mb-2">{rescheduleError}</p>}
                              {rescheduleSlotsLoading ? (
                                <div className="flex items-center gap-2 text-slate-500 text-xs"><Loader2 className="h-3 w-3 animate-spin" /> Loading slots...</div>
                              ) : rescheduleSlots.length === 0 ? (
                                <p className="text-xs text-slate-500">No open slots available for this doctor right now.</p>
                              ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {rescheduleSlots.map(slot => (
                                    <button key={slot.id} onClick={() => handleConfirmReschedule(appt.id, slot.id)}
                                      className="text-[10px] font-mono p-2 border border-slate-700 hover:border-brand-500 hover:text-brand-300 rounded-lg transition text-slate-300 text-center">
                                      {slot.date}<br/>{slot.startTime}â€“{slot.endTime}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <button onClick={(e) => { e.stopPropagation(); setReschedulingApptId(null); setRescheduleSlots([]); setRescheduleError(''); }}
                                className="mt-2 text-[10px] text-slate-500 hover:text-slate-300 transition">âœ• Close</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* â”€â”€ Visit History â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {(pastAppts.length > 0 || !appointmentsLoading) && (
            <div className="glass-panel p-6 rounded-2xl">
              <h3 className="text-xl font-bold mb-4">Visit History</h3>
              {pastAppts.length === 0 ? (
                <div className="border border-slate-800/85 rounded-xl p-4 text-slate-500 text-center text-sm py-8 bg-slate-950/20">
                  No past appointments yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {pastAppts.map(appt => {
                    const isExpanded = expandedApptId === appt.id;
                    return (
                      <div
                        key={appt.id}
                        onClick={() => setExpandedApptId(isExpanded ? null : appt.id)}
                        className={`border border-slate-800/60 bg-slate-950/60 p-4 rounded-xl cursor-pointer hover:border-slate-700 transition opacity-90 ${isExpanded ? 'ring-1 ring-brand-500/30' : ''}`}
                      >
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                          <div>
                            <h4 className="font-bold text-white text-sm">{appt.doctorName}</h4>
                            <p className="text-xs text-brand-500 font-semibold">{appt.specialisation}</p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-xs text-slate-400 font-mono">{appt.date} @ {appt.startTime} - {appt.endTime}</p>
                            <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mt-1 ${
                              appt.status === 'COMPLETED' ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                              {appt.status}
                            </span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-slate-900 text-xs text-slate-300 space-y-3">
                            <div>
                              <strong className="text-slate-500 block mb-1">Your Symptoms:</strong>
                              <p className="bg-slate-900 p-2.5 rounded-lg border border-slate-900 italic text-[11px] leading-relaxed">
                                {appt.symptomsText || 'No symptoms described.'}
                              </p>
                            </div>

                            {appt.preVisitSummaryJson && !appt.preVisitSummaryJson.aiError && (
                              <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-900 space-y-2">
                                <div className="flex justify-between items-center text-[10px] text-slate-400">
                                  <span className="font-bold tracking-wider">AI SYMPTOM BRIEFING</span>
                                  <span className={`px-2 py-0.5 rounded font-bold uppercase ${appt.urgencyLevel === 'High' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : appt.urgencyLevel === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                    Urgency: {appt.urgencyLevel || 'Low'}
                                  </span>
                                </div>
                                <div>
                                  <strong className="text-slate-500 text-[10px] uppercase">Chief Complaint:</strong>
                                  <p className="text-slate-300 text-xs mt-0.5">{appt.preVisitSummaryJson.chief_complaint}</p>
                                </div>
                              </div>
                            )}

                            {appt.status === 'COMPLETED' && appt.postVisitSummaryText && (
                              <div className="bg-brand-950/15 border border-brand-900/30 p-3 rounded-lg space-y-2">
                                <span className="text-[10px] uppercase font-bold text-brand-400 tracking-wider">AI Patient-Friendly Summary</span>
                                <div className="text-xs text-slate-300 leading-relaxed break-words">
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                      table: ({node: _n, ...props}) => <div className="overflow-x-auto my-2"><table className="min-w-full divide-y divide-slate-800 border border-slate-800 rounded-lg text-left" {...props} /></div>,
                                      thead: ({node: _n, ...props}) => <thead className="bg-slate-900/60" {...props} />,
                                      th: ({node: _n, ...props}) => <th className="px-3 py-1.5 border border-slate-800 font-semibold text-slate-200" {...props} />,
                                      td: ({node: _n, ...props}) => <td className="px-3 py-1.5 border border-slate-800 text-slate-300" {...props} />,
                                      tr: ({node: _n, ...props}) => <tr className="even:bg-slate-900/20" {...props} />,
                                      p: ({node: _n, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                                      strong: ({node: _n, ...props}) => <strong className="font-bold text-white" {...props} />,
                                      h1: ({node: _n, ...props}) => <h1 className="text-base font-bold text-white mt-3 mb-1" {...props} />,
                                      h2: ({node: _n, ...props}) => <h2 className="text-sm font-bold text-white mt-2.5 mb-1" {...props} />,
                                      h3: ({node: _n, ...props}) => <h3 className="text-xs font-bold text-white mt-2 mb-0.5" {...props} />,
                                      ul: ({node: _n, ...props}) => <ul className="list-disc pl-4 mb-2 mt-1 space-y-1" {...props} />,
                                      ol: ({node: _n, ...props}) => <ol className="list-decimal pl-4 mb-2 mt-1 space-y-1" {...props} />,
                                      li: ({node: _n, ...props}) => <li {...props} />,
                                    }}
                                  >
                                    {appt.postVisitSummaryText}
                                  </ReactMarkdown>
                                </div>
                                {appt.prescriptionJson && Array.isArray(appt.prescriptionJson) && appt.prescriptionJson.length > 0 && (
                                  <div className="pt-2 border-t border-slate-900/50">
                                    <strong className="text-slate-500 text-[10px] uppercase block mb-1">Prescribed Meds:</strong>
                                    <div className="space-y-1">
                                      {appt.prescriptionJson.map((med, idx) => (
                                        <div key={idx} className="text-[11px] text-slate-300">
                                          â€¢ <span className="font-bold text-white">{med.medicineName}</span> ({med.dosage}) â€” {med.frequencyPerDay}x/day for {med.durationDays} days
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}




          {/* Book an Appointment */}
          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="text-xl font-bold mb-2">Book an Appointment</h3>
            <p className="text-slate-400 mb-5 text-sm">
              Search for specialist doctors, check real-time availability, hold a slot, and confirm your booking.
            </p>
            <form onSubmit={handleSearch} className="flex gap-3">
              <input
                type="text"
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                placeholder="Search specialisation (e.g. Cardiology, Paediatrics)..."
                className="flex-1 px-4 py-2.5 border border-slate-800 bg-slate-900 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm transition"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 font-semibold rounded-lg text-sm transition shadow-lg shrink-0"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </form>
          </div>

          {/* Doctor Profiles with Slots List */}
          <div className="space-y-4">
            {loading ? (
              <div className="glass-panel p-12 text-center rounded-2xl flex flex-col items-center">
                <Loader2 className="h-8 w-8 text-brand-500 animate-spin mb-2" />
                <span className="text-slate-400 text-sm">Searching for specialist listings...</span>
              </div>
            ) : doctors.length === 0 ? (
              <div className="glass-panel p-12 text-center text-slate-500 text-sm rounded-2xl border border-slate-900">
                No doctor profiles found matching your query.
              </div>
            ) : (
              doctors.map(doc => (
                <div key={doc.id} className="glass-panel p-6 rounded-2xl border border-slate-900 space-y-4 text-left">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-lg font-bold text-white leading-snug">{doc.name}</h4>
                      <span className="text-xs text-brand-500 font-bold uppercase tracking-wider">{doc.specialisation}</span>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">{doc.bio || 'No profile biography details provided.'}</p>
                    </div>
                    <div className="text-[10px] text-slate-500 text-right shrink-0">
                      <div>Slot length: {doc.slotDurationMinutes}m</div>
                      <div>{doc.phone}</div>
                    </div>
                  </div>

                  {/* Slots listing */}
                  <div className="pt-3 border-t border-slate-900">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 block mb-2.5">Available Slots</span>
                    {doc.slots.length === 0 ? (
                      <span className="text-xs text-slate-500 italic">No open slots available. Verify working days schedule or check back later.</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {doc.slots.map(s => {
                          const isCurrentlyHeldByMe = heldSlot?.id === s.id;
                          return (
                            <button
                              key={s.id}
                              onClick={() => handleSelectSlot(s, doc)}
                              disabled={!!heldSlot}
                              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition text-left flex flex-col justify-center min-w-[100px] ${
                                isCurrentlyHeldByMe
                                  ? 'bg-brand-500/20 text-brand-400 border-brand-500'
                                  : 'bg-slate-950 hover:bg-slate-900 border-slate-900 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:bg-slate-950 disabled:hover:text-slate-300'
                              }`}
                            >
                              <span className="text-[9px] font-medium text-slate-500">{s.date}</span>
                              <span className="font-mono mt-0.5">{s.startTime}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Google Calendar Card */}
          <div className="glass-panel p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="h-8 w-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-brand-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Google Calendar</h4>
                <p className="text-[10px] text-slate-500">Sync appointments automatically</p>
              </div>
            </div>
            {calendarConnected ? (
              <>
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium mb-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Connected
                </div>
                <button
                  onClick={handleCalendarDisconnect}
                  className="w-full py-1.5 text-[10px] font-semibold uppercase tracking-wide border border-slate-700 hover:border-red-800 hover:text-red-400 text-slate-400 rounded-lg transition"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-500 mb-3">Connect once to see appointments in your Google Calendar with automatic reminders.</p>
                <button
                  onClick={handleCalendarConnect}
                  className="w-full py-2 bg-brand-500 hover:bg-brand-400 text-white text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Connect Google Calendar
                </button>
              </>
            )}
          </div>

          {/* Active Prescriptions â€” sourced from COMPLETED appointments */}
          {(() => {
            // Collect all prescriptions from completed appointments that have real prescription rows
            const allRx = appointments
              .filter(a => a.status === 'COMPLETED' && a.prescriptions && a.prescriptions.length > 0)
              .flatMap(a => a.prescriptions);

            return (
              <div className="glass-panel p-6 rounded-2xl border-l-4 border-l-brand-500 bg-slate-900/5">
                <h4 className="font-bold text-white mb-3 text-sm uppercase tracking-wider">Active Prescriptions</h4>
                {allRx.length === 0 ? (
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Dosing reminders and clinical follow-up schedules will automatically sync here once clinical notes are uploaded by your doctor.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {allRx.map(rx => {
                      const nextDose = rx.upcomingReminders?.[0];
                      return (
                        <div key={rx.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-white">{rx.medicineName}</span>
                            <span className="text-[10px] font-mono bg-brand-500/10 text-brand-300 border border-brand-500/20 px-2 py-0.5 rounded-full">{rx.dosage}</span>
                          </div>
                          <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
                            <span>ðŸ” {rx.frequencyPerDay}x / day</span>
                            <span>ðŸ“… {rx.durationDays} days</span>
                          </div>
                          {nextDose ? (
                            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-emerald-400 font-medium">
                              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Next dose: {new Date(nextDose).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500 mt-1">No upcoming reminders</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </DashboardLayout>
  );
}

// 7. Doctor Dashboard Page Component
function DoctorDashboard() {
  const { user, fetchWithAuth } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedApptId, setExpandedApptId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Google Calendar integration
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarConnecting, setCalendarConnecting] = useState(false);

  // Doctor complete visit form states
  const [doctorNotes, setDoctorNotes] = useState('');
  const [prescriptionList, setPrescriptionList] = useState([]);

  // Individual medicine inputs
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medFreq, setMedFreq] = useState(1);
  const [medDuration, setMedDuration] = useState(5);

  // Reset form inputs whenever expanded appointment shifts
  useEffect(() => {
    setDoctorNotes('');
    setPrescriptionList([]);
    setMedName('');
    setMedDosage('');
    setMedFreq(1);
    setMedDuration(5);
  }, [expandedApptId]);

  const handleAddMedication = (e) => {
    e.preventDefault();
    if (!medName.trim() || !medDosage.trim()) return;
    setPrescriptionList([...prescriptionList, {
      medicineName: medName.trim(),
      dosage: medDosage.trim(),
      frequencyPerDay: Number(medFreq) || 1,
      durationDays: Number(medDuration) || 5
    }]);
    setMedName('');
    setMedDosage('');
    setMedFreq(1);
    setMedDuration(5);
  };

  const handleRemoveMedication = (index) => {
    setPrescriptionList(prescriptionList.filter((_, idx) => idx !== index));
  };

  const handleSubmitClinicalRecord = async (apptId) => {
    if (!doctorNotes.trim()) {
      setError('Please provide clinical notes before completing the visit.');
      return;
    }
    setError('');
    setSuccess('');
    try {
      const res = await fetchWithAuth(`/api/doctor/appointments/${apptId}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          doctorNotes,
          prescription: prescriptionList
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Appointment completed and AI summary generated!');
        setExpandedApptId(null);
        loadAppointments();
      } else {
        setError(data.error || 'Failed to complete appointment.');
      }
    } catch (err) {
      setError('Network error completing appointment.');
    }
  };

  const isAppointmentInFuture = (appt) => {
    const now = new Date();
    const [year, month, day] = appt.date.split('-').map(Number);
    const [hour, min] = appt.startTime.split(':').map(Number);
    const apptDate = new Date(year, month - 1, day, hour, min);
    return apptDate > now;
  };

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth('/api/doctor/appointments');
      const data = await res.json();
      if (res.ok) {
        setAppointments(data.appointments || []);
      }
    } catch (err) {
      console.error('Error fetching doctor appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkCalendarStatus = async () => {
    try {
      const res = await fetchWithAuth('/api/auth/google/status');
      const data = await res.json();
      if (res.ok) setCalendarConnected(data.connected);
    } catch (_) {}
  };

  useEffect(() => {
    loadAppointments();
    checkCalendarStatus();
    // Check if we just returned from Google OAuth
    const params = new URLSearchParams(window.location.search);
    if (params.get('calendarConnected') === 'true') {
      setCalendarConnected(true);
      setSuccess('Google Calendar connected successfully!');
      window.history.replaceState({}, '', '/doctor');
    }
    if (params.get('calendarError')) {
      setError('Google Calendar connection failed. Please try again.');
      window.history.replaceState({}, '', '/doctor');
    }
  }, []);

  const { token } = useAuth();

  const handleCalendarConnect = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/auth/google/connect?token=${token}`;
  };

  const handleCalendarDisconnect = async () => {
    try {
      await fetchWithAuth('/api/auth/google/disconnect', { method: 'POST' });
      setCalendarConnected(false);
      setSuccess('Google Calendar disconnected.');
    } catch (_) {
      setError('Failed to disconnect calendar.');
    }
  };

  const todayStr = new Date().toLocaleDateString('en-CA');
  const todayAppointments = appointments.filter(a => a.date === todayStr && a.status === 'CONFIRMED');
  const upcomingAppointments = appointments.filter(a => a.date > todayStr && a.status === 'CONFIRMED');
  // Past: COMPLETED or CANCELLED (most recent first)
  const pastDoctorAppts = appointments
    .filter(a => a.status === 'COMPLETED' || a.status === 'CANCELLED')
    .sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime));

  return (
    <DashboardLayout title="Doctor Portal" icon={Stethoscope}>
      {/* Alerts */}
      {error && (
        <div className="mb-6 bg-red-950/40 border border-red-800/80 text-red-200 px-4 py-3 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 bg-emerald-950/40 border border-emerald-800/80 text-emerald-200 px-4 py-3 rounded-xl text-sm font-medium">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Schedule Section */}
          <div className="glass-panel p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800">
            <h3 className="text-xl font-bold mb-1">Today's Schedule</h3>
            <span className="text-xs text-slate-500 font-mono block mb-4">Date: {todayStr}</span>
            
            {loading ? (
              <div className="flex items-center justify-center py-6 text-slate-500 text-xs">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading schedule...
              </div>
            ) : todayAppointments.length === 0 ? (
              <div className="border border-slate-800/80 rounded-xl p-4 text-slate-500 text-center text-sm py-8">
                No patient slots booked for today.
              </div>
            ) : (
              <div className="space-y-3">
                {todayAppointments.map(appt => {
                  const isExpanded = expandedApptId === appt.id;
                  return (
                    <div
                      key={appt.id}
                      onClick={() => setExpandedApptId(isExpanded ? null : appt.id)}
                      className={`border border-slate-800 bg-slate-950/60 p-4 rounded-xl cursor-pointer hover:border-slate-700 transition ${
                        isExpanded ? 'ring-1 ring-brand-500/50' : ''
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-white text-sm">{appt.patientName}</h4>
                          <span className="text-[10px] text-slate-400">{appt.patientEmail}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-xs text-brand-400 font-bold">{appt.startTime} - {appt.endTime}</span>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-900 text-xs text-slate-300 space-y-4 animate-fadeIn">
                          {/* Symptoms Section */}
                          <div>
                            <strong className="text-slate-500 block mb-1">Patient Symptoms:</strong>
                            <p className="bg-slate-900 p-2.5 rounded-lg border border-slate-900 italic text-[11px] leading-relaxed">
                              {appt.symptomsText || 'No symptom description provided.'}
                            </p>
                          </div>

                          {/* Pre-Visit AI Summary */}
                          {appt.preVisitSummaryJson && (
                            <div>
                              {appt.preVisitSummaryJson.aiError ? (
                                <div className="bg-red-950/20 border border-red-900/50 p-2.5 rounded-lg text-[11px] text-red-300 leading-relaxed">
                                  <strong>AI summary unavailable</strong>: please review symptoms manually.
                                </div>
                              ) : (
                                <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-900 space-y-2">
                                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                                    <span className="font-bold tracking-wider">AI PRE-VISIT SUMMARY</span>
                                    <span className={`px-2 py-0.5 rounded font-bold uppercase ${
                                      appt.urgencyLevel === 'High' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                      appt.urgencyLevel === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                                      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    }`}>
                                      Urgency: {appt.urgencyLevel || 'Low'}
                                    </span>
                                  </div>
                                  <div>
                                    <strong className="text-slate-500 text-[10px] uppercase">Chief Complaint:</strong>
                                    <p className="text-slate-300 text-xs mt-0.5">{appt.preVisitSummaryJson.chief_complaint}</p>
                                  </div>
                                  {appt.preVisitSummaryJson.questions && appt.preVisitSummaryJson.questions.length > 0 && (
                                    <div>
                                      <strong className="text-slate-500 text-[10px] uppercase">Suggested Questions:</strong>
                                      <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-xs text-slate-300">
                                        {appt.preVisitSummaryJson.questions.map((q, idx) => <li key={idx}>{q}</li>)}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Completed Post-Visit Details */}
                          {appt.status === 'COMPLETED' && appt.postVisitSummaryText && (
                            <div className="bg-brand-950/15 border border-brand-900/30 p-3 rounded-lg space-y-2">
                              <span className="text-[10px] uppercase font-bold text-brand-400 tracking-wider">AI Patient-Friendly Summary</span>
                              <div className="text-xs text-slate-300 leading-relaxed break-words">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    table: ({node: _n, ...props}) => <div className="overflow-x-auto my-2"><table className="min-w-full divide-y divide-slate-800 border border-slate-800 rounded-lg text-left" {...props} /></div>,
                                    thead: ({node: _n, ...props}) => <thead className="bg-slate-900/60" {...props} />,
                                    th: ({node: _n, ...props}) => <th className="px-3 py-1.5 border border-slate-800 font-semibold text-slate-200" {...props} />,
                                    td: ({node: _n, ...props}) => <td className="px-3 py-1.5 border border-slate-800 text-slate-300" {...props} />,
                                    tr: ({node: _n, ...props}) => <tr className="even:bg-slate-900/20" {...props} />,
                                    p: ({node: _n, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                                    strong: ({node: _n, ...props}) => <strong className="font-bold text-white" {...props} />,
                                    h1: ({node: _n, ...props}) => <h1 className="text-base font-bold text-white mt-3 mb-1" {...props} />,
                                    h2: ({node: _n, ...props}) => <h2 className="text-sm font-bold text-white mt-2.5 mb-1" {...props} />,
                                    h3: ({node: _n, ...props}) => <h3 className="text-xs font-bold text-white mt-2 mb-0.5" {...props} />,
                                    ul: ({node: _n, ...props}) => <ul className="list-disc pl-4 mb-2 mt-1 space-y-1" {...props} />,
                                    ol: ({node: _n, ...props}) => <ol className="list-decimal pl-4 mb-2 mt-1 space-y-1" {...props} />,
                                    li: ({node: _n, ...props}) => <li {...props} />,
                                  }}
                                >
                                  {appt.postVisitSummaryText}
                                </ReactMarkdown>
                              </div>
                              
                              {appt.prescriptionJson && Array.isArray(appt.prescriptionJson) && appt.prescriptionJson.length > 0 && (
                                <div className="pt-2 border-t border-slate-900/50">
                                  <strong className="text-slate-500 text-[10px] uppercase block mb-1">Prescribed Meds:</strong>
                                  <div className="space-y-1">
                                    {appt.prescriptionJson.map((med, idx) => (
                                      <div key={idx} className="text-[11px] text-slate-300">
                                        â€¢ <span className="font-bold text-white">{med.medicineName}</span> ({med.dosage}) â€” {med.frequencyPerDay}x/day for {med.durationDays} days
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Complete Appointment Form â€” stopPropagation prevents clicks from bubbling
                               up to the card's expand toggle, fixing input collapse + stale-notes bugs */}
                          {appt.status === 'CONFIRMED' && (
                            <div
                              className="border-t border-slate-900 pt-4 space-y-4"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <h5 className="font-bold text-white text-xs uppercase tracking-wider">Record Clinical Visit Details</h5>
                              
                              {/* Clinical Notes input */}
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-1">Doctor's Clinical Notes (converted to patient-friendly summary by AI)</label>
                                <textarea
                                  rows={3}
                                  value={doctorNotes}
                                  onChange={(e) => setDoctorNotes(e.target.value)}
                                  placeholder="Patient has high blood pressure, prescribe Metoprolol 50mg twice daily for 30 days. Rest, limit sodium intake, and follow up in one month."
                                  className="w-full text-xs px-2.5 py-2 bg-slate-950 border border-slate-900 rounded text-slate-100 placeholder-slate-750 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                />
                              </div>

                              {/* Prescription builder */}
                              <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-900">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Add Medications</span>
                                
                                {/* Added meds list */}
                                {prescriptionList.length > 0 && (
                                  <div className="space-y-1.5 mb-2.5 pb-2.5 border-b border-slate-900">
                                    {prescriptionList.map((med, idx) => (
                                      <div key={idx} className="flex justify-between items-center text-xs bg-slate-900 px-2 py-1 rounded">
                                        <span>
                                          <strong className="text-slate-200">{med.medicineName}</strong> ({med.dosage}) â€” {med.frequencyPerDay}x/day for {med.durationDays}d
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveMedication(idx)}
                                          className="text-red-400 hover:text-red-300 font-bold px-1.5"
                                        >
                                          Ã—
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Inputs */}
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[9px] text-slate-500 uppercase">Medicine Name</label>
                                    <input
                                      type="text"
                                      value={medName}
                                      onChange={(e) => setMedName(e.target.value)}
                                      placeholder="Metoprolol"
                                      className="w-full text-[11px] px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] text-slate-500 uppercase">Dosage</label>
                                    <input
                                      type="text"
                                      value={medDosage}
                                      onChange={(e) => setMedDosage(e.target.value)}
                                      placeholder="50mg"
                                      className="w-full text-[11px] px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] text-slate-500 uppercase">Frequency / Day</label>
                                    <input
                                      type="number"
                                      min={1}
                                      value={medFreq}
                                      onChange={(e) => setMedFreq(Number(e.target.value))}
                                      className="w-full text-[11px] px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] text-slate-500 uppercase">Duration (Days)</label>
                                    <input
                                      type="number"
                                      min={1}
                                      value={medDuration}
                                      onChange={(e) => setMedDuration(Number(e.target.value))}
                                      className="w-full text-[11px] px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200"
                                    />
                                  </div>
                                </div>

                                <div className="flex justify-end pt-1">
                                  <button
                                    type="button"
                                    onClick={handleAddMedication}
                                    className="px-3 py-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[10px] text-slate-300 font-semibold rounded"
                                  >
                                    Add Medication
                                  </button>
                                </div>
                              </div>

                              {/* Form submit actions */}
                              <div className="flex justify-between items-center gap-3 pt-2">
                                {/* Cancel Appointment */}
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setError('');
                                    setSuccess('');
                                    if (window.confirm(`Are you sure you want to cancel this appointment with ${appt.patientName}?`)) {
                                      try {
                                        const res = await fetchWithAuth(`/api/doctor/appointments/${appt.id}/cancel`, {
                                          method: 'POST'
                                        });
                                        if (res.ok) {
                                          setSuccess('Appointment cancelled successfully.');
                                          loadAppointments();
                                        } else {
                                          const data = await res.json();
                                          setError(data.error || 'Failed to cancel appointment');
                                        }
                                      } catch (err) {
                                        setError('Network error cancelling appointment.');
                                      }
                                    }
                                  }}
                                  className="px-3 py-1.5 border border-red-800 hover:bg-red-950/20 text-red-400 text-xs font-semibold rounded"
                                >
                                  Cancel Appointment
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSubmitClinicalRecord(appt.id)}
                                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded"
                                >
                                  Submit Clinical Record
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Schedule Section */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800">
            <h3 className="text-xl font-bold mb-4">Upcoming Appointments</h3>
            
            {loading ? (
              <div className="flex items-center justify-center py-6 text-slate-500 text-xs">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading schedule...
              </div>
            ) : upcomingAppointments.length === 0 ? (
              <div className="border border-slate-800/80 rounded-xl p-4 text-slate-500 text-center text-sm py-8">
                No future appointments scheduled.
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingAppointments.map(appt => {
                  const isExpanded = expandedApptId === appt.id;
                  return (
                    <div
                      key={appt.id}
                      onClick={() => setExpandedApptId(isExpanded ? null : appt.id)}
                      className={`border border-slate-800 bg-slate-950/60 p-4 rounded-xl cursor-pointer hover:border-slate-700 transition ${
                        isExpanded ? 'ring-1 ring-brand-500/50' : ''
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                        <div>
                          <h4 className="font-bold text-white text-sm">{appt.patientName}</h4>
                          <span className="text-[10px] text-slate-400">{appt.patientEmail}</span>
                        </div>
                        <div className="text-left sm:text-right">
                          <span className="font-mono text-xs text-brand-400 font-bold block">{appt.date}</span>
                          <span className="font-mono text-[10px] text-slate-400">{appt.startTime} - {appt.endTime}</span>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-900 text-xs text-slate-300 space-y-4 animate-fadeIn">
                          {/* Symptoms Section */}
                          <div>
                            <strong className="text-slate-500 block mb-1">Patient Symptoms:</strong>
                            <p className="bg-slate-900 p-2.5 rounded-lg border border-slate-900 italic text-[11px] leading-relaxed">
                              {appt.symptomsText || 'No symptom description provided.'}
                            </p>
                          </div>

                          {/* Pre-Visit AI Summary */}
                          {appt.preVisitSummaryJson && (
                            <div>
                              {appt.preVisitSummaryJson.aiError ? (
                                <div className="bg-red-950/20 border border-red-900/50 p-2.5 rounded-lg text-[11px] text-red-300 leading-relaxed">
                                  <strong>AI summary unavailable</strong>: please review symptoms manually.
                                </div>
                              ) : (
                                <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-900 space-y-2">
                                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                                    <span className="font-bold tracking-wider">AI PRE-VISIT SUMMARY</span>
                                    <span className={`px-2 py-0.5 rounded font-bold uppercase ${
                                      appt.urgencyLevel === 'High' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                      appt.urgencyLevel === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                                      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    }`}>
                                      Urgency: {appt.urgencyLevel || 'Low'}
                                    </span>
                                  </div>
                                  <div>
                                    <strong className="text-slate-500 text-[10px] uppercase">Chief Complaint:</strong>
                                    <p className="text-slate-300 text-xs mt-0.5">{appt.preVisitSummaryJson.chief_complaint}</p>
                                  </div>
                                  {appt.preVisitSummaryJson.questions && appt.preVisitSummaryJson.questions.length > 0 && (
                                    <div>
                                      <strong className="text-slate-500 text-[10px] uppercase">Suggested Questions:</strong>
                                      <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-xs text-slate-300">
                                        {appt.preVisitSummaryJson.questions.map((q, idx) => <li key={idx}>{q}</li>)}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Completed Post-Visit Details */}
                          {appt.status === 'COMPLETED' && appt.postVisitSummaryText && (
                            <div className="bg-brand-950/15 border border-brand-900/30 p-3 rounded-lg space-y-2">
                              <span className="text-[10px] uppercase font-bold text-brand-400 tracking-wider">AI Patient-Friendly Summary</span>
                              <div className="text-xs text-slate-300 leading-relaxed break-words">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    table: ({node: _n, ...props}) => <div className="overflow-x-auto my-2"><table className="min-w-full divide-y divide-slate-800 border border-slate-800 rounded-lg text-left" {...props} /></div>,
                                    thead: ({node: _n, ...props}) => <thead className="bg-slate-900/60" {...props} />,
                                    th: ({node: _n, ...props}) => <th className="px-3 py-1.5 border border-slate-800 font-semibold text-slate-200" {...props} />,
                                    td: ({node: _n, ...props}) => <td className="px-3 py-1.5 border border-slate-800 text-slate-300" {...props} />,
                                    tr: ({node: _n, ...props}) => <tr className="even:bg-slate-900/20" {...props} />,
                                    p: ({node: _n, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                                    strong: ({node: _n, ...props}) => <strong className="font-bold text-white" {...props} />,
                                    h1: ({node: _n, ...props}) => <h1 className="text-base font-bold text-white mt-3 mb-1" {...props} />,
                                    h2: ({node: _n, ...props}) => <h2 className="text-sm font-bold text-white mt-2.5 mb-1" {...props} />,
                                    h3: ({node: _n, ...props}) => <h3 className="text-xs font-bold text-white mt-2 mb-0.5" {...props} />,
                                    ul: ({node: _n, ...props}) => <ul className="list-disc pl-4 mb-2 mt-1 space-y-1" {...props} />,
                                    ol: ({node: _n, ...props}) => <ol className="list-decimal pl-4 mb-2 mt-1 space-y-1" {...props} />,
                                    li: ({node: _n, ...props}) => <li {...props} />,
                                  }}
                                >
                                  {appt.postVisitSummaryText}
                                </ReactMarkdown>
                              </div>
                              
                              {appt.prescriptionJson && Array.isArray(appt.prescriptionJson) && appt.prescriptionJson.length > 0 && (
                                <div className="pt-2 border-t border-slate-900/50">
                                  <strong className="text-slate-500 text-[10px] uppercase block mb-1">Prescribed Meds:</strong>
                                  <div className="space-y-1">
                                    {appt.prescriptionJson.map((med, idx) => (
                                      <div key={idx} className="text-[11px] text-slate-300">
                                        â€¢ <span className="font-bold text-white">{med.medicineName}</span> ({med.dosage}) â€” {med.frequencyPerDay}x/day for {med.durationDays} days
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Complete Appointment Form â€” stopPropagation prevents clicks from bubbling
                               up to the card's expand toggle, fixing input collapse + stale-notes bugs */}
                          {appt.status === 'CONFIRMED' && (
                            <div
                              className="border-t border-slate-900 pt-4 space-y-4"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <h5 className="font-bold text-white text-xs uppercase tracking-wider">Record Clinical Visit Details</h5>
                              
                              {/* Clinical Notes input */}
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-1">Doctor's Clinical Notes (converted to patient-friendly summary by AI)</label>
                                <textarea
                                  rows={3}
                                  value={doctorNotes}
                                  onChange={(e) => setDoctorNotes(e.target.value)}
                                  placeholder="Patient has high blood pressure, prescribe Metoprolol 50mg twice daily for 30 days. Rest, limit sodium intake, and follow up in one month."
                                  className="w-full text-xs px-2.5 py-2 bg-slate-950 border border-slate-900 rounded text-slate-100 placeholder-slate-750 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                />
                              </div>

                              {/* Prescription builder */}
                              <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-900">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Add Medications</span>
                                
                                {/* Added meds list */}
                                {prescriptionList.length > 0 && (
                                  <div className="space-y-1.5 mb-2.5 pb-2.5 border-b border-slate-900">
                                    {prescriptionList.map((med, idx) => (
                                      <div key={idx} className="flex justify-between items-center text-xs bg-slate-900 px-2 py-1 rounded">
                                        <span>
                                          <strong className="text-slate-200">{med.medicineName}</strong> ({med.dosage}) â€” {med.frequencyPerDay}x/day for {med.durationDays}d
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveMedication(idx)}
                                          className="text-red-400 hover:text-red-300 font-bold px-1.5"
                                        >
                                          Ã—
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Inputs */}
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[9px] text-slate-500 uppercase">Medicine Name</label>
                                    <input
                                      type="text"
                                      value={medName}
                                      onChange={(e) => setMedName(e.target.value)}
                                      placeholder="Metoprolol"
                                      className="w-full text-[11px] px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] text-slate-500 uppercase">Dosage</label>
                                    <input
                                      type="text"
                                      value={medDosage}
                                      onChange={(e) => setMedDosage(e.target.value)}
                                      placeholder="50mg"
                                      className="w-full text-[11px] px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] text-slate-500 uppercase">Frequency / Day</label>
                                    <input
                                      type="number"
                                      min={1}
                                      value={medFreq}
                                      onChange={(e) => setMedFreq(Number(e.target.value))}
                                      className="w-full text-[11px] px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] text-slate-500 uppercase">Duration (Days)</label>
                                    <input
                                      type="number"
                                      min={1}
                                      value={medDuration}
                                      onChange={(e) => setMedDuration(Number(e.target.value))}
                                      className="w-full text-[11px] px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200"
                                    />
                                  </div>
                                </div>

                                <div className="flex justify-end pt-1">
                                  <button
                                    type="button"
                                    onClick={handleAddMedication}
                                    className="px-3 py-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[10px] text-slate-300 font-semibold rounded"
                                  >
                                    Add Medication
                                  </button>
                                </div>
                              </div>

                              {/* Form submit actions */}
                              <div className="flex justify-between items-center gap-3 pt-2">
                                {/* Cancel Appointment */}
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setError('');
                                    setSuccess('');
                                    if (window.confirm(`Are you sure you want to cancel this appointment with ${appt.patientName}?`)) {
                                      try {
                                        const res = await fetchWithAuth(`/api/doctor/appointments/${appt.id}/cancel`, {
                                          method: 'POST'
                                        });
                                        if (res.ok) {
                                          setSuccess('Appointment cancelled successfully.');
                                          loadAppointments();
                                        } else {
                                          const data = await res.json();
                                          setError(data.error || 'Failed to cancel appointment');
                                        }
                                      } catch (err) {
                                        setError('Network error cancelling appointment.');
                                      }
                                    }
                                  }}
                                  className="px-3 py-1.5 border border-red-800 hover:bg-red-950/20 text-red-400 text-xs font-semibold rounded"
                                >
                                  Cancel Appointment
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSubmitClinicalRecord(appt.id)}
                                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded"
                                >
                                  Submit Clinical Record
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* â”€â”€ Past Appointments (Doctor) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {pastDoctorAppts.length > 0 && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-800">
              <h3 className="text-xl font-bold mb-4">Past Appointments</h3>
              <div className="space-y-3">
                {pastDoctorAppts.map(appt => {
                  const isExpanded = expandedApptId === appt.id;
                  return (
                    <div
                      key={appt.id}
                      onClick={() => setExpandedApptId(isExpanded ? null : appt.id)}
                      className={`border border-slate-800/60 bg-slate-950/60 p-4 rounded-xl cursor-pointer hover:border-slate-700 transition opacity-90 ${isExpanded ? 'ring-1 ring-brand-500/30' : ''}`}
                    >
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                        <div>
                          <h4 className="font-bold text-white text-sm">{appt.patientName}</h4>
                          <span className="text-[10px] text-slate-400">{appt.patientEmail}</span>
                        </div>
                        <div className="text-left sm:text-right">
                          <span className="font-mono text-xs text-slate-400 font-bold block">{appt.date}</span>
                          <span className="font-mono text-[10px] text-slate-500">{appt.startTime} - {appt.endTime}</span>
                          <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mt-1 ${
                            appt.status === 'COMPLETED' ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {appt.status}
                          </span>
                        </div>
                      </div>
                      {isExpanded && appt.status === 'COMPLETED' && appt.postVisitSummaryText && (
                        <div className="mt-4 pt-4 border-t border-slate-900 text-xs text-slate-300">
                          <div className="bg-brand-950/15 border border-brand-900/30 p-3 rounded-lg">
                            <span className="text-[10px] uppercase font-bold text-brand-400 tracking-wider block mb-2">AI Patient-Friendly Summary</span>
                            <div className="text-xs text-slate-300 leading-relaxed break-words">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{appt.postVisitSummaryText}</ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Google Calendar Card */}
          <div className="glass-panel p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="h-8 w-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-brand-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Google Calendar</h4>
                <p className="text-[10px] text-slate-500">Sync appointments automatically</p>
              </div>
            </div>
            {calendarConnected ? (
              <>
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium mb-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Connected
                </div>
                <button
                  onClick={handleCalendarDisconnect}
                  className="w-full py-1.5 text-[10px] font-semibold uppercase tracking-wide border border-slate-700 hover:border-red-800 hover:text-red-400 text-slate-400 rounded-lg transition"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-500 mb-3">Connect once to see appointments in your Google Calendar with automatic reminders.</p>
                <button
                  onClick={handleCalendarConnect}
                  className="w-full py-2 bg-brand-500 hover:bg-brand-400 text-white text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Connect Google Calendar
                </button>
              </>
            )}
          </div>

          <div className="glass-panel p-6 rounded-2xl">
            <h4 className="font-bold text-white mb-3 text-sm uppercase tracking-wider">Profile Details</h4>
            <div className="text-xs space-y-2 text-slate-300">
              <div><strong className="text-slate-500 block">Speciality:</strong> {user?.doctorProfile?.specialisation || 'General Medicine'}</div>
              <div><strong className="text-slate-500 block">Consultation Duration:</strong> {user?.doctorProfile?.slotDurationMinutes || 30} minutes</div>
              <div><strong className="text-slate-500 block">Bio Details:</strong> {user?.doctorProfile?.bio || 'No biography uploaded yet.'}</div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// 8. Admin Dashboard Page Component
function AdminDashboard() {
  const { fetchWithAuth } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form toggles
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeDoctor, setActiveDoctor] = useState(null); // Selected doctor for detail view & action modals
  const [activeTab, setActiveTab] = useState('hours'); // 'hours' | 'leave'

  // New Doctor form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [specialisation, setSpecialisation] = useState('General Medicine');
  const [bio, setBio] = useState('');
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(30);

  // Set Working Hours form state
  const [whDay, setWhDay] = useState(1); // Monday
  const [whStart, setWhStart] = useState('09:00');
  const [whEnd, setWhEnd] = useState('17:00');

  // Mark Leave form state
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveDateError, setLeaveDateError] = useState('');

  // Fetch doctors list
  const loadDoctors = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetchWithAuth('/api/admin/doctors');
      const data = await res.json();
      if (res.ok) {
        setDoctors(data.doctors || []);
      } else {
        setError(data.error || 'Failed to load doctors list');
      }
    } catch (err) {
      setError('Network error fetching doctors.');
    } finally {
      setLoading(false);
    }
  };

  // Notification logs state
  const [notifLogs, setNotifLogs] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const loadNotifLogs = async () => {
    try {
      setNotifLoading(true);
      const res = await fetchWithAuth('/api/admin/notification-logs');
      const data = await res.json();
      if (res.ok) setNotifLogs(data.logs || []);
    } catch (_) {}
    finally { setNotifLoading(false); }
  };

  useEffect(() => {
    loadDoctors();
    loadNotifLogs();
  }, []);

  // Validate leave date whenever activeDoctor or leaveDate changes
  useEffect(() => {
    setLeaveDateError('');
    if (leaveDate && activeDoctor) {
      const [year, month, day] = leaveDate.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      const dayOfWeek = dateObj.getDay();
      const isWorking = (activeDoctor.workingHours || []).some(wh => wh.dayOfWeek === dayOfWeek);
      if (!isWorking) {
        setLeaveDateError(`Dr. ${activeDoctor.name} is not scheduled to work on ${getDayName(dayOfWeek)}s.`);
      }
    }
  }, [leaveDate, activeDoctor]);

  const handleCreateDoctor = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const res = await fetchWithAuth('/api/admin/doctors', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          password,
          phone: phone || null,
          specialisation,
          bio: bio || null,
          slotDurationMinutes: Number(slotDurationMinutes)
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Doctor profile created for Dr. ${name}!`);
        setName('');
        setEmail('');
        setPassword('');
        setPhone('');
        setBio('');
        setSlotDurationMinutes(30);
        setShowCreateForm(false);
        loadDoctors();
      } else {
        setError(data.error || 'Failed to register doctor');
      }
    } catch (err) {
      setError('Network error registering doctor.');
    }
  };

  const handleSaveWorkingHours = async (e) => {
    e.preventDefault();
    if (!activeDoctor) return;
    setError('');
    setSuccess('');

    // Add or overwrite the working hour for the selected dayOfWeek
    const newWhEntry = {
      dayOfWeek: Number(whDay),
      startTime: whStart,
      endTime: whEnd
    };

    // Strip ID and fields Prisma doesn't need for upsert mapping from current listing
    const currentWh = (activeDoctor.workingHours || []).map(w => ({
      dayOfWeek: w.dayOfWeek,
      startTime: w.startTime,
      endTime: w.endTime
    }));

    const filteredWh = currentWh.filter(w => w.dayOfWeek !== Number(whDay));
    const updatedWh = [...filteredWh, newWhEntry];

    try {
      const res = await fetchWithAuth(`/api/admin/doctors/${activeDoctor.id}/working-hours`, {
        method: 'POST',
        body: JSON.stringify({ workingHours: updatedWh })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Schedules updated for Dr. ${activeDoctor.name}. Slots generated!`);
        // Refresh doctor list and reload active selection
        const resList = await fetchWithAuth('/api/admin/doctors');
        const dataList = await resList.json();
        if (resList.ok) {
          setDoctors(dataList.doctors || []);
          const updatedDoc = (dataList.doctors || []).find(d => d.id === activeDoctor.id);
          if (updatedDoc) setActiveDoctor(updatedDoc);
        }
      } else {
        setError(data.error || 'Failed to update schedule');
      }
    } catch (err) {
      setError('Network error updating schedule.');
    }
  };

  const handleClearWorkingHours = async () => {
    if (!activeDoctor) return;
    setError('');
    setSuccess('');
    try {
      const res = await fetchWithAuth(`/api/admin/doctors/${activeDoctor.id}/working-hours`, {
        method: 'POST',
        body: JSON.stringify({ workingHours: [] })
      });
      if (res.ok) {
        setSuccess(`Cleared all hours for Dr. ${activeDoctor.name}.`);
        const resList = await fetchWithAuth('/api/admin/doctors');
        const dataList = await resList.json();
        if (resList.ok) {
          setDoctors(dataList.doctors || []);
          const updatedDoc = (dataList.doctors || []).find(d => d.id === activeDoctor.id);
          if (updatedDoc) setActiveDoctor(updatedDoc);
        }
      } else {
        setError('Failed to clear working hours.');
      }
    } catch (err) {
      setError('Network error clearing working hours.');
    }
  };

  const handleMarkLeave = async (e) => {
    e.preventDefault();
    if (!activeDoctor || !leaveDate) return;
    setError('');
    setSuccess('');
    try {
      const res = await fetchWithAuth(`/api/admin/doctors/${activeDoctor.id}/leave`, {
        method: 'POST',
        body: JSON.stringify({ date: leaveDate, reason: leaveReason })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Leave recorded. Conflicting bookings cancelled: ${data.cancelledAppointments}`);
        setLeaveDate('');
        setLeaveReason('');
        setLeaveDateError('');
        
        // Refresh doctor data
        const resList = await fetchWithAuth('/api/admin/doctors');
        const dataList = await resList.json();
        if (resList.ok) {
          setDoctors(dataList.doctors || []);
          const updatedDoc = (dataList.doctors || []).find(d => d.id === activeDoctor.id);
          if (updatedDoc) setActiveDoctor(updatedDoc);
        }
      } else {
        setError(data.error || 'Failed to mark leave');
      }
    } catch (err) {
      setError('Network error saving leave day.');
    }
  };

  const getDayName = (dayNum) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNum];
  };

  return (
    <DashboardLayout title="Admin Portal" icon={Shield}>
      {/* Alert Banners */}
      {error && (
        <div className="mb-6 bg-red-950/40 border border-red-800/80 text-red-200 px-4 py-3 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 bg-emerald-950/40 border border-emerald-800/80 text-emerald-200 px-4 py-3 rounded-xl text-sm font-medium">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Main Action Banner */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold">Doctor List</h3>
              <p className="text-slate-400 text-sm mt-1">
                Configure specialization profiles, working schedules, and mark leaves.
              </p>
            </div>
            <button
              onClick={() => {
                setShowCreateForm(!showCreateForm);
                setActiveDoctor(null);
              }}
              className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 font-semibold rounded-lg text-sm transition glow-btn shrink-0"
            >
              {showCreateForm ? 'Cancel Profile Creation' : 'Create Doctor Profile'}
            </button>
          </div>

          {/* Create Doctor Form */}
          {showCreateForm && (
            <div className="glass-panel p-6 rounded-2xl border border-brand-500/20 bg-slate-900/10">
              <h4 className="text-lg font-bold mb-4 text-white">Create New Doctor Profile</h4>
              <form onSubmit={handleCreateDoctor} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Dr. Sarah Jenkins"
                      className="block w-full px-3 py-2 border border-slate-800 bg-slate-950 rounded-lg text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="sarah.jenkins@caresync.com"
                      className="block w-full px-3 py-2 border border-slate-800 bg-slate-950 rounded-lg text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Password</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                      className="block w-full px-3 py-2 border border-slate-800 bg-slate-950 rounded-lg text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Specialisation</label>
                    <input
                      type="text"
                      required
                      value={specialisation}
                      onChange={(e) => setSpecialisation(e.target.value)}
                      placeholder="Cardiology"
                      className="block w-full px-3 py-2 border border-slate-800 bg-slate-950 rounded-lg text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Slot Duration</label>
                    <select
                      value={slotDurationMinutes}
                      onChange={(e) => setSlotDurationMinutes(Number(e.target.value))}
                      className="block w-full px-3 py-2 border border-slate-800 bg-slate-950 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value={15}>15 minutes</option>
                      <option value={20}>20 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={45}>45 minutes</option>
                      <option value={60}>60 minutes</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+15550189"
                      className="block w-full px-3 py-2 border border-slate-800 bg-slate-950 rounded-lg text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Biography / Bio</label>
                    <input
                      type="text"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Specialist in cardiovascular diseases and heart surgeries..."
                      className="block w-full px-3 py-2 border border-slate-800 bg-slate-950 rounded-lg text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2 bg-brand-600 hover:bg-brand-500 font-semibold rounded-lg text-xs transition"
                  >
                    Save Doctor Profile
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Doctors Listing Grid */}
          {loading ? (
            <div className="glass-panel p-12 rounded-2xl flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 text-brand-500 animate-spin mb-2" />
              <span className="text-slate-400 text-sm">Fetching profiles...</span>
            </div>
          ) : doctors.length === 0 ? (
            <div className="glass-panel p-12 text-center rounded-2xl text-slate-500 text-sm border border-slate-900">
              No doctors profiles are configured in the system. Use the builder above to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {doctors.map(doc => (
                <div
                  key={doc.id}
                  onClick={() => {
                    setActiveDoctor(doc);
                    setShowCreateForm(false);
                  }}
                  className={`glass-panel p-5 rounded-2xl text-left border hover:border-slate-700 transition cursor-pointer relative group flex flex-col justify-between ${
                    activeDoctor?.id === doc.id ? 'border-brand-500/50 bg-slate-900/20' : 'border-slate-800/80 bg-slate-900/5'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="bg-brand-600/10 p-2.5 rounded-xl border border-brand-500/10 text-brand-500">
                        <Stethoscope className="h-5 w-5" />
                      </div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 border border-slate-900 px-2 py-0.5 rounded bg-slate-950">
                        {doc.slotDurationMinutes} min
                      </span>
                    </div>
                    <h4 className="text-lg font-bold mt-3 text-white group-hover:text-brand-400 transition">{doc.name}</h4>
                    <p className="text-xs text-brand-500 font-semibold">{doc.specialisation}</p>
                    <p className="text-xs text-slate-400 mt-2 line-clamp-2">{doc.bio || 'No biography details provided.'}</p>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-slate-900 flex justify-between items-center text-[10px] text-slate-500">
                    <span>{doc.email}</span>
                    <span>{doc.workingHours.length} days scheduled</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Sidebar: Scheduler & Leave Forms */}
        <div className="space-y-6">
          {activeDoctor ? (
            <div className="glass-panel p-6 rounded-2xl border border-brand-500/20 bg-slate-900/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-brand-500/10 p-2 rounded-xl text-brand-500">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white leading-tight">{activeDoctor.name}</h4>
                  <span className="text-xs text-brand-500 font-medium">{activeDoctor.specialisation}</span>
                </div>
              </div>

              {/* Action Tabs */}
              <div className="flex border-b border-slate-900 mb-4">
                <button
                  onClick={() => setActiveTab('hours')}
                  className={`flex-1 pb-2 text-xs font-semibold uppercase tracking-wider text-center transition ${
                    activeTab === 'hours' ? 'border-b-2 border-brand-500 text-brand-500' : 'text-slate-500 hover:text-slate-400'
                  }`}
                >
                  Hours
                </button>
                <button
                  onClick={() => setActiveTab('leave')}
                  className={`flex-1 pb-2 text-xs font-semibold uppercase tracking-wider text-center transition ${
                    activeTab === 'leave' ? 'border-b-2 border-brand-500 text-brand-500' : 'text-slate-500 hover:text-slate-400'
                  }`}
                >
                  Leave
                </button>
              </div>

              {/* Tab Content: 1. Working Hours */}
              {activeTab === 'hours' && (
                <div className="space-y-4">
                  {/* Current Active Hours */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Active Schedule</span>
                    {activeDoctor.workingHours.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No working hours configured.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {activeDoctor.workingHours.map(wh => (
                          <div key={wh.id} className="flex justify-between items-center text-xs bg-slate-950 px-2.5 py-1.5 rounded border border-slate-900">
                            <span className="font-semibold text-slate-300">{getDayName(wh.dayOfWeek)}</span>
                            <span className="text-slate-400 font-mono">{wh.startTime} - {wh.endTime}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add / Set Schedule Form */}
                  <form onSubmit={handleSaveWorkingHours} className="border-t border-slate-900 pt-4 space-y-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Add / Edit Day hours</span>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <label className="block text-[10px] text-slate-400 mb-1">Select Day</label>
                        <select
                          value={whDay}
                          onChange={(e) => setWhDay(Number(e.target.value))}
                          className="w-full text-xs px-2.5 py-2 bg-slate-950 border border-slate-900 rounded text-slate-100"
                        >
                          <option value={1}>Monday</option>
                          <option value={2}>Tuesday</option>
                          <option value={3}>Wednesday</option>
                          <option value={4}>Thursday</option>
                          <option value={5}>Friday</option>
                          <option value={6}>Saturday</option>
                          <option value={0}>Sunday</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">Start Time</label>
                        <input
                          type="text"
                          required
                          value={whStart}
                          onChange={(e) => setWhStart(e.target.value)}
                          placeholder="09:00"
                          className="w-full text-xs px-2.5 py-1.5 bg-slate-950 border border-slate-900 rounded text-slate-100 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">End Time</label>
                        <input
                          type="text"
                          required
                          value={whEnd}
                          onChange={(e) => setWhEnd(e.target.value)}
                          placeholder="17:00"
                          className="w-full text-xs px-2.5 py-1.5 bg-slate-950 border border-slate-900 rounded text-slate-100 font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 justify-between pt-1">
                      <button
                        type="button"
                        onClick={handleClearWorkingHours}
                        className="px-3 py-1.5 border border-red-800 text-red-400 hover:bg-red-950/20 text-xs font-semibold rounded"
                      >
                        Clear All
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded"
                      >
                        Save Schedule
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Tab Content: 2. Leaves */}
              {activeTab === 'leave' && (
                <div className="space-y-4">
                  {/* Current Active Leaves */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Leave History</span>
                    {activeDoctor.leaves.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No leaves recorded.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {activeDoctor.leaves.map(lv => (
                          <div key={lv.id} className="text-xs bg-slate-950 px-2.5 py-2 rounded border border-slate-900">
                            <div className="flex justify-between font-semibold text-red-400">
                              <span>{lv.date}</span>
                              <span className="text-[9px] uppercase tracking-wider text-slate-500">Leave</span>
                            </div>
                            <p className="text-slate-400 mt-1 text-[11px] leading-relaxed">{lv.reason || 'No reason provided.'}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add Leave Form */}
                  <form onSubmit={handleMarkLeave} className="border-t border-slate-900 pt-4 space-y-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Mark New Leave Date</span>
                    
                    {/* Working Weekdays Guide */}
                    <div className="text-[10px] bg-slate-900/50 border border-slate-900 p-2.5 rounded-lg text-slate-400">
                      <span className="text-slate-300 font-bold block mb-1">Scheduled Workdays</span>
                      <div className="flex gap-1 mt-1.5">
                        {[1, 2, 3, 4, 5, 6, 0].map(d => {
                          const isWorking = (activeDoctor.workingHours || []).some(w => w.dayOfWeek === d);
                          const dayName = getDayName(d).substring(0, 3);
                          return (
                            <span
                              key={d}
                              className={`flex-1 text-center py-0.5 rounded text-[9px] font-bold border ${
                                isWorking 
                                  ? 'bg-brand-500/10 text-brand-400 border-brand-500/20' 
                                  : 'bg-slate-950 text-slate-700 border-slate-950/40'
                              }`}
                            >
                              {dayName}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Select Date</label>
                      <input
                        type="date"
                        required
                        value={leaveDate}
                        min={new Date().toLocaleDateString('en-CA')}
                        onChange={(e) => setLeaveDate(e.target.value)}
                        className={`w-full text-xs px-2.5 py-2 bg-slate-950 border rounded text-slate-100 focus:outline-none ${
                          leaveDateError ? 'border-red-500 focus:ring-1 focus:ring-red-500' : 'border-slate-900 focus:ring-1 focus:ring-brand-500'
                        }`}
                      />
                      {leaveDateError && (
                        <p className="mt-1 text-[10px] text-red-400 leading-tight">
                          {leaveDateError}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Reason (Optional)</label>
                      <input
                        type="text"
                        value={leaveReason}
                        onChange={(e) => setLeaveReason(e.target.value)}
                        placeholder="Attending medical conference..."
                        className="w-full text-xs px-2.5 py-1.5 bg-slate-950 border border-slate-900 rounded text-slate-100 placeholder-slate-700"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!leaveDate || !!leaveDateError}
                      className="w-full py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save Leave (Cancels Bookings)
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <div className="glass-panel p-6 rounded-2xl border border-slate-900 bg-slate-900/5 flex flex-col items-center justify-center text-center py-12 text-slate-500">
              <Stethoscope className="h-8 w-8 mb-2 text-slate-600" />
              <p className="text-xs">Select a doctor from the list to manage working hours or record leaves.</p>
            </div>
          )}

          {/* System Monitor Panel */}
          <div className="glass-panel p-6 rounded-2xl bg-slate-900/5">
            <h4 className="font-bold text-white mb-3 text-sm uppercase tracking-wider">System Monitor</h4>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-900">
                <span className="text-slate-400">Background Worker:</span>
                <span className="text-emerald-500 font-bold flex items-center gap-1.5 animate-pulse">
                  <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full"></div>
                  Active
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-900">
                <span className="text-slate-400">Worker Frequency:</span>
                <span className="text-slate-300 font-mono">10 seconds</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Log Panel */}
      <div className="mt-8 glass-panel p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Notification Log</h3>
            <p className="text-xs text-slate-500 mt-0.5">Last 200 entries Â· FAILED rows need attention</p>
          </div>
          <button
            onClick={loadNotifLogs}
            disabled={notifLoading}
            className="text-[10px] text-slate-400 hover:text-slate-200 font-mono border border-slate-800 hover:border-slate-700 px-2.5 py-1 rounded transition disabled:opacity-50"
          >
            {notifLoading ? 'Refreshing...' : 'â†» Refresh'}
          </button>
        </div>

        {notifLoading ? (
          <div className="flex items-center justify-center gap-2 text-slate-500 text-xs py-8">
            <Loader2 className="h-4 w-4 animate-spin text-brand-500" /> Loading logs...
          </div>
        ) : notifLogs.length === 0 ? (
          <p className="text-slate-500 text-xs py-8 text-center border border-slate-800/50 rounded-xl">No notification logs yet.</p>
        ) : (
          <div className="overflow-x-auto border border-slate-800/50 rounded-xl">
            <table className="min-w-full text-xs text-left divide-y divide-slate-850">
              <thead className="bg-slate-900/60 text-slate-400 font-medium">
                <tr>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Channel</th>
                  <th className="px-4 py-3 font-semibold">Patient</th>
                  <th className="px-4 py-3 font-semibold">Doctor</th>
                  <th className="px-4 py-3 font-semibold text-center">Attempts</th>
                  <th className="px-4 py-3 font-semibold">Created At</th>
                  <th className="px-4 py-3 font-semibold">Last Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {notifLogs.map(log => {
                  const statusCls = log.status === 'SENT'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : log.status === 'FAILED'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
                  return (
                    <tr key={log.id} className="hover:bg-slate-900/30 transition text-slate-300">
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${statusCls}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-brand-400">{log.type}</td>
                      <td className="px-4 py-3 font-medium text-slate-400">{log.channel}</td>
                      <td className="px-4 py-3">{log.patientName ? `${log.patientName} (${log.patientEmail || ''})` : 'â€”'}</td>
                      <td className="px-4 py-3">{log.doctorName ? `Dr. ${log.doctorName}` : 'â€”'}</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-400">{log.attempts}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono">
                        {new Date(log.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-red-400 max-w-[250px] truncate" title={log.lastError || ''}>
                        {log.lastError || 'â€”'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route
            path="/login"
            element={
              <LoginRedirect>
                <LoginPage />
              </LoginRedirect>
            }
          />
          <Route
            path="/register"
            element={
              <LoginRedirect>
                <RegisterPage />
              </LoginRedirect>
            }
          />
          <Route
            path="/patient"
            element={
              <ProtectedRoute allowedRoles={['PATIENT']}>
                <PatientDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor"
            element={
              <ProtectedRoute allowedRoles={['DOCTOR']}>
                <DoctorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          {/* Default Route redirects to Login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}


