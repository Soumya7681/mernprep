import { SquareTerminal } from "lucide-react";
import { COMPILER_URL } from "@/lib/site";

// "JS Compiler" call-to-action — opens the Programiz online compiler in a new tab.
// Used on the landing page and the playground page.
export default function CompilerButton({
  variant = "header",
  label = "JS Compiler",
  className = "",
}: {
  variant?: "header" | "hero";
  label?: string;
  className?: string;
}) {
  const sizing = variant === "hero" ? "btn btn-secondary btn-lg" : "btn btn-secondary btn-sm";
  return (
    <a
      href={COMPILER_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`${sizing} ${className}`.trim()}
      aria-label="Open the online JavaScript compiler"
    >
      <SquareTerminal aria-hidden="true" />
      <span>{label}</span>
    </a>
  );
}
