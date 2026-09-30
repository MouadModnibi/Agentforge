import { PlaygroundPage } from "@/components/playground/PlaygroundPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlaygroundPage agentId={id} />;
}
