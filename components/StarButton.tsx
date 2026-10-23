import { Github, Star } from "lucide-react";
import { GITHUB_STARS_URL } from "@/lib/site";

// "Star on GitHub" call-to-action. Used in the header and on the landing page.
// `variant` controls sizing/emphasis; both link to the repo's stargazers page.
export default function StarButton({
  variant = "header",
  className = "",
}: {
  variant?: "header" | "hero";
  className?: string;
}) {
  const sizing = variant === "hero" ? "btn btn-secondary btn-lg" : "btn btn-secondary btn-sm star-btn-header";
  return (
    <a
      href={GITHUB_STARS_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`${sizing} ${className}`.trim()}
      aria-label="Star this project on GitHub"
    >
      <Github aria-hidden="true" />
      <span>Star on GitHub</span>
      {variant === "header" && <Star className="star-icon" aria-hidden="true" />}
    </a>
  );
}
