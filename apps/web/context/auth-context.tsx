"use client";

import { createContext, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMeApi, logoutApi } from "@/lib/api/auth";
import type { Session } from "@/types/auth";
import { useRouter } from "next/navigation";

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  setSession: (session: Session) => void;
  refresh: () => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await getMeApi()).data,
    retry: false,
    staleTime: Infinity,
  });

  const setSession = (session: Session) => {
    queryClient.setQueryData(["me"], session);
  };

  // Call after editing profile (day 13) so the header updates.
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["me"] });
  };

  const logout = async () => {
    try {
      await logoutApi();
    } finally {
      queryClient.clear();
      router.replace("/login");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session: data ?? null,
        loading: isLoading,
        setSession,
        refresh,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
