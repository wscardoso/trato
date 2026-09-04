"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PublicService, PublicStaff } from "@/lib/booking/tenant";

export type BookingStep =
  | "service"
  | "staff"
  | "datetime"
  | "customer"
  | "confirm";

export type SelectedSlot = {
  startsAt: string;
  endsAt: string;
  label: string;
  dateLocal: string;
};

export type CustomerDraft = {
  name: string;
  phone: string;
  email: string;
  cpf: string;
  notes: string;
};

type BookingFlowState = {
  tenantSlug: string | null;
  step: BookingStep;
  service: PublicService | null;
  staffMode: "any" | "specific";
  staff: PublicStaff | null;
  dateLocal: string | null;
  slot: SelectedSlot | null;
  customer: CustomerDraft;
  submitting: boolean;
  submitError: string | null;
  hydrateTenant: (slug: string) => void;
  setStep: (step: BookingStep) => void;
  selectService: (service: PublicService) => void;
  selectStaffMode: (mode: "any" | "specific") => void;
  selectStaff: (staff: PublicStaff | null) => void;
  selectDate: (dateLocal: string) => void;
  selectSlot: (slot: SelectedSlot | null) => void;
  setCustomer: (patch: Partial<CustomerDraft>) => void;
  setSubmitting: (v: boolean) => void;
  setSubmitError: (msg: string | null) => void;
  reset: () => void;
};

const STEPS: BookingStep[] = [
  "service",
  "staff",
  "datetime",
  "customer",
  "confirm",
];

export function stepIndex(step: BookingStep): number {
  return STEPS.indexOf(step);
}

const emptyCustomer: CustomerDraft = {
  name: "",
  phone: "",
  email: "",
  cpf: "",
  notes: "",
};

export const useBookingFlow = create<BookingFlowState>()(
  persist(
    (set, get) => ({
      tenantSlug: null,
      step: "service",
      service: null,
      staffMode: "any",
      staff: null,
      dateLocal: null,
      slot: null,
      customer: emptyCustomer,
      submitting: false,
      submitError: null,
      hydrateTenant: (slug) => {
        if (get().tenantSlug === slug) return;
        set({
          tenantSlug: slug,
          step: "service",
          service: null,
          staffMode: "any",
          staff: null,
          dateLocal: null,
          slot: null,
          customer: emptyCustomer,
          submitting: false,
          submitError: null,
        });
      },
      setStep: (step) => set({ step, submitError: null }),
      selectService: (service) =>
        set({
          service,
          staff: null,
          staffMode: "any",
          slot: null,
          dateLocal: null,
          step: "staff",
        }),
      selectStaffMode: (staffMode) =>
        set((state) => ({
          staffMode,
          staff: staffMode === "any" ? null : state.staff,
          slot: null,
        })),
      selectStaff: (staff) =>
        set({
          staff,
          staffMode: staff ? "specific" : "any",
          slot: null,
        }),
      selectDate: (dateLocal) => set({ dateLocal, slot: null }),
      selectSlot: (slot) => set({ slot }),
      setCustomer: (patch) =>
        set((s) => ({ customer: { ...s.customer, ...patch } })),
      setSubmitting: (submitting) => set({ submitting }),
      setSubmitError: (submitError) => set({ submitError }),
      reset: () =>
        set({
          step: "service",
          service: null,
          staffMode: "any",
          staff: null,
          dateLocal: null,
          slot: null,
          customer: emptyCustomer,
          submitting: false,
          submitError: null,
        }),
    }),
    {
      name: "booking-flow-v1",
      partialize: (s) => ({
        tenantSlug: s.tenantSlug,
        step: s.step,
        service: s.service,
        staffMode: s.staffMode,
        staff: s.staff,
        dateLocal: s.dateLocal,
        slot: s.slot,
        customer: s.customer,
      }),
    },
  ),
);
