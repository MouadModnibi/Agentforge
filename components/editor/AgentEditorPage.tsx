"use client";
import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  Play,
  ArrowLeft,
  AlertCircle,
  Loader2,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { GeneralTab } from "./tabs/GeneralTab";
import { PromptTab } from "./tabs/PromptTab";
import { InputTab } from "./tabs/InputTab";
import { OutputTab } from "./tabs/OutputTab";
import { ResourcesTab } from "./tabs/ResourcesTab";
import { AdvancedTab } from "./tabs/AdvancedTab";
import { CustomToolTab } from "./tabs/CustomToolTab";
import { ExternalApisTab } from "./tabs/ExternalApisTab";
import { VersionHistoryDrawer } from "./VersionHistoryDrawer";
import {
  useAgent,
  useCreateAgent,
  useUpdateAgent,
} from "@/lib/hooks/useAgents";
import {
  AgentConfigSchema,
  CreateAgentSchema,
  type Agent,
  type AgentConfig,
  type CustomTool,
  type ExternalApi,
} from "@/lib/schemas/agent";
import { toast } from "sonner";
import { useAccount } from "@/lib/hooks/useAccount";

const DRAFT_KEY = (owner: string, id: string) => `m8m:draft:${owner}:${id}`;

interface AgentFormState {
  name: string;
  description: string;
  status: "draft" | "active";
  config: AgentConfig;
  customTool: CustomTool | null;
  externalApis: ExternalApi[];
}

const DEFAULT_CONFIG: AgentConfig = {
  model: "gemini-3.5-flash-lite",
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: "",
  inputParams: [],
  outputFormat: "json",
  outputSchema: "{}",
  strictValidation: false,
  maxIterations: 3,
  repairRetries: 1,
  timeoutMs: 30000,
};

const subscribeHydration = () => () => {};

export function AgentEditorPage({ agentId }: { agentId?: string }) {
  const { data: account } = useAccount();
  const router = useRouter();
  const {
    data: existingAgent,
    isLoading,
    isError,
    refetch,
  } = useAgent(agentId ?? "");
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
  if (!hydrated || !account || (agentId && isLoading))
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  if (agentId && (isError || !existingAgent))
    return (
      <div className="m-6 forge-empty">
        <span className="forge-empty-icon">
          <AlertCircle />
        </span>
        <h3>Couldn’t open this agent</h3>
        <p>The agent may have been deleted, or the connection failed.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/")}>
            Back to agents
          </Button>
          <Button onClick={() => refetch()}>Try again</Button>
        </div>
      </div>
    );
  return (
    <AgentEditorForm
      key={`${account.id}:${agentId ?? "new"}`}
      accountId={account.id}
      agentId={agentId}
      existingAgent={existingAgent}
    />
  );
}

