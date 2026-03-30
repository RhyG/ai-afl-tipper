import type { FC } from "hono/jsx";

interface Source {
  id: number;
  name: string;
  type: string;
  url: string;
  description: string;
  enabled: number;
  last_validation_status?: string;
  last_validated_at?: string;
  last_validation_error?: string;
}

const TYPE_STYLES: Record<string, string> = {
  rss: "background:rgba(249,115,22,0.15);color:#fb923c;border:1px solid rgba(249,115,22,0.3)",
  api: "background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3)",
  url: "background:rgba(6,182,212,0.12);color:#67e8f9;border:1px solid rgba(6,182,212,0.25)",
  "squiggle-tips": "background:rgba(16,185,129,0.12);color:#6ee7b7;border:1px solid rgba(16,185,129,0.25)",
};

const STATUS_BADGE: Record<string, { label: string; style: string }> = {
  ok:      { label: "✓ Verified", style: "background:rgba(16,185,129,0.12);color:#34d399;border:1px solid rgba(16,185,129,0.25)" },
  error:   { label: "✗ Failed",   style: "background:rgba(239,68,68,0.1);color:#f87171;border:1px solid rgba(239,68,68,0.25)" },
  unknown: { label: "Pending",    style: "background:rgba(255,255,255,0.04);color:rgba(100,116,139,0.8);border:1px solid rgba(255,255,255,0.08)" },
};

export const SourceRow: FC<{ source: Source }> = ({ source }) => {
  const typeStyle = TYPE_STYLES[source.type] ?? "background:rgba(255,255,255,0.04);color:rgba(148,163,184,0.8);border:1px solid rgba(255,255,255,0.08)";
  const status = source.last_validation_status ?? "unknown";
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.unknown;
  const badgeTitle =
    status === "error" && source.last_validation_error
      ? source.last_validation_error
      : undefined;

  return (
    <tr id={`source-${source.id}`} style="border-top:1px solid rgba(255,255,255,0.05)" class="transition-colors" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
      <td class="px-4 py-3">
        <div class="font-bold text-white text-sm">{source.name}</div>
        {source.description && (
          <div class="text-xs mt-0.5" style="color:rgba(71,85,105,0.9)">{source.description}</div>
        )}
      </td>
      <td class="px-4 py-3">
        <span class="text-xs font-bold px-2 py-0.5 rounded-full" style={typeStyle}>
          {source.type}
        </span>
      </td>
      <td class="px-4 py-3">
        <span
          class="text-xs font-bold px-2 py-0.5 rounded-full"
          style={badge.style}
          title={badgeTitle}
        >
          {badge.label}
        </span>
      </td>
      <td class="px-4 py-3 max-w-xs">
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs truncate block transition-colors"
          style="color:#22d3ee"
          onmouseover="this.style.color='#67e8f9'"
          onmouseout="this.style.color='#22d3ee'"
          title={source.url}
        >
          {source.url}
        </a>
      </td>
      <td class="px-4 py-3">
        <button
          hx-post={`/sources/${source.id}/toggle`}
          hx-target={`#source-${source.id}`}
          hx-swap="outerHTML"
          class="relative inline-flex h-5 w-9 items-center rounded-full transition-all"
          style={source.enabled
            ? "background:linear-gradient(135deg,#f97316,#ea580c);box-shadow:0 2px 8px rgba(249,115,22,0.3)"
            : "background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1)"}
          title={source.enabled ? "Disable" : "Enable"}
        >
          <span
            class="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
            style={source.enabled ? "transform:translateX(18px)" : "transform:translateX(3px)"}
          />
        </button>
      </td>
      <td class="px-4 py-3">
        <button
          hx-delete={`/sources/${source.id}`}
          hx-target={`#source-${source.id}`}
          hx-swap="outerHTML"
          hx-confirm="Delete this source?"
          class="text-sm transition-colors"
          style="color:rgba(71,85,105,0.6)"
          onmouseover="this.style.color='#f87171'"
          onmouseout="this.style.color='rgba(71,85,105,0.6)'"
        >
          ✕
        </button>
      </td>
    </tr>
  );
};
