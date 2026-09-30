import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LookupAddress } from "dns";

// Mock dns/promises before importing the module
vi.mock("dns/promises", () => ({
  default: {
    lookup: vi.fn(),
  },
  lookup: vi.fn(),
}));

import { validateUrl, SSRFError } from "@/lib/security/ssrfGuard";
import dns from "dns/promises";

const mockLookup = vi.mocked(dns.lookup);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateUrl – protocol", () => {
  it("allows https URLs", async () => {
    mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as unknown as LookupAddress);
    const url = await validateUrl("https://example.com/api");
    expect(url.hostname).toBe("example.com");
  });

  it("blocks ftp scheme", async () => {
    await expect(validateUrl("ftp://example.com")).rejects.toThrow(SSRFError);
  });

  it("blocks javascript scheme", async () => {
    await expect(validateUrl("javascript:alert(1)")).rejects.toThrow(SSRFError);
  });

  it("rejects invalid URL", async () => {
    await expect(validateUrl("not-a-url")).rejects.toThrow(SSRFError);
  });
});

describe("validateUrl – blocked hosts", () => {
  it("blocks metadata endpoint by hostname", async () => {
    await expect(validateUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow(SSRFError);
  });

  it("blocks metadata.google.internal", async () => {
    await expect(validateUrl("http://metadata.google.internal/computeMetadata/v1/")).rejects.toThrow(SSRFError);
  });
});

describe("validateUrl – private IPs via DNS", () => {
  it("blocks loopback IP", async () => {
    mockLookup.mockResolvedValue([{ address: "127.0.0.1", family: 4 }] as unknown as LookupAddress);
    await expect(validateUrl("http://internal.example.com")).rejects.toThrow(SSRFError);
  });

  it("blocks RFC1918 10.x.x.x", async () => {
    mockLookup.mockResolvedValue([{ address: "10.0.0.1", family: 4 }] as unknown as LookupAddress);
    await expect(validateUrl("http://internal.example.com")).rejects.toThrow(SSRFError);
  });

  it("blocks RFC1918 192.168.x.x", async () => {
    mockLookup.mockResolvedValue([{ address: "192.168.1.100", family: 4 }] as unknown as LookupAddress);
    await expect(validateUrl("http://internal.example.com")).rejects.toThrow(SSRFError);
  });

  it("blocks RFC1918 172.16.x.x", async () => {
    mockLookup.mockResolvedValue([{ address: "172.16.0.1", family: 4 }] as unknown as LookupAddress);
    await expect(validateUrl("http://internal.example.com")).rejects.toThrow(SSRFError);
  });

  it("blocks link-local 169.254.x.x via DNS", async () => {
    mockLookup.mockResolvedValue([{ address: "169.254.1.1", family: 4 }] as unknown as LookupAddress);
    await expect(validateUrl("http://internal.example.com")).rejects.toThrow(SSRFError);
  });

  it("blocks IPv6 loopback ::1", async () => {
    mockLookup.mockResolvedValue([{ address: "::1", family: 6 }] as unknown as LookupAddress);
    await expect(validateUrl("http://internal.example.com")).rejects.toThrow(SSRFError);
  });

  it("blocks IPv6 ULA fc00::/7", async () => {
    mockLookup.mockResolvedValue([{ address: "fc00::1", family: 6 }] as unknown as LookupAddress);
    await expect(validateUrl("http://internal.example.com")).rejects.toThrow(SSRFError);
  });

  it("allows public IP", async () => {
    mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as unknown as LookupAddress);
    const url = await validateUrl("https://example.com");
    expect(url).toBeDefined();
  });
});

describe("validateUrl – DNS failure", () => {
  it("throws SSRFError on DNS failure", async () => {
    mockLookup.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(validateUrl("http://nonexistent.invalid")).rejects.toThrow(SSRFError);
  });
});
