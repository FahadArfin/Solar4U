import { SolarApp } from "../../solar-app";

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ product: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { product } = await params;
  const query = await searchParams;
  const requestedReturn = typeof query.returnTo === "string" ? query.returnTo : "";
  const returnTo = requestedReturn.startsWith("/solar-part-picker") ? requestedReturn : "/catalog";
  return <SolarApp section="product-detail" productId={decodeURIComponent(product)} productReturnTo={returnTo} />;
}
