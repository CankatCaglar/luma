"use client";

import { useMemo, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Eye, EyeOff, KeyRound, Loader2, User } from "lucide-react";
import { LumaLogo } from "@/components/layout/NeraLogo";
import { firebaseAuth, firebaseEnabled } from "@/lib/firebase/client";

function firebaseErrorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: string }).code)
    : "";
}

function hasCode(error: unknown, code: string): boolean {
  return firebaseErrorCode(error).toLowerCase().includes(code.toLowerCase());
}

function authErrorMessage(error: unknown) {
  const code = firebaseErrorCode(error);
  if (
    hasCode(error, "api-key-not-valid") ||
    hasCode(error, "invalid-api-key")
  ) {
    return "Firebase API anahtarı geçersiz görünüyor.";
  }
  switch (code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Kullanıcı adı veya şifre hatalı.";
    case "auth/email-already-in-use":
      return "Bu kullanıcı adı zaten kullanımda.";
    case "auth/weak-password":
      return "Şifre en az 6 karakter olmalıdır.";
    case "auth/invalid-email":
      return "Kullanıcı adı geçerli değil.";
    case "auth/missing-password":
      return "Lütfen şifrenizi girin.";
    case "auth/operation-not-allowed":
      return "Firebase tarafında Email/Password girişi henüz aktif değil.";
    case "auth/configuration-not-found":
      return "Firebase kimlik doğrulama ayarları tamamlanmamış görünüyor.";
    case "auth/app-not-authorized":
    case "auth/unauthorized-domain":
      return "Bu domain Firebase Authentication için yetkili değil.";
    case "auth/invalid-api-key":
      return "Firebase API anahtarı geçersiz görünüyor.";
    case "auth/user-disabled":
      return "Bu kullanıcı hesabı devre dışı bırakılmış.";
    case "auth/too-many-requests":
      return "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.";
    case "auth/popup-closed-by-user":
      return "Google giriş penceresi kapatıldı.";
    case "auth/network-request-failed":
      return "Ağ bağlantısı kurulamadı.";
    default:
      return code
        ? `İşlem tamamlanamadı (${code}).`
        : "İşlem tamamlanamadı. Lütfen tekrar deneyin.";
  }
}

function isExpectedAuthError(error: unknown) {
  const code = firebaseErrorCode(error);
  return (
    code === "auth/invalid-credential" ||
    code === "auth/user-not-found" ||
    code === "auth/wrong-password" ||
    code === "auth/invalid-email" ||
    code === "auth/missing-password" ||
    code === "auth/too-many-requests" ||
    code === "auth/user-disabled"
  );
}

function authErrorHint(error: unknown) {
  const code = firebaseErrorCode(error);
  if (hasCode(error, "api-key-not-valid") || hasCode(error, "invalid-api-key")) {
    return "`.env.local` içindeki Firebase API key değerini Firebase Console > Project settings > Your apps bölümünden tekrar kopyalayın.";
  }
  switch (code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Marka kullanıcısı admin panelden kaydedilmiş olmalı. Kullanıcı adı ve şifreyi kontrol edin.";
    case "auth/operation-not-allowed":
      return "Firebase Console > Authentication > Sign-in method bölümünde Email/Password sağlayıcısını açın.";
    case "auth/configuration-not-found":
      return "Firebase projesinde Authentication kurulumunu tamamlayın ve Email/Password girişini açın.";
    case "auth/app-not-authorized":
    case "auth/unauthorized-domain":
      return "Authentication > Settings > Authorized domains içine kullandığınız domaini (örn. localhost) ekleyin.";
    case "auth/invalid-api-key":
      return "`.env.local` içindeki `FIREBASE_API_KEY` değerini Firebase proje ayarlarından tekrar kopyalayın.";
    default:
      return isExpectedAuthError(error)
        ? null
        : "Devam ederse Firebase Console'daki Authentication ayarlarını kontrol edelim.";
  }
}

export default function GirisPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);

  const title = useMemo(() => "Giriş Yap", []);

  async function handleEmailLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Klavye açıkken iOS sayfayı kaydırıyor; giriş sonrası ana sayfanın kayık
    // açılmaması için önce odağı bırakıp klavyeyi kapatıyoruz.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    if (!firebaseAuth) return;

    setSubmitting(true);
    setError(null);
    setErrorHint(null);

    try {
      const identifier = username.trim();
      const resolved = await fetch("/api/auth/portal-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: identifier }),
      });
      const payload = (await resolved.json().catch(() => null)) as { email?: string } | null;
      const email = payload?.email?.trim() || identifier;
      await signInWithEmailAndPassword(firebaseAuth, email, password);
    } catch (error) {
      setError(authErrorMessage(error));
      setErrorHint(authErrorHint(error));
      if (!isExpectedAuthError(error)) {
        console.error("[auth] email auth failed", firebaseErrorCode(error), error);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center pb-8">
      <div className="mb-10 flex items-center justify-center">
        <LumaLogo height={56} />
      </div>

      <section className="rounded-3xl bg-white p-5 shadow-[0_16px_48px_rgba(28,25,23,0.08)] ring-1 ring-luma-border/80">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-luma-muted">
          Size verilen kullanıcı adı ve şifre ile güvenli şekilde giriş yapabilirsiniz.
        </p>

        {!firebaseEnabled ? (
          <div className="mt-4 rounded-2xl bg-luma-soft px-4 py-3 text-sm text-luma">
            Firebase henüz aktif değil. Devam etmeden önce `.env.local` içine Firebase
            değişkenlerini girin.
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          <form className="space-y-3" onSubmit={handleEmailLogin}>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">
                Kullanıcı adı
              </span>
              <span className="relative block">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-luma-muted" />
                <input
                  required
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="kullaniciadi"
                  className="w-full rounded-xl border border-luma-border bg-white py-3 pl-9 pr-3 text-base text-foreground outline-none placeholder:text-luma-muted focus:ring-2 focus:ring-luma"
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">
                Şifre
              </span>
              <span className="relative block">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-luma-muted" />
                <input
                  required
                  minLength={6}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Şifrenizi girin"
                  className="w-full rounded-xl border border-luma-border bg-white py-3 pl-9 pr-10 text-base text-foreground outline-none placeholder:text-luma-muted focus:ring-2 focus:ring-luma"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-luma transition-transform duration-150 ease-out active:scale-[0.95]"
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </span>
            </label>

            {error ? (
              <div className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-luma-red">
                <p>{error}</p>
                {errorHint ? <p className="mt-1 text-xs">{errorHint}</p> : null}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting || !firebaseEnabled}
              className="flex w-full select-none items-center justify-center gap-2 rounded-xl bg-luma py-3 text-sm font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Giriş yap
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
