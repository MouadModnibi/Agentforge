import dns from "dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";

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
  const normalized = ip.replace(/^\[|\]$/g, "").toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    const suffix = normalized.slice(7);
    if (suffix.includes(".")) return isBlockedIp(suffix);
    const parts = suffix.split(":");
    if (parts.length === 2) {
      const high = parseInt(parts[0], 16),
        low = parseInt(parts[1], 16);
      return isBlockedIp(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
    }
    return true;
  }
  if (normalized.includes(":")) return !/^[23][0-9a-f]{3}:/.test(normalized);
  const first = Number(normalized.split(".")[0]);
  return first >= 224 || BLOCKED_CIDRS.some((re) => re.test(normalized));
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

  if (url.username || url.password)
    throw new SSRFError("URL credentials are not allowed");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname) && isBlockedIp(hostname))
    throw new SSRFError("Private/reserved IP blocked");

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

export async function resolvePublicHost(hostname: string): Promise<string> {
  const url = await validateUrl(`https://${hostname}`);
  if (url.hostname !== hostname || url.port || url.pathname !== "/")
    throw new SSRFError("Use a plain public hostname");
  const addresses = await dns.lookup(hostname, { all: true });
  if (!addresses.length || addresses.some((a) => isBlockedIp(a.address)))
    throw new SSRFError("Private/reserved IP blocked");
  return addresses[0].address;
}

export async function guardedFetch(
  urlStr: string,
  options: RequestInit = {},
  maxResponseSizeBytes = 1024 * 1024,
  redirects = 0,
): Promise<Response> {
  if (redirects > 5) throw new SSRFError("Too many redirects");
  const validatedUrl = await validateUrl(urlStr);
  const hostname = validatedUrl.hostname.replace(/^\[|\]$/g, "");
  const addresses = await dns.lookup(hostname, { all: true });
  if (!addresses.length || addresses.some((a) => isBlockedIp(a.address)))
    throw new SSRFError("Private/reserved IP blocked");
  const address = addresses[0];
  const signal = AbortSignal.any([
    AbortSignal.timeout(10000),
    ...(options.signal ? [options.signal] : []),
  ]);
  const headers = new Headers(options.headers);
  headers.set("accept-encoding", "identity");
  const response = await new Promise<Response>((resolve, reject) => {
    const request = (validatedUrl.protocol === "https:" ? https : http).request(
      validatedUrl,
      {
        method: options.method ?? "GET",
        headers: Object.fromEntries(headers.entries()),
        signal,
        // Pin the validated address to close the DNS rebinding window; TLS still verifies the hostname.
        lookup: (_hostname, lookupOptions, callback) => {
          if (lookupOptions.all) callback(null, [address]);
          else callback(null, address.address, address.family);
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxResponseSizeBytes) {
            request.destroy(new SSRFError("Response exceeds 1 MB limit"));
          } else chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () => {
          const responseHeaders = new Headers();
          for (const [key, value] of Object.entries(res.headers))
            if (
              value !== undefined &&
              !["transfer-encoding", "content-length"].includes(key)
            )
              responseHeaders.set(
                key,
                Array.isArray(value) ? value.join(", ") : value,
              );
          const status = res.statusCode ?? 502;
          resolve(
            new Response(
              [204, 205, 304].includes(status) || options.method === "HEAD"
                ? null
                : Buffer.concat(chunks),
              { status, headers: responseHeaders },
            ),
          );
        });
      },
    );
    request.on("error", reject);
    if (options.body != null) {
      if (typeof options.body !== "string") {
        request.destroy(new Error("Only string request bodies are supported"));
        return;
      }
      request.write(options.body);
    }
    request.end();
  });
  if (
    response.status >= 300 &&
    response.status < 400 &&
    response.headers.has("location")
  ) {
    const next = new URL(response.headers.get("location")!, validatedUrl);
    if (next.origin !== validatedUrl.origin) {
      headers.delete("authorization");
      headers.delete("cookie");
    }
    const useGet =
      response.status === 303 ||
      ([301, 302].includes(response.status) && options.method === "POST");
    return guardedFetch(
      next.toString(),
      {
        ...options,
        headers,
        ...(useGet ? { method: "GET", body: undefined } : {}),
      },
      maxResponseSizeBytes,
      redirects + 1,
    );
  }
  return response;
}
