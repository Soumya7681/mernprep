# Chapter 70 — Dependency Injection in NestJS

## 📖 Definition

**Dependency Injection (DI)** is a design pattern in which a class declares the dependencies it needs (usually in the constructor) and the framework supplies them at runtime, instead of the class instantiating them directly.

## 🔍 Why DI?

| Without DI | With DI |
|-----------|---------|
| Class creates its own deps → tight coupling | Class accepts deps → loose coupling |
| Hard to swap (e.g., mock in tests) | Easy to swap implementations |
| Singletons managed manually | Container manages lifetimes |

NestJS has a built-in **IoC (Inversion of Control)** container that:
1. Reads constructor parameter types (via TypeScript metadata).
2. Looks up matching providers in the module graph.
3. Instantiates and injects them.

## 💻 Code Example — Provider + Injection

```ts
// user.repository.ts
@Injectable()
export class UserRepository {
  findById(id: string) { /* … */ }
}

// user.service.ts
@Injectable()
export class UserService {
  constructor(private readonly repo: UserRepository) {}    // ← injected

  get(id: string) {
    return this.repo.findById(id);
  }
}

// user.controller.ts
@Controller("users")
export class UserController {
  constructor(private readonly service: UserService) {}    // ← injected

  @Get(":id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }
}

// user.module.ts
@Module({
  controllers: [UserController],
  providers: [UserService, UserRepository],
})
export class UserModule {}
```

Nest sees `UserController` needs `UserService`, which needs `UserRepository`. It instantiates them in order and injects.

## 💻 Code Example — Provider Types

```ts
// 1. Class provider (default)
{ provide: UserService, useClass: UserService }
// Shortcut: just UserService

// 2. Value provider
{ provide: "CONFIG", useValue: { apiKey: "abc" } }

// 3. Factory provider
{
  provide: "DB_CONNECTION",
  useFactory: async (config: ConfigService) => {
    return await connectDb(config.get("DB_URL"));
  },
  inject: [ConfigService],
}

// 4. Existing (alias)
{ provide: "USER_SVC", useExisting: UserService }
```

## 💻 Code Example — Injecting by Token

```ts
@Module({
  providers: [
    { provide: "STRIPE_KEY", useValue: process.env.STRIPE_KEY },
  ],
  exports: ["STRIPE_KEY"],
})
export class ConfigModule {}

@Injectable()
export class PaymentService {
  constructor(@Inject("STRIPE_KEY") private readonly key: string) {}
}
```

## 💻 Code Example — Scopes

```ts
@Injectable({ scope: Scope.DEFAULT })   // singleton — default
@Injectable({ scope: Scope.REQUEST })   // new instance per HTTP request
@Injectable({ scope: Scope.TRANSIENT }) // new instance per consumer
export class UserService { /* … */ }
```

- **DEFAULT** — best performance; share across all requests.
- **REQUEST** — useful when you need per-request state (current user, tenant id).
- **TRANSIENT** — for utility classes that should never be shared.

## 💻 Code Example — Module Sharing

```ts
@Module({
  providers: [DbConnection, UserRepository],
  exports:   [UserRepository],            // ← visible to importers
})
export class DbModule {}

@Module({
  imports:   [DbModule],                  // ← brings UserRepository into scope
  providers: [UserService],
})
export class UserModule {}
```

If a provider isn't `exports`-ed, it's private to its module.

## 💻 Code Example — Global Module

```ts
@Global()
@Module({
  providers: [LoggerService],
  exports:   [LoggerService],
})
export class LoggerModule {}

// Now LoggerService is available everywhere without importing LoggerModule.
```

Use sparingly — global modules can obscure dependencies.

## 💻 Code Example — Mocking in Tests

```ts
const module = await Test.createTestingModule({
  controllers: [UserController],
  providers: [
    UserService,
    { provide: UserRepository, useValue: { findById: jest.fn().mockReturnValue({ id: "1", name: "Mock" }) } },
  ],
}).compile();

const ctrl = module.get<UserController>(UserController);
expect(await ctrl.get("1")).toEqual({ id: "1", name: "Mock" });
```

## 💻 Code Example — Circular Dependencies

```ts
@Injectable()
export class A {
  constructor(@Inject(forwardRef(() => B)) private readonly b: B) {}
}

@Injectable()
export class B {
  constructor(@Inject(forwardRef(() => A)) private readonly a: A) {}
}
```

> ⚠️ Circular deps are a smell. Prefer extracting shared logic into a third class.

## 🌍 Real-World Impact

- DI makes large codebases maintainable; one service can be reused across HTTP, GraphQL, queue workers, CLI.
- Tests become trivial — inject mocks.
- The Nest module graph mirrors your domain — each feature is one module.

## 🎯 Likely Interview Questions

1. **What is Dependency Injection?**
2. **What's an `@Injectable()`?**
3. **What are the provider types in NestJS?**
4. **What are scopes?**
5. **How do you handle circular dependencies?** — `forwardRef`, or restructure to break the cycle.

---

[← Express vs NestJS](01-express-vs-nestjs.md) | [Index](../README.md) | [Next: DTOs & Validation →](03-dtos-validation.md)
