# Chapter 66 — DTOs and Validation

## 📖 Definition

A **DTO (Data Transfer Object)** is a class that defines the shape of incoming or outgoing data. In NestJS, DTOs are validated using **`class-validator`** decorators applied through the **`ValidationPipe`**.

## 🔍 Why DTOs?

- **Validation in one place** — decorators close to the data.
- **Type safety** — controllers receive a typed payload.
- **Documentation** — Swagger reads the same decorators.
- **Security** — `whitelist` strips unknown fields (mass assignment protection).

## 💻 Code Example — DTO with Validation

```ts
import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from "class-validator";

export enum Role { ADMIN = "admin", USER = "user" }

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
```

## 💻 Code Example — Global ValidationPipe

```ts
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,                  // strip unknown fields
    forbidNonWhitelisted: true,       // reject if extra fields exist
    transform: true,                  // transform plain JSON → DTO class
    transformOptions: { enableImplicitConversion: true },
  }));
  await app.listen(3000);
}
```

## 💻 Code Example — Using the DTO

```ts
@Controller("users")
export class UserController {
  @Post()
  create(@Body() dto: CreateUserDto) {
    // dto is already validated. If invalid, ValidationPipe responds 400.
    return this.userService.create(dto);
  }
}
```

Bad request body:
```json
{ "email": "not-an-email", "password": "123" }
```
Nest auto-responds:
```json
{
  "statusCode": 400,
  "message": [
    "email must be an email",
    "password must be longer than or equal to 8 characters"
  ],
  "error": "Bad Request"
}
```

## 💻 Code Example — Common Decorators

```ts
@IsString()
@IsNumber()
@IsBoolean()
@IsDate()
@IsArray()
@IsEmail()
@IsUrl()
@IsUUID()
@IsEnum(MyEnum)
@MinLength(3)
@MaxLength(50)
@Min(0)
@Max(120)
@Length(3, 50)
@Matches(/^[A-Z]/)
@IsOptional()                  // skip validation if undefined
@IsNotEmpty()
@IsDefined()                   // must not be undefined
@ArrayMinSize(1)
@ArrayMaxSize(10)
```

## 💻 Code Example — Nested DTOs

```ts
class AddressDto {
  @IsString() street: string;
  @IsString() city: string;
  @IsString() country: string;
}

class CreateUserDto {
  @IsString() name: string;

  @ValidateNested()
  @Type(() => AddressDto)            // required by class-transformer
  address: AddressDto;

  @ValidateNested({ each: true })
  @Type(() => AddressDto)
  pastAddresses: AddressDto[];
}
```

## 💻 Code Example — Custom Validator

```ts
import { ValidatorConstraint, ValidatorConstraintInterface, registerDecorator } from "class-validator";

@ValidatorConstraint({ async: true })
export class IsUniqueEmail implements ValidatorConstraintInterface {
  constructor(private readonly userService: UserService) {}
  async validate(email: string) {
    return !(await this.userService.findByEmail(email));
  }
  defaultMessage() { return "Email already in use"; }
}

// Usage
class CreateUserDto {
  @IsEmail()
  @Validate(IsUniqueEmail)
  email: string;
}
```

## 💻 Code Example — Transform (e.g., Trim, Lowercase)

```ts
import { Transform } from "class-transformer";

class CreateUserDto {
  @Transform(({ value }) => value?.toLowerCase().trim())
  @IsEmail()
  email: string;
}
```

## 💻 Code Example — Partial Update (PATCH) DTO

```ts
import { PartialType } from "@nestjs/mapped-types";

export class UpdateUserDto extends PartialType(CreateUserDto) {}
// All CreateUserDto fields become optional automatically.
```

## 💻 Code Example — Query Param DTO

```ts
class ListUsersQueryDto {
  @IsOptional() @IsInt() @Type(() => Number) @Min(1) page: number = 1;
  @IsOptional() @IsInt() @Type(() => Number) @Min(1) @Max(100) limit: number = 20;
  @IsOptional() @IsString() search?: string;
}

@Get()
list(@Query() query: ListUsersQueryDto) {
  return this.userService.list(query);
}
```

## 💻 Code Example — Plain JS Validation (Joi / Zod for Express)

```js
// Zod equivalent
import { z } from "zod";

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "user"]).optional(),
});

app.post("/users", (req, res) => {
  const result = CreateUserSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json(result.error.flatten());
  // result.data is now strongly typed
});
```

## 🌍 Real-World Impact

- DTOs catch ~80% of bad requests at the controller boundary.
- Swagger picks up the same decorators → docs stay in sync.
- `whitelist: true` prevents over-posting attacks (extra fields like `isAdmin`).

## 🎯 Likely Interview Questions

1. **What is a DTO?**
2. **How does NestJS validate requests?**
3. **What does `whitelist: true` do in ValidationPipe?**
4. **How do you validate nested objects?** — `@ValidateNested() + @Type(() => Nested)`.
5. **How would you do this in Express?** — Joi, Zod, express-validator.

---

[← Dependency Injection](02-dependency-injection.md) | [Index](../README.md) | [Next: Guards / Interceptors →](04-guards-middleware-interceptors.md)
