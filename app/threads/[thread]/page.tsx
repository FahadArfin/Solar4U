import { SolarApp } from "../../solar-app";

const threadIdPattern = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const publicNumberPattern = /-([0-9]+)$/;

export default async function ThreadPage({ params }: { params: Promise<{ thread: string }> }) {
  const { thread } = await params;
  const decoded = decodeURIComponent(thread);
  const reference = decoded.match(threadIdPattern)?.[1] || decoded.match(publicNumberPattern)?.[1] || "";

  return <SolarApp section="community" communityThreadId={reference} />;
}
