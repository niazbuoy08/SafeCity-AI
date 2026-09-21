import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { Sidebar } from "./components/Sidebar";
import { IncidentAlertToast } from "./components/IncidentAlertToast";

import LoginPage from "./pages/LoginPage";
import DashboardHome from "./pages/DashboardHome";
import LiveCameras from "./pages/LiveCameras";
import CameraDetail from "./pages/CameraDetail";
import Incidents from "./pages/Incidents";
import IncidentDetail from "./pages/IncidentDetail";
import MapPage from "./pages/MapPage";
import ResponseTeamsPage from "./pages/ResponseTeamsPage";
import Analytics from "./pages/Analytics";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0">{children}</main>
      <IncidentAlertToast />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedLayout><DashboardHome /></ProtectedLayout>} />
            <Route path="/cameras" element={<ProtectedLayout><LiveCameras /></ProtectedLayout>} />
            <Route path="/cameras/:cameraId" element={<ProtectedLayout><CameraDetail /></ProtectedLayout>} />
            <Route path="/incidents" element={<ProtectedLayout><Incidents /></ProtectedLayout>} />
            <Route path="/incidents/:incidentId" element={<ProtectedLayout><IncidentDetail /></ProtectedLayout>} />
            <Route path="/map" element={<ProtectedLayout><MapPage /></ProtectedLayout>} />
            <Route path="/responses" element={<ProtectedLayout><ResponseTeamsPage /></ProtectedLayout>} />
            <Route path="/analytics" element={<ProtectedLayout><Analytics /></ProtectedLayout>} />
            <Route path="/reports" element={<ProtectedLayout><Reports /></ProtectedLayout>} />
            <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}
