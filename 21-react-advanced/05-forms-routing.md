# Chapter 38 — Forms & Routing

## 📖 Definition

**Forms** collect and validate user input. In production React apps this is usually done with **React Hook Form** (uncontrolled inputs registered via refs, so few re-renders) plus a schema validator like **Zod**. **Routing** maps URLs to components; **React Router** (v6.4+/v7) adds data loading, mutations, nested layouts and protected routes.

## 💻 Code Example — React Hook Form + Zod

```jsx
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const signupSchema = z
  .object({
    name: z.string().min(2, "Name is too short"),
    email: z.string().email("Invalid email"),
    password: z.string().min(8, "At least 8 characters").regex(/\d/, "Include a number"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords do not match" });

export function SignupForm() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(signupSchema) });

  async function onSubmit(values) {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (res.status === 409) setError("email", { message: "Email already registered" }); // server error → field
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <input {...register("name")} placeholder="Name" aria-invalid={!!errors.name} />
      {errors.name && <p role="alert">{errors.name.message}</p>}

      <input {...register("email")} type="email" placeholder="Email" />
      {errors.email && <p role="alert">{errors.email.message}</p>}

      <input {...register("password")} type="password" />
      {errors.password && <p role="alert">{errors.password.message}</p>}

      <input {...register("confirm")} type="password" />
      {errors.confirm && <p role="alert">{errors.confirm.message}</p>}

      <button disabled={isSubmitting}>{isSubmitting ? "Creating…" : "Sign up"}</button>
    </form>
  );
}
```

**Share the schema:** put the Zod schema in a shared package and use it in Express too (`signupSchema.parse(req.body)`), so frontend and backend validation cannot drift.

## 💻 Code Example — Dynamic Fields With `useFieldArray`

```jsx
const { control, register } = useForm({ defaultValues: { items: [{ name: "", qty: 1 }] } });
const { fields, append, remove } = useFieldArray({ control, name: "items" });

{fields.map((field, i) => (
  <div key={field.id}>                         {/* use field.id, not the index */}
    <input {...register(`items.${i}.name`)} />
    <input type="number" {...register(`items.${i}.qty`, { valueAsNumber: true })} />
    <button type="button" onClick={() => remove(i)}>✕</button>
  </div>
))}
<button type="button" onClick={() => append({ name: "", qty: 1 })}>Add item</button>
```

## 🔍 Why React Hook Form Is Fast

Controlled inputs re-render the whole form on every keystroke. RHF keeps values in refs (uncontrolled) and only re-renders the fields whose error state changes. Use `watch` / `useWatch` sparingly — they subscribe to re-renders.

## 💻 Code Example — React Router: Layouts and Nested Routes

```jsx
import { createBrowserRouter, RouterProvider, Outlet, NavLink } from "react-router-dom";

function AppLayout() {
  return (
    <>
      <nav>
        <NavLink to="/">Home</NavLink>
        <NavLink to="/orders">Orders</NavLink>
      </nav>
      <main><Outlet /></main>          {/* child route renders here */}
    </>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Home /> },
      { path: "orders", element: <Orders />, loader: ordersLoader },
      { path: "orders/:orderId", element: <OrderDetail />, loader: orderLoader },
      { path: "login", element: <Login /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
```

## 💻 Code Example — Loaders and Actions

```jsx
import { useLoaderData, Form, redirect, useNavigation } from "react-router-dom";

export async function orderLoader({ params }) {
  const res = await fetch(`/api/orders/${params.orderId}`);
  if (res.status === 404) throw new Response("Not found", { status: 404 });
  return res.json();                 // data is ready BEFORE the component renders
}

export async function cancelAction({ params }) {
  await fetch(`/api/orders/${params.orderId}/cancel`, { method: "POST" });
  return redirect("/orders");
}

export function OrderDetail() {
  const order = useLoaderData();
  const navigation = useNavigation();
  return (
    <>
      <h1>Order #{order.number}</h1>
      <Form method="post" action="cancel">
        <button disabled={navigation.state === "submitting"}>Cancel order</button>
      </Form>
    </>
  );
}
```

Loaders fetch in parallel with code loading, avoiding the "render → effect → fetch → render" waterfall.

## 💻 Code Example — Protected Routes

```jsx
import { Navigate, Outlet, useLocation } from "react-router-dom";

function RequireAuth({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/forbidden" replace />;
  return <Outlet />;
}

// Routes
{
  element: <RequireAuth roles={["admin"]} />,
  children: [{ path: "admin", element: <AdminDashboard /> }],
}

// After login, send the user back where they came from
const from = location.state?.from?.pathname ?? "/";
navigate(from, { replace: true });
```

**Remember:** frontend route guards are UX only. Every API route must still check authentication and authorisation on the server.

## 💻 Code Example — URL as State (Filters, Pagination)

```jsx
import { useSearchParams } from "react-router-dom";

function ProductsPage() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") ?? 1);
  const sort = params.get("sort") ?? "newest";

  const update = (key, value) =>
    setParams((prev) => { prev.set(key, value); if (key !== "page") prev.set("page", "1"); return prev; });

  // URL: /products?page=2&sort=price — shareable, bookmarkable, back-button friendly
}
```

## 🌍 Real-World Use

- Checkout, sign-up and multi-step onboarding → RHF + Zod, one schema per step.
- Admin panels → nested layouts, role-protected route groups, URL-driven filters.
- Lazy loading per route → `lazy: () => import("./routes/Reports")` in the route config.

## 🎯 Likely Interview Questions

1. **Controlled vs uncontrolled forms — which does React Hook Form use and why?**
2. **How do you share validation between React and Express?**
3. **How do you show a server-side validation error on a specific field?**
4. **How do you implement protected and role-based routes?**
5. **What are loaders and actions in React Router? What problem do they solve?**
6. **Why store filters and pagination in the URL?**
7. **How do you redirect the user back to the original page after login?**

---

[← Server State & Data Fetching](04-server-state-data-fetching.md) | [Index](../README.md) | [Next: Testing React Apps →](06-testing-react.md)
