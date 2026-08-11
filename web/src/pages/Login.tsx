import { type SyntheticEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/api";

interface LoginProps {
  readonly onLoggedIn: () => void;
}

export function Login({ onLoggedIn }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      await login(email, password);
      onLoggedIn();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        className="w-full max-w-sm border border-line bg-panel p-8"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-brass">
          tcu-relay
        </p>
        <h1 className="mt-2 text-2xl font-medium text-paper">LiveWire link</h1>
        <p className="mt-2 mb-8 text-sm text-mute">
          Sign in with the same c.technology email and password stored on the
          relay.
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              required
            />
          </div>
        </div>
        {error !== undefined ? (
          <p className="mt-4 font-mono text-sm text-alert">{error}</p>
        ) : null}
        <Button type="submit" className="mt-8 w-full" disabled={pending}>
          {pending ? "Checking…" : "Open dashboard"}
        </Button>
      </form>
    </main>
  );
}
