import { betterAuth } from "better-auth";
import { anonymous } from "better-auth/plugins";
import { Pool } from "pg";
import { pgConfig } from "./db-config";

export const auth = betterAuth({
  database: new Pool(pgConfig),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  plugins: [anonymous({ emailDomainName: "guest.wsic.app" })],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 10 * 60, // 10 minutes
    },
  },
});
