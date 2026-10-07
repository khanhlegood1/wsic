"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const PLACEHOLDER_URL = "https://missing-convex-url.convex.cloud";

/**
 * Clean up common mistakes in the env var (surrounding quotes/whitespace,
 * missing protocol) and make sure the result is an absolute http(s) URL.
 * Returns undefined when the value can't be used.
 */
function normalizeConvexUrl(raw: string | undefined): string | undefined {
    if (!raw) return undefined;
    let value = raw.trim().replace(/^["']+|["']+$/g, "").trim();
    if (!value) return undefined;
    if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
    try {
        const url = new URL(value);
        return url.origin;
    } catch {
        return undefined;
    }
}

const convexUrl = normalizeConvexUrl(process.env.NEXT_PUBLIC_CONVEX_URL);

if (!convexUrl) {
    console.error(
        "NEXT_PUBLIC_CONVEX_URL is missing or not a valid absolute URL (expected e.g. https://your-deployment.convex.cloud). Fix it in Vercel → Settings → Environment Variables and redeploy."
    );
}

// Never crash the whole app at module load because of a bad env var;
// Convex queries will simply stay in their loading state.
const convex = new ConvexReactClient(convexUrl ?? PLACEHOLDER_URL);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
    return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
