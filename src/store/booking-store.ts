"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BookingStep, PublicService, PublicStaff } from "@/types/booking";

export type CustomerDraft = {
  name: string;
  phone: string;
  email: string;
  cpf: string;
  notes: string;
};

type BookingState = {
  step: BookingStep;
  service: PublicService | null;
  staffMode: "any" | "specific";
  staff: PublicStaff | null;
  dateLocal: string | null;
  startsAt: string | null;
  endsAt: string | null;
  slotLabel: string | null;
  assignedStaffId: string | null;
  customer: CustomerDraft;
  bookingId: string | null;
  isSubmitting: boolean;
  setStep: (step: BookingStep) => void;
  selectService: (service: PublicService) => void;
  selectStaffAny: () => void;
  selectStaff: (staff: PublicStaff) => void;
  selectSlot: (slot: {
    startsAt: string;
    endsAt: string;
    label: string;
    staffId?: string;
  }) => void;
  setDateLocal: (date: string) => void;
  setCustomer: (patch: Partial<CustomerDraft>) => void;
  setBookingSuccess: (bookingId: string) => void;
  setSubmitting: (v: boolean) => void;
  reset: () => void;
};

const emptyCustomer: CustomerDraft = {
  name: "",
  phone: "",
  email: "",
  cpf: "",
  notes: "",
};

export const useBookingStore = create<BookingState>()(
  persist(
    (set) => ({
      step: "service",
      service: null,
      staffMode: "any",
      staff: null,
      dateLocal: null,
      startsAt: null,
      endsAt: null,
      slotLabel: null,
      assignedStaffId: null,
      customer: emptyCustomer,
      bookingId: null,
      isSubmitting: false,
      setStep: (step) => set({ step }),
      selectService: (service) =>
        set({
          service,
          staff: null,
          staffMode: "any",
          startsAt: null,
          endsAt: null,
          slotLabel: null,
          assignedStaffId: null,
          step: "staff",
        }),
      selectStaffAny: () =>
        set({
          staffMode: "any",
          staff: null,
          startsAt: null,
          endsAt: null,
          slotLabel: null,
          assignedStaffId: null,
          step: "datetime",
        }),
      selectStaff: (staff) =>
        set({
          staffMode: "specific",
          staff,
          startsAt: null,
          endsAt: null,
          slotLabel: null,
          assignedStaffId: staff.id,
          step: "datetime",
        }),
      setDateLocal: (dateLocal) =>
        set({
          dateLocal,
          startsAt: null,
          endsAt: null,
          slotLabel: null,
          assignedStaffId: null,
        }),
      selectSlot: (slot) =>
        set({
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          slotLabel: slot.label,
          assignedStaffId: slot.staffId ?? null,
          step: "customer",
        }),
      setCustomer: (patch) =>
        set((s) => ({ customer: { ...s.customer, ...patch } })),
      setBookingSuccess: (bookingId) =>
        set({ bookingId, step: "success", isSubmitting: false }),
      setSubmitting: (isSubmitting) => set({ isSubmitting }),
      reset: () =>
        set({
          step: "service",
          service: null,
          staffMode: "any",
          staff: null,
          dateLocal: null,
          startsAt: null,
          endsAt: null,
          slotLabel: null,
          assignedStaffId: null,
          customer: emptyCustomer,
          bookingId: null,
          isSubmitting: false,
        }),
    }),
    {
      name: "booking-wizard-v1",
      partialize: (s) => ({
        step: s.step === "success" ? "service" : s.step,
        service: s.service,
        staffMode: s.staffMode,
        staff: s.staff,
        dateLocal: s.dateLocal,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        slotLabel: s.slotLabel,
        assignedStaffId: s.assignedStaffId,
        customer: s.customer,
      }),
    },
  ),
);
