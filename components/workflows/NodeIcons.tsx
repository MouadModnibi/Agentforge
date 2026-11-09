/**
 * Branded SVG logos for every workflow node kind.
 * Each component renders a self-contained inline SVG.
 * Use size prop to control dimensions; logos fill the given square.
 */

interface SvgProps {
  size?: number;
  className?: string;
}

// ─── Triggers ────────────────────────────────────────────────────────────────

export function ManualTriggerLogo({ size = 22, className }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#e8bf66" opacity="0.15" />
      <circle cx="12" cy="12" r="11" stroke="#e8bf66" strokeWidth="1.2" />
      <polygon points="9,7 19,12 9,17" fill="#e8bf66" />
    </svg>
  );
}

export function FormTriggerLogo({ size = 22, className }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="2" width="18" height="20" rx="2.5" fill="#e8bf66" opacity="0.15" stroke="#e8bf66" strokeWidth="1.2" />
      <rect x="7" y="7" width="10" height="2" rx="1" fill="#e8bf66" opacity="0.7" />
      <rect x="7" y="11" width="10" height="2" rx="1" fill="#e8bf66" opacity="0.5" />
      <rect x="7" y="15" width="6" height="2" rx="1" fill="#e8bf66" opacity="0.35" />
    </svg>
  );
}

export function WebhookLogo({ size = 22, className }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#e8bf66" opacity="0.12" stroke="#e8bf66" strokeWidth="1.2" />
      {/* hook + arc */}
      <path d="M8 9a4 4 0 0 1 7.46-2" stroke="#e8bf66" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <circle cx="7" cy="16" r="2.5" stroke="#e8bf66" strokeWidth="1.4" />
      <path d="M8 9l2.5 4H15a2.5 2.5 0 1 1 0 5h-2" stroke="#e8bf66" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function TelegramLogo({ size = 22, className }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#29B6F6" />
      <path d="M5.5 11.8l3.8 1.5 1.5 4.7c.1.3.5.4.7.2l2.1-2a.5.5 0 0 1 .6 0l3.8 2.7c.3.2.7 0 .8-.3l2.3-11c.1-.4-.3-.8-.7-.6L5.5 10.8c-.4.2-.4.8 0 1z" fill="#fff" />
      <path d="M9.8 13.3l-.5 3.7 1.5-3.3" fill="#B0BEC5" />
    </svg>
  );
}

export function EmailLogo({ size = 22, className }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" fill="#fff" />
      <path d="M2 7l10 7 10-7" stroke="#EA4335" strokeWidth="1.8" fill="none" />
      <path d="M2 7a2 2 0 0 1 2-2h.5v5.5L12 16l7.5-5.5V5H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7z" fill="#EA4335" opacity="0.9" />
      <path d="M2 7v3.5l2.5 1.8V5L2 7z" fill="#C5221F" />
      <path d="M22 7v3.5l-2.5 1.8V5L22 7z" fill="#C5221F" />
    </svg>
  );
}

export function XLogo({ size = 22, className }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#000" />
      <path d="M13.6 10.9 18.3 6h-1.1l-4.1 4.7L9.8 6H6.3l4.9 7.1L6.3 18h1.1l4.3-5 3.4 5H19l-5.4-7.1zm-1.5 1.7-.5-.7L7.8 6.9h1.7l3.2 4.6.5.7 4.2 6h-1.7l-3.6-5.6z" fill="#fff" />
    </svg>
  );
}

// ─── AI ──────────────────────────────────────────────────────────────────────

export function AgentLogo({ size = 22, className }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="6" width="18" height="13" rx="3" fill="#b8d2e8" opacity="0.2" stroke="#b8d2e8" strokeWidth="1.3" />
      {/* face */}
      <circle cx="9" cy="12" r="1.5" fill="#b8d2e8" />
      <circle cx="15" cy="12" r="1.5" fill="#b8d2e8" />
      <path d="M9 15.5q3 2 6 0" stroke="#b8d2e8" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      {/* antenna */}
      <line x1="12" y1="6" x2="12" y2="3" stroke="#b8d2e8" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="12" cy="2.5" r="1" fill="#b8d2e8" />
    </svg>
  );
}

export function GeminiLogo({ size = 22, className }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="gem-g" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="50%" stopColor="#9B72CB" />
          <stop offset="100%" stopColor="#D96570" />
        </linearGradient>
      </defs>
      <path d="M12 2C12 2 14 8.5 19 12C14 15.5 12 22 12 22C12 22 10 15.5 5 12C10 8.5 12 2 12 2Z" fill="url(#gem-g)" />
      <path d="M2 12C2 12 8.5 10 12 5C15.5 10 22 12 22 12C22 12 15.5 14 12 19C8.5 14 2 12 2 12Z" fill="url(#gem-g)" opacity="0.55" />
    </svg>
  );
}

