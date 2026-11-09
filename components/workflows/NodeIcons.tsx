/**
 * Branded SVG logos for workflow node types.
 * Each component is a plain inline SVG sized to fill its container.
 * Use with a fixed width/height wrapper (e.g. size={22}).
 */

interface SvgProps {
  size?: number;
  className?: string;
}

export function TelegramLogo({ size = 22, className }: SvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="12" fill="#29B6F6" />
      <path
        d="M5.2 11.7l3.6 1.4 1.4 4.4c.1.3.5.4.7.2l2-1.9a.5.5 0 0 1 .6 0l3.6 2.6c.3.2.7 0 .7-.3l2.2-10.5c.1-.4-.3-.7-.6-.6L5.2 10.8c-.4.2-.4.7 0 .9z"
        fill="#fff"
      />
      <path
        d="M9.4 13l-.4 3.6 1.4-3.1"
        fill="#B0BEC5"
      />
    </svg>
  );
}

export function DiscordLogo({ size = 22, className }: SvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="12" fill="#5865F2" />
      <path
        d="M16.6 7.4A13 13 0 0 0 13.4 6.5a.05.05 0 0 0-.05.02c-.14.25-.3.58-.41.84a12 12 0 0 0-1.87 0 8.3 8.3 0 0 0-.42-.84.05.05 0 0 0-.05-.02 13 13 0 0 0-3.2.9.04.04 0 0 0-.02.02C5.62 10.3 5.14 13.1 5.4 15.9c0 .01.01.03.02.04a13.1 13.1 0 0 0 3.96 2 .05.05 0 0 0 .05-.02c.3-.42.57-.86.8-1.32a.05.05 0 0 0-.03-.07 8.6 8.6 0 0 1-1.23-.59.05.05 0 0 1 0-.08c.08-.06.16-.13.24-.19a.05.05 0 0 1 .05-.01c2.6 1.19 5.41 1.19 7.98 0a.05.05 0 0 1 .05.01c.08.06.16.13.24.19a.05.05 0 0 1 0 .08c-.39.23-.8.43-1.23.59a.05.05 0 0 0-.03.07c.24.46.5.9.8 1.32a.05.05 0 0 0 .05.02 13.1 13.1 0 0 0 3.97-2 .05.05 0 0 0 .02-.04c.33-3.37-.55-6.15-2.3-8.48a.04.04 0 0 0-.02-.02zM9.68 14.3c-.8 0-1.47-.74-1.47-1.65s.65-1.65 1.47-1.65c.83 0 1.49.75 1.47 1.65 0 .91-.64 1.65-1.47 1.65zm5.43 0c-.8 0-1.47-.74-1.47-1.65s.65-1.65 1.47-1.65c.83 0 1.49.75 1.47 1.65 0 .91-.63 1.65-1.47 1.65z"
        fill="#fff"
      />
    </svg>
  );
}

export function XLogo({ size = 22, className }: SvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="12" fill="#000" />
      <path
        d="M13.6 10.9 18.3 6h-1.1l-4.1 4.7L9.8 6H6.3l4.9 7.1L6.3 18h1.1l4.3-5 3.4 5H19l-5.4-7.1zm-1.5 1.7-.5-.7L7.8 6.9h1.7l3.2 4.6.5.7 4.2 6h-1.7l-3.6-5.6z"
        fill="#fff"
      />
    </svg>
  );
}

export function GmailLogo({ size = 22, className }: SvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="5" width="20" height="14" rx="2" fill="#fff" />
      <path d="M2 7l10 7 10-7" stroke="#EA4335" strokeWidth="1.5" fill="none" />
      <path d="M2 7v10a2 2 0 0 0 2 2h1.5V10L12 15l6.5-5v9H20a2 2 0 0 0 2-2V7l-10 7L2 7z" fill="#EA4335" />
      <path d="M2 7a2 2 0 0 1 2-2h.5v5L2 12V7z" fill="#C5221F" />
      <path d="M22 7a2 2 0 0 0-2-2h-.5v5l2.5 2V7z" fill="#C5221F" />
    </svg>
  );
}

export function GeminiLogo({ size = 22, className }: SvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="gemini-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="50%" stopColor="#9B72CB" />
          <stop offset="100%" stopColor="#D96570" />
        </linearGradient>
      </defs>
      {/* Four-pointed star / sparkle shape */}
      <path
        d="M12 2C12 2 13.5 8.5 18 12C13.5 15.5 12 22 12 22C12 22 10.5 15.5 6 12C10.5 8.5 12 2 12 2Z"
        fill="url(#gemini-grad)"
      />
      <path
        d="M2 12C2 12 8.5 10.5 12 6C15.5 10.5 22 12 22 12C22 12 15.5 13.5 12 18C8.5 13.5 2 12 2 12Z"
        fill="url(#gemini-grad)"
        opacity="0.75"
      />
    </svg>
  );
}

export function HttpLogo({ size = 22, className }: SvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      {/* Globe latitude lines */}
      <path d="M2 12h20M12 2c-3 2.5-4.5 6-4.5 10s1.5 7.5 4.5 10M12 2c3 2.5 4.5 6 4.5 10S15 19.5 12 22" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function WebhookLogo({ size = 22, className }: SvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Hook arc */}
      <path
        d="M14 5a3 3 0 1 1-5.5 1.6L5 13h5.3A3 3 0 1 1 13 17H7.7L4 11.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="17" cy="18" r="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="11.5" cy="5" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function ManualTriggerLogo({ size = 22, className }: SvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <polygon
        points="6,3 20,12 6,21"
        fill="currentColor"
        opacity="0.85"
        rx="2"
      />
    </svg>
  );
}

export function FormTriggerLogo({ size = 22, className }: SvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <line x1="7" y1="8" x2="17" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="7" y="11" width="10" height="2.5" rx="1" fill="currentColor" opacity="0.5" />
      <line x1="7" y1="16" x2="12" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Map from NodeKind to a branded logo component, where one exists. */
export const brandedIcons: Partial<Record<string, React.ComponentType<SvgProps>>> = {
  telegram: TelegramLogo,
  telegramTrigger: TelegramLogo,
  discord: DiscordLogo,
  x: XLogo,
  xTrigger: XLogo,
  email: GmailLogo,
  emailTrigger: GmailLogo,
  gemini: GeminiLogo,
  http: HttpLogo,
  webhook: WebhookLogo,
  manual: ManualTriggerLogo,
  formTrigger: FormTriggerLogo,
};
