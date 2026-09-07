import "next-auth";

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      role: "member" | "trusted_member" | "moderator" | "editor" | "admin";
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
