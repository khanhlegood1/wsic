"use client";

import React, { FC, useState } from "react";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";
import { CALLBACK_URL, NEW_USER_CALLBACK_URL } from "@/constants/common";
import { useSearchParams } from "next/navigation";

interface GoogleSignInButtonProps {
  isLoading?: boolean;
  onSignIn?: () => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  label?: string;
  loadingLabel?: string;
}

const GoogleSignInButton: FC<GoogleSignInButtonProps> = ({
  isLoading: externalLoading = false,
  onSignIn,
  onError,
  disabled = false,
  label = "Sign in with Google",
  loadingLabel = "Signing in with Google...",
}) => {
  const [internalLoading, setInternalLoading] = useState(false);
  const params = useSearchParams();

  // Use external loading state if provided, otherwise use internal state
  const isLoadingState = externalLoading || internalLoading;

  const handleSignIn = async () => {
    if (isLoadingState || disabled) return;

    try {
      setInternalLoading(true);

      // Call the optional onSignIn callback
      if (onSignIn) {
        onSignIn();
      }

      // Initiate Google OAuth flow using better-auth
      const result = await signIn.social({
        provider: "google",
        callbackURL: params.get('redirect_url') ?? CALLBACK_URL, // Redirect to redirect url or home page after successful sign-in
        newUserCallbackURL: params.get('redirect_url') ?? NEW_USER_CALLBACK_URL // Redirect to redirect url or home page after successful sign-in
      });

      // Check if the sign-in was successful
      if (result?.error) {
        throw new Error(result.error.message || "Authentication failed");
      }
    } catch (error) {
      console.error("Sign-in error:", error);

      // Determine error type and provide appropriate message
      let errorMessage = "Something went wrong. Please try again later.";

      if (error instanceof Error) {
        if (error.message.includes("network") || error.message.includes("fetch")) {
          errorMessage = "Connection issue. Please check your internet and try again.";
        } else if (error.message.includes("oauth") || error.message.includes("google")) {
          errorMessage = "Unable to sign in with Google. Please try again.";
        } else if (error.message.includes("popup") || error.message.includes("blocked")) {
          errorMessage = "Pop-up blocked. Please allow pop-ups and try again.";
        }
      }

      // Call the error callback if provided
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <Button
      onClick={handleSignIn}
      disabled={isLoadingState || disabled}
      variant="outline"
      size="lg"
      className="w-full text-base p-6 font-semibold rounded-xl border-border bg-background hover:border-teal-500 hover:bg-teal-500/5 transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-center gap-3">
        {isLoadingState ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-foreground border-t-transparent" />
            <span>{loadingLabel}</span>
          </>
        ) : (
          <>
            <svg
              className="size-6"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span>{label}</span>
          </>
        )}
      </div>
    </Button>
  );
};

export default GoogleSignInButton;