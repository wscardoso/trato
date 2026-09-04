export type PublicService = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceCents: number;
  category: string | null;
};

export type PublicStaff = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
};

export type PublicTenant = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  logoUrl: string | null;
  brandPrimary: string;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  maxAdvanceDays: number;
  slotIntervalMin: number;
  services: PublicService[];
  staff: PublicStaff[];
};

export type SlotDTO = {
  startsAt: string;
  endsAt: string;
  label: string;
  staffId?: string;
};

export type BookingStep =
  | "service"
  | "staff"
  | "datetime"
  | "customer"
  | "confirm"
  | "success";
