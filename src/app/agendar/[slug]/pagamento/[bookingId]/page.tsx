import { PixCheckout } from "@/components/booking/pix-checkout";

type Props = {
  params: Promise<{ slug: string; bookingId: string }>;
};

export default async function PagamentoPage({ params }: Props) {
  const { slug, bookingId } = await params;
  return (
    <div className="booking-shell min-h-dvh px-4 py-8">
      <div className="mx-auto max-w-md">
        <PixCheckout slug={slug} bookingId={bookingId} />
      </div>
    </div>
  );
}
