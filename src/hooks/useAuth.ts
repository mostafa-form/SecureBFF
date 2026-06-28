import { useAuthContext } from '@/context/AuthContext';

export function useAuth() {
  const { user, isLoading, login, logout } = useAuthContext();

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin:         !!user?.is_admin,
    isApproved:      !!user?.is_approved || !!user?.is_admin,
    login,
    logout,
  };
}
