import type { Metadata } from "next";
import Playground from "@/components/Playground";
import CompilerButton from "@/components/CompilerButton";
import { COMPILER_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "JavaScript Playground — Run Code Online",
  description:
    "Run and tweak JavaScript straight in your browser — test the interview code examples from this prep book without leaving the page. Nothing is uploaded.",
  alternates: { canonical: "/playground" },
};

export default function PlaygroundPage() {
  return (
    <>
      <div className="breadcrumb">
        <span>Practice</span>
        <span className="breadcrumb-sep" aria-hidden="true">/</span>
        <span className="breadcrumb-current">JS Playground</span>
      </div>

      <div className="pg-head">
        <div>
          <h1 className="pg-title">JavaScript Playground</h1>
          <p className="pg-sub">
            Run and tweak the code examples from this prep book. Everything
            executes <strong>in your own browser</strong> — no server, no
            account, and your code never leaves this machine.
          </p>
        </div>
        <CompilerButton variant="hero" label="Other languages ↗" />
      </div>

      <Playground />

      <p className="pg-note">
        Your code runs in a sandboxed frame with no access to this page or your
        data, and is kept in this browser between visits. For languages other
        than JavaScript, open the{" "}
        <a href={COMPILER_URL} target="_blank" rel="noopener noreferrer">
          Programiz compiler
        </a>{" "}
        in a new tab.
      </p>
    </>
  );
}
