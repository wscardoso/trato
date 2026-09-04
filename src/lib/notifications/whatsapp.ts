/**
 * Canonical WhatsApp client lives in `@/lib/whatsapp` (uazapiGO).
 * This path re-exports for any legacy imports.
 */
export {
  enqueueBookingCreated,
  deliverWhatsAppForTest,
  type BookingNotifyContext,
} from "@/lib/whatsapp";
