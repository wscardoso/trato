import { z } from "zod";
import {
  isValidCpf,
  isValidEmail,
  onlyDigits,
  toPhoneE164,
} from "@/lib/formatters/br";

const uuid = z.string().uuid();

export const createBookingSchema = z.object({
  tenantSlug: z.string().min(1).max(120),
  serviceId: uuid,
  staffId: uuid.nullish(),
  startsAt: z.string().datetime({ offset: true }),
  notes: z.string().max(500).nullish(),
  source: z
    .enum(["public_web", "dashboard", "whatsapp"])
    .default("public_web"),
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    phone: z
      .string()
      .min(10)
      .transform((v) => toPhoneE164(v))
      .refine((v) => /^\+\d{12,15}$/.test(v), "Telefone inválido"),
    email: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined))
      .refine((v) => v === undefined || isValidEmail(v), "E-mail inválido"),
    cpf: z
      .string()
      .min(11)
      .transform((v) => onlyDigits(v))
      .refine(isValidCpf, "CPF inválido"),
  }),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const slotsQuerySchema = z.object({
  slug: z.string().min(1),
  serviceId: uuid,
  staffId: uuid.optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
});

export type SlotsQueryInput = z.infer<typeof slotsQuerySchema>;

export const customerFormSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome"),
  phone: z
    .string()
    .min(14, "Telefone incompleto")
    .refine((v) => onlyDigits(v).length >= 10, "Telefone inválido"),
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || isValidEmail(v), { message: "E-mail inválido" }),
  cpf: z.string().refine((v) => isValidCpf(v), "CPF inválido"),
  notes: z.string().max(500).optional(),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;
