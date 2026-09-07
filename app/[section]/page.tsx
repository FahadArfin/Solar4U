import { SolarApp } from "../solar-app";

const validSections = new Set([
  "products",
  "catalog",
  "deals",
  "solar-part-picker",
  "recommendations",
  "guides",
  "calculators",
  "planner",
  "diagrams",
  "community",
  "community-test",
  "dashboard",
  "admin",
  "diagnostics",
]);

export default async function SectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { section } = await params;
  const query = await searchParams;
  const pickerSearch = new URLSearchParams(
    Object.fromEntries(Object.entries(query).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : [])),
  ).toString();
  return <SolarApp section={validSections.has(section) ? section : "home"} pickerSearch={pickerSearch} />;
}
