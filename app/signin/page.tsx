import Link from "next/link";
import { signIn } from "../auth";

export default function SignInPage() {
  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return (
    <main className="signin-page" style={{ maxWidth: 560, padding: "12vh 24px", margin: "auto" }}>
      <div className="eyebrow">SOLAR4U ACCOUNT</div>
      <h1 style={{ fontSize: 52, letterSpacing: "-.06em", marginBottom: 12 }}>Keep your projects connected.</h1>
      <p style={{ color: "#98a49f", lineHeight: 1.7 }}>Google sign-in is optional during local development and will be required only before public deployment.</p>
      {googleConfigured ? (
        <form action={async () => { "use server"; await signIn("google", { redirectTo: "/dashboard" }); }}>
          <button className="primary-button" type="submit">Continue with Google →</button>
        </form>
      ) : (
        <div className="method-note"><b>Local profile active</b><span>Add Google OAuth values to your ignored `.env` file when you are ready to test sign-in.</span></div>
      )}
      <Link className="secondary-button" href="/" style={{ marginTop: 12 }}>Return home</Link>
    </main>
  );
}
