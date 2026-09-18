// Punto Lovera — modelo de datos (Drizzle ORM)
// Casa de remates: subastas de comercios y maquinaria, con pujas en vivo,
// sistema de créditos por comprobante de transferencia (sin pasarela de
// pago), y chat en la sala de subasta activa.
import { randomUUID } from 'crypto';
import {
  boolean,
  decimal,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const userRoleEnum = pgEnum('user_role', ['USER', 'MARTILLERO', 'ADMIN']);
export const auctionStatusEnum = pgEnum('auction_status', ['PROXIMA', 'ACTIVA', 'FINALIZADA', 'CANCELADA']);
export const voucherStatusEnum = pgEnum('voucher_status', ['PENDIENTE', 'APROBADO', 'RECHAZADO']);

const id = () => uuid('id').primaryKey().$defaultFn(() => randomUUID());

// ---------- Usuarios ----------

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: text('phone'),
  dni: text('dni'),
  role: userRoleEnum('role').notNull().default('USER'),

  emailVerified: boolean('email_verified').notNull().default(false),
  verificationToken: text('verification_token').unique(),
  verificationSentAt: timestamp('verification_sent_at'),

  resetToken: text('reset_token').unique(),
  resetTokenExpiry: timestamp('reset_token_expiry'),

  // Saldo de créditos disponible para pujar (se acredita cuando un admin
  // aprueba un comprobante subido en /creditos)
  creditBalance: decimal('credit_balance', { precision: 12, scale: 2 }).notNull().default('0'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ---------- Subastas y lotes ----------

export const auctions = pgTable('auctions', {
  id: id(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  location: text('location').notNull(),
  coverImageUrl: text('cover_image_url'),
  startsAt: timestamp('starts_at').notNull(),
  status: auctionStatusEnum('status').notNull().default('PROXIMA'),

  // cameraId del stream en rtsp-manager (Francis), cuando la subasta tiene
  // cámara en vivo activa. Null = sin video, solo chat/pujas.
  cameraId: text('camera_id'),

  createdById: uuid('created_by_id').references(() => users.id),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const lots = pgTable(
  'lots',
  {
    id: id(),
    auctionId: uuid('auction_id')
      .notNull()
      .references(() => auctions.id, { onDelete: 'cascade' }),

    number: integer('number').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    startingPrice: decimal('starting_price', { precision: 12, scale: 2 }).notNull(),
    currentPrice: decimal('current_price', { precision: 12, scale: 2 }).notNull(),
    bidIncrement: decimal('bid_increment', { precision: 12, scale: 2 }).notNull().default('1000'),
    sold: boolean('sold').notNull().default(false),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [unique('lots_auction_number_unique').on(table.auctionId, table.number)]
);

export const lotImages = pgTable('lot_images', {
  id: id(),
  lotId: uuid('lot_id')
    .notNull()
    .references(() => lots.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  position: integer('position').notNull().default(0),
});

// ---------- Pujas ----------

export const bids = pgTable('bids', {
  id: id(),
  lotId: uuid('lot_id')
    .notNull()
    .references(() => lots.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ---------- Chat de la subasta en vivo ----------

export const chatMessages = pgTable('chat_messages', {
  id: id(),
  auctionId: uuid('auction_id')
    .notNull()
    .references(() => auctions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  text: text('text').notNull(),
  isOffer: boolean('is_offer').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ---------- Créditos (comprobantes de transferencia) ----------

export const creditVouchers = pgTable('credit_vouchers', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  fileUrl: text('file_url').notNull(),
  status: voucherStatusEnum('status').notNull().default('PENDIENTE'),
  reviewedById: uuid('reviewed_by_id'),
  reviewedAt: timestamp('reviewed_at'),
  rejectionReason: text('rejection_reason'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ---------- Compras (historial en el panel de usuario) ----------

export const purchases = pgTable('purchases', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  lotId: uuid('lot_id')
    .notNull()
    .unique()
    .references(() => lots.id),
  reference: text('reference').notNull().unique(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ---------- Relaciones (para poder usar db.query.x.findMany({ with: {...} })) ----------

export const usersRelations = relations(users, ({ many }) => ({
  bids: many(bids),
  vouchers: many(creditVouchers),
  purchases: many(purchases),
  chatMessages: many(chatMessages),
}));

export const auctionsRelations = relations(auctions, ({ many, one }) => ({
  lots: many(lots),
  chatMessages: many(chatMessages),
  createdBy: one(users, { fields: [auctions.createdById], references: [users.id] }),
}));

export const lotsRelations = relations(lots, ({ one, many }) => ({
  auction: one(auctions, { fields: [lots.auctionId], references: [auctions.id] }),
  images: many(lotImages),
  bids: many(bids),
  purchase: one(purchases, { fields: [lots.id], references: [purchases.lotId] }),
}));

export const lotImagesRelations = relations(lotImages, ({ one }) => ({
  lot: one(lots, { fields: [lotImages.lotId], references: [lots.id] }),
}));

export const bidsRelations = relations(bids, ({ one }) => ({
  lot: one(lots, { fields: [bids.lotId], references: [lots.id] }),
  user: one(users, { fields: [bids.userId], references: [users.id] }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  auction: one(auctions, { fields: [chatMessages.auctionId], references: [auctions.id] }),
  user: one(users, { fields: [chatMessages.userId], references: [users.id] }),
}));

export const purchasesRelations = relations(purchases, ({ one }) => ({
  user: one(users, { fields: [purchases.userId], references: [users.id] }),
  lot: one(lots, { fields: [purchases.lotId], references: [lots.id] }),
}));
