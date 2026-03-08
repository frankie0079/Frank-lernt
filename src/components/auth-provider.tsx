"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface Member {
  id: string;
  name: string | null;
  token: string;
  role: "organizer" | "admin" | "member";
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  member: Member | null;
  loading: boolean;
  signOut: () => void;
  refreshMember: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  member: null,
  loading: true,
  signOut: () => {},
  refreshMember: async () => {},
});

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

function getMemberToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)member_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function clearMemberToken() {
  document.cookie = "member_token=; path=/; max-age=0";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createSupabaseBrowserClient();

  const fetchMember = useCallback(
    async (token: string) => {
      const { data } = await supabase
        .from("members")
        .select("*")
        .eq("token", token)
        .single();

      setMember(data);
      return data;
    },
    [supabase]
  );

  const refreshMember = useCallback(async () => {
    const token = getMemberToken();
    if (token) {
      await fetchMember(token);
    }
  }, [fetchMember]);

  const signOut = useCallback(() => {
    clearMemberToken();
    setMember(null);
    window.location.href = "/login";
  }, []);

  useEffect(() => {
    const init = async () => {
      const token = getMemberToken();
      if (token) {
        await fetchMember(token);
      }
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
