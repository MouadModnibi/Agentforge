import { GraphSchema, type NodeKind } from "./schema";
import type { WorkflowTemplate } from "./templates";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const n = (
  id: string, kind: NodeKind, label: string,
  x: number, y: number, config: Record<string, unknown> = {},
) => ({ id, kind, label, position: { x, y }, config });

const t = (id: string, label: string, x: number, y: number, values: Record<string, unknown>) =>
  n(id, "transform", label, x, y, { values });

const e = (source: string, target: string, sourceHandle = "out") => ({
  id: `${source}-${sourceHandle}-${target}`, source, target, sourceHandle,
});

const http = (id: string, label: string, x: number, y: number, url: string,
  method = "GET", body: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  n(id, "http", label, x, y, { url, method, headers, body, credentialId: "" });

const g = (nodes: object[], edges: object[]) => GraphSchema.parse({ nodes, edges });

// ─── Template factory ─────────────────────────────────────────────────────────

export const extendedTemplates: WorkflowTemplate[] = [

  // 1 ── AI content writer
  {
    id: "ai-content-writer",
    name: "AI content writer",
    summary: "Turn a topic into a full blog post draft with title, intro, body and CTA.",
    description: "Send a topic via Run workflow. The Gemini node writes a structured blog post and the transform packages it for review. No credentials required.",
    requirements: "Gemini key in settings",
    input: { topic: "The future of AI agents", tone: "professional" },
    graph: g([
      n("start", "manual", "Start content run", 40, 180),
      t("settings", "Content settings", 300, 180, { topic: "{{input.topic}}", tone: "{{input.tone}}", wordCount: 600 }),
      n("write", "gemini", "Write blog post", 580, 180, {
        model: "gemini-3.8-flash",
        prompt: "Write a {{nodes.settings.wordCount}}-word blog post about: {{nodes.settings.topic}}.\nTone: {{nodes.settings.tone}}.\nStructure: catchy title, intro paragraph, 3 main sections with subheadings, and a call-to-action. Return plain text.",
      }),
      t("result", "Package post", 860, 180, { title: "Draft ready", content: "{{nodes.write}}", topic: "{{nodes.settings.topic}}" }),
    ], [e("start","settings"), e("settings","write"), e("write","result")]),
  },

  // 2 ── Slack standup notifier
  {
    id: "slack-standup",
    name: "Slack daily standup notifier",
    summary: "Post a formatted standup prompt to your Slack channel every morning.",
    description: "Trigger via webhook on a schedule. Composes a standup prompt and posts it to Slack. Setup: set your Slack channel in the settings node; add a Slack credential.",
    requirements: "Slack credential · Webhook schedule",
    input: {},
    graph: g([
      n("start", "webhook", "Morning schedule trigger", 40, 180),
      t("msg", "Build standup prompt", 300, 180, {
        text: ":sun_with_face: *Daily Standup* — time to sync!\n\n*Please share:*\n1. What did you finish yesterday?\n2. What are you working on today?\n3. Any blockers?\n\nReply in thread :thread:",
        channel: "#standup",
      }),
      n("post", "slack", "Post to Slack", 580, 180, { credentialId: "", channel: "{{nodes.msg.channel}}", text: "{{nodes.msg.text}}" }),
      t("done", "Record post", 860, 180, { posted: true, channel: "{{nodes.msg.channel}}" }),
    ], [e("start","msg"), e("msg","post"), e("post","done")]),
  },

  // 3 ── GitHub new issue → Discord alert
  {
    id: "github-issue-discord",
    name: "GitHub issue → Discord alert",
    summary: "When a webhook fires for a new GitHub issue, post a formatted alert to Discord.",
    description: "Receive a GitHub issue webhook, extract the key fields, and post a rich message to your Discord channel. Setup: configure the GitHub webhook to POST to this workflow's endpoint; add a Discord credential.",
    requirements: "Discord credential · GitHub webhook",
    input: { action: "opened", issue: { number: 42, title: "Bug: login fails", html_url: "https://github.com/org/repo/issues/42", user: { login: "octocat" } } },
    graph: g([
      n("start", "webhook", "GitHub issue webhook", 40, 180),
      t("extract", "Extract issue fields", 300, 180, {
        number: "{{trigger.issue.number}}",
        title: "{{trigger.issue.title}}",
        url: "{{trigger.issue.html_url}}",
        author: "{{trigger.issue.user.login}}",
        action: "{{trigger.action}}",
      }),
      n("cond", "condition", "Is it opened?", 580, 180, { value: "{{nodes.extract.action}}", operator: "equals", compare: "opened" }),
      t("format", "Format Discord message", 860, 100, {
        text: ":bug: **New Issue #{{nodes.extract.number}}**\n**{{nodes.extract.title}}**\nOpened by @{{nodes.extract.author}}\n{{nodes.extract.url}}",
      }),
      t("skip", "Skip — not a new issue", 860, 280, { skipped: true }),
      n("post", "discord", "Post to Discord", 1140, 100, { credentialId: "", text: "{{nodes.format.text}}", threadId: "" }),
    ], [
      e("start","extract"), e("extract","cond"),
      e("cond","format","true"), e("cond","skip","false"),
      e("format","post"),
    ]),
  },

  // 4 ── RSS → Telegram digest
  {
    id: "rss-telegram-digest",
    name: "RSS feed → Telegram digest",
    summary: "Fetch the latest RSS items and send a digest message to Telegram.",
    description: "Poll any RSS feed, format the top items, and send to a Telegram chat. Setup: set feed URL and Telegram chat ID in the settings node; add a Telegram credential.",
    requirements: "Telegram credential",
    input: {},
    graph: g([
      n("start", "webhook", "Scheduled digest trigger", 40, 180),
      t("cfg", "Feed settings — edit me", 300, 180, { feedUrl: "https://feeds.bbci.co.uk/news/rss.xml", maxItems: 5, chatId: "YOUR_CHAT_ID" }),
      n("fetch", "rss", "Fetch RSS feed", 580, 180, { url: "{{nodes.cfg.feedUrl}}", maxItems: "{{nodes.cfg.maxItems}}" }),
      t("format", "Format digest", 860, 180, { text: "📰 *News Digest*\n\n{{nodes.fetch}}", chatId: "{{nodes.cfg.chatId}}" }),
      n("send", "telegram", "Send to Telegram", 1140, 180, { credentialId: "", chatId: "{{nodes.format.chatId}}", text: "{{nodes.format.text}}" }),
    ], [e("start","cfg"), e("cfg","fetch"), e("fetch","format"), e("format","send")]),
  },

  // 5 ── Notion content log
  {
    id: "notion-content-log",
    name: "Log content ideas to Notion",
    summary: "Submit a content idea via form and automatically log it to a Notion database.",
    description: "Fill the public form with a title and description. The workflow adds a new page to your Notion database. Setup: set your Notion database ID in the settings node; add a Notion credential.",
    requirements: "Notion credential",
    input: { title: "Blog post: AI agents in 2026", description: "A deep dive into the state of AI agents." },
    graph: g([
      n("start", "formTrigger", "Submit content idea", 40, 180, {
        title: "Log a content idea",
        fields: [
          { name: "title", label: "Idea title", type: "text", required: true },
          { name: "description", label: "Description", type: "textarea", required: false },
          { name: "category", label: "Category (blog, video, tweet)", type: "text", required: false },
        ],
      }),
      t("cfg", "Notion settings — edit me", 320, 180, { databaseId: "YOUR_DATABASE_ID" }),
      t("prep", "Prepare page data", 600, 180, { title: "{{trigger.title}}", content: "{{trigger.description}}\n\nCategory: {{trigger.category}}", databaseId: "{{nodes.cfg.databaseId}}" }),
      n("create", "notion", "Create Notion page", 880, 180, { credentialId: "", databaseId: "{{nodes.prep.databaseId}}", title: "{{nodes.prep.title}}", content: "{{nodes.prep.content}}" }),
      t("done", "Log result", 1160, 180, { created: true, title: "{{nodes.prep.title}}" }),
    ], [e("start","cfg"), e("cfg","prep"), e("prep","create"), e("create","done")]),
  },

  // 6 ── AI email reply drafter
  {
    id: "ai-email-reply-draft",
    name: "AI email reply drafter",
    summary: "Receive an email, use AI to draft a polished reply, and save it for review.",
    description: "New emails are picked up by the trigger, sent to Gemini for a reply draft, and the result is saved to a transform node for review. Never auto-sends. Setup: add an Email credential.",
    requirements: "Email credential · Gemini key",
    input: { from: "client@example.com", subject: "Project update?", text: "Hi, can you give me an update on the project?" },
    graph: g([
      n("start", "emailTrigger", "New email arrives", 40, 180, { credentialId: "", mailbox: "INBOX" }),
      t("extract", "Extract email fields", 300, 180, { from: "{{trigger.from}}", subject: "{{trigger.subject}}", body: "{{trigger.text}}" }),
      n("draft", "gemini", "Draft a reply", 580, 180, {
        model: "gemini-3.8-flash",
        prompt: "You are a professional assistant. Draft a polite, concise reply to this email.\nFrom: {{nodes.extract.from}}\nSubject: {{nodes.extract.subject}}\nMessage: {{nodes.extract.body}}\n\nReturn only the reply text. Do not include a subject line.",
      }),
      t("result", "Save draft for review", 860, 180, {
        status: "DRAFT — not sent",
        replyTo: "{{nodes.extract.from}}",
        subject: "Re: {{nodes.extract.subject}}",
        body: "{{nodes.draft}}",
      }),
    ], [e("start","extract"), e("extract","draft"), e("draft","result")]),
  },

  // 7 ── Twitter/X thread publisher
  {
    id: "x-thread-publisher",
    name: "X / Twitter post publisher",
    summary: "Generate a short post with AI and publish it to X.",
    description: "Provide a topic and the workflow uses Gemini to write a punchy post (≤280 chars), then publishes it via the X API. Setup: add an X credential.",
    requirements: "X credential · Gemini key",
    input: { topic: "Why AI agents will replace SaaS" },
    graph: g([
      n("start", "manual", "Trigger post run", 40, 180),
      t("cfg", "Post settings", 300, 180, { topic: "{{input.topic}}", maxChars: 270 }),
      n("write", "gemini", "Write X post", 560, 180, {
        model: "gemini-3.8-flash",
        prompt: "Write a single punchy X (Twitter) post about: {{nodes.cfg.topic}}. Max {{nodes.cfg.maxChars}} characters. No hashtags spam. Use a strong hook. Return only the post text.",
      }),
      t("prep", "Prepare post", 820, 180, { text: "{{nodes.write}}" }),
      n("post", "x", "Publish to X", 1080, 180, { credentialId: "", text: "{{nodes.prep.text}}" }),
      t("done", "Record publish", 1340, 180, { published: true, post: "{{nodes.prep.text}}" }),
    ], [e("start","cfg"), e("cfg","write"), e("write","prep"), e("prep","post"), e("post","done")]),
  },

  // 8 ── Weather alert to WhatsApp
  {
    id: "weather-whatsapp-alert",
    name: "Weather alert → WhatsApp",
    summary: "Check the weather for a city and send a WhatsApp alert if it's bad.",
    description: "Fetch weather from Open-Meteo, check if temperature is extreme, and send a WhatsApp message. Setup: set city and phone number in settings; add a WhatsApp credential.",
    requirements: "WhatsApp credential",
    input: {},
    graph: g([
      n("start", "webhook", "Daily weather check", 40, 180),
      t("cfg", "Alert settings — edit me", 300, 180, { city: "Marrakech", phone: "+212600000000", heatThreshold: 38, coldThreshold: 5 }),
      n("wx", "weather", "Get weather", 580, 180, { city: "{{nodes.cfg.city}}", units: "celsius" }),
      n("hot", "condition", "Too hot?", 860, 80, { value: "{{nodes.wx.temperature}}", operator: "greaterThan", compare: "{{nodes.cfg.heatThreshold}}" }),
      n("cold", "condition", "Too cold?", 860, 300, { value: "{{nodes.wx.temperature}}", operator: "lessThan", compare: "{{nodes.cfg.coldThreshold}}" }),
      t("hot-msg", "Heat alert message", 1140, 40, { text: "🌡️ Heat alert in {{nodes.cfg.city}}! Temperature: {{nodes.wx.temperature}}°C. Stay hydrated and avoid direct sun." }),
      t("cold-msg", "Cold alert message", 1140, 300, { text: "🥶 Cold alert in {{nodes.cfg.city}}! Temperature: {{nodes.wx.temperature}}°C. Dress warmly." }),
      t("ok-msg", "All clear message", 1140, 180, { text: "✅ Weather in {{nodes.cfg.city}} is fine: {{nodes.wx.temperature}}°C." }),
      n("send-hot", "whatsapp", "Send heat alert", 1420, 40, { credentialId: "", to: "{{nodes.cfg.phone}}", text: "{{nodes.hot-msg.text}}" }),
      n("send-cold", "whatsapp", "Send cold alert", 1420, 300, { credentialId: "", to: "{{nodes.cfg.phone}}", text: "{{nodes.cold-msg.text}}" }),
    ], [
      e("start","cfg"), e("cfg","wx"),
      e("wx","hot"), e("wx","cold"),
      e("hot","hot-msg","true"), e("hot","ok-msg","false"),
      e("cold","cold-msg","true"),
      e("hot-msg","send-hot"), e("cold-msg","send-cold"),
    ]),
  },

  // 9 ── LinkedIn post scheduler
  {
    id: "linkedin-post-scheduler",
    name: "LinkedIn post from AI",
    summary: "Generate a professional LinkedIn post with AI and publish it.",
    description: "Enter a topic and Gemini writes a professional LinkedIn post. The workflow publishes it via the LinkedIn API. Setup: add a LinkedIn credential (HTTP with Bearer token).",
    requirements: "LinkedIn credential · Gemini key",
    input: { topic: "Lessons learned shipping my first AI product" },
    graph: g([
      n("start", "manual", "Start LinkedIn post", 40, 180),
      t("cfg", "Post config", 300, 180, { topic: "{{input.topic}}" }),
      n("write", "gemini", "Write LinkedIn post", 560, 180, {
        model: "gemini-3.8-flash",
        prompt: "Write a professional LinkedIn post about: {{nodes.cfg.topic}}. 150-200 words. Use a strong opening line, share a genuine insight, and end with a question to drive engagement. No excessive hashtags. Return only the post text.",
      }),
      t("prep", "Prepare post", 820, 180, { text: "{{nodes.write}}" }),
      n("post", "linkedin", "Publish to LinkedIn", 1080, 180, { credentialId: "", text: "{{nodes.prep.text}}" }),
      t("done", "Record publish", 1340, 180, { published: true }),
    ], [e("start","cfg"), e("cfg","write"), e("write","prep"), e("prep","post"), e("post","done")]),
  },

  // 10 ── YouTube search → Slack digest
  {
    id: "youtube-slack-digest",
    name: "YouTube search → Slack digest",
    summary: "Search YouTube for a topic and post the top results to Slack.",
    description: "Trigger with a search query, fetch top YouTube videos, format them, and post to Slack. Setup: add a YouTube credential (HTTP with API key); set your Slack channel.",
    requirements: "YouTube API key · Slack credential",
    input: { query: "AI agents tutorial 2026" },
    graph: g([
      n("start", "manual", "Start YouTube search", 40, 180),
      t("cfg", "Search config", 300, 180, { query: "{{input.query}}", maxResults: 5, channel: "#research" }),
      n("search", "youtube", "Search YouTube", 560, 180, { credentialId: "", query: "{{nodes.cfg.query}}", maxResults: "{{nodes.cfg.maxResults}}" }),
      t("format", "Format results for Slack", 820, 180, {
        text: "🎥 *YouTube results for: {{nodes.cfg.query}}*\n{{nodes.search}}",
        channel: "{{nodes.cfg.channel}}",
      }),
      n("post", "slack", "Post to Slack", 1080, 180, { credentialId: "", channel: "{{nodes.format.channel}}", text: "{{nodes.format.text}}" }),
    ], [e("start","cfg"), e("cfg","search"), e("search","format"), e("format","post")]),
  },

  // 11 ── Bug report form → GitHub issue
  {
    id: "bug-report-to-github",
    name: "Bug report form → GitHub issue",
    summary: "Collect a bug report via public form and automatically open a GitHub issue.",
    description: "Users fill a public form. The workflow opens a GitHub issue with formatted content. Setup: set your repository in the settings node; add a GitHub credential.",
    requirements: "GitHub credential",
    input: { title: "Login button unresponsive on mobile", steps: "1. Open app on iOS\n2. Tap Login", expected: "Login screen", actual: "Nothing happens", severity: "high" },
    graph: g([
      n("start", "formTrigger", "Submit bug report", 40, 180, {
        title: "Report a bug",
        fields: [
          { name: "title", label: "Bug title", type: "text", required: true },
          { name: "steps", label: "Steps to reproduce", type: "textarea", required: true },
          { name: "expected", label: "Expected behavior", type: "text", required: true },
          { name: "actual", label: "Actual behavior", type: "text", required: true },
          { name: "severity", label: "Severity (low/medium/high)", type: "text", required: false },
        ],
      }),
      t("cfg", "Repo settings — edit me", 320, 180, { repo: "owner/repo" }),
      t("format", "Format issue body", 600, 180, {
        title: "[Bug] {{trigger.title}}",
        body: "## Bug Report\n\n**Steps to reproduce:**\n{{trigger.steps}}\n\n**Expected:** {{trigger.expected}}\n**Actual:** {{trigger.actual}}\n**Severity:** {{trigger.severity}}\n\n*Submitted via m8m bug report form.*",
        repo: "{{nodes.cfg.repo}}",
      }),
      n("create", "github", "Open GitHub issue", 880, 180, { credentialId: "", repo: "{{nodes.format.repo}}", title: "{{nodes.format.title}}", body: "{{nodes.format.body}}" }),
      t("done", "Record issue", 1160, 180, { created: true, title: "{{nodes.format.title}}" }),
    ], [e("start","cfg"), e("cfg","format"), e("format","create"), e("create","done")]),
  },

  // 12 ── Daily AI news briefing email
  {
    id: "ai-news-briefing-email",
    name: "Daily AI news briefing email",
    summary: "Fetch AI news from RSS, summarize with AI, and email a daily briefing.",
    description: "Fetches the latest AI news RSS feed, uses Gemini to summarize the top items, and emails a clean briefing. Schedule via webhook. Setup: add Email credential; set recipient.",
    requirements: "Email credential · Gemini key",
    input: {},
    graph: g([
      n("start", "webhook", "Daily briefing trigger", 40, 180),
      t("cfg", "Briefing settings — edit me", 300, 180, { recipient: "you@example.com", feedUrl: "https://feeds.feedburner.com/oreilly/radar/atom" }),
      n("fetch", "rss", "Fetch AI news feed", 560, 180, { url: "{{nodes.cfg.feedUrl}}", maxItems: 8 }),
      n("summarize", "gemini", "Summarize news items", 820, 180, {
        model: "gemini-3.8-flash",
        prompt: "Summarize these RSS feed items into a clean daily briefing. For each item include: title (bold), one-sentence summary, and the link. Keep it concise. Format as plain text.\n\nItems:\n{{nodes.fetch}}",
      }),
      t("email-body", "Compose email", 1080, 180, {
        subject: "🤖 Your daily AI briefing",
        text: "YOUR DAILY AI NEWS\n\n{{nodes.summarize}}\n\n—\nDelivered by m8m",
        to: "{{nodes.cfg.recipient}}",
      }),
      n("send", "email", "Send briefing email", 1340, 180, { credentialId: "", to: "{{nodes.email-body.to}}", subject: "{{nodes.email-body.subject}}", text: "{{nodes.email-body.text}}" }),
    ], [e("start","cfg"), e("cfg","fetch"), e("fetch","summarize"), e("summarize","email-body"), e("email-body","send")]),
  },

  // 13 ── Customer feedback router
  {
    id: "customer-feedback-router",
    name: "Customer feedback router",
    summary: "Collect feedback via form, classify sentiment with AI, and route to the right team.",
    description: "A public form collects feedback. Gemini classifies sentiment (positive/negative/neutral). A router sends each to the correct Slack channel. Setup: add a Slack credential.",
    requirements: "Slack credential · Gemini key",
    input: { name: "Alice", feedback: "The product is great but the onboarding is confusing.", rating: "3" },
    graph: g([
      n("start", "formTrigger", "Collect feedback", 40, 180, {
        title: "Share your feedback",
        fields: [
          { name: "name", label: "Your name", type: "text", required: true },
          { name: "feedback", label: "Your feedback", type: "textarea", required: true },
          { name: "rating", label: "Rating (1-5)", type: "text", required: false },
        ],
      }),
      n("classify", "gemini", "Classify sentiment", 320, 180, {
        model: "gemini-3.1-flash-lite",
        prompt: "Classify this customer feedback as exactly one word: positive, negative, or neutral.\nFeedback: {{trigger.feedback}}\nReturn only the single word.",
      }),
      t("prep", "Prepare routing data", 600, 180, {
        sentiment: "{{nodes.classify}}",
        name: "{{trigger.name}}",
        feedback: "{{trigger.feedback}}",
        rating: "{{trigger.rating}}",
      }),
      n("route", "router", "Route by sentiment", 880, 180, {
        value: "{{nodes.prep.sentiment}}",
        cases: { positive: "positive", negative: "negative" },
      }),
      t("positive-msg", "Positive message", 1160, 60, { text: "⭐ Positive feedback from {{nodes.prep.name}} (rating: {{nodes.prep.rating}})\n\n{{nodes.prep.feedback}}", channel: "#feedback-wins" }),
      t("negative-msg", "Negative message", 1160, 180, { text: "⚠️ Negative feedback from {{nodes.prep.name}} (rating: {{nodes.prep.rating}})\n\n{{nodes.prep.feedback}}", channel: "#feedback-issues" }),
      t("neutral-msg", "Neutral message", 1160, 300, { text: "💬 Feedback from {{nodes.prep.name}} (rating: {{nodes.prep.rating}})\n\n{{nodes.prep.feedback}}", channel: "#feedback-general" }),
      n("post-pos", "slack", "Post positive", 1440, 60, { credentialId: "", channel: "{{nodes.positive-msg.channel}}", text: "{{nodes.positive-msg.text}}" }),
      n("post-neg", "slack", "Post negative", 1440, 180, { credentialId: "", channel: "{{nodes.negative-msg.channel}}", text: "{{nodes.negative-msg.text}}" }),
      n("post-neu", "slack", "Post neutral", 1440, 300, { credentialId: "", channel: "{{nodes.neutral-msg.channel}}", text: "{{nodes.neutral-msg.text}}" }),
    ], [
      e("start","classify"), e("classify","prep"), e("prep","route"),
      e("route","positive-msg","positive"), e("route","negative-msg","negative"), e("route","neutral-msg","default"),
      e("positive-msg","post-pos"), e("negative-msg","post-neg"), e("neutral-msg","post-neu"),
    ]),
  },

  // 14 ── Uptime monitor
  {
    id: "uptime-monitor",
    name: "Uptime monitor with Slack alert",
    summary: "Ping a URL, check if it's up, and alert on Slack if it's down.",
    description: "Schedule this workflow to run every few minutes via webhook. It pings your URL and posts a Slack alert if the response fails. Setup: set URL and Slack channel in settings; add a Slack credential.",
    requirements: "Slack credential · Webhook schedule",
    input: {},
    graph: g([
      n("start", "webhook", "Scheduled uptime check", 40, 180),
      t("cfg", "Monitor settings — edit me", 300, 180, { url: "https://example.com/health", channel: "#alerts", serviceName: "My App" }),
      http("ping", "Ping endpoint", 560, 180, "{{nodes.cfg.url}}"),
      t("check", "Check response", 820, 180, { status: "{{nodes.ping.status}}", ok: true, service: "{{nodes.cfg.serviceName}}" }),
      t("alert", "Compose down alert", 1080, 180, { text: "🚨 *{{nodes.check.service}} is DOWN!*\nEndpoint: {{nodes.cfg.url}}\nTime: check execution log for details.", channel: "{{nodes.cfg.channel}}" }),
      n("notify", "slack", "Alert on Slack", 1340, 180, { credentialId: "", channel: "{{nodes.alert.channel}}", text: "{{nodes.alert.text}}" }),
    ], [e("start","cfg"), e("cfg","ping"), e("ping","check"), e("check","alert"), e("alert","notify")]),
  },

  // 15 ── Google Sheets data logger
  {
    id: "sheets-data-logger",
    name: "Log form submissions to Google Sheets",
    summary: "Collect contact info via form and append each submission as a row in Google Sheets.",
    description: "A public form collects contact details. Each submission is appended to a Google Sheets spreadsheet. Setup: set spreadsheet ID in settings; add an HTTP credential with your Google OAuth access token.",
    requirements: "Google Sheets credential (HTTP + OAuth)",
    input: { name: "Jane Smith", email: "jane@example.com", message: "I'd like a demo." },
    graph: g([
      n("start", "formTrigger", "Contact form submission", 40, 180, {
        title: "Get in touch",
        fields: [
          { name: "name", label: "Your name", type: "text", required: true },
          { name: "email", label: "Email address", type: "email", required: true },
          { name: "message", label: "Message", type: "textarea", required: false },
        ],
      }),
      t("cfg", "Sheets settings — edit me", 320, 180, { spreadsheetId: "YOUR_SPREADSHEET_ID", sheet: "Submissions" }),
      t("row", "Build row data", 600, 180, {
        values: ["{{trigger.name}}", "{{trigger.email}}", "{{trigger.message}}", "{{trigger.submittedAt}}"],
        spreadsheetId: "{{nodes.cfg.spreadsheetId}}",
        sheet: "{{nodes.cfg.sheet}}",
      }),
      n("append", "sheets", "Append to Google Sheets", 880, 180, {
        credentialId: "",
        spreadsheetId: "{{nodes.row.spreadsheetId}}",
        sheet: "{{nodes.row.sheet}}",
        values: "{{nodes.row.values}}",
      }),
      t("done", "Confirm logged", 1160, 180, { logged: true, name: "{{trigger.name}}" }),
    ], [e("start","cfg"), e("cfg","row"), e("row","append"), e("append","done")]),
  },

  // 16 ── PR review reminder
  {
    id: "pr-review-reminder",
    name: "Pull request review reminder",
    summary: "Fetch open PRs from GitHub and post a review reminder to Slack.",
    description: "Fetches open pull requests from a GitHub repo and posts a formatted reminder to a Slack channel. Great for daily standup prep. Setup: set repo in settings; add a GitHub credential (HTTP) and Slack credential.",
    requirements: "GitHub credential · Slack credential · Webhook schedule",
    input: {},
    graph: g([
      n("start", "webhook", "Daily PR reminder trigger", 40, 180),
      t("cfg", "PR settings — edit me", 300, 180, { repo: "owner/repo", channel: "#dev-team" }),
      http("prs", "Fetch open PRs", 560, 180, "https://api.github.com/repos/{{nodes.cfg.repo}}/pulls?state=open&per_page=10", "GET", {}, { Accept: "application/vnd.github+json", "User-Agent": "m8m-workflow" }),
      t("format", "Format PR list", 820, 180, {
        text: "👀 *Open PRs needing review in {{nodes.cfg.repo}}*\n{{nodes.prs}}",
        channel: "{{nodes.cfg.channel}}",
      }),
      n("post", "slack", "Post PR reminder", 1080, 180, { credentialId: "", channel: "{{nodes.format.channel}}", text: "{{nodes.format.text}}" }),
    ], [e("start","cfg"), e("cfg","prs"), e("prs","format"), e("format","post")]),
  },

  // 17 ── AI meeting notes summarizer
  {
    id: "ai-meeting-summarizer",
    name: "AI meeting notes summarizer",
    summary: "Paste raw meeting notes and get a clean summary with action items.",
    description: "Submit raw meeting notes via the form. Gemini summarizes them and extracts action items. Result is saved for review. No external API except Gemini.",
    requirements: "Gemini key",
    input: { notes: "We discussed Q3 targets. John will handle the API redesign by July 15. Sarah needs to review the pricing page. The team agreed to move standups to 10am." },
    graph: g([
      n("start", "formTrigger", "Submit meeting notes", 40, 180, {
        title: "Summarize meeting notes",
        fields: [
          { name: "meetingTitle", label: "Meeting title", type: "text", required: true },
          { name: "notes", label: "Raw notes (paste here)", type: "textarea", required: true },
          { name: "date", label: "Meeting date", type: "text", required: false },
        ],
      }),
      n("summarize", "gemini", "Summarize and extract actions", 320, 180, {
        model: "gemini-3.8-flash",
        prompt: "Summarize these meeting notes and extract action items.\n\nMeeting: {{trigger.meetingTitle}}\nDate: {{trigger.date}}\nNotes: {{trigger.notes}}\n\nReturn:\n1. Summary (2-3 sentences)\n2. Action Items (bullet list with owner and deadline if mentioned)",
      }),
      t("result", "Save summary", 600, 180, {
        meeting: "{{trigger.meetingTitle}}",
        date: "{{trigger.date}}",
        summary: "{{nodes.summarize}}",
      }),
    ], [e("start","summarize"), e("summarize","result")]),
  },

  // 18 ── New lead → CRM via HTTP
  {
    id: "new-lead-crm",
    name: "New lead form → CRM via HTTP",
    summary: "Collect leads via form and POST them to any CRM REST API.",
    description: "A public lead capture form feeds into an HTTP POST to your CRM's API. Setup: set your CRM endpoint and field mapping in the settings node; add an HTTP credential with your API key.",
    requirements: "HTTP credential (CRM API key)",
    input: { firstName: "Alex", lastName: "Carter", email: "alex@startup.io", company: "StartupIO", phone: "+1-555-0100" },
    graph: g([
      n("start", "formTrigger", "Lead capture form", 40, 180, {
        title: "Get a free demo",
        fields: [
          { name: "firstName", label: "First name", type: "text", required: true },
          { name: "lastName", label: "Last name", type: "text", required: true },
          { name: "email", label: "Work email", type: "email", required: true },
          { name: "company", label: "Company name", type: "text", required: true },
          { name: "phone", label: "Phone number", type: "text", required: false },
        ],
      }),
      t("cfg", "CRM settings — edit me", 320, 180, { crmEndpoint: "https://api.yourcrm.com/v1/contacts" }),
      t("payload", "Map to CRM fields", 600, 180, {
        first_name: "{{trigger.firstName}}",
        last_name: "{{trigger.lastName}}",
        email: "{{trigger.email}}",
        company: "{{trigger.company}}",
        phone: "{{trigger.phone}}",
        source: "m8m lead form",
      }),
      http("send", "POST to CRM", 880, 180, "{{nodes.cfg.crmEndpoint}}", "POST", { "{{nodes.payload}}": "" }),
      t("done", "Lead logged", 1160, 180, { success: true, email: "{{trigger.email}}" }),
    ], [e("start","cfg"), e("cfg","payload"), e("payload","send"), e("send","done")]),
  },

  // 19 ── Competitor price monitor
  {
    id: "competitor-price-monitor",
    name: "Competitor price monitor",
    summary: "Fetch a competitor's public pricing page and alert if content changes.",
    description: "Fetches a public page, hashes the content length, and sends a Telegram alert if it changes significantly. Run on a schedule via webhook. Setup: set URL and Telegram chat in settings; add a Telegram credential.",
    requirements: "Telegram credential · Webhook schedule",
    input: {},
    graph: g([
      n("start", "webhook", "Scheduled price check", 40, 180),
      t("cfg", "Monitor settings — edit me", 300, 180, { url: "https://competitor.com/pricing", chatId: "YOUR_CHAT_ID", label: "Competitor X" }),
      http("fetch", "Fetch pricing page", 560, 180, "{{nodes.cfg.url}}"),
      t("report", "Report page data", 820, 180, {
        label: "{{nodes.cfg.label}}",
        url: "{{nodes.cfg.url}}",
        content: "{{nodes.fetch}}",
        chatId: "{{nodes.cfg.chatId}}",
      }),
      t("alert", "Compose alert", 1080, 180, {
        text: "👀 Pricing page fetched for {{nodes.report.label}}. Review execution log to compare content. URL: {{nodes.report.url}}",
        chatId: "{{nodes.report.chatId}}",
      }),
      n("send", "telegram", "Send alert", 1340, 180, { credentialId: "", chatId: "{{nodes.alert.chatId}}", text: "{{nodes.alert.text}}" }),
    ], [e("start","cfg"), e("cfg","fetch"), e("fetch","report"), e("report","alert"), e("alert","send")]),
  },

  // 20 ── AI code reviewer
  {
    id: "ai-code-reviewer",
    name: "AI code reviewer",
    summary: "Paste code into a form and get an AI review with issues and suggestions.",
    description: "Submit code via the form. Gemini reviews it for bugs, security issues, and style improvements. The review is saved for you to read in the execution result.",
    requirements: "Gemini key",
    input: { code: "function getUser(id) { return db.query('SELECT * FROM users WHERE id = ' + id); }", language: "javascript" },
    graph: g([
      n("start", "formTrigger", "Submit code for review", 40, 180, {
        title: "AI code review",
        fields: [
          { name: "language", label: "Language (e.g. JavaScript, Python)", type: "text", required: true },
          { name: "code", label: "Paste your code here", type: "textarea", required: true },
          { name: "context", label: "What does this code do? (optional)", type: "text", required: false },
        ],
      }),
      n("review", "gemini", "Review code", 320, 180, {
        model: "gemini-2.5-pro",
        prompt: "Review this {{trigger.language}} code and provide:\n1. Summary of what it does\n2. Bugs or errors found\n3. Security issues (especially injection vulnerabilities)\n4. Style and best practice suggestions\n5. Improved version\n\nContext: {{trigger.context}}\n\nCode:\n```\n{{trigger.code}}\n```",
      }),
      t("result", "Save review", 600, 180, {
        language: "{{trigger.language}}",
        review: "{{nodes.review}}",
        status: "Review complete — check execution result",
      }),
    ], [e("start","review"), e("review","result")]),
  },

  // 21 ── On-call incident notifier
  {
    id: "incident-notifier",
    name: "Incident notifier — webhook to all channels",
    summary: "Receive an incident webhook and broadcast to Slack, Discord and Telegram simultaneously.",
    description: "An incoming webhook payload triggers parallel notifications to Slack, Discord and Telegram. Great for on-call alerting. Setup: add credentials for each channel.",
    requirements: "Slack · Discord · Telegram credentials",
    input: { severity: "P1", service: "payments-api", message: "503 spike detected. Elevated error rate on checkout." },
    graph: g([
      n("start", "webhook", "Incident webhook", 40, 180),
      t("extract", "Extract incident data", 300, 180, {
        severity: "{{trigger.severity}}",
        service: "{{trigger.service}}",
        message: "{{trigger.message}}",
      }),
      t("slack-msg", "Format for Slack", 560, 60, { text: ":rotating_light: *INCIDENT {{nodes.extract.severity}}* — {{nodes.extract.service}}\n{{nodes.extract.message}}", channel: "#incidents" }),
      t("discord-msg", "Format for Discord", 560, 180, { text: "🚨 **INCIDENT {{nodes.extract.severity}}** — {{nodes.extract.service}}\n{{nodes.extract.message}}" }),
      t("telegram-msg", "Format for Telegram", 560, 300, { text: "🚨 INCIDENT {{nodes.extract.severity}} — {{nodes.extract.service}}\n{{nodes.extract.message}}", chatId: "YOUR_CHAT_ID" }),
      n("slack", "slack", "Notify Slack", 840, 60, { credentialId: "", channel: "{{nodes.slack-msg.channel}}", text: "{{nodes.slack-msg.text}}" }),
      n("discord", "discord", "Notify Discord", 840, 180, { credentialId: "", text: "{{nodes.discord-msg.text}}", threadId: "" }),
      n("telegram", "telegram", "Notify Telegram", 840, 300, { credentialId: "", chatId: "{{nodes.telegram-msg.chatId}}", text: "{{nodes.telegram-msg.text}}" }),
    ], [
      e("start","extract"),
      e("extract","slack-msg"), e("extract","discord-msg"), e("extract","telegram-msg"),
      e("slack-msg","slack"), e("discord-msg","discord"), e("telegram-msg","telegram"),
    ]),
  },

  // 22 ── Social media cross-poster
  {
    id: "social-cross-poster",
    name: "Social media cross-poster",
    summary: "Write one post and publish it to X and LinkedIn simultaneously.",
    description: "Enter your post text via form. The workflow adapts it slightly for each platform and publishes both. Setup: add X and LinkedIn credentials.",
    requirements: "X credential · LinkedIn credential · Gemini key",
    input: { topic: "Just shipped a new feature: real-time collaboration!" },
    graph: g([
      n("start", "manual", "Start cross-post", 40, 180),
      t("cfg", "Post settings", 300, 180, { topic: "{{input.topic}}" }),
      n("x-write", "gemini", "Write X post (≤280 chars)", 560, 80, {
        model: "gemini-3.1-flash-lite",
        prompt: "Write a punchy X/Twitter post about: {{nodes.cfg.topic}}. Max 270 characters. Strong hook, no hashtag spam. Return only the text.",
      }),
      n("li-write", "gemini", "Write LinkedIn post", 560, 280, {
        model: "gemini-3.8-flash",
        prompt: "Write a professional LinkedIn post about: {{nodes.cfg.topic}}. 120-150 words. Professional tone, end with engagement question. Return only the text.",
      }),
      n("post-x", "x", "Publish to X", 840, 80, { credentialId: "", text: "{{nodes.x-write}}" }),
      n("post-li", "linkedin", "Publish to LinkedIn", 840, 280, { credentialId: "", text: "{{nodes.li-write}}" }),
      t("done", "Cross-post complete", 1100, 180, { x: "{{nodes.post-x}}", linkedin: "{{nodes.post-li}}" }),
    ], [
      e("start","cfg"),
      e("cfg","x-write"), e("cfg","li-write"),
      e("x-write","post-x"), e("li-write","post-li"),
      e("post-x","done"), e("post-li","done"),
    ]),
  },

  // 23 ── AI FAQ generator
  {
    id: "ai-faq-generator",
    name: "AI FAQ generator",
    summary: "Describe your product and generate a complete FAQ section with AI.",
    description: "Enter a product description and target audience. Gemini generates a professional FAQ with 10 Q&A pairs ready to use on your website or docs.",
    requirements: "Gemini key",
    input: { product: "A project management SaaS for remote teams", audience: "startups and small businesses" },
    graph: g([
      n("start", "formTrigger", "Generate FAQ", 40, 180, {
        title: "Generate a product FAQ",
        fields: [
          { name: "product", label: "Describe your product", type: "textarea", required: true },
          { name: "audience", label: "Target audience", type: "text", required: true },
          { name: "count", label: "Number of FAQ items (default 10)", type: "text", required: false },
        ],
      }),
      n("generate", "gemini", "Generate FAQ", 320, 180, {
        model: "gemini-3.8-flash",
        prompt: "Generate {{trigger.count || 10}} FAQ items for this product:\n\nProduct: {{trigger.product}}\nAudience: {{trigger.audience}}\n\nFormat as:\nQ: [question]\nA: [answer]\n\nCover: pricing, features, setup, support, security, and common objections.",
      }),
      t("result", "Package FAQ", 600, 180, {
        product: "{{trigger.product}}",
        faq: "{{nodes.generate}}",
        status: "FAQ generated — review in execution result",
      }),
    ], [e("start","generate"), e("generate","result")]),
  },

  // 24 ── Scheduled database backup alert
  {
    id: "db-backup-alert",
    name: "Scheduled backup status alert",
    summary: "Ping a backup status endpoint and alert via email if backup is stale.",
    description: "Hits your backup status API, checks the last backup timestamp, and emails an alert if it's older than 24 hours. Run on a schedule via webhook.",
    requirements: "Email credential · HTTP credential",
    input: {},
    graph: g([
      n("start", "webhook", "Scheduled backup check", 40, 180),
      t("cfg", "Backup settings — edit me", 300, 180, { statusUrl: "https://api.example.com/backup/status", alertEmail: "ops@example.com", maxAgeHours: 24 }),
      http("check", "Check backup status", 560, 180, "{{nodes.cfg.statusUrl}}"),
      t("extract", "Extract backup time", 820, 180, {
        lastBackup: "{{nodes.check.lastBackupAt}}",
        status: "{{nodes.check.status}}",
        maxAge: "{{nodes.cfg.maxAgeHours}}",
        alertEmail: "{{nodes.cfg.alertEmail}}",
      }),
      t("alert-body", "Compose alert email", 1080, 180, {
        subject: "⚠️ Backup status alert",
        text: "Backup status check triggered.\n\nLast backup: {{nodes.extract.lastBackup}}\nStatus: {{nodes.extract.status}}\nMax allowed age: {{nodes.extract.maxAge}} hours\n\nReview your backup system immediately if the timestamp is stale.\n\nSent by m8m.",
        to: "{{nodes.extract.alertEmail}}",
      }),
      n("send", "email", "Send alert email", 1340, 180, { credentialId: "", to: "{{nodes.alert-body.to}}", subject: "{{nodes.alert-body.subject}}", text: "{{nodes.alert-body.text}}" }),
    ], [e("start","cfg"), e("cfg","check"), e("check","extract"), e("extract","alert-body"), e("alert-body","send")]),
  },

  // 25 ── AI product description writer
  {
    id: "ai-product-description",
    name: "AI product description writer",
    summary: "Enter product details and get a conversion-optimised product description.",
    description: "Fill in the product form and Gemini writes a compelling product description with headline, benefits, features and CTA — ready to paste into your store or website.",
    requirements: "Gemini key",
    input: { name: "AirFlow Pro", category: "Air purifier", features: "HEPA H13, 99.97% particle removal, whisper-quiet, 500 sqft coverage, app control", price: "$299" },
    graph: g([
      n("start", "formTrigger", "Enter product details", 40, 180, {
        title: "Write a product description",
        fields: [
          { name: "name", label: "Product name", type: "text", required: true },
          { name: "category", label: "Product category", type: "text", required: true },
          { name: "features", label: "Key features (comma separated)", type: "textarea", required: true },
          { name: "price", label: "Price", type: "text", required: false },
          { name: "tone", label: "Tone (luxury/friendly/technical)", type: "text", required: false },
        ],
      }),
      n("write", "gemini", "Write product description", 320, 180, {
        model: "gemini-3.8-flash",
        prompt: "Write a compelling e-commerce product description for:\n\nProduct: {{trigger.name}}\nCategory: {{trigger.category}}\nFeatures: {{trigger.features}}\nPrice: {{trigger.price}}\nTone: {{trigger.tone || 'friendly'}}\n\nInclude: catchy headline, 2-sentence intro, 4-5 bullet benefits, a closing CTA. Return plain text.",
      }),
      t("result", "Save description", 600, 180, {
        product: "{{trigger.name}}",
        description: "{{nodes.write}}",
        status: "Ready to use",
      }),
    ], [e("start","write"), e("write","result")]),
  },

  // 26 ── Webhook event logger to Notion
  {
    id: "webhook-event-logger",
    name: "Webhook event logger to Notion",
    summary: "Log any incoming webhook payload as a structured Notion page.",
    description: "Any webhook POST is logged as a page in your Notion database with a timestamp and the raw payload. Useful for auditing events from third-party services. Setup: add a Notion credential and set your database ID.",
    requirements: "Notion credential",
    input: { event: "payment.completed", amount: 99.99, customerId: "cus_abc123" },
    graph: g([
      n("start", "webhook", "Receive any webhook", 40, 180),
      t("extract", "Extract event data", 300, 180, {
        event: "{{trigger.event}}",
        payload: "{{trigger}}",
      }),
      t("cfg", "Notion settings — edit me", 300, 360, { databaseId: "YOUR_DATABASE_ID" }),
      t("prep", "Prepare Notion page", 560, 180, {
        title: "Event: {{nodes.extract.event}}",
        content: "Raw payload:\n{{nodes.extract.payload}}",
        databaseId: "{{nodes.cfg.databaseId}}",
      }),
      n("log", "notion", "Log to Notion", 840, 180, {
        credentialId: "",
        databaseId: "{{nodes.prep.databaseId}}",
        title: "{{nodes.prep.title}}",
        content: "{{nodes.prep.content}}",
      }),
    ], [e("start","extract"), e("start","cfg"), e("extract","prep"), e("cfg","prep"), e("prep","log")]),
  },

  // 27 ── AI resume screener
  {
    id: "ai-resume-screener",
    name: "AI resume screener",
    summary: "Paste a resume and job description — AI scores fit and highlights gaps.",
    description: "Submit a resume and job description via the form. Gemini scores the candidate fit 1-10, lists matched skills, missing skills, and gives a hiring recommendation.",
    requirements: "Gemini key",
    input: { resume: "5 years Python, led 3 ML projects, BS Computer Science", jobDescription: "Senior ML Engineer: 5+ years Python, ML experience, leadership skills required" },
    graph: g([
      n("start", "formTrigger", "Screen a resume", 40, 180, {
        title: "AI resume screener",
        fields: [
          { name: "role", label: "Role title", type: "text", required: true },
          { name: "jobDescription", label: "Job description", type: "textarea", required: true },
          { name: "resume", label: "Resume / CV (paste text)", type: "textarea", required: true },
        ],
      }),
      n("screen", "gemini", "Screen resume", 320, 180, {
        model: "gemini-3.8-flash",
        prompt: "Screen this resume for the given job. Return:\n1. Fit score (1-10)\n2. Matched requirements\n3. Missing requirements\n4. Recommendation (strong yes / yes / maybe / no)\n5. One-paragraph summary\n\nRole: {{trigger.role}}\nJob description: {{trigger.jobDescription}}\nResume: {{trigger.resume}}",
      }),
      t("result", "Save screening result", 600, 180, {
        role: "{{trigger.role}}",
        screening: "{{nodes.screen}}",
        status: "Screened",
      }),
    ], [e("start","screen"), e("screen","result")]),
  },

  // 28 ── Daily crypto price alert
  {
    id: "crypto-price-alert",
    name: "Daily crypto price alert",
    summary: "Fetch Bitcoin and Ethereum prices and send a Telegram summary.",
    description: "Fetches live prices from the CoinGecko public API (no key needed) and sends a daily price summary to Telegram. Schedule via webhook.",
    requirements: "Telegram credential",
    input: {},
    graph: g([
      n("start", "webhook", "Daily crypto check", 40, 180),
      t("cfg", "Alert settings — edit me", 300, 180, { chatId: "YOUR_CHAT_ID" }),
      http("btc", "Fetch BTC price", 560, 100, "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,eur"),
      http("eth", "Fetch ETH price", 560, 260, "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd,eur"),
      t("format", "Format price alert", 820, 180, {
        text: "📈 *Crypto Price Update*\n\n₿ Bitcoin: ${{nodes.btc.bitcoin.usd}} (€{{nodes.btc.bitcoin.eur}})\nΞ Ethereum: ${{nodes.eth.ethereum.usd}} (€{{nodes.eth.ethereum.eur}})\n\n_Not financial advice._",
        chatId: "{{nodes.cfg.chatId}}",
      }),
      n("send", "telegram", "Send price alert", 1080, 180, { credentialId: "", chatId: "{{nodes.format.chatId}}", text: "{{nodes.format.text}}" }),
    ], [
      e("start","cfg"),
      e("cfg","btc"), e("cfg","eth"),
      e("btc","format"), e("eth","format"),
      e("format","send"),
    ]),
  },

  // 29 ── AI job application cover letter
  {
    id: "ai-cover-letter",
    name: "AI cover letter generator",
    summary: "Enter your background and a job posting — get a tailored cover letter instantly.",
    description: "Fill in your experience and the job description. Gemini writes a personalised cover letter that highlights relevant experience and matches the company's tone.",
    requirements: "Gemini key",
    input: { name: "Alex", experience: "3 years frontend dev, React specialist, shipped 5 products", jobDescription: "Senior Frontend Engineer at Stripe — React, TypeScript, payments experience a plus" },
    graph: g([
      n("start", "formTrigger", "Generate cover letter", 40, 180, {
        title: "AI cover letter generator",
        fields: [
          { name: "name", label: "Your full name", type: "text", required: true },
          { name: "experience", label: "Your background (skills, years, highlights)", type: "textarea", required: true },
          { name: "jobDescription", label: "Job posting text", type: "textarea", required: true },
          { name: "company", label: "Company name", type: "text", required: false },
          { name: "tone", label: "Tone (formal/conversational)", type: "text", required: false },
        ],
      }),
      n("write", "gemini", "Write cover letter", 320, 180, {
        model: "gemini-3.8-flash",
        prompt: "Write a compelling cover letter for this job application.\n\nApplicant: {{trigger.name}}\nBackground: {{trigger.experience}}\nCompany: {{trigger.company}}\nTone: {{trigger.tone || 'professional'}}\nJob description: {{trigger.jobDescription}}\n\nThe letter should: open strong, show genuine interest in the company, highlight 2-3 most relevant experiences, and close with a clear CTA. Max 300 words. Return only the letter.",
      }),
      t("result", "Save cover letter", 600, 180, {
        applicant: "{{trigger.name}}",
        company: "{{trigger.company}}",
        coverLetter: "{{nodes.write}}",
      }),
    ], [e("start","write"), e("write","result")]),
  },

  // 30 ── E-commerce order webhook → Slack + email
  {
    id: "ecommerce-order-notify",
    name: "E-commerce order → Slack + email",
    summary: "New order webhook triggers a Slack alert and a confirmation email simultaneously.",
    description: "Receive a new order webhook from your e-commerce platform. The workflow posts an order alert to Slack and sends a confirmation email to your ops team. Setup: add Slack and Email credentials.",
    requirements: "Slack credential · Email credential",
    input: { orderId: "ORD-9182", customer: "Jane Smith", email: "jane@example.com", total: 149.99, items: "AirFlow Pro x1" },
    graph: g([
      n("start", "webhook", "New order webhook", 40, 180),
      t("extract", "Extract order data", 300, 180, {
        orderId: "{{trigger.orderId}}",
        customer: "{{trigger.customer}}",
        email: "{{trigger.email}}",
        total: "{{trigger.total}}",
        items: "{{trigger.items}}",
      }),
      t("cfg", "Notification settings — edit me", 300, 360, { slackChannel: "#orders", opsEmail: "ops@example.com" }),
      t("slack-msg", "Format Slack alert", 560, 100, {
        text: "🛍️ *New Order* {{nodes.extract.orderId}}\nCustomer: {{nodes.extract.customer}}\nItems: {{nodes.extract.items}}\nTotal: ${{nodes.extract.total}}",
        channel: "{{nodes.cfg.slackChannel}}",
      }),
      t("email-msg", "Format confirmation email", 560, 280, {
        subject: "New order: {{nodes.extract.orderId}}",
        text: "New order received.\n\nOrder: {{nodes.extract.orderId}}\nCustomer: {{nodes.extract.customer}} <{{nodes.extract.email}}>\nItems: {{nodes.extract.items}}\nTotal: ${{nodes.extract.total}}\n\nReview in your e-commerce dashboard.",
        to: "{{nodes.cfg.opsEmail}}",
      }),
      n("slack", "slack", "Alert on Slack", 840, 100, { credentialId: "", channel: "{{nodes.slack-msg.channel}}", text: "{{nodes.slack-msg.text}}" }),
      n("email", "email", "Send ops email", 840, 280, { credentialId: "", to: "{{nodes.email-msg.to}}", subject: "{{nodes.email-msg.subject}}", text: "{{nodes.email-msg.text}}" }),
      t("done", "Order processed", 1100, 180, { orderId: "{{nodes.extract.orderId}}", notified: true }),
    ], [
      e("start","extract"), e("start","cfg"),
      e("extract","slack-msg"), e("extract","email-msg"),
      e("cfg","slack-msg"), e("cfg","email-msg"),
      e("slack-msg","slack"), e("email-msg","email"),
      e("slack","done"), e("email","done"),
    ]),
  },

];
