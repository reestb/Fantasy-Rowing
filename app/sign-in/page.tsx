import AuthForm from "@/components/auth-form";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const next = safeDestination(params.next);
  return <AuthForm mode="sign-in" next={next} initialError={params.error === "auth" ? "That sign-in link has expired. Please try again." : ""} />;
}

function safeDestination(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}