# Chapter 64 — Express vs NestJS

## 📖 Definitions

- **Express** — a minimalist, unopinionated Node.js web framework.
- **NestJS** — a TypeScript-first, opinionated framework built on top of Express (or optionally Fastify), inspired by Angular's architecture (modules, controllers, providers, decorators).

## 🔍 Comparison

| Aspect | Express | NestJS |
|--------|---------|--------|
| Style | Minimalist | Opinionated, modular |
| Language | JS/TS (either) | TypeScript-first |
| Architecture | You design it | Modules + DI built-in |
| DI | Manual | Built-in IoC container |
| Validation | Manual (Joi, Zod) | `class-validator` + DTOs |
| Boilerplate | Low | Higher (but consistent) |
| Testing | Roll-your-own setup | Built-in test utilities |
| Best for | Small services, prototypes, niche apps | Large enterprise apps, teams |
| Performance | Fast, minimal overhead | Slightly heavier (acceptable for most cases) |

## 💻 Code Example — Same Endpoint in Both

### Express

```js
// app.js
import express from "express";
import { z } from "zod";

const app = express();
app.use(express.json());

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const users = [];

app.post("/users", (req, res) => {
  const parsed = CreateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.flatten() });
  }
  const user = { id: users.length + 1, ...parsed.data };
  users.push(user);
  res.status(201).json(user);
});

app.listen(3000);
```

### NestJS

```ts
// user.dto.ts
import { IsEmail, MinLength } from "class-validator";

export class CreateUserDto {
  @IsEmail() email: string;
  @MinLength(8) password: string;
}

// user.controller.ts
@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }
}

// user.service.ts
@Injectable()
export class UserService {
  private users: any[] = [];
  create(dto: CreateUserDto) {
    const user = { id: this.users.length + 1, ...dto };
    this.users.push(user);
    return user;
  }
}

// user.module.ts
@Module({
  controllers: [UserController],
  providers:   [UserService],
})
export class UserModule {}

// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.listen(3000);
}
bootstrap();
```

Same endpoint — Nest is more code upfront, but **scales much better** as the app grows.

## 💻 Code Example — DI Difference

### Express (Manual)

```js
// You manually instantiate and wire dependencies
const db          = createDb();
const userRepo    = new UserRepository(db);
const userService = new UserService(userRepo);
const userCtrl    = new UserController(userService);

app.get("/users/:id", (req, res) => userCtrl.get(req, res));
```

### NestJS (Automatic)

```ts
@Injectable()
export class UserService {
  constructor(private readonly userRepo: UserRepository) {}    // ← injected automatically
}

// You declare in module, Nest handles the wiring:
@Module({
  providers: [UserService, UserRepository, DbProvider],
})
export class UserModule {}
```

## 💻 Code Example — Testing

```ts
// NestJS — easy to swap dependencies
const module = await Test.createTestingModule({
  controllers: [UserController],
  providers: [
    UserService,
    { provide: UserRepository, useValue: mockRepo },     // ← mock
  ],
}).compile();

const ctrl = module.get(UserController);
expect(await ctrl.get("1")).toEqual({ id: "1", name: "Mock" });
```

In Express you can do the same, but you build the harness yourself.

## 📊 When to Choose Which

| Scenario | Pick |
|----------|------|
| 1–2 endpoints, quick PoC | Express |
| Lambdas / small workers | Express / native handlers |
| Internal CLI / scripts | Express / none |
| Large team, complex domain | NestJS |
| Need OpenAPI, validation, DI out of the box | NestJS |
| You want strict structure to onboard juniors quickly | NestJS |

## 🎯 Likely Interview Questions

1. **Difference between Express and NestJS?**
2. **Why use NestJS over Express?** — Built-in DI, modules, validation, testing utilities, OpenAPI, guards/interceptors. Better for large codebases.
3. **What's NestJS inspired by?** — Angular (decorators, modules, providers).
4. **Can NestJS use Express under the hood?** — Yes, by default it uses Express. You can switch to Fastify for performance.

---

[← Testing Node APIs](../22-node-advanced/08-testing-node-apis.md) | [Index](../README.md) | [Next: Dependency Injection →](02-dependency-injection.md)
