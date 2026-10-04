-- Los mails se guardan siempre en minúsculas (ver schemas/auth.schema.ts).
-- Si dos cuentas difieren solo en mayúsculas, la UNIQUE de users.email
-- hace fallar la migración: hay que unificarlas a mano antes.
UPDATE "users" SET "email" = lower(trim("email")) WHERE "email" <> lower(trim("email"));
