# Chapter 90 — Mongoose with TypeScript

## 📖 Definition

Mongoose ships its own TypeScript types (no `@types/mongoose` needed since v5.11). You type a model by giving `Schema` and `model` generics — the **raw document interface**, the **model type** (for statics), and the **methods** interface — or by letting Mongoose **infer** the type from the schema with `InferSchemaType`.

## 🔍 Key Type Names

| Type | Meaning |
|------|---------|
| `IUser` (your interface) | Plain data shape stored in MongoDB |
| `HydratedDocument<IUser, IUserMethods>` | A full Mongoose document: data + `save()`, `_id`, methods |
| `Model<IUser, {}, IUserMethods>` | The model class — `User.find()`, `User.create()` |
| `InferSchemaType<typeof schema>` | Data type inferred from a schema definition |
| `Types.ObjectId` | ObjectId in documents/interfaces |
| `FlattenMaps<T>` / lean result | What `.lean()` returns — plain object, no methods |

## 💻 Code Example — Approach 1: Interface-First (most explicit)

```ts
// modules/users/user.model.ts
import { Schema, model, type Model, type HydratedDocument, type Types } from "mongoose";
import bcrypt from "bcrypt";

export type Role = "admin" | "user";

// 1. Raw document shape
export interface IUser {
  email: string;
  name: string;
  password: string;
  role: Role;
  isActive: boolean;
  orgId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// 2. Instance methods
export interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

// 3. Model type with statics
export interface UserModel extends Model<IUser, {}, IUserMethods> {
  findByEmail(email: string): Promise<UserDocument | null>;
}

export type UserDocument = HydratedDocument<IUser, IUserMethods>;

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    name:     { type: String, required: true, trim: true, maxlength: 80 },
    password: { type: String, required: true, select: false, minlength: 8 },
    role:     { type: String, enum: ["admin", "user"], default: "user" },
    isActive: { type: Boolean, default: true },
    orgId:    { type: Schema.Types.ObjectId, ref: "Org" },
  },
  { timestamps: true },
);

// Methods — `this` is typed as UserDocument
userSchema.method("comparePassword", function (candidate: string) {
  return bcrypt.compare(candidate, this.password);
});

// Statics — `this` is typed as UserModel
userSchema.static("findByEmail", function (email: string) {
  return this.findOne({ email: email.toLowerCase() }).select("+password");
});

// Hooks — Mongoose 8 supports async hooks without calling next()
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Remove secrets from every JSON response
userSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.password;
    delete ret._id;          // `id` virtual (string) is kept instead
    return ret;
  },
});

export const User = model<IUser, UserModel>("User", userSchema);
```

Usage — everything is typed:

```ts
const user = await User.findByEmail("a@b.com");   // UserDocument | null
if (user && (await user.comparePassword("secret"))) {
  user.role;                                      // "admin" | "user"
  // user.rol                                     ❌ compile error
}
```

## 💻 Code Example — Approach 2: Schema-First with `InferSchemaType`

```ts
import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const productSchema = new Schema(
  {
    name:  { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    tags:  { type: [String], default: [] },
    stock: { type: Number, default: 0 },
    category: { type: String, enum: ["book", "electronics", "toy"] as const, required: true },
  },
  { timestamps: true },
);

export type IProduct = InferSchemaType<typeof productSchema>;
// {
//   name: string; price: number; tags: string[]; stock: number;
//   category: "book" | "electronics" | "toy";
//   createdAt: NativeDate; updatedAt: NativeDate;
// }
export type ProductDocument = HydratedDocument<IProduct>;
export const Product = model("Product", productSchema);
```

| | Interface-first | Schema-first (`InferSchemaType`) |
|-|-----------------|----------------------------------|
| Source of truth | Interface (risk: schema drifts) | Schema (no duplication) |
| Methods/statics typing | Clear generics | Use `methods`/`statics` schema options |
| Readability | Explicit, easy to share | Type is "hidden" until hover |
| Good for | Shared/public types, complex models | Fast iteration, simple models |

## 💻 Code Example — References & Typed `populate`

```ts
import { Schema, model, type Types } from "mongoose";
import type { IUser } from "../users/user.model.js";

export interface IOrderItem { product: Types.ObjectId; qty: number; price: number }
export interface IOrder {
  user: Types.ObjectId;
  items: IOrderItem[];
  total: number;
  status: "pending" | "paid" | "shipped" | "cancelled";
}

const orderSchema = new Schema<IOrder>(
  {
    user:  { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: [{
      product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
      qty:     { type: Number, required: true, min: 1 },
      price:   { type: Number, required: true },
    }],
    total:  { type: Number, required: true },
    status: { type: String, enum: ["pending", "paid", "shipped", "cancelled"], default: "pending" },
  },
  { timestamps: true },
);
export const Order = model<IOrder>("Order", orderSchema);

// Without the generic, order.user stays Types.ObjectId after populate.
// Tell TS what populate replaced:
const order = await Order.findById(id)
  .populate<{ user: Pick<IUser, "name" | "email"> }>("user", "name email")
  .orFail();                     // throws DocumentNotFoundError instead of returning null

order.user.email;                // ✅ string
```