// ─── Logic ───────────────────────────────────────────────────────────────────

export function ConditionLogo({ size = 22, className }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#b9b7a5" opacity="0.12" stroke="#b9b7a5" strokeWidth="1.2" />
      {/* diamond */}
      <path d="M12 5l5.5 7-5.5 7-5.5-7z" fill="#b9b7a5" opacity="0.3" stroke="#b9b7a5" strokeWidth="1.3" strokeLinejoin="round" />
      {/* branches */}
      <line x1="17.5" y1="12" x2="21" y2="8" stroke="#b9b7a5" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="17.5" y1="12" x2="21" y2="16" stroke="#b9b7a5" strokeWidth="1.5" strokeLinecap="round" />
      <text x="12" y="13.5" textAnchor="middle" fontSize="5" fontWeight="700" fill="#b9b7a5" fontFamily="monospace">IF</text>
    </svg>
  );
}

export function RouterLogo({ size = 22, className }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#b9b7a5" opacity="0.12" stroke="#b9b7a5" strokeWidth="1.2" />
      <circle cx="6" cy="12" r="2" fill="#b9b7a5" />
      <line x1="8" y1="12" x2="12" y2="12" stroke="#b9b7a5" strokeWidth="1.4" />
      <circle cx="14" cy="12" r="2" fill="#b9b7a5" opacity="0.5" />
      <line x1="16" y1="12" x2="19" y2="8" stroke="#b9b7a5" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="16" y1="12" x2="19" y2="12" stroke="#b9b7a5" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="16" y1="12" x2="19" y2="16" stroke="#b9b7a5" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function TransformLogo({ size = 22, className }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="3" fill="#b9b7a5" opacity="0.1" stroke="#b9b7a5" strokeWidth="1.2" />
      <text x="4" y="11" fontSize="5.5" fill="#b9b7a5" fontFamily="monospace" fontWeight="600">{"{"}</text>
      <line x1="8" y1="9" x2="18" y2="9" stroke="#b9b7a5" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      <line x1="8" y1="12" x2="15" y2="12" stroke="#b9b7a5" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
      <line x1="8" y1="15" x2="17" y2="15" stroke="#b9b7a5" strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
      <text x="4" y="20" fontSize="5.5" fill="#b9b7a5" fontFamily="monospace" fontWeight="600">{"}"}</text>
    </svg>
  );
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export function HttpLogo({ size = 22, className }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="#9dc6b1" strokeWidth="1.4" />
      <ellipse cx="12" cy="12" rx="4.5" ry="10" stroke="#9dc6b1" strokeWidth="1.2" />
      <line x1="2" y1="12" x2="22" y2="12" stroke="#9dc6b1" strokeWidth="1.2" />
      <path d="M4.5 7.5 Q12 9 19.5 7.5M4.5 16.5 Q12 15 19.5 16.5" stroke="#9dc6b1" strokeWidth="1" fill="none" />
    </svg>
  );
}

export function CustomToolLogo({ size = 22, className }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="3" fill="#9dc6b1" opacity="0.1" stroke="#9dc6b1" strokeWidth="1.2" />
      <path d="M8 8l-4 4 4 4" stroke="#9dc6b1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 8l4 4-4 4" stroke="#9dc6b1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="14" y1="6" x2="10" y2="18" stroke="#9dc6b1" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export function DiscordLogo({ size = 22, className }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#5865F2" />
      <path d="M16.6 7.4A13 13 0 0 0 13.4 6.5a.05.05 0 0 0-.05.02c-.14.25-.3.58-.41.84a12 12 0 0 0-1.87 0 8.3 8.3 0 0 0-.42-.84.05.05 0 0 0-.05-.02 13 13 0 0 0-3.2.9.04.04 0 0 0-.02.02C5.62 10.3 5.14 13.1 5.4 15.9c0 .01.01.03.02.04a13.1 13.1 0 0 0 3.96 2 .05.05 0 0 0 .05-.02c.3-.42.57-.86.8-1.32a.05.05 0 0 0-.03-.07 8.6 8.6 0 0 1-1.23-.59.05.05 0 0 1 0-.08c.08-.06.16-.13.24-.19a.05.05 0 0 1 .05-.01c2.6 1.19 5.41 1.19 7.98 0a.05.05 0 0 1 .05.01c.08.06.16.13.24.19a.05.05 0 0 1 0 .08 8.2 8.2 0 0 1-1.23.59.05.05 0 0 0-.03.07c.24.46.5.9.8 1.32a.05.05 0 0 0 .05.02 13.1 13.1 0 0 0 3.97-2 .05.05 0 0 0 .02-.04c.33-3.37-.55-6.15-2.3-8.48a.04.04 0 0 0-.02-.02zM9.68 14.3c-.8 0-1.47-.74-1.47-1.65s.65-1.65 1.47-1.65c.83 0 1.49.75 1.47 1.65 0 .91-.64 1.65-1.47 1.65zm5.43 0c-.8 0-1.47-.74-1.47-1.65s.65-1.65 1.47-1.65c.83 0 1.49.75 1.47 1.65 0 .91-.63 1.65-1.47 1.65z" fill="#fff" />
    </svg>
  );
}

