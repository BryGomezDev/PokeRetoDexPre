"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createUserWithEmailAndPassword, AuthError } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PokeballLogo } from "@/components/PokeballLogo";
import { AVATAR_SLUGS, formatAvatarName } from "@/lib/avatars";
import { useLanguage } from "@/context/LanguageContext";
import { LangToggle } from "@/components/LangToggle";

const USERNAME_REGEX = /^[a-zA-Z0-9]+$/;

export default function RegistroPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [avatarData, setAvatarData] = useState<
    Record<string, { name: string; sprite_url: string }>
  >({});

  // Validation functions defined inside component to access t()
  function validateUsername(value: string): string | null {
    if (value.length < 3) return t("registro.errorUsernameShort");
    if (value.length > 20) return t("registro.errorUsernameLong");
    if (!USERNAME_REGEX.test(value)) return t("registro.errorUsernameChars");
    return null;
  }

  function getRegisterError(code: string): string {
    switch (code) {
      case "auth/email-already-in-use":
        return t("registro.errorUserTaken");
      case "auth/weak-password":
        return t("registro.errorPasswordShort");
      default:
        return t("registro.errorGeneric");
    }
  }

  // Fetch sprite URLs and names for all avatar options from Firestore /pokemon
  useEffect(() => {
    async function fetchAvatarSprites() {
      const snaps = await Promise.all(
        AVATAR_SLUGS.map((slug) => getDoc(doc(db, "pokemon", slug)))
      );
      const data: Record<string, { name: string; sprite_url: string }> = {};
      for (const snap of snaps) {
        if (snap.exists()) {
          data[snap.id] = {
            name: snap.data().name ?? snap.id,
            sprite_url: snap.data().sprite_url ?? "",
          };
        }
      }
      setAvatarData(data);
    }
    fetchAvatarSprites();
  }, []);

  function handleUsernameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setUsername(value);
    if (value.length > 0) setUsernameError(validateUsername(value));
    else setUsernameError(null);
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setPassword(value);
    if (value.length > 0 && value.length < 6)
      setPasswordError(t("registro.errorPasswordShort"));
    else setPasswordError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const usernameValidation = validateUsername(username);
    if (usernameValidation) { setUsernameError(usernameValidation); return; }
    if (password.length < 6) { setPasswordError(t("registro.errorPasswordShort")); return; }
    if (!selectedAvatar) { setFormError(t("registro.errorNoAvatar")); return; }

    setIsLoading(true);

    let uid: string;
    try {
      const usernameLower = username.trim().toLowerCase();
      const email = `${usernameLower}@${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}`;
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      uid = credential.user.uid;
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err ? (err as AuthError).code : "";
      setFormError(getRegisterError(code));
      setIsLoading(false);
      return;
    }

    try {
      await setDoc(doc(db, "users", uid), {
        username: username.trim(),
        created_at: serverTimestamp(),
        avatar_pokemon_slug: selectedAvatar,
      });
    } catch (err) {
      console.error("[registro] Error al crear documento de usuario:", err);
    }

    document.cookie = "session=1; path=/; max-age=2592000; SameSite=Lax; Secure";
    router.push("/pokedex");
  }

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4 py-8">
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
              {/* Username */}
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-gray-300 text-sm font-medium">
                  {t("registro.username")}
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder={t("registro.usernamePlaceholder")}
                  value={username}
                  onChange={handleUsernameChange}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={20}
                  aria-invalid={!!usernameError}
                  aria-describedby={usernameError ? "username-error" : undefined}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-red-500 focus:ring-red-500/20 h-11 aria-[invalid=true]:border-red-500"
                />
                {usernameError && (
                  <p id="username-error" role="alert" className="text-red-400 text-xs mt-1">
                    {usernameError}
                  </p>
                )}
                <p className="text-gray-500 text-xs">{t("registro.usernameHint")}</p>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-gray-300 text-sm font-medium">
                  {t("registro.password")}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("registro.passwordPlaceholder")}
                    value={password}
                    onChange={handlePasswordChange}
                    autoComplete="new-password"
                    aria-invalid={!!passwordError}
                    aria-describedby={passwordError ? "password-error" : undefined}
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-red-500 focus:ring-red-500/20 h-11 pr-12 aria-[invalid=true]:border-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                    aria-label={showPassword ? t("registro.hidePassword") : t("registro.showPassword")}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {passwordError && (
                  <p id="password-error" role="alert" className="text-red-400 text-xs mt-1">
                    {passwordError}
                  </p>
                )}
              </div>

              {/* Avatar selector — 4 cols mobile, 5 cols sm+ */}
              <div className="space-y-3">
                <div>
                  <p className="text-gray-300 text-sm font-medium">{t("registro.avatarTitle")}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {t("registro.avatarHint")}
                  </p>
                </div>
                <div
                  className="grid grid-cols-4 sm:grid-cols-5 gap-2"
                  role="radiogroup"
                  aria-label={t("registro.avatarTitle")}
                >
                  {AVATAR_SLUGS.map((slug) => {
                    const data = avatarData[slug];
                    const isSelected = selectedAvatar === slug;
                    return (
                      <button
                        key={slug}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={data?.name ? formatAvatarName(data.name) : slug}
                        onClick={() => setSelectedAvatar(slug)}
                        className={[
                          "flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-150",
                          "bg-gray-800/60 hover:bg-gray-700/80 border-2",
                          isSelected
                            ? "border-yellow-400 ring-2 ring-yellow-400/30 scale-110 bg-gray-700"
                            : "border-transparent hover:border-gray-600",
                        ].join(" ")}
                      >
                        <div className="relative w-12 h-12">
                          {data?.sprite_url ? (
                            <Image
                              src={data.sprite_url}
                              alt={data.name ?? slug}
                              fill
                              sizes="48px"
                              className="object-contain drop-shadow-sm"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full rounded-full bg-gray-700 animate-pulse" />
                          )}
                        </div>
                        <span className="text-gray-400 text-[9px] leading-tight text-center truncate w-full">
                          {data?.name ? formatAvatarName(data.name) : slug}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Form-level error */}
              {formError && (
                <p
                  role="alert"
                  className="text-red-400 text-sm bg-red-950/40 border border-red-800/50 rounded-md px-3 py-2"
                >
                  {formError}
                </p>
              )}

              {/* Submit */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-semibold text-base transition-colors disabled:opacity-60 mt-2"
              >
                {isLoading ? t("registro.submitting") : t("registro.submit")}
              </Button>
            </form>

            <p className="text-center text-sm text-gray-400 mt-6">
              {t("registro.hasAccount")}{" "}
              <Link
                href="/login"
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors underline-offset-2 hover:underline"
              >
                {t("registro.signIn")}
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
