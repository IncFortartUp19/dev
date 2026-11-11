import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    error?: "SessionExpired";
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    accessExpires?: number;
  }
}