// ─── New integrations ─────────────────────────────────────────────────────────

export function SlackLogo({ size = 22, className }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#4A154B" />
      {/* Slack hash mark — 4 rounded bars */}
      <rect x="5.5" y="10" width="4.5" height="1.8" rx="0.9" fill="#E01E5A" />
      <rect x="5.5" y="13" width="4.5" height="1.8" rx="0.9" fill="#E01E5A" />
      <rect x="14" y="10" width="4.5" height="1.8" rx="0.9" fill="#ECB22E" />
      <rect x="14" y="13" width="4.5" height="1.8" rx="0.9" fill="#ECB22E" />
      <rect x="10" y="5.5" width="1.8" height="4.5" rx="0.9" fill="#2EB67D" />
      <rect x="13" y="5.5" width="1.8" height="4.5" rx="0.9" fill="#2EB67D" />
      <rect x="10" y="14" width="1.8" height="4.5" rx="0.9" fill="#36C5F0" />
      <rect x="13" y="14" width="1.8" height="4.5" rx="0.9" fill="#36C5F0" />
    </svg>
  );
}

export function NotionLogo({ size = 22, className }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#fff" />
      <path d="M6 5.5h7.5l4 4.5V19a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5z" fill="#fff" stroke="#1a1a1a" strokeWidth="1.2" />
      <path d="M13.5 5.5V10H17.5" stroke="#1a1a1a" strokeWidth="1.2" strokeLinejoin="round" fill="none" />
      <line x1="8" y1="12" x2="16" y2="12" stroke="#1a1a1a" strokeWidth="1" opacity="0.6" />
      <line x1="8" y1="14.5" x2="14" y2="14.5" stroke="#1a1a1a" strokeWidth="1" opacity="0.4" />
      <line x1="8" y1="17" x2="12" y2="17" stroke="#1a1a1a" strokeWidth="1" opacity="0.3" />
    </svg>
  );
}

export function GitHubLogo({ size = 22, className }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#24292f" />
      <path fillRule="evenodd" clipRule="evenodd" d="M12 3.5a8.5 8.5 0 0 0-2.687 16.573c.425.078.58-.184.58-.41v-1.44c-2.363.513-2.861-1.139-2.861-1.139-.386-.98-.944-1.241-.944-1.241-.77-.527.058-.516.058-.516.853.06 1.302.875 1.302.875.758 1.3 1.99.924 2.475.707.077-.55.296-.924.54-1.137-1.887-.214-3.869-.943-3.869-4.197 0-.927.33-1.685.874-2.279-.088-.215-.379-1.079.083-2.248 0 0 .713-.228 2.334.87a8.13 8.13 0 0 1 2.124-.285 8.13 8.13 0 0 1 2.124.285c1.62-1.098 2.332-.87 2.332-.87.463 1.17.172 2.033.085 2.248.544.594.873 1.352.873 2.279 0 3.262-1.985 3.98-3.876 4.19.304.262.576.778.576 1.568v2.322c0 .228.153.493.584.41A8.5 8.5 0 0 0 12 3.5z" fill="#fff" />
    </svg>
  );
}

export function YouTubeLogo({ size = 22, className }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="1" y="5" width="22" height="14" rx="4" fill="#FF0000" />
      <polygon points="10,8.5 16.5,12 10,15.5" fill="#fff" />
    </svg>
  );
}

