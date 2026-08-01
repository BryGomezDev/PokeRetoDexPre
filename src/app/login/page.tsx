"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PokeballLogo } from "@/components/PokeballLogo";
import { useLanguage } from "@/context/LanguageContext";
import { LangToggle } from "@/components/LangToggle";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function getLoginError(code: string): string {
    switch (code) {
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
      case "auth/invalid-email":
        return t("login.errorInvalid");
      default:
        return t("login.errorGeneric");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError(t("login.errorEmptyUsername"));
      return;
    }
    if (!password) {
      setError(t("login.errorEmptyPassword"));
      return;
    }

    setIsLoading(true);
    try {
      const usernameLower = username.trim().toLowerCase();
      const email = `${usernameLower}@pokeretodex.firebaseapp.com`;
      await signInWithEmailAndPassword(auth, email, password);
      // Set session cookie for middleware (30 days)
      document.cookie = "session=1; path=/; max-age=2592000; SameSite=Lax; Secure";
      router.push("/pokedex");
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? (err as { code: string }).code
          : "";
      setError(getLoginError(code));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      {/* Mobile: full width; Desktop: fixed-width card */}
      <div className="w-full max-w-[440px]">
        <Card className="bg-gray-900 border-gray-800 shadow-2xl">
          <CardHeader className="pb-2 pt-8 px-8">
            <PokeballLogo />
          </CardHeader>

          <CardContent className="px-8 pb-8">
            <div className="flex justify-end mb-4">
              <LangToggle />
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Username field */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="username"
                  className="text-gray-300 text-sm font-medium"
                >
                  {t("login.username")}
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder={t("login.usernamePlaceholder")}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-red-500 focus:ring-red-500/20 h-11"
                  aria-describedby={error ? "login-error" : undefined}
                />
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="password"
                  className="text-gray-300 text-sm font-medium"
                >
                  {t("login.password")}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("login.passwordPlaceholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-red-500 focus:ring-red-500/20 h-11 pr-12"
                    aria-describedby={error ? "login-error" : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                    aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                  >
                    {showPassword ? (
                      // Eye-off icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      // Eye icon
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <p
                  id="login-error"
                  role="alert"
                  className="text-red-400 text-sm bg-red-950/40 border border-red-800/50 rounded-md px-3 py-2"
                >
                  {error}
                </p>
              )}

              {/* Submit button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-semibold text-base transition-colors disabled:opacity-60"
              >
                {isLoading ? t("login.submitting") : t("login.submit")}
              </Button>
            </form>

            {/* Sign up link */}
            <p className="text-center text-sm text-gray-400 mt-6">
              {t("login.noAccount")}{" "}
              <Link
                href="/registro"
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors underline-offset-2 hover:underline"
              >
                {t("login.signUp")}
              </Link>
            </p>

            {/* Legal footer */}
            <p className="text-center mt-4">
              <Link
                href="/legal"
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                {t("common.legalLink")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
