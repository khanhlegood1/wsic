"use client";

import { useEffect, useState } from "react";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import { APP_NAME, APP_SHORT_NAME, CALLBACK_URL } from "@/constants/common";

const LoginPage = () => {
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const { data: session } = useSession();
    const params = useSearchParams();
    const gradientTextClass = "text-transparent bg-clip-text bg-gradient-to-br from-teal-600 to-teal-400";

    const handleSignInError = (errorMessage: string) => {
        setError(errorMessage);
    };

    const handleSignInStart = () => {
        // Clear any existing errors when starting a new sign-in attempt
        setError(null);
    };

    const dismissError = () => {
        setError(null);
    };

    useEffect(() => {
        if (session) {
            router.replace(params.get("redirect_url") ?? CALLBACK_URL);
        }
    }, [session, params, router])

    return (
        <div className="relative flex flex-1 items-center justify-center min-h-[calc(100dvh-5rem)] py-12 px-2">
            {/* Soft teal glow behind the card */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(20,184,166,0.14)_0%,transparent_60%)]"
            />
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
                    Welcome to <span className={gradientTextClass}>{APP_NAME}</span>
                </h1>
                <p className="mt-1 mb-7 text-center text-sm text-muted-foreground">
                    Sign in to discover what matters most.
                </p>

                {/* Google Sign-in Button */}
                <GoogleSignInButton
                    onSignIn={handleSignInStart}
                    onError={handleSignInError}
                />

                {/* Error Message */}
                {error && (
                    <div
                        className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 py-2 pl-4 pr-2 text-destructive dark:border-red-900/50 dark:bg-red-950/40"
                        role="alert"
                    >
                        <span className="text-sm/relaxed">{error}</span>
                        <Button
                            onClick={dismissError}
                            variant="destructive"
                            size="icon"
                            aria-label="Dismiss error"
                            className="bg-inherit text-destructive shadow-none hover:text-white"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LoginPage;