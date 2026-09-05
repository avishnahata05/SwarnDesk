import { TrendingUp, Quote } from "lucide-react";
import type { Block } from "@/content/blog";

export default function BlogBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-6">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "p":
            return (
              <p key={i} className="text-base text-foreground/90 leading-relaxed">
                {block.text}
              </p>
            );

          case "h2":
            return (
              <h2 key={i} id={block.id} className="text-2xl font-bold text-foreground pt-6 scroll-mt-24">
                {block.text}
              </h2>
            );

          case "h3":
            return (
              <h3 key={i} className="text-lg font-semibold text-foreground pt-2">
                {block.text}
              </h3>
            );

          case "stats":
            return (
              <div key={i} className="grid sm:grid-cols-1 gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-5">
                {block.items.map((stat, j) => (
                  <div key={j} className="flex items-start gap-2.5 text-sm text-foreground/90">
                    <TrendingUp className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{stat}</span>
                  </div>
                ))}
              </div>
            );

          case "ul":
            return (
              <ul key={i} className="space-y-2 list-disc pl-5 text-base text-foreground/90 leading-relaxed">
                {block.items.map((item, j) => <li key={j}>{item}</li>)}
              </ul>
            );

          case "ol":
            return (
              <ol key={i} className="space-y-2 list-decimal pl-5 text-base text-foreground/90 leading-relaxed">
                {block.items.map((item, j) => <li key={j}>{item}</li>)}
              </ol>
            );

          case "quote":
            return (
              <blockquote key={i} className="border-l-2 border-primary pl-5 py-1 italic text-foreground/80">
                <Quote className="w-4 h-4 text-primary/60 mb-2" />
                <p>{block.text}</p>
                <footer className="text-sm not-italic text-muted-foreground mt-2">— {block.author}</footer>
              </blockquote>
            );

          case "table":
            return (
              <div key={i} className="rounded-2xl border border-border overflow-hidden overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b border-border bg-card/60">
                      {block.headers.map((h, j) => (
                        <th key={j} className="px-4 py-3 text-left font-semibold text-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, j) => (
                      <tr key={j} className={j !== block.rows.length - 1 ? "border-b border-border/60" : ""}>
                        {row.map((cell, k) => (
                          <td key={k} className="px-4 py-3 text-foreground/90 align-top">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case "callout":
            return (
              <div key={i} className="rounded-2xl border border-primary/30 bg-primary/5 p-5 text-sm text-foreground/90">
                {block.text}
              </div>
            );

          case "faq":
            return (
              <div key={i} className="space-y-3">
                {block.items.map((item, j) => (
                  <details key={j} className="group rounded-2xl border border-border bg-card px-5 py-4 open:border-primary/40">
                    <summary className="flex items-center justify-between cursor-pointer list-none font-semibold text-sm text-foreground">
                      {item.q}
                      <span className="text-primary text-lg leading-none group-open:rotate-45 transition-transform">+</span>
                    </summary>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-3">{item.a}</p>
                  </details>
                ))}
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
