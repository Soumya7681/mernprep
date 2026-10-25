# Chapter 72 — Guards, Middleware, Interceptors, Pipes, Filters

## 📖 Overview

NestJS provides five composable building blocks for cross-cutting concerns:

| Construct | Purpose | Where it runs |
|-----------|---------|---------------|
| **Middleware** | Pre-route work (logging, parsing) | Before guards |
| **Guards** | Authorization (true/false to allow/deny) | After middleware, before interceptors |
| **Interceptors** | Wrap handler — transform, cache, log timings | Around handler |
| **Pipes** | Transform/validate inputs | Before handler arguments are passed |
| **Exception filters** | Catch thrown errors | At the end (on error) |

### Execution Order

```
Request
  ↓
[ Middleware ]
  ↓
[ Guards ]            ← may reject 403
  ↓
[ Interceptors (before) ]
  ↓
[ Pipes ]             ← validates/transforms params
  ↓
[ Controller method ]
  ↓
[ Interceptors (after) ] ← transform response
  ↓
[ Exception filters ] ← if anything threw
  ↓
Response
```

## 💻 Code Example — Middleware

```ts
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log(`[${req.method}] ${req.url}`);
    next();
  }
}

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes("*");
  }
}
```

## 💻 Code Example — Auth Guard

```ts
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) throw new UnauthorizedException();

    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
      return true;
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }
}

@Controller("orders")
@UseGuards(JwtAuthGuard)
export class OrdersController { /* ... */ }
```

## 💻 Code Example — Roles Guard with Custom Decorator

```ts
// roles.decorator.ts
export const Roles = (...roles: string[]) => SetMetadata("roles", roles);

// roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.get<string[]>("roles", ctx.getHandler());
    if (!required) return true;

    const { user } = ctx.switchToHttp().getRequest();
    return required.some(r => user?.roles?.includes(r));
  }
}

// Usage
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  @Get("stats")
  @Roles("admin")
  getStats() { /* ... */ }
}
```

## 💻 Code Example — Logging Interceptor (Timing)

```ts
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const req = ctx.switchToHttp().getRequest();
    return next.handle().pipe(
      tap(() => console.log(`${req.method} ${req.url} - ${Date.now() - start}ms`)),
    );
  }
}

@UseInterceptors(LoggingInterceptor)
@Controller("orders")
export class OrdersController { /* ... */ }
```

## 💻 Code Example — Response Transform Interceptor

```ts
@Injectable()
export class WrapResponseInterceptor<T> implements NestInterceptor<T, { data: T }> {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(map(data => ({ data, ts: Date.now() })));
  }
}

// Apply globally
app.useGlobalInterceptors(new WrapResponseInterceptor());

// Now every response becomes: { data: ..., ts: ... }
```

## 💻 Code Example — Cache Interceptor

```ts
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private cache = new Map<string, any>();

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    const key = req.url;
    if (this.cache.has(key)) {
      return of(this.cache.get(key));
    }
    return next.handle().pipe(tap(data => this.cache.set(key, data)));
  }
}
```

## 💻 Code Example — Custom Pipe (ParseIntPipe is built-in)

```ts
@Injectable()
export class TrimPipe implements PipeTransform {
  transform(value: any) {
    if (typeof value === "string") return value.trim();
    if (value && typeof value === "object") {
      Object.keys(value).forEach(k => {
        if (typeof value[k] === "string") value[k] = value[k].trim();
      });
    }
    return value;
  }
}

@Post()
create(@Body(new TrimPipe()) dto: CreateUserDto) { /* ... */ }

// Built-in pipes
@Get(":id")
get(@Param("id", ParseIntPipe) id: number) {}
@Get()
list(@Query("active", new DefaultValuePipe(true), ParseBoolPipe) active: boolean) {}
```

## 💻 Code Example — Exception Filter

```ts
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx     = host.switchToHttp();
    const res     = ctx.getResponse<Response>();
    const req     = ctx.getRequest<Request>();
    const status  = exception.getStatus();
    const message = exception.getResponse();

    res.status(status).json({
      timestamp: new Date().toISOString(),
      path: req.url,
      error: message,
    });
  }
}

// Apply
app.useGlobalFilters(new HttpExceptionFilter());
```

## 💻 Code Example — All-Errors Filter (Catch Anything)

```ts
@Catch()                              // no argument = catch all
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const body = exception instanceof HttpException ? exception.getResponse()
                                                    : { error: "Internal server error" };
    res.status(status).json(body);
  }
}
```

## 💻 Code Example — Composing Everything

```ts
@Controller("users")
@UseGuards(JwtAuthGuard)
@UseInterceptors(LoggingInterceptor)
@UseFilters(HttpExceptionFilter)
export class UserController {
  @Get(":id")
  @Roles("admin")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }
}
```

## 🌍 Real-World Impact

- **Guards** centralize auth — controllers stay clean.
- **Interceptors** wrap every endpoint with logging/metrics in one line.
- **Pipes** ensure inputs are validated and transformed before reaching business logic.
- **Filters** standardize error responses across the API.

## 🎯 Likely Interview Questions

1. **What's the order of execution: middleware, guard, interceptor, pipe, filter?** (See diagram above.)
2. **Difference between a guard and middleware?** — Guards have access to `ExecutionContext` (controller class, handler metadata via `Reflector`); middleware does not. Use guards for auth.
3. **What is an interceptor?**
4. **How do you implement role-based access?**
5. **How do you customize error responses globally?**

---

[← DTOs & Validation](03-dtos-validation.md) | [Index](../README.md) | [Next: Swagger / OpenAPI →](05-swagger.md)
