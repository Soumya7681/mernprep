# Chapter 73 — Swagger / OpenAPI in NestJS

## 📖 Definition

**OpenAPI** (formerly Swagger) is a standard for describing REST APIs. The **`@nestjs/swagger`** module generates this spec automatically from your decorators and DTOs.

## 🔍 What You Get

- Interactive docs at `/docs` (try-it-out, request/response examples).
- Auto-generated client SDKs (via `openapi-generator`).
- Schema validation that stays in sync with the code.

## 💻 Code Example — Bootstrap

```ts
// main.ts
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle("Hyscaler API")
    .setDescription("Internal API for the dashboard")
    .setVersion("1.0")
    .addBearerAuth()
    .addTag("users")
    .addTag("orders")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);   // → http://localhost:3000/docs

  await app.listen(3000);
}
bootstrap();
```

## 💻 Code Example — Documenting a Controller

```ts
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from "@nestjs/swagger";

@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class UserController {
  @Post()
  @ApiOperation({ summary: "Create a user" })
  @ApiResponse({ status: 201, description: "Created", type: UserDto })
  @ApiResponse({ status: 400, description: "Validation failed" })
  @ApiResponse({ status: 409, description: "Email already in use" })
  create(@Body() dto: CreateUserDto): Promise<UserDto> {
    return this.service.create(dto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get user by id" })
  @ApiParam({ name: "id", type: "string", format: "uuid" })
  @ApiResponse({ status: 200, type: UserDto })
  @ApiResponse({ status: 404, description: "Not found" })
  get(@Param("id") id: string): Promise<UserDto> {
    return this.service.findById(id);
  }
}
```

## 💻 Code Example — DTO with `@ApiProperty`

```ts
import { ApiProperty } from "@nestjs/swagger";

export class CreateUserDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "S3cret!23", minLength: 8 })
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: Role, default: Role.USER, required: false })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

export class UserDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty({ enum: Role }) role: Role;
  @ApiProperty() createdAt: Date;
}
```

## 💻 Code Example — CLI Plugin (Less Boilerplate)

```json
// nest-cli.json
{
  "compilerOptions": {
    "plugins": ["@nestjs/swagger"]
  }
}
```

With this plugin, most `@ApiProperty()` decorators are inferred from the TypeScript types — you only add them when overriding (examples, descriptions, etc.).

## 💻 Code Example — Reusable Decorators

```ts
// Combine common responses
export const ApiAuthResponses = () => applyDecorators(
  ApiBearerAuth(),
  ApiResponse({ status: 401, description: "Unauthorized" }),
  ApiResponse({ status: 403, description: "Forbidden" }),
);

@Get()
@ApiAuthResponses()
list() { /* ... */ }
```

## 💻 Code Example — Query Param Documentation

```ts
@Get()
@ApiQuery({ name: "page",   required: false, type: Number, example: 1 })
@ApiQuery({ name: "limit",  required: false, type: Number, example: 20 })
@ApiQuery({ name: "search", required: false, type: String })
list(@Query() query: ListQueryDto) { /* ... */ }
```

## 💻 Code Example — Authentication in Try-It-Out

```ts
.addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "JWT")
```

In the docs page, click "Authorize" → paste a token. All subsequent requests include the `Authorization: Bearer <token>` header.

## 💻 Code Example — Generating a Client SDK

```bash
# Export the spec
curl http://localhost:3000/docs-json > openapi.json

# Generate a typed TS client
npx @openapitools/openapi-generator-cli generate \
  -i openapi.json \
  -g typescript-fetch \
  -o ./client
```

Now your frontend can import strongly-typed API methods that stay in sync with the backend.

## 💻 Code Example — Excluding Internal Endpoints

```ts
@ApiExcludeController()
@Controller("internal")
export class InternalController { /* won't appear in docs */ }

@ApiExcludeEndpoint()
@Get("debug")
debug() {}
```

## 🌍 Real-World Impact

- New developers and external partners can explore the API without reading code.
- Postman / Insomnia can import the spec directly.
- Frontend SDKs are auto-generated → no drift between client and server.
- You already use Swagger at Hyscaler — mention this in interviews as a concrete win.

## 🎯 Likely Interview Questions

1. **What's OpenAPI vs Swagger?** — OpenAPI is the spec; Swagger is the original toolchain (now used loosely).
2. **How do you set up Swagger in NestJS?**
3. **How do you document a DTO?**
4. **How do you generate client SDKs?**
5. **How do you secure the Swagger docs in production?** — Behind auth middleware, or disable `/docs` in production.

---

[← Guards / Interceptors](04-guards-middleware-interceptors.md) | [Index](../README.md) | [Next: SQL vs NoSQL →](../05-mongodb/05-sql-vs-nosql.md)