function AgentEditorForm({
  accountId,
  agentId,
  existingAgent,
}: {
  accountId: string;
  agentId?: string;
  existingAgent?: Agent;
}) {
  const router = useRouter();
  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();

  const [initial] = useState(() => {
    try {
      const saved = localStorage.getItem(
        DRAFT_KEY(accountId, agentId ?? "__new__"),
      );
      if (saved) {
        const draft = CreateAgentSchema.safeParse(JSON.parse(saved));
        if (draft.success)
          return {
            form: {
              ...draft.data,
              config: AgentConfigSchema.parse(draft.data.config ?? {}),
              customTool: draft.data.customTool ?? null,
              externalApis: draft.data.externalApis ?? [],
            },
            unsaved: true,
          };
      }
    } catch {
      /* Ignore unavailable storage and invalid drafts. */
    }
    return {
      form: existingAgent
        ? {
            name: existingAgent.name,
            description: existingAgent.description,
            status: existingAgent.status,
            config: existingAgent.config,
            customTool: existingAgent.customTool,
            externalApis: existingAgent.externalApis,
          }
        : {
            name: "Untitled Agent",
            description: "",
            status: "draft" as const,
            config: DEFAULT_CONFIG,
            customTool: null,
            externalApis: [],
          },
      unsaved: false,
    };
  });
  const [form, setForm] = useState<AgentFormState>(initial.form);
  const [hasUnsaved, setHasUnsaved] = useState(initial.unsaved);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false);
  const draftId = agentId ?? "__new__";

  // Autosave draft to localStorage only (no LLM call)
  const saveDraft = useCallback(
    (state: AgentFormState) => {
      try {
        localStorage.setItem(
          DRAFT_KEY(accountId, draftId),
          JSON.stringify(state),
        );
      } catch {
        /* ignore */
      }
    },
    [draftId, accountId],
  );

  function updateForm(partial: Partial<AgentFormState>) {
    setForm((prev) => {
      const next = { ...prev, ...partial };
      setHasUnsaved(true);
      saveDraft(next);
      return next;
    });
  }

  function updateConfig(partial: Partial<AgentConfig>) {
    updateForm({ config: { ...form.config, ...partial } });
  }

  // Warn on navigation with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsaved) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);

  // Keyboard save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  async function handleSave() {
    if (isSaving) return;
    if (!form.name.trim()) {
      toast.error("Agent name is required");
      setActiveTab("general");
      return;
    }
    setIsSaving(true);
    try {
      if (agentId) {
        await updateAgent.mutateAsync({ id: agentId, data: form });
      } else {
        const agent = await createAgent.mutateAsync(form);
        localStorage.removeItem(DRAFT_KEY(accountId, "__new__"));
        router.replace(`/agents/${agent.id}/edit`);
      }
      localStorage.removeItem(DRAFT_KEY(accountId, draftId));
      setHasUnsaved(false);
    } catch {
      // Mutation hooks report the error; keep the draft available for retry.
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="forge-detail-page bg-background flex flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => router.push("/")}
            aria-label="Back to agents"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <input
            value={form.name}
            onChange={(e) => updateForm({ name: e.target.value })}
            className="text-sm font-medium bg-transparent border-none outline-none focus:ring-0 flex-1 min-w-0"
            placeholder="Agent name"
            aria-label="Agent name"
          />
          {hasUnsaved && (
            <Badge variant="warning" className="text-xs">
              <AlertCircle className="w-3 h-3 mr-1" />
              Unsaved
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => agentId && setVersionDrawerOpen(true)}
            disabled={!agentId}
            title="Version history"
          >
            <History className="w-3.5 h-3.5" />
            History
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              agentId && router.push(`/agents/${agentId}/playground`)
            }
            disabled={!agentId}
          >
            <Play className="w-3.5 h-3.5" />
            Test
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save
          </Button>
        </div>
      </header>

      <div className="forge-editor-content max-w-5xl mx-auto px-4 w-full flex-1">
        <div className="forge-editor-intro">
          <h1>{agentId ? "Agent settings" : "New agent"}</h1>
          <p>Define the model, instructions, and tools behind your agent.</p>
        </div>
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          orientation="vertical"
          className="m4m-agent-layout"
        >
          <TabsList
            className="mb-6 flex-wrap h-auto"
            aria-label="Agent configuration"
          >
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="prompt">Prompt</TabsTrigger>
            <TabsTrigger value="input">Input</TabsTrigger>
            <TabsTrigger value="output">Output</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="external-apis">External APIs</TabsTrigger>
            <TabsTrigger value="custom-tool">Custom Tool</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <GeneralTab
              form={form}
              onChange={updateForm}
              onConfigChange={updateConfig}
              config={form.config}
            />
          </TabsContent>
          <TabsContent value="prompt">
            <PromptTab config={form.config} onChange={updateConfig} />
          </TabsContent>
          <TabsContent value="input">
            <InputTab config={form.config} onChange={updateConfig} />
          </TabsContent>
          <TabsContent value="output">
            <OutputTab config={form.config} onChange={updateConfig} />
          </TabsContent>
          <TabsContent value="resources">
            <ResourcesTab agentId={agentId} />
          </TabsContent>
          <TabsContent value="external-apis">
            <ExternalApisTab
              externalApis={form.externalApis}
              onChange={(apis) => updateForm({ externalApis: apis })}
            />
          </TabsContent>
          <TabsContent value="custom-tool">
            <CustomToolTab
              customTool={form.customTool}
              onChange={(tool) => updateForm({ customTool: tool })}
            />
          </TabsContent>
          <TabsContent value="advanced">
            <AdvancedTab
              config={form.config}
              onChange={updateConfig}
              agentId={agentId}
              hasApiKey={!!existingAgent?.apiKeyHash}
              onApiKeyChanged={() =>
                updateAgent.mutate({ id: agentId!, data: {} })
              }
            />
          </TabsContent>
        </Tabs>
      </div>

      {agentId && (
        <VersionHistoryDrawer
          agentId={agentId}
          open={versionDrawerOpen}
          onClose={() => setVersionDrawerOpen(false)}
          onRestore={(snapshot) => {
            updateForm({
              name: snapshot.name,
              description: snapshot.description,
              status: snapshot.status,
              config: snapshot.config,
              customTool: snapshot.customTool,
              externalApis: snapshot.externalApis,
            });
          }}
        />
      )}
    </div>
  );
}
