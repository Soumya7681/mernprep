# Chapter 73 — Mongoose Schemas

## 📖 Definition

A **Mongoose schema** defines the structure, types, defaults, validations, and hooks for documents in a MongoDB collection. The **model** is the class derived from the schema that you use to perform CRUD.

## 🔍 Why Schemas in a "Schemaless" DB?

MongoDB is flexible by design, but in production you want predictable shapes:
- Type safety (no `null` strings, no string-where-number).
- Validation at write time.
- Default values, timestamps, soft deletes.
- Pre/post hooks (hashing passwords, syncing timestamps).

## 💻 Code Example — Basic Schema

```js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  name:     { type: String, required: true },
  age:      { type: Number, min: 0, max: 120 },
  role:     { type: String, enum: ["admin", "user"], default: "user" },
  tags:     { type: [String], default: [] },
  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,                    // adds createdAt + updatedAt
});

export const User = mongoose.model("User", userSchema);
```

## 💻 Code Example — Nested Schema

```js
const addressSchema = new mongoose.Schema({
  street:  String,
  city:    String,
  country: String,
}, { _id: false });

const userSchema = new mongoose.Schema({
  name:    String,
  address: addressSchema,              // embedded
  addresses: [addressSchema],          // embedded array
});
```

## 💻 Code Example — References (Foreign Keys)

```js
const orderSchema = new mongoose.Schema({
  user:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    quantity: Number,
    price:    Number,
  }],
  status: { type: String, enum: ["pending", "paid", "shipped"], default: "pending" },
});

export const Order = mongoose.model("Order", orderSchema);

// Usage with populate
const order = await Order.findById(id)
  .populate("user", "name email")
  .populate("items.product", "name price");
```

## 💻 Code Example — Validation

```js
const productSchema = new mongoose.Schema({
  name:  { type: String, required: [true, "Name is required"], minlength: 3 },
  price: { type: Number, required: true, min: [0, "Price cannot be negative"] },
  sku:   {
    type: String,
    required: true,
    validate: {
      validator: (v) => /^[A-Z]{3}-\d{4}$/.test(v),
      message: "SKU must look like ABC-1234",
    },
  },
});
```

Invalid writes throw a `ValidationError`:
```js
try {
  await Product.create({ name: "x", price: -10, sku: "bad" });
} catch (err) {
  console.log(err.errors);              // structured per-field errors
}
```

## 💻 Code Example — Hooks (Middleware)

```js
import bcrypt from "bcrypt";

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.pre(["findOneAndUpdate", "updateOne"], function (next) {
  const update = this.getUpdate();
  if (update.password) {
    bcrypt.hash(update.password, 10).then(h => {
      this.setUpdate({ ...update, password: h });
      next();
    });
  } else next();
});

userSchema.post("save", function (doc, next) {
  console.log(`User ${doc.id} saved`);
  next();
});
```

## 💻 Code Example — Instance & Static Methods

```js
// Instance method — on a single document
userSchema.methods.checkPassword = async function (raw) {
  return bcrypt.compare(raw, this.password);
};

// Static method — on the model
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email });
};

// Usage
const user = await User.findByEmail("a@b.com").select("+password");
const ok = await user.checkPassword("input");
```

## 💻 Code Example — Virtuals (Computed Fields)

```js
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.set("toJSON", { virtuals: true });   // include in JSON output

// Usage
user.fullName;                           // "Soumya Rout"
```

## 💻 Code Example — Indexes Defined on Schema

```js
userSchema.index({ email: 1 });                                  // single field
userSchema.index({ role: 1, createdAt: -1 });                    // compound
userSchema.index({ name: "text" });                              // text search
userSchema.index({ tokenExpires: 1 }, { expireAfterSeconds: 0 }); // TTL
```

See [Chapter 47 — Indexing](02-indexing.md) for full details.

## 💻 Code Example — Discriminators (Polymorphism)

```js
const baseOpts = { discriminatorKey: "kind", collection: "events" };
const Event = mongoose.model("Event", new mongoose.Schema({ time: Date }, baseOpts));

const ClickEvent  = Event.discriminator("Click",  new mongoose.Schema({ url: String }));
const SignupEvent = Event.discriminator("Signup", new mongoose.Schema({ source: String }));

await ClickEvent.create({ time: new Date(), url: "/home" });
await SignupEvent.create({ time: new Date(), source: "ad-campaign" });

// Find both kinds in one query:
await Event.find();
// Find only clicks:
await ClickEvent.find();
```

## 💻 Code Example — NestJS Mongoose Module

```ts
// schemas/user.schema.ts
@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({ default: "user", enum: ["admin", "user"] })
  role: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// users.module.ts
@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
})
export class UsersModule {}

// users.service.ts
@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}
  findByEmail(email: string) {
    return this.userModel.findOne({ email });
  }
}
```

## 🌍 Real-World Impact

- Schemas catch bad data before it lands in your DB.
- Hooks centralize cross-cutting concerns like hashing or audit logs.
- Virtuals keep derived data out of the storage layer.

## 🎯 Likely Interview Questions

1. **What is Mongoose?** — An ODM (Object Data Modelling) library for Node.js on top of the MongoDB driver: schemas, type casting, validation, middleware, `populate`, and model methods.
2. **Why use schemas with a NoSQL DB?** — The database is flexible, but the application needs predictable shapes: validation at write time, defaults, hooks, and fewer `undefined` bugs.
3. **Difference between `pre` and `post` hooks?** — `pre` runs before the operation and can modify data or abort it (throw); `post` runs after and receives the result — good for logging, cache invalidation, events.
4. **How would you hash a password before saving?** — `pre("save")` hook: skip if `!this.isModified("password")`, else `this.password = await bcrypt.hash(this.password, 12)`; keep `select: false` on the field. Remember `save` hooks don't run on `updateOne`/`findOneAndUpdate`.
5. **What are virtuals?** — Computed properties (e.g. `fullName`) that are not stored in MongoDB; include them in output with `toJSON: { virtuals: true }`. Virtual populate can also link related collections without storing ids.
6. **Document middleware vs query middleware?** — Document middleware (`save`, `validate`, `deleteOne` on a doc) has `this` = document; query middleware (`find`, `updateOne`, `findOneAndUpdate`) has `this` = query. Updates via queries skip `save` hooks.
7. **What is `select: false`?** — Field is excluded from query results by default; opt in with `.select("+password")`.
8. **What are discriminators?** — Mongoose's way of storing several schemas (types) in one collection with a `kind` key — e.g. different event types sharing base fields.
9. **What is `timestamps: true`?** — Adds and maintains `createdAt` and `updatedAt` automatically.
10. **Instance methods vs statics?** — Methods operate on one document (`user.checkPassword()`); statics on the model (`User.findByEmail()`).

---

[← Data Modelling & Schema Patterns](07-data-modeling-patterns.md) | [Index](../README.md) | [Next: Indexing →](02-indexing.md)
