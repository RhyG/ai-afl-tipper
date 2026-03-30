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

const TYPE_COLORS: Record<string, string> = {
  rss: "bg-orange-900/50 text-orange-300 border-orange-700/50",
  api: "bg-purple-900/50 text-purple-300 border-purple-700/50",
  url: "bg-cyan-900/50 text-cyan-300 border-cyan-700/50",
  "squiggle-tips": "bg-green-900/50 text-green-300 border-green-700/50",
};

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  ok:      { label: "✓ Verified", class: "bg-green-900/50 text-green-400 border-green-700/50" },
  error:   { label: "✗ Failed",   class: "bg-red-900/50 text-red-400 border-red-700/50" },
  unknown: { label: "Pending",    class: "bg-gray-800 text-gray-500 border-gray-700" },
};

export const SourceRow: FC<{ source: Source }> = ({ source }) => {
  const typeClass = TYPE_COLORS[source.type] ?? "bg-gray-800 text-gray-400 border-gray-700";
  const status = source.last_validation_status ?? "unknown";
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE["unknown"]!;
  const badgeTitle =
    status === "error" && source.last_validation_error
      ? source.last_validation_error
      : undefined;

  return (
    <tr id={`source-${source.id}`} class="border-t border-gray-800 hover:bg-gray-800/50 transition-colors">
      <td class="px-4 py-3">
        <div class="font-medium text-white text-sm">{source.name}</div>
        {source.description && (
          <div class="text-xs text-gray-500 mt-0.5">{source.description}</div>
        )}
      </td>
      <td class="px-4 py-3">
        <span class={`text-xs font-medium px-2 py-0.5 rounded border ${typeClass}`}>
          {source.type}
        </span>
      </td>
      <td class="px-4 py-3">
        <span
          class={`text-xs font-medium px-2 py-0.5 rounded border ${badge.class}`}
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
          class="text-xs text-blue-400 hover:text-blue-300 truncate block"
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
          class={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            source.enabled ? "bg-blue-600" : "bg-gray-700"
          }`}
          title={source.enabled ? "Disable" : "Enable"}
        >
          <span
            class={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
              source.enabled ? "translate-x-4" : "translate-x-1"
            }`}
          />
        </button>
      </td>
      <td class="px-4 py-3">
        <button
          hx-delete={`/sources/${source.id}`}
          hx-target={`#source-${source.id}`}
          hx-swap="outerHTML"
          hx-confirm="Delete this source?"
          class="text-gray-600 hover:text-red-400 transition-colors text-sm"
        >
          ✕
        </button>
      </td>
    </tr>
  );
};
