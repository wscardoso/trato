import { z } from "zod";

/** Brazilian CPF check digits */
export function isValidCpf(raw: string): boolean {
  const cpf = raw.replace(/\D/g, "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let dig = (sum * 10) % 11;
  if (dig === 10) dig = 0;
  if (dig !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  dig = (sum * 10) % 11;
  if (dig === 10) dig = 0;
  return dig === Number(cpf[10]);
}

export function normalizePhoneE164(phone: string): string {
  let digits = phone.replace(/\D/g, "");

  // Collapse duplicated Brazil country code (e.g. 5555319… → 55319…)
  while (digits.startsWith("55") && digits.slice(2).startsWith("55")) {
    digits = digits.slice(2);
  }

  // Already has country code — never prefix 55 again (avoids 55+5531… → 555531…)
  if (digits.startsWith("55")) {
    return `+${digits}`;
  }

  // National number: DDD (2) + local (8–9)
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }

  if (phone.trim().startsWith("+") && digits.length >= 10) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

export function isValidBrazilPhone(phone: string): boolean {
  const e164 = normalizePhoneE164(phone);
  return /^\+55\d{10,11}$/.test(e164);
}

/** Strip HTML / script payloads from free-text fields (defense in depth). */
export function sanitizePlainText(value: string): string {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

export const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .transform(sanitizePlainText)
    .pipe(z.string().min(2, "Informe seu nome completo").max(120)),
  phone: z
    .string()
    .trim()
    .refine(isValidBrazilPhone, "Telefone inválido (DDD + número)"),
  email: z
    .string()
    .trim()
    .email("E-mail inválido")
    .optional()
    .or(z.literal("")),
  cpf: z
    .string()
    .trim()
    .refine((v) => v === "" || isValidCpf(v), "CPF inválido")
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .transform((v) => (typeof v === "string" && v ? sanitizePlainText(v) : v)),
});

export const createBookingSchema = z.object({
  tenantSlug: z.string().trim().min(1),
  serviceId: z.string().uuid(),
  staffId: z.string().uuid().nullable(),
  startsAt: z.string().datetime({ offset: true }),
  customer: customerSchema,
  source: z.string().default("public_web"),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CustomerFormInput = z.infer<typeof customerSchema>;

export const slotsQuerySchema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().uuid(),
  staffId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
