import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTenantBySlug } from "@/lib/booking/tenant";
import { BookingWizard } from "@/components/booking/booking-wizard";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return { title: "Agendar" };
    return {
      title: `Agendar · ${tenant.name}`,
      description: tenant.address
        ? `Agende online em ${tenant.name} — ${tenant.address}`
        : `Agende online em ${tenant.name}`,
    };
  } catch {
    return { title: "Agendar" };
  }
}

export default async function AgendarPage({ params }: PageProps) {
  const { slug } = await params;

  let tenant;
  try {
    tenant = await getTenantBySlug(slug);
  } catch (err) {
    console.error("[agendar]", err);
    notFound();
  }

  if (!tenant) notFound();

  return <BookingWizard tenant={tenant} />;
}
