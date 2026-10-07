"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
    console.error(
        "NEXT_PUBLIC_CONVEX_URL is not set. Add it in Vercel → Project Settings → Environment Variables (or .env.local for local dev) and redeploy."
    );
}

// Fall back to a placeholder so a missing env var doesn't crash the whole app
// at module load; Convex queries will simply stay in their loading state.
const convex = new ConvexReactClient(
    convexUrl ?? "https://missing-convex-url.convex.cloud"
);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
    return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
