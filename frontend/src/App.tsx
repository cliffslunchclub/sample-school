import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { ToastProvider, Spinner } from "./components/ui";
import { RequireParent, RequireAdmin } from "./components/guards";

import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import AdminLogin from "./pages/auth/AdminLogin";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";

import ParentLayout from "./components/ParentLayout";
import MyStudents from "./pages/parent/MyStudents";
import MealSelection from "./pages/parent/MealSelection";
import MyOrders from "./pages/parent/MyOrders";
import Account from "./pages/parent/Account";
import ParentMenu from "./pages/parent/Menu";

import AdminLayout from "./components/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import Orders from "./pages/admin/Orders";
import Summary from "./pages/admin/Summary";
import AdminStudents from "./pages/admin/Students";
import Parents from "./pages/admin/Parents";
import Menu from "./pages/admin/Menu";
import GradesTeachers from "./pages/admin/GradesTeachers";
import DeliveryTimes from "./pages/admin/DeliveryTimes";
import Settings from "./pages/admin/Settings";
import AuditLog from "./pages/admin/AuditLog";
import ImportData from "./pages/admin/ImportData";
import GuideParent from "./pages/admin/GuideParent";
import GuideAdmin from "./pages/admin/GuideAdmin";

import Admins from "./pages/admin/Admins";
import Labels from "./pages/admin/Labels";

import NotFound from "./pages/NotFound";

function Landing() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Loading…" />;
  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/menu"} replace />;
  return <Navigate to="/login" replace />;
}

const App = () => (
  <ToastProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* Parent area */}
          <Route
            element={
              <RequireParent>
                <ParentLayout />
              </RequireParent>
            }
          >
             <Route path="/students" element={<MyStudents />} />
             <Route path="/meals" element={<MealSelection />} />
             <Route path="/menu" element={<ParentMenu />} />
             <Route path="/orders" element={<MyOrders />} />
             <Route path="/account" element={<Account />} />
          </Route>

          {/* Admin area */}
          <Route
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/orders" element={<Orders />} />
            <Route path="/admin/summary" element={<Summary />} />
            <Route path="/admin/students" element={<AdminStudents />} />
            <Route path="/admin/admins" element={<Admins />} />
            <Route path="/admin/labels" element={<Labels />} />
            <Route path="/admin/parents" element={<Parents />} />
            <Route path="/admin/menu" element={<Menu />} />
            <Route path="/admin/grades" element={<GradesTeachers />} />
            <Route path="/admin/delivery-times" element={<DeliveryTimes />} />
             <Route path="/admin/import" element={<ImportData />} />
             <Route path="/admin/settings" element={<Settings />} />
             <Route path="/admin/audit" element={<AuditLog />} />
             <Route path="/admin/parent-audit" element={<AuditLog parent />} />
             <Route path="/admin/guide/parent" element={<GuideParent />} />
             <Route path="/admin/guide/admin" element={<GuideAdmin />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </ToastProvider>
);

export default App;
