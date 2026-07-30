// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks'
import Sprint from './pages/Sprint';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';


// Placeholder pages (we'll build these next)
// const Tasks     = () => <div className="text-gray-500">Tasks page coming soon...</div>;
// const Sprint    = () => <div className="text-gray-500">Sprint page coming soon...</div>;
// const Analytics = () => <div className="text-gray-500">Analytics page coming soon...</div>;
// const Settings  = () => <div className="text-gray-500">Settings page coming soon...</div>;

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tasks"     element={<Tasks />} />
          <Route path="/sprint"    element={<Sprint />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings"  element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

export default App;