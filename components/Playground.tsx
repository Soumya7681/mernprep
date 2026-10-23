"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A JavaScript scratchpad that runs entirely in the reader's browser.
 *
 * The code is executed inside an iframe with `sandbox="allow-scripts"` and no
 * `allow-same-origin`, so it gets an opaque origin: it cannot reach this page's
 * DOM, cookies or localStorage. The only channel is postMessage, which the
 * harness below uses to stream console output back.
 *
 * Every run remounts the iframe. That gives each run a clean global scope and,
 * more importantly, means Stop can kill a runaway loop by tearing the frame
 * down — there is no other way to interrupt synchronous script.
 */

const STORAGE_KEY = "playground-code-v1";
const MARK = "__jp_pg__";

const EXAMPLES: { name: string; code: string }[] = [
  {
    name: "Closures",
    code: `// A closure keeps its own copy of \`n\` alive after counter() returns.
function counter() {
  let n = 0;
  return () => ++n;
}

const next = counter();
const other = counter();

console.log(next(), next(), next());
console.log("independent:", other());
`,
  },
  {
    name: "Event loop order",
    code: `// Predict the output before you run it.
console.log("1 sync");

setTimeout(() => console.log("4 macrotask"), 0);

Promise.resolve().then(() => console.log("3 microtask"));

console.log("2 sync");
`,
  },
  {
    name: "Promises & async",
    code: `const wait = (ms, value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

async function main() {
  // Sequential: ~300ms total.
  const a = await wait(150, "a");
  const b = await wait(150, "b");
  console.log("sequential:", a, b);

  // Parallel: ~150ms total.
  const both = await Promise.all([wait(150, "a"), wait(150, "b")]);
  console.log("parallel:", both);
}

main();
`,
  },
  {
    name: "this & binding",
    code: `const user = {
  name: "Ada",
  greetRegular() {
    return \`regular: \${this?.name}\`;
  },
  greetArrow: () => \`arrow: \${globalThis.name || "undefined"}\`,
};

console.log(user.greetRegular());
console.log(user.greetArrow());

// Detaching the method loses \`this\`.
const detached = user.greetRegular;
console.log(detached());
console.log(detached.call(user));
`,
  },
  {
    name: "Array methods",
    code: `const people = [
  { name: "Ada", role: "backend", years: 6 },
  { name: "Linus", role: "backend", years: 9 },
  { name: "Grace", role: "frontend", years: 3 },
];

const byRole = people.reduce((acc, p) => {
  (acc[p.role] ||= []).push(p.name);
  return acc;
}, {});

console.log(byRole);
console.log("total years:", people.reduce((n, p) => n + p.years, 0));
console.log("seniors:", people.filter((p) => p.years > 5).map((p) => p.name));
`,
  },
];

type LogLevel = "log" | "info" | "warn" | "error";
type LogLine = { level: LogLevel; text: string };

