# Chapter 31 — Controlled vs Uncontrolled Components

## 📖 Definition

- **Controlled component** — form value is driven by React state. Single source of truth.
- **Uncontrolled component** — form value is managed by the DOM; React reads it via `ref`.

## 🔍 Explanation

| | Controlled | Uncontrolled |
|---|---|---|
| Value source | React state | DOM |
| Read value | From state | `ref.current.value` |
| Validation | Easy (on every change) | On submit / blur |
| Best for | Production forms | Simple/legacy inputs, file uploads |
| Re-renders | One per keystroke | Zero |

## 💻 Code Example — Controlled Input

```jsx
function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = (e) => {
    e.preventDefault();
    console.log({ email, password });
  };

  return (
    <form onSubmit={onSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit">Login</button>
    </form>
  );
}
```

## 💻 Code Example — Uncontrolled Input

```jsx
function Login() {
  const emailRef = useRef();
  const passwordRef = useRef();

  const onSubmit = (e) => {
    e.preventDefault();
    console.log({
      email: emailRef.current.value,
      password: passwordRef.current.value,
    });
  };

  return (
    <form onSubmit={onSubmit}>
      <input type="email"    ref={emailRef}    defaultValue="" />
      <input type="password" ref={passwordRef} defaultValue="" />
      <button type="submit">Login</button>
    </form>
  );
}
```

> 🔑 Use `defaultValue` (not `value`) for uncontrolled inputs.

## 💻 Code Example — Validation in a Controlled Form

```jsx
function Signup() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});

  const update = (field) => (e) => {
    const value = e.target.value;
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: validate(field, value) }));
  };

  const validate = (field, value) => {
    if (field === "email" && !/^\S+@\S+$/.test(value)) return "Invalid email";
    if (field === "password" && value.length < 8) return "Min 8 characters";
    return undefined;
  };

  const isValid = Object.values(errors).every(e => !e) && form.email && form.password;

  return (
    <form>
      <input value={form.email} onChange={update("email")} />
      {errors.email && <span className="err">{errors.email}</span>}

      <input value={form.password} onChange={update("password")} type="password" />
      {errors.password && <span className="err">{errors.password}</span>}

      <button disabled={!isValid}>Sign up</button>
    </form>
  );
}
```

## 💻 Code Example — File Input (Must Be Uncontrolled)

```jsx
function UploadForm() {
  const fileRef = useRef();

  const onSubmit = (e) => {
    e.preventDefault();
    const file = fileRef.current.files[0];
    const formData = new FormData();
    formData.append("file", file);
    fetch("/upload", { method: "POST", body: formData });
  };

  return (
    <form onSubmit={onSubmit}>
      <input type="file" ref={fileRef} accept="image/*" />
      <button type="submit">Upload</button>
    </form>
  );
}
```

> File inputs cannot be controlled — the browser owns the value for security reasons.

## 💻 Code Example — Checkbox & Select (Controlled)

```jsx
function Preferences() {
  const [newsletter, setNewsletter] = useState(true);
  const [country, setCountry] = useState("IN");

  return (
    <>
      <label>
        <input
          type="checkbox"
          checked={newsletter}
          onChange={(e) => setNewsletter(e.target.checked)}
        />
        Subscribe to newsletter
      </label>

      <select value={country} onChange={(e) => setCountry(e.target.value)}>
        <option value="IN">India</option>
        <option value="US">USA</option>
        <option value="UK">UK</option>
      </select>
    </>
  );
}
```

## 💻 Code Example — Form Libraries (React Hook Form)

For larger forms, libraries reduce boilerplate:

```jsx
import { useForm } from "react-hook-form";

function Signup() {
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = (data) => console.log(data);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("email", { required: true, pattern: /\S+@\S+/ })} />
      {errors.email && <span>Email invalid</span>}

      <input type="password" {...register("password", { minLength: 8 })} />
      {errors.password && <span>Min 8 chars</span>}

      <button type="submit">Sign up</button>
    </form>
  );
}
```

`react-hook-form` uses uncontrolled inputs under the hood for performance, but exposes a controlled-like API.

## 🌍 Real-World Impact

- **Controlled** for everything where you need live validation, conditional disabling, masking, or transformation.
- **Uncontrolled** for huge forms (performance), file inputs, or quick prototypes.

## 🎯 Likely Interview Questions

1. **Difference between controlled and uncontrolled components?**
2. **When would you use one over the other?**
3. **Why use `defaultValue` instead of `value` in uncontrolled inputs?** — `value` makes it controlled and React will keep overwriting user input.
4. **How do you handle file uploads in React?** — Always uncontrolled; use `ref` to read `.files`.

---

[← useRef](05-useref.md) | [Index](../README.md) | [Next: Context API →](07-context-api.md)
