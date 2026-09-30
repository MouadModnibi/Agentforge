import dns from "dns/promises";

const BLOCKED_CIDRS = [
  // IPv4
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./,
  // IPv6
  /^::1$/,
  /^fc/i,
  /^fd/i,
  /^fe80/i,
];

const BLOCKED_METADATA_HOSTS = [
  "metadata.google.internal",
  "169.254.169.254",
  "100.100.100.200",
];

export class SSRFError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SSRFError";
  }
}

function isBlockedIp(ip: string): boolean {
  return BLOCKED_CIDRS.some((re) => re.test(ip));
}

export async function validateUrl(urlStr: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new SSRFError(`Invalid URL: ${urlStr}`);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new SSRFError(`Only HTTP/HTTPS URLs are allowed`);
  }

  const hostname = url.hostname;

  if (BLOCKED_METADATA_HOSTS.includes(hostname)) {
    throw new SSRFError(`Access to metadata endpoint blocked`);
  }

  // Resolve DNS
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    for (const addr of addresses) {
      if (isBlockedIp(addr.address)) {
        throw new SSRFError(`URL resolves to a private/reserved IP address`);
      }
    }
  } catch (err) {
    if (err instanceof SSRFError) throw err;
    throw new SSRFError(`DNS resolution failed for ${hostname}`);
  }

  return url;
}

export async function guardedFetch(
  urlStr: string,
  options: RequestInit = {},
  maxResponseSizeBytes = 1024 * 1024 // 1MB
): Promise<Response> {
  const validatedUrl = await validateUrl(urlStr);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(validatedUrl.toString(), {
      ...options,
      signal: controller.signal,
      redirect: "manual", // Block redirects to private IPs
    });

    // Follow redirects manually with re-validation
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location) {
        return guardedFetch(location, options, maxResponseSizeBytes);
      }
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}
