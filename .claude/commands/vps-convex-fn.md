# VPS Control Room — Convex Function Pattern

Gunakan skill ini saat membuat atau memodifikasi Convex functions untuk project ini.

## Schema Pattern

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  table_name: defineTable({
    field: v.string(),
    optional_field: v.optional(v.string()),
    number_field: v.float64(),
    array_field: v.array(v.float64()),
    object_field: v.object({
      key: v.string(),
      value: v.float64(),
    }),
    metadata: v.optional(v.any()),
  })
    .index("by_field", ["field"])
    .index("by_compound", ["field", "number_field"]),
});
```

## Query Pattern

```typescript
// convex/<domain>.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const listItems = query({
  args: {
    // optional filters
    status: v.optional(v.string()),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("table_name");

    if (args.status) {
      q = q.withIndex("by_status", (q) => q.eq("status", args.status!));
    }

    q = q.order("desc");

    const limit = args.limit ?? 50;
    return await q.take(limit);
  },
});
```

## Mutation Pattern

```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Insert
export const insertItem = mutation({
  args: {
    field: v.string(),
    value: v.float64(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("table_name", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

// Upsert by unique field
export const upsertItem = mutation({
  args: {
    name: v.string(),
    status: v.string(),
    last_seen: v.float64(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("table_name")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        last_seen: args.last_seen,
      });
      return existing._id;
    }

    return await ctx.db.insert("table_name", args);
  },
});
```

## Cron Pattern (TTL Cleanup)

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("cleanup old events", { hours: 1 }, internal.events.cleanupOld);
crons.interval("cleanup old snapshots", { hours: 1 }, internal.snapshots.cleanupOld);

export default crons;
```

```typescript
// Di convex/events.ts
import { internalMutation } from "./_generated/server";

export const cleanupOld = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 hari
    const old = await ctx.db
      .query("events")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", cutoff))
      .take(100);

    for (const doc of old) {
      await ctx.db.delete(doc._id);
    }
  },
});
```

## Rules

- SELALU definisikan index di schema untuk setiap field yang dipakai di `withIndex`.
- Gunakan `v.float64()` untuk semua angka (Convex tidak punya `v.number()`... sebenarnya punya tapi `v.float64()` lebih eksplisit).
- Gunakan `v.optional()` untuk field yang boleh null.
- Pagination: gunakan `.take(limit)` untuk simple, atau `.paginate(opts)` untuk cursor-based.
- Internal mutations (dipanggil dari cron/action): gunakan `internalMutation`.
- Timestamp selalu `Date.now()` (epoch ms).

## Tables Project Ini

Lihat `/vps-prd` atau `PRD.md` section 11 untuk schema lengkap 7 tabel.
