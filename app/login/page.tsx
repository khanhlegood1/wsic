"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import AnonymousHelpDialog from "@/components/auth/AnonymousHelpDialog";
import { loginStrings, type LoginLang } from "@/components/auth/loginStrings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn, signUp, useSession } from "@/lib/auth-client";
import { APP_NAME, APP_SHORT_NAME, CALLBACK_URL } from "@/constants/common";

type Mode = "login" | "register";

const LoginPage = () => {
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<Mode>("login");
    const [lang, setLang] = useState<LoginLang>("vi");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [showHelp, setShowHelp] = useState(false);
    const [mounted, setMounted] = useState(false);
    const router = useRouter();
    const { data: session } = useSession();
    const params = useSearchParams();
    const { resolvedTheme, setTheme } = useTheme();
    const t = loginStrings[lang];
    const gradientTextClass = "text-transparent bg-clip-text bg-gradient-to-br from-teal-600 to-teal-400";

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (session) {
            router.replace(params.get("redirect_url") ?? CALLBACK_URL);
        }
    }, [session, params, router]);

    const run = async (fn: () => Promise<{ error?: { message?: string } | null } | void>) => {
        setError(null);
        setLoading(true);
        try {
            const result = await fn();
            if (result && result.error) {
                throw new Error(result.error.message || t.genericError);
            }
            // On success the session effect above redirects.
        } catch (e) {
            console.error("Auth error:", e);
            setError(e instanceof Error && e.message ? e.message : t.genericError);
        } finally {
            setLoading(false);
        }
    };

    const handleAnonymous = () => run(() => signIn.anonymous());

    const handleEmail = () => {
        if (!email.trim() || !password) {
            setError(t.emailRequired);
            return;
        }
        if (mode === "register" && password.length < 8) {
            setError(t.passwordTooShort);
            return;
        }
        return run(() =>
            mode === "register"
                ? signUp.email({
                      email: email.trim(),
                      password,
                      name: name.trim() || email.trim().split("@")[0],
                  })
                : signIn.email({ email: email.trim(), password })
        );
    };

    const isDark = mounted && resolvedTheme === "dark";
    const labelClass = "mb-1.5 block text-xs font-semibold text-muted-foreground";
    const toolbarBtn =
        "rounded-lg border bg-background px-3 py-1.5 text-sm font-semibold hover:border-teal-500 transition-colors cursor-pointer";

    return (
        <div className="relative flex flex-1 items-center justify-center min-h-[calc(100dvh-5rem)] py-12 px-2">
            {/* Soft teal glow behind the card */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(20,184,166,0.14)_0%,transparent_60%)]"
            />

            {/* Language + theme toggles */}
            <div className="absolute right-3 top-3 flex items-center gap-2">
                <button
                    type="button"
                    className={toolbarBtn}
                    onClick={() => setLang((l) => (l === "vi" ? "en" : "vi"))}
                >
                    {lang === "vi" ? "🇻🇳 VI" : "🇬🇧 EN"}
                </button>
                <button
                    type="button"
                    className={toolbarBtn}
                    aria-label="Toggle theme"
                    onClick={() => setTheme(isDark ? "light" : "dark")}
                >
                    {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                </button>
            </div>

            <div className="w-full max-w-105 rounded-2xl border bg-card text-card-foreground shadow-xl p-6 sm:p-9">
                {/* Brand */}
                <div className="flex items-center justify-center gap-3 mb-7">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-linear-to-br from-teal-500 to-teal-700 font-mono text-sm font-extrabold text-white">
                        {APP_SHORT_NAME.slice(0, 2)}
                    </div>
                    <div className="leading-tight">
                        <div className="font-mono text-sm font-extrabold tracking-widest text-teal-500">
                            {APP_SHORT_NAME}
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            {APP_NAME}
                        </div>
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-center text-2xl font-extrabold">
                    {mode === "login" ? t.login : t.register}
                </h1>
                <p className="mt-1 mb-7 text-center text-sm text-muted-foreground">
                    {t.welcome} <span className={gradientTextClass}>{APP_NAME}</span>
                    <br />
                    {t.tagline}
                </p>

                {/* Start anonymously */}
                <button
                    type="button"
                    onClick={handleAnonymous}
                    disabled={loading}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-linear-to-br from-emerald-700 via-emerald-600 to-teal-500 px-4 py-3.5 text-[15px] font-extrabold text-white shadow-[0_4px_20px_rgba(20,184,166,0.3)] transition-opacity disabled:opacity-70"
                >
                    🌿 {t.startAnonymous}
                </button>
                <div className="mt-1.5 mb-4 flex flex-wrap items-center justify-center gap-2.5">
                    <span className="text-[11px] text-muted-foreground">{t.anonymousNote}</span>
                    <button
                        type="button"
                        onClick={() => setShowHelp(true)}
                        aria-label={t.helpAria}
                        className="inline-flex size-6.5 shrink-0 cursor-pointer items-center justify-center rounded-full border border-teal-500/50 bg-teal-500/10 text-[13px] font-black text-teal-600 transition-colors hover:bg-teal-500/20 dark:text-teal-300"
                    >
                        ?
                    </button>
                </div>

                <Divider label={t.or} />

                {/* Google */}
                <GoogleSignInButton
                    onSignIn={() => setError(null)}
                    onError={setError}
                    disabled={loading}
                    label={t.continueGoogle}
                    loadingLabel={t.signingGoogle}
                />

                <Divider label={t.orEmail} />

                {/* Email / password */}
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleEmail();
                    }}
                    className="space-y-3"
                >
                    {mode === "register" && (
                        <div>
                            <label className={labelClass} htmlFor="login-name">{t.name}</label>
                            <Input id="login-name" autoComplete="name" placeholder="Nguyễn Văn A" value={name} onChange={(e) => setName(e.target.value)} />
                        </div>
                    )}
                    <div>
                        <label className={labelClass} htmlFor="login-email">{t.email}</label>
                        <Input id="login-email" type="email" autoComplete="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass} htmlFor="login-password">{t.password}</label>
                        <Input id="login-password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>

                    {error && (
                        <div
                            className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 py-2 pl-4 pr-2 text-destructive dark:border-red-900/50 dark:bg-red-950/40"
                            role="alert"
                        >
                            <span className="text-sm/relaxed">{error}</span>
                            <Button
                                type="button"
                                onClick={() => setError(null)}
                                variant="destructive"
                                size="icon"
                                aria-label={t.dismiss}
                                className="bg-inherit text-destructive shadow-none hover:text-white"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </Button>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full cursor-pointer rounded-xl bg-linear-to-br from-teal-500 to-teal-700 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-70"
                    >
                        {loading ? "..." : mode === "login" ? t.login : t.register}
                    </button>
                </form>

                <div className="mt-5 text-center text-[13px] text-muted-foreground">
                    {mode === "login" ? t.noAccount : t.hasAccount}{" "}
                    <button
                        type="button"
                        className="cursor-pointer font-semibold text-teal-500"
                        onClick={() => {
                            setMode((m) => (m === "login" ? "register" : "login"));
                            setError(null);
                        }}
                    >
                        {mode === "login" ? t.register : t.login}
                    </button>
                </div>
            </div>

            <AnonymousHelpDialog open={showHelp} onOpenChange={setShowHelp} lang={lang} />
        </div>
    );
};

function Divider({ label }: { label: string }) {
    return (
        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            {label}
            <div className="h-px flex-1 bg-border" />
        </div>
    );
}

export default LoginPage;