## 💻 Code Example — `.lean()` and Its Type

```ts
// Hydrated: full Document with getters, save(), virtuals — slower, more memory
const doc = await User.findById(id);           // UserDocument | null

// Lean: plain JS object — 3-5x faster for read-only endpoints
const plain = await User.findById(id).lean();  // (IUser & { _id: Types.ObjectId; __v: number }) | null
// plain.comparePassword  ❌ no methods on lean objects
// plain.save()           ❌
```

Use `.lean()` for list/read endpoints; use hydrated docs when you'll mutate and `save()` (so hooks and validation run).

## 💻 Code Example — Typed Service with Pagination

```ts
// modules/users/user.service.ts
import type { FilterQuery } from "mongoose";
import { User, type IUser } from "./user.model.js";
import { AppError } from "../../utils/AppError.js";
import type { Paginated } from "@app/shared";

export const userService = {
  async list(opts: { page: number; limit: number; search?: string }): Promise<Paginated<IUser>> {
    const filter: FilterQuery<IUser> = { isActive: true };
    if (opts.search) filter.name = { $regex: escapeRegex(opts.search), $options: "i" };

    const [items, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((opts.page - 1) * opts.limit)
        .limit(opts.limit)
        .lean<IUser[]>(),
      User.countDocuments(filter),
    ]);
    return { items, total, page: opts.page, limit: opts.limit };
  },

  async findById(id: string) {
    const user = await User.findById(id);
    if (!user) throw AppError.notFound("User");
    return user.toJSON();
  },

  async update(id: string, patch: Partial<Pick<IUser, "name" | "role">>) {
    const user = await User.findByIdAndUpdate(id, patch, {
      new: true,             // return the updated doc
      runValidators: true,   // validators are OFF by default on updates!
    });
    if (!user) throw AppError.notFound("User");
    return user.toJSON();
  },
};

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");   // prevents ReDoS/regex injection
}
```

> `FilterQuery<T>` was renamed to `QueryFilter<T>` in Mongoose 9 — check your version.

## 💻 Code Example — Transactions (Replica Set Required)

```ts
import mongoose from "mongoose";

export async function placeOrder(userId: string, items: { productId: string; qty: number }[]) {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      let total = 0;
      for (const { productId, qty } of items) {
        // Atomic decrement only if stock is sufficient
        const p = await Product.findOneAndUpdate(
          { _id: productId, stock: { $gte: qty } },
          { $inc: { stock: -qty } },
          { new: true, session },
        );
        if (!p) throw AppError.conflict(`Insufficient stock for ${productId}`);
        total += p.price * qty;
      }
      const [order] = await Order.create(
        [{ user: userId, items: items.map((i) => ({ product: i.productId, qty: i.qty, price: 0 })), total }],
        { session },
      );
      return order;
    });
  } finally {
    await session.endSession();
  }
}
```

`withTransaction` retries on transient errors and commits/aborts for you. Transactions need a **replica set** (Atlas always is; locally run `mongod --replSet rs0`).

## 💻 Code Example — Connection with Typed Events

```ts
import mongoose from "mongoose";

export async function connectDB(uri: string) {
  mongoose.set("strictQuery", true);       // unknown filter fields are dropped
  mongoose.connection.on("connected", () => console.log("Mongo connected"));
  mongoose.connection.on("error", (err: Error) => console.error("Mongo error", err));
  mongoose.connection.on("disconnected", () => console.warn("Mongo disconnected"));

  await mongoose.connect(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    autoIndex: process.env.NODE_ENV !== "production",   // build indexes via migrations in prod
  });
}
```

## 🌍 Real-World Impact

- Typed `populate` and `lean` eliminate the classic "is this an ObjectId or an object?" bug.
- `runValidators: true` and `orFail()` close two of the most common silent-data-corruption holes.
- Transactions + conditional `$inc` prevent overselling under concurrent checkouts.

## 🎯 Likely Interview Questions

1. **How do you type a Mongoose model?** — `Schema<IUser, UserModel, IUserMethods>` + `model<IUser, UserModel>()`, or `InferSchemaType`.
2. **What is `HydratedDocument`?** — The document type returned by queries: your fields + Mongoose document API + methods.
3. **What does `.lean()` return and when do you use it?** — Plain object, no getters/methods/virtuals; faster for read-only responses.
4. **Why aren't validators running on `findByIdAndUpdate`?** — Update validators are opt-in: `runValidators: true`.
5. **How do you type populated fields?** — `.populate<{ user: IUser }>("user")`.
6. **How do you prevent the password from leaking?** — `select: false` in schema + `toJSON` transform + DTO mapping.
7. **When do you need transactions in MongoDB?** — Multi-document atomic writes (order + stock). Single-doc ops are already atomic.
8. **`save()` vs `updateOne()`?** — `save()` runs all `save` hooks and full validation on a hydrated doc; `updateOne` is a single atomic DB op, faster, runs only query middleware.

---

[← Typed Express Server](03-typed-express-server.md) | [Index](../README.md) | [Next: Authentication End-to-End →](05-authentication-end-to-end.md)
