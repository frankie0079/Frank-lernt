"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export interface Member {
  id: string;
  name: string | null;
  role: "organizer" | "admin" | "member";
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  member: Member | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshMember: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  member: null,
  loading: true,
  signOut: async () => {},
  refreshMember: async () => {},
});

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMember = useCallback(async () => {
    try {
      const res = await fetch("/api/members/me");
      if (res.ok) {
        const data = await res.json();
        setMember(data.member);
      } else {
        setMember(null);
      }
    } catch {
      setMember(null);
    }
  }, []);

  const refreshMember = useCallback(async () => {
    await fetchMember();
  }, [fetchMember]);

  const signOut = useCallback(async () => {
    await fetch("/api/members/me", { method: "DELETE" });
    setMember(null);
    window.location.href = "/login";
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchMember();
      setLoading(false);
    };
    init();
  }, [fetchMember]);

  return (
    <AuthContext.Provider value={{ member, loading, signOut, refreshMember }}>
      {children}
    </AuthContext.Provider>
  );
}
