import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/** Every account is exactly one type, chosen at sign-up and stored by the
 *  database where the user can't change it (see the enforce_account_type
 *  migration). Operator sign-ups pass "operator", Customer sign-ups "customer". */
export type AccountType = "operator" | "customer";

/** Shown when an account of the wrong type tries to use an app. */
export const WRONG_APP_MESSAGE = "This account can't be used in this app.";

/** The signed-in account's type, read fresh from the server (a stored sign-in
 *  token can predate the type being set), or null if unknown/signed out. */
export async function getAccountType(): Promise<AccountType | null> {
  const { data } = await supabase.auth.getUser();
  const t = data.user?.app_metadata?.account_type;
  return t === "operator" || t === "customer" ? t : null;
}

/** Carries a sign-out reason to the login page the visitor lands on. */
const AUTH_MESSAGE_KEY = "solo.authMessage";
export function setAuthMessage(message: string) {
  try { sessionStorage.setItem(AUTH_MESSAGE_KEY, message); } catch {}
}
export function takeAuthMessage(): string | null {
  try {
    const m = sessionStorage.getItem(AUTH_MESSAGE_KEY);
    sessionStorage.removeItem(AUTH_MESSAGE_KEY);
    return m;
  } catch {
    return null;
  }
}

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, accountType: AccountType) => ReturnType<typeof supabase.auth.signUp>;
  signIn: (email: string, password: string) => ReturnType<typeof supabase.auth.signInWithPassword>;
  signOut: () => ReturnType<typeof supabase.auth.signOut>;
};

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signUp: (email, password, accountType) =>
          supabase.auth.signUp({ email, password, options: { data: { account_type: accountType } } }),
        signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
        signOut: () => supabase.auth.signOut(),
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
