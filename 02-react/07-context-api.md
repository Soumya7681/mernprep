# Chapter 29 — Context API

## 📖 Definition

The **Context API** is a React feature for passing data through the component tree without manually drilling props at every level.

## 🔍 Explanation

Context solves **prop drilling**. It's perfect for:
- Themes (light/dark)
- Current authenticated user
- Locale / i18n
- Feature flags

It's **not great for**:
- Frequently changing data (every consumer re-renders on each value change).
- Replacing Redux for complex global state.

## 💻 Code Example — Creating and Using Context

```jsx
import { createContext, useContext, useState } from "react";

// 1. Create
const ThemeContext = createContext("light");

// 2. Provide
function App() {
  const [theme, setTheme] = useState("light");
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <Layout />
    </ThemeContext.Provider>
  );
}

// 3. Consume — anywhere in the tree, no props needed
function ThemeButton() {
  const { theme, setTheme } = useContext(ThemeContext);
  return (
    <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
      Theme: {theme}
    </button>
  );
}
```

## 💻 Code Example — Auth Context

```jsx
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const login = async (email, password) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    localStorage.setItem("token", data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

```jsx
// Anywhere in the app
function Navbar() {
  const { user, logout } = useAuth();
  return user
    ? <button onClick={logout}>Logout {user.name}</button>
    : <a href="/login">Login</a>;
}
```

## 💻 Code Example — Custom Hook for Safer Consumption

```jsx
const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside <AuthProvider>");
  return ctx;
}
```

This ensures consumers always have a provider above them.

## 💻 Code Example — Splitting Context to Avoid Re-Renders

```jsx
// ❌ One context for everything → any update re-renders all consumers
const AppContext = createContext({ user, theme, cart });

// ✅ Split by concern
const UserContext  = createContext(null);
const ThemeContext = createContext("light");
const CartContext  = createContext([]);

// Now updating cart doesn't re-render consumers of theme/user.
```

## 💻 Code Example — Avoiding Pointless Re-Renders

```jsx
function App() {
  const [user, setUser] = useState(null);

  // ❌ value is a new object every render → every consumer re-renders
  return <UserContext.Provider value={{ user, setUser }}>{children}</UserContext.Provider>;

  // ✅ memoize
  const value = useMemo(() => ({ user, setUser }), [user]);
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
```

## 💻 Code Example — Multiple Providers

```jsx
function Providers({ children }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <CartProvider>
          {children}
        </CartProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

function App() {
  return (
    <Providers>
      <Router>...</Router>
    </Providers>
  );
}
```

## 💻 Code Example — Context with useReducer (Redux-Like)

```jsx
const CartContext = createContext();

function cartReducer(state, action) {
  switch (action.type) {
    case "ADD":    return [...state, action.item];
    case "REMOVE": return state.filter(i => i.id !== action.id);
    case "CLEAR":  return [];
    default:       return state;
  }
}

export function CartProvider({ children }) {
  const [cart, dispatch] = useReducer(cartReducer, []);
  const value = useMemo(() => ({ cart, dispatch }), [cart]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);

// Usage
const { cart, dispatch } = useCart();
dispatch({ type: "ADD", item: { id: 1, name: "Book" } });
```

## 🎯 Likely Interview Questions

1. **What is the Context API?**
2. **When would you use Context over Redux?** — Low-frequency, app-wide values (theme, auth, locale).
3. **What's the performance pitfall with Context?** — Any change to the provider value re-renders *all* consumers. Split contexts and memoize the value.
4. **How would you create a global auth context?** (See example above.)

---

[← Controlled / Uncontrolled](06-controlled-uncontrolled.md) | [Index](../README.md) | [Next: Custom Hooks →](08-custom-hooks.md)
