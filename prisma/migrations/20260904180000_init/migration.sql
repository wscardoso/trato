-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('SUPER_ADMIN', 'OWNER', 'MANAGER', 'STAFF', 'RECEPTION');

-- CreateEnum
CREATE TYPE "public"."BookingStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('NONE', 'PENDING', 'PAID', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."PaymentProvider" AS ENUM ('NONE', 'ASAAS', 'STRIPE', 'PIX_MANUAL');

-- CreateEnum
CREATE TYPE "public"."NotificationChannel" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "public"."NotificationEvent" AS ENUM ('BOOKING_CREATED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_RESCHEDULED', 'REMINDER_24H', 'REMINDER_2H', 'FEEDBACK_POST_SERVICE', 'PAYMENT_REQUIRED', 'PAYMENT_RECEIVED');

-- CreateEnum
CREATE TYPE "public"."DayOfWeek" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- CreateEnum
CREATE TYPE "public"."StaffStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE');

-- CreateTable
CREATE TABLE "public"."tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "phone" TEXT,
    "whatsapp_e164" TEXT,
    "email" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "state" VARCHAR(2),
    "postal_code" TEXT,
    "country" CHAR(2) NOT NULL DEFAULT 'BR',
    "logo_url" TEXT,
    "brand_primary" TEXT,
    "custom_domain" TEXT,
    "slot_interval_min" INTEGER NOT NULL DEFAULT 15,
    "buffer_before_min" INTEGER NOT NULL DEFAULT 0,
    "buffer_after_min" INTEGER NOT NULL DEFAULT 0,
    "min_lead_min" INTEGER NOT NULL DEFAULT 60,
    "max_advance_days" INTEGER NOT NULL DEFAULT 60,
    "cancel_policy_min" INTEGER NOT NULL DEFAULT 120,
    "deposit_required" BOOLEAN NOT NULL DEFAULT false,
    "deposit_percent" INTEGER,
    "deposit_fixed_cents" INTEGER,
    "payment_provider" "public"."PaymentProvider" NOT NULL DEFAULT 'NONE',
    "asaas_api_key_enc" TEXT,
    "stripe_acct_id" TEXT,
    "wa_instance_id" TEXT,
    "wa_provider" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "auth_user_id" TEXT,
    "email" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'STAFF',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."staff" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "location_id" UUID,
    "display_name" TEXT NOT NULL,
    "bio" TEXT,
    "avatar_url" TEXT,
    "color" TEXT,
    "status" "public"."StaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "slot_interval_min" INTEGER,
    "buffer_before_min" INTEGER,
    "buffer_after_min" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."services" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration_min" INTEGER NOT NULL,
    "buffer_after_min" INTEGER NOT NULL DEFAULT 0,
    "price_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "category" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "requires_deposit" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."staff_services" (
    "staff_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,

    CONSTRAINT "staff_services_pkey" PRIMARY KEY ("staff_id","service_id")
);

-- CreateTable
CREATE TABLE "public"."availability_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "day_of_week" "public"."DayOfWeek" NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "break_start" TEXT,
    "break_end" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" DATE,
    "effective_to" DATE,

    CONSTRAINT "availability_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."availability_exceptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "is_day_off" BOOLEAN NOT NULL DEFAULT false,
    "start_time" TEXT,
    "end_time" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "email" CITEXT,
    "cpf" TEXT,
    "notes" TEXT,
    "marketing_opt_in" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bookings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "block_starts_at" TIMESTAMPTZ(6) NOT NULL,
    "block_ends_at" TIMESTAMPTZ(6) NOT NULL,
    "timezone" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "payment_status" "public"."PaymentStatus" NOT NULL DEFAULT 'NONE',
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'public_web',
    "cancellation_reason" TEXT,
    "cancelled_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "idempotency_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "provider" "public"."PaymentProvider" NOT NULL,
    "provider_ref" TEXT,
    "amount_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "checkout_url" TEXT,
    "pix_qr_code" TEXT,
    "raw_payload" JSONB,
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notification_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "booking_id" UUID,
    "customer_id" UUID,
    "channel" "public"."NotificationChannel" NOT NULL DEFAULT 'WHATSAPP',
    "event" "public"."NotificationEvent" NOT NULL,
    "to_e164" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "provider_msg_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "scheduled_for" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "public"."tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_custom_domain_key" ON "public"."tenants"("custom_domain");

-- CreateIndex
CREATE INDEX "locations_tenant_id_idx" ON "public"."locations"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_user_id_key" ON "public"."users"("auth_user_id");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "public"."users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "public"."users"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "staff_user_id_key" ON "public"."staff"("user_id");

-- CreateIndex
CREATE INDEX "staff_tenant_id_status_idx" ON "public"."staff"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "services_tenant_id_is_active_idx" ON "public"."services"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "staff_services_tenant_id_idx" ON "public"."staff_services"("tenant_id");

-- CreateIndex
CREATE INDEX "availability_rules_tenant_id_staff_id_day_of_week_idx" ON "public"."availability_rules"("tenant_id", "staff_id", "day_of_week");

-- CreateIndex
CREATE INDEX "availability_exceptions_tenant_id_staff_id_date_idx" ON "public"."availability_exceptions"("tenant_id", "staff_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "availability_exceptions_staff_id_date_key" ON "public"."availability_exceptions"("staff_id", "date");

-- CreateIndex
CREATE INDEX "customers_tenant_id_name_idx" ON "public"."customers"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenant_id_phone_e164_key" ON "public"."customers"("tenant_id", "phone_e164");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_idempotency_key_key" ON "public"."bookings"("idempotency_key");

-- CreateIndex
CREATE INDEX "bookings_tenant_id_staff_id_block_starts_at_block_ends_at_idx" ON "public"."bookings"("tenant_id", "staff_id", "block_starts_at", "block_ends_at");

-- CreateIndex
CREATE INDEX "bookings_tenant_id_starts_at_idx" ON "public"."bookings"("tenant_id", "starts_at");

-- CreateIndex
CREATE INDEX "bookings_tenant_id_customer_id_idx" ON "public"."bookings"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "bookings_tenant_id_status_idx" ON "public"."bookings"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "payments_tenant_id_booking_id_idx" ON "public"."payments"("tenant_id", "booking_id");

-- CreateIndex
CREATE INDEX "payments_provider_ref_idx" ON "public"."payments"("provider_ref");

-- CreateIndex
CREATE INDEX "notification_logs_tenant_id_event_status_idx" ON "public"."notification_logs"("tenant_id", "event", "status");

-- CreateIndex
CREATE INDEX "notification_logs_scheduled_for_status_idx" ON "public"."notification_logs"("scheduled_for", "status");

-- CreateIndex
CREATE INDEX "notification_logs_booking_id_event_idx" ON "public"."notification_logs"("booking_id", "event");

-- AddForeignKey
ALTER TABLE "public"."locations" ADD CONSTRAINT "locations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."staff" ADD CONSTRAINT "staff_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."staff" ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."staff" ADD CONSTRAINT "staff_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."services" ADD CONSTRAINT "services_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."staff_services" ADD CONSTRAINT "staff_services_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."staff_services" ADD CONSTRAINT "staff_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."availability_rules" ADD CONSTRAINT "availability_rules_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."availability_exceptions" ADD CONSTRAINT "availability_exceptions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification_logs" ADD CONSTRAINT "notification_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification_logs" ADD CONSTRAINT "notification_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prevent overlapping active bookings for the same staff (GiST)
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "public"."bookings"
  ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    staff_id WITH =,
    tstzrange(block_starts_at, block_ends_at, '[)') WITH &&
  )
  WHERE (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN'));
