import { createAuthClient } from "better-auth/react";
import { anonymousClient } from "better-auth/client/plugins";
import { auth } from "./auth";

const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL,
  plugins: [anonymousClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
export type Session = typeof auth.$Infer.Session;