/** Runs inside the sandboxed frame. Kept in ES5 style — it is not transpiled. */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
(function () {
  var MARK = ${JSON.stringify(MARK)};

  function fmt(v, seen) {
    seen = seen || [];
    if (typeof v === "string") return v;
    if (v === undefined) return "undefined";
    if (v === null) return "null";
    if (typeof v === "function") return v.toString().split("\\n")[0];
    if (v instanceof Error) return v.stack || String(v);
    if (typeof v === "object") {
      if (seen.indexOf(v) !== -1) return "[Circular]";
      seen.push(v);
      try {
        if (Array.isArray(v)) {
          return "[" + v.map(function (x) { return fmt(x, seen); }).join(", ") + "]";
        }
        var parts = Object.keys(v).map(function (k) { return k + ": " + fmt(v[k], seen); });
        return "{ " + parts.join(", ") + " }";
      } catch (e) {
        return String(v);
      }
    }
    return String(v);
  }

  function send(level, args) {
    var text = Array.prototype.map.call(args || [], function (a) { return fmt(a); }).join(" ");
    try {
      parent.postMessage({ mark: MARK, level: level, text: text }, "*");
    } catch (e) {}
  }

  ["log", "info", "warn", "error", "debug", "trace"].forEach(function (name) {
    console[name] = function () {
      send(name === "debug" || name === "trace" ? "log" : name, arguments);
    };
  });

  window.onerror = function (msg, src, line, col, err) {
    send("error", [err && err.stack ? err.stack : msg]);
    return true;
  };
  window.addEventListener("unhandledrejection", function (e) {
    send("error", ["Unhandled promise rejection: " + fmt(e.reason)]);
  });

  window.addEventListener("message", function (e) {
    var d = e.data;
    if (!d || d.mark !== MARK || typeof d.code !== "string") return;
    try {
      new Function(d.code)();
    } catch (err) {
      send("error", [err && err.stack ? err.stack : String(err)]);
    }
    send("__done", []);
  });

  parent.postMessage({ mark: MARK, level: "__ready" }, "*");
})();
<\/script></body></html>`;

export default function Playground() {
  const [example, setExample] = useState(EXAMPLES[0].name);
  const [code, setCode] = useState(EXAMPLES[0].code);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [running, setRunning] = useState(false);
  const [ranMs, setRanMs] = useState<number | null>(null);
  // Bumping this remounts the frame, which is both the reset and the kill switch.
  const [runId, setRunId] = useState(0);

  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const pendingCode = useRef<string | null>(null);
  const outRef = useRef<HTMLDivElement | null>(null);
  const startedAt = useRef(0);

  // Restore the last session's code. This has to be an effect rather than a
  // lazy initialiser: localStorage does not exist during the server render, so
  // seeding state from it directly would hydrate against different markup.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot sync from storage on mount
      if (saved) setCode(saved);
    } catch {}
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, code);
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [code]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const frame = frameRef.current;
      // Only listen to the frame we mounted; ignore anything else on the page.
      if (!frame || e.source !== frame.contentWindow) return;
      const data = e.data;
      if (!data || data.mark !== MARK) return;

      if (data.level === "__ready") {
        const queued = pendingCode.current;
        pendingCode.current = null;
        if (queued !== null) {
          frame.contentWindow?.postMessage({ mark: MARK, code: queued }, "*");
        }
        return;
      }
      if (data.level === "__done") {
        setRanMs(Math.round(performance.now() - startedAt.current));
        setRunning(false);
        return;
      }
      setLines((prev) => [
        ...prev,
        { level: (data.level as LogLevel) ?? "log", text: String(data.text ?? "") },
      ]);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Keep the newest output in view.
  useEffect(() => {
    const el = outRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const run = useCallback(() => {
    setLines([]);
    setRanMs(null);
    setRunning(true);
    startedAt.current = performance.now();
    pendingCode.current = code;
    setRunId((n) => n + 1);
  }, [code]);

  const pickExample = useCallback((name: string) => {
    const found = EXAMPLES.find((e) => e.name === name);
    if (!found) return;
    setExample(name);
    setCode(found.code);
    setLines([]);
    setRanMs(null);
  }, []);

  const stop = useCallback(() => {
    pendingCode.current = null;
    setRunId((n) => n + 1);
    setRunning(false);
    setLines((prev) => [...prev, { level: "warn", text: "Stopped." }]);
  }, []);

  const onEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      run();
      return;
    }
    // Tab indents instead of leaving the editor.
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const { selectionStart: start, selectionEnd: end } = el;
      const next = code.slice(0, start) + "  " + code.slice(end);
      setCode(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    }
  };

  const errorCount = lines.filter((l) => l.level === "error").length;
  const status = running
    ? "running…"
    : errorCount > 0
      ? `${errorCount} error${errorCount > 1 ? "s" : ""}`
      : ranMs !== null
        ? `finished in ${ranMs} ms`
        : "Ctrl / ⌘ + Enter to run";

  return (
    <div className="pg">
      <section className="pg-pane" aria-labelledby="pg-editor-heading">
        <h2 id="pg-editor-heading" className="sr-only">
          Code editor
        </h2>
        <div className="pg-bar">
          <label className="pg-pick">
            <span className="pg-bar-label">Example</span>
            <select
              className="pg-select"
              value={example}
              onChange={(e) => pickExample(e.target.value)}
            >
              {EXAMPLES.map((ex) => (
                <option key={ex.name} value={ex.name}>
                  {ex.name}
                </option>
              ))}
            </select>
          </label>

          <div className="pg-bar-actions">
            <button
              type="button"
              className="pg-btn"
              onClick={() => pickExample(example)}
              title="Restore this example's original code"
            >
              Reset
            </button>
            {running ? (
              <button type="button" className="pg-btn pg-btn-stop" onClick={stop}>
                ■ Stop
              </button>
            ) : (
              <button type="button" className="pg-btn pg-btn-run" onClick={run}>
                ▶ Run
              </button>
            )}
          </div>
        </div>

        <textarea
          className="pg-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={onEditorKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="JavaScript editor"
        />
      </section>

      <section className="pg-pane">
        <div className="pg-bar">
          <h2 className="pg-bar-label">Console</h2>
          <div className="pg-bar-actions">
            <span className={`pg-status${errorCount > 0 ? " is-error" : ""}`}>{status}</span>
            <button type="button" className="pg-btn" onClick={() => setLines([])}>
              Clear
            </button>
          </div>
        </div>

        <div className="pg-out" ref={outRef} role="log" aria-live="polite" aria-label="Console output">
          {lines.length === 0 ? (
            <p className="pg-out-empty">
              {running
                ? "Running…"
                : "console.log output appears here. Press Run, or Ctrl / ⌘ + Enter."}
            </p>
          ) : (
            lines.map((line, i) => (
              <pre key={i} className={`pg-line is-${line.level}`}>
                {line.text}
              </pre>
            ))
          )}
        </div>
      </section>

      {/* The sandbox. Offscreen rather than display:none so it reliably runs. */}
      <iframe
        key={runId}
        ref={frameRef}
        className="pg-runner"
        title="JavaScript sandbox"
        sandbox="allow-scripts"
        srcDoc={HARNESS}
      />
    </div>
  );
}
