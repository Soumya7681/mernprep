export type TocItem = { id: string; text: string; level: 2 | 3 };

/**
 * "On this page" rail for long chapters. The heading list is extracted on the
 * server from the rendered markdown (see tocFromHtml in lib/content.ts). Plain
 * anchor links, no scroll tracking, so it renders on the server with no JS.
 * Hidden below 1280px, where the reading column needs the width more.
 */
export default function Toc({ items }: { items: TocItem[] }) {
  if (items.length < 3) return null;

  return (
    <nav className="toc" aria-label="On this page">
      <p className="toc-title">On this page</p>
      <ul>
        {items.map((item) => (
          <li key={item.id} className={item.level === 3 ? "toc-sub" : undefined}>
            <a href={`#${item.id}`}>{item.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
