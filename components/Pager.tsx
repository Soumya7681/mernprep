import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { FlatChapter } from "@/lib/manifest";

function hrefFor(ch: FlatChapter) {
  return ch.slug.length === 1 && ch.slug[0] === "readme"
    ? "/start"
    : "/" + ch.slug.join("/");
}

export default function Pager({
  prev,
  next,
}: {
  prev: FlatChapter | null;
  next: FlatChapter | null;
}) {
  return (
    <nav className="pager" aria-label="Chapter navigation">
      {prev ? (
        <Link href={hrefFor(prev)} className="pager-card prev">
          <span className="pager-label">
            <ArrowLeft aria-hidden="true" /> Previous
          </span>
          <span className="pager-title">{prev.title}</span>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link href={hrefFor(next)} className="pager-card next">
          <span className="pager-label">
            Next <ArrowRight aria-hidden="true" />
          </span>
          <span className="pager-title">{next.title}</span>
        </Link>
      ) : (
        <div />
      )}
    </nav>
  );
}
