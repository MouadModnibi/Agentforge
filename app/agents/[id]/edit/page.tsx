import { AgentEditorPage } from "@/components/editor/AgentEditorPage";
export const metadata = { title: "Agent studio" };

export default async function EditAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgentEditorPage agentId={id} />;
}
