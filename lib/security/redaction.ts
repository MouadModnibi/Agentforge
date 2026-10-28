export function redactSecrets<T>(value: T, secrets: string[]): T {
  let serialized = JSON.stringify(value);
  if (serialized === undefined) return value;
  for (const secret of secrets.filter((s) => s.length >= 4))
    serialized = serialized
      .split(JSON.stringify(secret).slice(1, -1))
      .join("[REDACTED]");
  return JSON.parse(serialized) as T;
}
