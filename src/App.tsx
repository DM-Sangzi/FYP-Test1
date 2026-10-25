import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SessionGuard } from './components/SessionGuard';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Chat } from './pages/Chat';
import { Profile } from './pages/Profile';
import { CryptoDiagnostics } from './pages/CryptoDiagnostics';

/**
 * Top-level app shell.
 *
 * Providers wrap the router so auth + theme state are available everywhere.
 * Routes map 1:1 to PRD §5.1. Protected routes (`/chat`, `/profile`) are
 * wrapped in <SessionGuard>, which bounces unauthenticated users to /login.
 */
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/chat"
              element={
                <SessionGuard>
                  <Chat />
                </SessionGuard>
              }
            />
            <Route
              path="/profile"
              element={
                <SessionGuard>
                  <Profile />
                </SessionGuard>
              }
            />
            {/* Stage 1 開發診斷頁：免登入，但測試功能需以
                python -m pqpm_client --diagnostics 啟動的桌面視窗開啟
                （?diagnostics=1 只是 UI 標記，bridge 由 Python 端控制）。 */}
            <Route path="/dev/crypto" element={<CryptoDiagnostics />} />
            {/* Any unknown route falls back to the landing page. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
