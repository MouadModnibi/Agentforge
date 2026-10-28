import { WorkflowEditor } from "@/components/workflows/WorkflowEditor";
export const metadata = { title: "Workflow editor" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <WorkflowEditor id={(await params).id} />;
}