export function RSSLogo({ size = 22, className }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#f26522" />
      <circle cx="7" cy="17" r="2" fill="#fff" />
      <path d="M5 12.5a6.5 6.5 0 0 1 6.5 6.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M5 7a12 12 0 0 1 12 12" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function SheetsLogo({ size = 22, className }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="2" y="1" width="14" height="18" rx="1.5" fill="#fff" stroke="#34A853" strokeWidth="1" />
      <path d="M10 1v5h6" stroke="#34A853" strokeWidth="1" fill="none" />
      <line x1="5" y1="10" x2="13" y2="10" stroke="#34A853" strokeWidth="1" />
      <line x1="5" y1="13" x2="13" y2="13" stroke="#34A853" strokeWidth="1" />
      <line x1="5" y1="16" x2="10" y2="16" stroke="#34A853" strokeWidth="1" />
      <line x1="9" y1="7" x2="9" y2="19" stroke="#34A853" strokeWidth="1" opacity="0.4" />
      <rect x="13" y="10" width="9" height="12" rx="1.5" fill="#34A853" />
      <line x1="13" y1="14" x2="22" y2="14" stroke="#fff" strokeWidth="0.9" opacity="0.6" />
      <line x1="13" y1="17" x2="22" y2="17" stroke="#fff" strokeWidth="0.9" opacity="0.6" />
      <line x1="17.5" y1="10" x2="17.5" y2="22" stroke="#fff" strokeWidth="0.9" opacity="0.6" />
    </svg>
  );
}

export function WhatsAppLogo({ size = 22, className }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#25D366" />
      <path d="M17.5 14.3c-.3-.15-1.7-.84-2-.94-.3-.1-.5-.15-.7.15-.2.3-.8.94-.97 1.14-.18.2-.35.22-.65.07a8.2 8.2 0 0 1-2.4-1.48 9 9 0 0 1-1.66-2.07c-.17-.3-.02-.46.13-.6.13-.13.3-.34.44-.51.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.7-1.7-.96-2.33-.25-.6-.5-.52-.7-.53H8c-.2 0-.5.07-.76.37-.26.3-1 1-1 2.4 0 1.4 1.02 2.76 1.16 2.95.15.2 2 3.06 4.86 4.29.68.29 1.21.46 1.62.59.68.22 1.3.19 1.79.11.55-.08 1.7-.69 1.94-1.36.24-.67.24-1.25.17-1.37-.07-.1-.27-.17-.57-.32z" fill="#fff" />
    </svg>
  );
}

export function LinkedInLogo({ size = 22, className }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#0A66C2" />
      <rect x="4" y="9" width="3.5" height="11" rx="0.5" fill="#fff" />
      <circle cx="5.75" cy="6" r="2" fill="#fff" />
      <path d="M10 9h3.3v1.5S14 9 16.2 9C18.5 9 20 10.4 20 13.2V20h-3.5v-6c0-1.2-.5-1.8-1.5-1.8s-1.7.7-1.7 1.8V20H10V9z" fill="#fff" />
    </svg>
  );
}

export function WeatherLogo({ size = 22, className }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="10" r="4" fill="#FDD835" stroke="#F9A825" strokeWidth="1" />
      {/* sun rays */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
        const r = (deg * Math.PI) / 180;
        return (
          <line
            key={i}
            x1={12 + Math.cos(r) * 5.5}
            y1={10 + Math.sin(r) * 5.5}
            x2={12 + Math.cos(r) * 7}
            y2={10 + Math.sin(r) * 7}
            stroke="#F9A825"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        );
      })}
      {/* cloud */}
      <path d="M6 18a3 3 0 0 1 0-6 3.5 3.5 0 0 1 6.9-.5A2.5 2.5 0 0 1 18 14a2.5 2.5 0 0 1-2.5 2.5" stroke="#90CAF9" strokeWidth="1.3" fill="#BBDEFB" />
      <path d="M6 18h10a2 2 0 0 0 0-4 2 2 0 0 0-3.8-1A3 3 0 0 0 6 18z" fill="#BBDEFB" stroke="#90CAF9" strokeWidth="1" />
    </svg>
  );
}

// ─── Index ───────────────────────────────────────────────────────────────────

/**
 * Maps every NodeKind to its branded logo component.
 * Every kind has a logo — no fallback needed.
 */
export const brandedIcons: Record<string, React.ComponentType<SvgProps>> = {
  // Triggers
  manual: ManualTriggerLogo,
  formTrigger: FormTriggerLogo,
  webhook: WebhookLogo,
  telegramTrigger: TelegramLogo,
  emailTrigger: EmailLogo,
  xTrigger: XLogo,
  // AI
  agent: AgentLogo,
  gemini: GeminiLogo,
  // Logic
  condition: ConditionLogo,
  router: RouterLogo,
  transform: TransformLogo,
  // Actions
  http: HttpLogo,
  customTool: CustomToolLogo,
  telegram: TelegramLogo,
  discord: DiscordLogo,
  email: EmailLogo,
  x: XLogo,
  // Extended
  slack: SlackLogo,
  notion: NotionLogo,
  github: GitHubLogo,
  youtube: YouTubeLogo,
  rss: RSSLogo,
  sheets: SheetsLogo,
  whatsapp: WhatsAppLogo,
  linkedin: LinkedInLogo,
  weather: WeatherLogo,
};
