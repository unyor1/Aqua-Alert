import { Outlet, Link, useNavigate, useLocation } from "react-router";
import { Droplets, LogOut, BarChart3, Activity, ShieldCheck, Menu, X, MapPin } from "lucide-react";
import { Button } from "./ui/button";
import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase/client";

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const isAuthPage = ["/login", "/register", "/forgot-password", "/reset-password"].includes(location.pathname);

  const loadProfile = async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) {
      setIsLoggedIn(false);
      setIsAdmin(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      console.warn("Unable to load user profile:", profileError);
      setIsLoggedIn(false);
      setIsAdmin(false);
      return;
    }

    // Allow any registered profile to be considered logged in; only track admin role
    setIsLoggedIn(true);
    setIsAdmin(profile.role === "admin");
  };

  useEffect(() => {
    let isMounted = true;
    if (isMounted) void loadProfile();

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      void loadProfile();
    });

    return () => {
      isMounted = false;
      try {
        subscription.subscription.unsubscribe();
      } catch {}
    };
  }, [location]);

  const handleLogout = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error && !String(error.message || error).includes("Auth session missing")) {
          console.error("Sign out error:", error.message || error);
        }
      } else {
        console.debug("No active Supabase session to sign out.");
      }
    } catch (err) {
      console.error("Sign out exception:", err);
    } finally {
      setIsLoggedIn(false);
      setIsAdmin(false);
      setIsSidebarOpen(false);
      try { localStorage.removeItem('floodUser'); } catch {}
      navigate("/?loggedOut=1", { replace: true });
    }
  };

  // close on escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (prefix: string) => location.pathname.startsWith(prefix);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <Droplets className="w-8 h-8" />
              <div>
                <h1 className="text-xl font-bold">Aqua-Alert</h1>
                <p className="text-xs text-blue-100">Real-time Flood Monitoring</p>
              </div>
            </Link>

            {/* Desktop nav */}
            {!isAuthPage && (
              <nav className="hidden md:flex items-center gap-4">
                {isLoggedIn ? (
                  <>
                    <Link to="/dashboard">
                      <Button variant="ghost" className="text-white hover:bg-blue-700">
                        <Activity className="w-4 h-4 mr-2" />
                        Dashboard
                      </Button>
                    </Link>
                    <Link to="/history">
                      <Button variant="ghost" className="text-white hover:bg-blue-700">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        History
                      </Button>
                    </Link>
                    
                    {!isAdmin && (
                      <Link to="/evacuation">
                        <Button variant="ghost" className="text-white hover:bg-blue-700">
                          <MapPin className="w-4 h-4 mr-2" />
                          Evacuation
                        </Button>
                      </Link>
                    )}
                    {isAdmin && (
                      <Link to="/admin">
                        <Button variant="ghost" className="text-white hover:bg-blue-700">
                          <ShieldCheck className="w-4 h-4 mr-2" />
                          Admin
                        </Button>
                      </Link>
                    )}
                    <Button
                      variant="ghost"
                      className="text-white hover:bg-blue-700"
                      onClick={handleLogout}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </Button>
                  </>
                ) : (
                  <>
                    <Link to="/login">
                      <Button variant="ghost" className="text-white hover:bg-blue-700">
                        Login
                      </Button>
                    </Link>
                   
                    <Link to="/register">
                      <Button className="bg-white text-blue-600 hover:bg-blue-50">Register</Button>
                    </Link>
                  </>
                )}
              </nav>
            )}

            {/* Mobile hamburger */}
            {!isAuthPage && (
              <div className="md:hidden">
                <button
                  aria-label="Open menu"
                  onClick={() => setIsSidebarOpen(true)}
                  className="inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-blue-700"
                >
                  <Menu className="w-6 h-6" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity ${isSidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar (mobile) */}
      <aside
        className={`fixed top-0 right-0 h-full z-50 w-4/5 max-w-sm bg-gradient-to-br from-sky-50/90 to-white/95 backdrop-blur-sm shadow-xl transform transition-transform duration-300 border-l-4 border-sky-600 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Droplets className="w-6 h-6 text-sky-700" />
            <div className="text-lg font-semibold text-sky-900">Aqua-Alert</div>
          </div>
          <button aria-label="Close menu" onClick={() => setIsSidebarOpen(false)} className="p-2 rounded-md hover:bg-gray-100">
            <X className="w-5 h-5 text-sky-700" />
          </button>
        </div>

        <nav className="flex flex-col p-4 gap-3">
          {isLoggedIn ? (
            <>
              <Link to="/dashboard" onClick={() => setIsSidebarOpen(false)}>
                <Button
                  variant="ghost"
                  className={`w-full text-left transition-all px-3 py-2 flex items-center gap-3 rounded-md ${isActive('/dashboard') ? 'bg-sky-100 text-sky-900 shadow-sm ring-1 ring-sky-200' : 'text-slate-700 hover:bg-white/60'}`}
                >
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-md ${isActive('/dashboard') ? 'bg-sky-200 text-sky-700' : 'bg-white text-slate-400'}`}>
                    <Activity className="w-4 h-4" />
                  </span>
                  <span className="flex-1">Dashboard</span>
                </Button>
              </Link>

              <Link to="/history" onClick={() => setIsSidebarOpen(false)}>
                <Button
                  variant="ghost"
                  className={`w-full text-left transition-all px-3 py-2 flex items-center gap-3 rounded-md ${isActive('/history') ? 'bg-sky-100 text-sky-900 shadow-sm ring-1 ring-sky-200' : 'text-slate-700 hover:bg-white/60'}`}
                >
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-md ${isActive('/history') ? 'bg-sky-200 text-sky-700' : 'bg-white text-slate-400'}`}>
                    <BarChart3 className="w-4 h-4" />
                  </span>
                  <span className="flex-1">History</span>
                </Button>
              </Link>
              {!isAdmin && (
                <Link to="/evacuation" onClick={() => setIsSidebarOpen(false)}>
                  <Button
                    variant="ghost"
                    className={`w-full text-left transition-all px-3 py-2 flex items-center gap-3 rounded-md ${isActive('/evacuation') ? 'bg-sky-100 text-sky-900 shadow-sm ring-1 ring-sky-200' : 'text-slate-700 hover:bg-white/60'}`}
                  >
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-md ${isActive('/evacuation') ? 'bg-sky-200 text-sky-700' : 'bg-white text-slate-400'}`}>
                      <MapPin className="w-4 h-4" />
                    </span>
                    <span className="flex-1">Evacuation</span>
                  </Button>
                </Link>
              )}

              {isAdmin && (
                <Link to="/admin" onClick={() => setIsSidebarOpen(false)}>
                  <Button
                    variant="ghost"
                    className={`w-full text-left transition-all px-3 py-2 flex items-center gap-3 rounded-md ${isActive('/admin') ? 'bg-sky-100 text-sky-900 shadow-sm ring-1 ring-sky-200' : 'text-slate-700 hover:bg-white/60'}`}
                  >
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-md ${isActive('/admin') ? 'bg-sky-200 text-sky-700' : 'bg-white text-slate-400'}`}>
                      <ShieldCheck className="w-4 h-4" />
                    </span>
                    <span className="flex-1">Admin</span>
                  </Button>
                </Link>
              )}

              <Button
                variant="ghost"
                className="w-full text-left transition-all px-3 py-2 flex items-center gap-3 rounded-md text-slate-700 hover:bg-white/60"
                onClick={() => { setIsSidebarOpen(false); handleLogout(); }}
              >
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-white text-slate-400">
                  <LogOut className="w-4 h-4" />
                </span>
                <span className="flex-1">Logout</span>
              </Button>
            </>
          ) : !isAuthPage && (
            <>
              <Link to="/login" onClick={() => setIsSidebarOpen(false)}>
                <Button variant="ghost" className={`w-full text-left transition-all px-3 py-2 rounded-md ${isActive('/login') ? 'bg-sky-100 text-sky-900 shadow-sm ring-1 ring-sky-200' : 'text-slate-700 hover:bg-white/60'}`}>Login</Button>
              </Link>
              <Link to="/register" onClick={() => setIsSidebarOpen(false)}>
                <Button className="w-full bg-gradient-to-r from-sky-600 to-blue-600 text-white hover:from-sky-700 hover:to-blue-700">Register</Button>
              </Link>
            
            </>
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-6 mt-auto">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-gray-400">© 2026 Aqua-Alert. Real-time flood alert and monitoring system.</p>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
