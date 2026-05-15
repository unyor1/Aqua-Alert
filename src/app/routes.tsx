import { createBrowserRouter } from "react-router";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { History } from "./pages/History";
import { Admin } from "./pages/Admin";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import EvacFinder from "./pages/EvacFinder";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Landing /> },
      { path: "login", element: <Login /> },
      { path: "register", element: <Register /> },
      { path: "forgot-password", element: <ForgotPassword /> },
      { path: "reset-password", element: <ResetPassword /> },
      { path: "dashboard", element: <ProtectedRoute><Dashboard /></ProtectedRoute> },
      { path: "evacuation", element: <EvacFinder /> },
      { path: "history", element: <ProtectedRoute><History /></ProtectedRoute> },
      { path: "admin", element: <ProtectedRoute adminOnly><Admin /></ProtectedRoute> },
    ],
  },
]);
