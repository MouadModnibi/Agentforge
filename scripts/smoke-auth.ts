/** Use a dedicated test account; never send account passwords as Bearer keys. */
export async function smokeCookie(base: string) {
  const email = process.env.SMOKE_EMAIL,
    password = process.env.SMOKE_PASSWORD;
  if (!email || !password)
    throw new Error(
      "Set SMOKE_EMAIL and SMOKE_PASSWORD for a registered test account.",
    );
  const response = await fetch(new URL("/api/auth", base), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok)
    throw new Error(`Test account login failed (${response.status})`);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Login did not return a session cookie.");
  return cookie;
}
