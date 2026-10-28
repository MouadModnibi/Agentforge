import { PlaygroundPage } from "@/components/playground/PlaygroundPage";
export const metadata = { title: "Playground" };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PlaygroundPage key={id} agentId={id} />;
}
