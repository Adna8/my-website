import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

/**
 * Simple route guard that ensures the user is authenticated before accessing the page.
 * If `requireAdmin` is true, it also checks the user's email against `VITE_ADMIN_EMAILS` (comma-separated).
 * Falls back to allowing any authenticated user when the env var is not set.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAdmin = false }) => {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        setAllowed(false);
        setLoading(false);
        return;
      }

      if (!requireAdmin) {
        setAllowed(true);
        setLoading(false);
        return;
      }

      const envAdmins = (import.meta.env.VITE_ADMIN_EMAILS || "").split(",").map((e: string) => e.trim()).filter(Boolean);
      const isAdminByEnv = envAdmins.length === 0 ? true : envAdmins.includes(user.email || "");
      const isAdminByMetadata = Boolean((user.user_metadata as Record<string, unknown> | null)?.is_admin);

      setAllowed(Boolean(isAdminByEnv || isAdminByMetadata));
      setLoading(false);
    };
    checkAuth();
  }, [requireAdmin]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center text-muted-foreground">جارٍ التحقق من الصلاحيات...</div>
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;