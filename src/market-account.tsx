import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Page } from "./page";
import { formText, marketAction, marketClient } from "./market-foundation";

export function useMarketSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    if (!marketClient) return;
    const {
      data: { subscription },
    } = marketClient.auth.onAuthStateChange((_event, value) =>
      setSession(value),
    );
    return () => subscription.unsubscribe();
  }, []);
  return session;
}

export function useMarketMutation() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const cache = useQueryClient();
  async function run(operation: () => Promise<unknown>, success = "Saved.") {
    if (pending) return;
    setPending(true);
    setMessage("");
    setFailed(false);
    try {
      await operation();
      await cache.invalidateQueries({ queryKey: ["market"] });
      setMessage(success);
    } catch (reason) {
      setFailed(true);
      setMessage(
        reason instanceof Error
          ? reason.message
          : String(
              (reason as { message?: string })?.message ??
                "Request failed. Try again.",
            ),
      );
    } finally {
      setPending(false);
    }
  }
  return {
    run,
    pending,
    feedback: <p role={failed ? "alert" : "status"}>{message}</p>,
  };
}

export function MarketGate({
  title,
  children,
}: {
  title: string;
  children: (session: Session) => ReactNode;
}) {
  const session = useMarketSession();
  return (
    <Page title={title}>
      {!marketClient ? (
        <p>
          Connected Marketplace is unavailable. You can continue in{" "}
          <Link to="/shop">Demo Mode</Link>.
        </p>
      ) : session === undefined ? (
        <p role="status">Checking session</p>
      ) : session === null ? (
        <AccountForm />
      ) : (
        children(session)
      )}
    </Page>
  );
}

type AuthMode = "login" | "register" | "reset" | "update";
function callback(flow: string) {
  const url = new URL(window.location.pathname, window.location.origin);
  url.searchParams.set("flow", flow);
  return url.href;
}
export function AccountForm({ recovery = false }: { recovery?: boolean }) {
  const [mode, setMode] = useState<AuthMode>(recovery ? "update" : "login");
  const mutation = useMarketMutation();
  const change = (value: AuthMode) => setMode(value);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const email = formText(values, "email");
    const password = String(values.get("password") ?? "");
    void mutation.run(
      async () => {
        const auth = marketClient!.auth;
        const outcome =
          mode === "register"
            ? await auth.signUp({
                email,
                password,
                options: { emailRedirectTo: callback("verify") },
              })
            : mode === "reset"
              ? await auth.resetPasswordForEmail(email, {
                  redirectTo: callback("recovery"),
                })
              : mode === "update"
                ? await auth.updateUser({ password })
                : await auth.signInWithPassword({ email, password });
        if (outcome.error) throw outcome.error;
        if (mode === "update") {
          const url = new URL(window.location.href);
          url.searchParams.delete("flow");
          window.history.replaceState(window.history.state, "", url);
          setMode("login");
        }
      },
      mode === "register"
        ? "Check your inbox to verify your email address."
        : mode === "reset"
          ? "If an account exists, check your inbox for the recovery link."
          : mode === "update"
            ? "Password updated."
            : "Signed in.",
    );
  }
  return (
    <div className="market-stack">
      <div className="actions">
        <button className="outline" onClick={() => change("login")}>
          Sign in
        </button>
        <button className="outline" onClick={() => change("register")}>
          Create account
        </button>
        <button className="outline" onClick={() => change("reset")}>
          Reset password
        </button>
      </div>
      <form className="record form" onSubmit={submit}>
        {mode !== "update" && (
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
        )}
        {mode !== "reset" && (
          <label>
            {mode === "update" ? "New password" : "Password"}
            <input
              name="password"
              type="password"
              required
              minLength={mode === "login" ? 1 : 8}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </label>
        )}
        <button className="button" disabled={mutation.pending}>
          {mode === "register"
            ? "Send verification email"
            : mode === "reset"
              ? "Send recovery email"
              : mode === "update"
                ? "Update password"
                : "Sign in"}
        </button>
        {mutation.feedback}
      </form>
      <Link to="/shop">Continue browsing</Link>
    </div>
  );
}

function Profile({ session }: { session: Session }) {
  const mutation = useMarketMutation();
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("flow") !== "verify") return;
    url.searchParams.delete("flow");
    window.history.replaceState(window.history.state, "", url);
  }, []);
  const recovery =
    new URLSearchParams(window.location.search).get("flow") === "recovery";
  const profile = useQuery({
    queryKey: ["market", "profile", session.user.id],
    queryFn: async () => {
      const { data, error } = await marketClient!
        .from("market_profiles")
        .select("display_name")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [params] = useSearchParams();
  const invite = params.get("invite");
  return (
    <div className="market-stack">
      <p>
        {session.user.email}{" "}
        {session.user.email_confirmed_at
          ? "/ Email verified"
          : "/ Verification pending"}
      </p>
      {recovery && <AccountForm key="recovery" recovery />}
      {profile.isPending && <p role="status">Loading profile</p>}
      {profile.isError && (
        <button className="outline" onClick={() => void profile.refetch()}>
          Retry profile
        </button>
      )}
      {profile.isSuccess && (
        <form
          className="record form"
          onSubmit={(event) => {
            event.preventDefault();
            const display_name = formText(
              new FormData(event.currentTarget),
              "name",
            );
            void mutation.run(async () => {
              const { error } = await marketClient!
                .from("market_profiles")
                .upsert({ user_id: session.user.id, display_name });
              if (error) throw error;
            }, "Profile saved.");
          }}
        >
          <label>
            Display name
            <input
              name="name"
              maxLength={80}
              defaultValue={profile.data?.display_name}
              required
            />
          </label>
          <button className="button" disabled={mutation.pending}>
            Save profile
          </button>
        </form>
      )}
      {invite && (
        <button
          className="outline"
          disabled={mutation.pending}
          onClick={() =>
            void mutation.run(
              () => marketAction("accept_invite", { target: invite }),
              "Team invitation accepted.",
            )
          }
        >
          Accept team invitation
        </button>
      )}
      <div className="actions">
        <Link className="outline" to="/business/studio">
          Seller Studio
        </Link>
        <Link className="outline" to="/account/trust-center">
          Trust Center
        </Link>
        <button
          className="outline"
          disabled={mutation.pending}
          onClick={() =>
            void mutation.run(async () => {
              const { error } = await marketClient!.auth.signOut({
                scope: "local",
              });
              if (error) throw error;
            })
          }
        >
          Sign out
        </button>
      </div>
      {mutation.feedback}
    </div>
  );
}

export default function MarketAccount() {
  return (
    <MarketGate title="LOCAIZ Account">
      {(session) => <Profile key={session.user.id} session={session} />}
    </MarketGate>
  );
}
