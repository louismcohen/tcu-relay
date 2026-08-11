import { useCallback, useEffect, useState } from "react";
import { fetchMe } from "@/lib/api";
import { Dashboard } from "@/pages/Dashboard";
import { Login } from "@/pages/Login";

export function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  const refresh = useCallback(() => {
    void fetchMe().then((ok) => {
      setAuthed(ok);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!ready) {
    return (
      <p className="p-8 font-mono text-sm text-mute">Checking session…</p>
    );
  }

  if (!authed) {
    return (
      <Login
        onLoggedIn={() => {
          setAuthed(true);
        }}
      />
    );
  }

  return (
    <Dashboard
      onLoggedOut={() => {
        setAuthed(false);
      }}
    />
  );
}
