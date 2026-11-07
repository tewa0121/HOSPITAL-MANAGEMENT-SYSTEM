import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import PermissionRoute from './PermissionRoute';
import DashboardLayout from '../components/layout/DashboardLayout';
import Login from '../pages/auth/Login';
import Home from '../pages/Home';
import DashboardHome from '../pages/dashboard/DashboardHome';
import PatientList from '../pages/patients/PatientList';
import PatientForm from '../pages/patients/PatientForm';
import PatientProfile from '../pages/patients/PatientProfile';
import AppointmentList from '../pages/appointments/AppointmentList';
import AppointmentForm from '../pages/appointments/AppointmentForm';
import OpdQueue from '../pages/encounters/OpdQueue';
import Consultation from '../pages/encounters/Consultation';
import LabQueue from '../pages/lab/LabQueue';
import PrescriptionQueue from '../pages/pharmacy/PrescriptionQueue';
import Dispense from '../pages/pharmacy/Dispense';
import Stock from '../pages/pharmacy/Stock';
import InvoiceList from '../pages/billing/InvoiceList';
import InvoiceDetail from '../pages/billing/InvoiceDetail';
import Receipt from '../pages/billing/Receipt';
import WardList from '../pages/wards/WardList';
import AdmissionList from '../pages/wards/AdmissionList';
import AdmissionDetail from '../pages/wards/AdmissionDetail';
import Reports from '../pages/reports/Reports';
import UserManagement from '../pages/admin/UserManagement';
import RolePermissions from '../pages/admin/RolePermissions';
import AuditLogs from '../pages/admin/AuditLogs';
import Settings from '../pages/admin/Settings';
import Account from '../pages/Account';
// step 15
import RequestList from '../pages/requests/RequestList';
import NewsAdmin from '../pages/news/NewsAdmin';
import PublicNews from '../pages/public/PublicNews';
import TrackRequest from '../pages/public/TrackRequest';
import AboutPage from '../pages/public/AboutPage';
import ComingSoon from '../pages/ComingSoon';
import Unauthorized from '../pages/Unauthorized';
import NotFound from '../pages/NotFound';
import { NAV_ITEMS } from '../utils/navigation';
import { useAuth } from '../hooks/useAuth';

// One real page per sidebar item (the routes are generated from NAV_ITEMS below).
const PAGES = {
  dashboard: <DashboardHome />,
  patients: <PatientList />,
  appointments: <AppointmentList />,
  requests: <RequestList />,
  opd: <OpdQueue />,
  lab: <LabQueue />,
  pharmacy: <PrescriptionQueue />,
  stock: <Stock />,
  billing: <InvoiceList />,
  wards: <WardList />,
  admissions: <AdmissionList />,
  reports: <Reports />,
  users: <UserManagement />,
  roles: <RolePermissions />,
  audit: <AuditLogs />,
  settings: <Settings />,
  news: <NewsAdmin />,
};

export default function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* public website: anyone can open these */}
      <Route path="/" element={<Home />} />
      <Route path="/home" element={<Home />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/news" element={<PublicNews />} />
      <Route path="/news/:id" element={<PublicNews />} />
      <Route path="/portal" element={<TrackRequest />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />

      {/* staff area (login required) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          {NAV_ITEMS.map((item) => (
            <Route
              key={item.key}
              path={item.path}
              element={
                <PermissionRoute permission={item.permission}>
                  {PAGES[item.key] || <ComingSoon name={item.key} />}
                </PermissionRoute>
              }
            />
          ))}

          <Route path="/patients/new" element={<PermissionRoute permission="patients.create"><PatientForm /></PermissionRoute>} />
          <Route path="/patients/:id" element={<PermissionRoute permission="patients.read"><PatientProfile /></PermissionRoute>} />
          <Route path="/patients/:id/edit" element={<PermissionRoute permission="patients.update"><PatientForm /></PermissionRoute>} />
          <Route path="/appointments/new" element={<PermissionRoute permission="appointments.create"><AppointmentForm /></PermissionRoute>} />
          <Route path="/opd/:id" element={<PermissionRoute permission="encounters.read"><Consultation /></PermissionRoute>} />
          <Route path="/pharmacy/:id" element={<PermissionRoute permission="prescriptions.read"><Dispense /></PermissionRoute>} />
          <Route path="/billing/:id" element={<PermissionRoute permission="billing.invoice_read"><InvoiceDetail /></PermissionRoute>} />
          <Route path="/billing/:id/receipt/:paymentId" element={<PermissionRoute permission="billing.invoice_read"><Receipt /></PermissionRoute>} />
          <Route path="/admissions/:id" element={<PermissionRoute permission="admissions.read"><AdmissionDetail /></PermissionRoute>} />

          <Route path="/account" element={<Account />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
