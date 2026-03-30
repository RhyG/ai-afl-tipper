import type { FC } from "hono/jsx";
import { Layout } from "./layout";
import { SourceRow } from "./components/source-row";
import { SPORTS, type SportId } from "../sports";

interface Source {
  id: number;
  name: string;
  type: string;
  url: string;
  description: string;
  enabled: number;
  sport: string;
  last_validation_status?: string;
  last_validated_at?: string;
  last_validation_error?: string;
}

interface SourcesPageProps {
  sources: Source[];
  aiProvider?: string;
  aiModel?: string;
  sport?: SportId;
}

export const SourcesPage: FC<SourcesPageProps> = ({ sources, aiProvider, aiModel, sport = "afl" }) => {
  const sportConfig = SPORTS[sport];
  const typeOptions =
    sport === "afl"
      ? [
          { value: "rss", label: "RSS" },
          { value: "api", label: "API" },
          { value: "url", label: "URL" },
          { value: "squiggle-tips", label: "Squiggle Tips" },
        ]
      : [
          { value: "rss", label: "RSS" },
          { value: "api", label: "API" },
          { value: "url", label: "URL" },
        ];

  const inputStyle = "width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:white;border-radius:10px;padding:8px 12px;font-size:14px;outline:none";

  return (
    <Layout
      title={`Data Sources — ${sportConfig.label} AI Tipper`}
      currentPath="/sources"
      aiProvider={aiProvider}
      aiModel={aiModel}
      sport={sport}
    >
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="font-black text-white" style="font-size:clamp(20px,3vw,28px);letter-spacing:-0.02em">
            {sportConfig.emoji} {sportConfig.label} Data Sources
          </h1>
          <p class="text-sm mt-1" style="color:rgba(71,85,105,0.9)">{sources.filter((s) => s.enabled).length} active</p>
        </div>
      </div>

      {/* Table */}
      <div class="rounded-2xl overflow-hidden mb-8" style="background:linear-gradient(160deg,rgba(17,27,51,0.9) 0%,rgba(4,13,26,1) 100%);border:1px solid rgba(255,255,255,0.07)">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left" style="background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.06)">
              {["Name", "Type", "Status", "URL", "Enabled", ""].map((h) => (
                <th class="px-4 py-3 uppercase font-bold" style="font-size:10px;letter-spacing:0.1em;color:rgba(71,85,105,0.8)">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody
            id="sources-table"
            hx-get={`/sources/rows?sport=${sport}`}
            hx-trigger="startupComplete from:body"
            hx-swap="innerHTML"
          >
            {sources.map((s) => (
              <SourceRow source={s} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Add source form */}
      <div class="rounded-2xl p-6" style="background:linear-gradient(160deg,rgba(17,27,51,0.9) 0%,rgba(4,13,26,1) 100%);border:1px solid rgba(255,255,255,0.07)">
        <h2 class="font-black text-white mb-5" style="font-size:16px;letter-spacing:-0.01em">Add New {sportConfig.label} Source</h2>
        <form
          hx-post="/sources"
          hx-target="#sources-table"
          hx-swap="beforeend"
          hx-on--after-request="this.reset()"
          class="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <input type="hidden" name="sport" value={sport} />
          <div>
            <label class="block uppercase font-bold mb-2" style="font-size:10px;letter-spacing:0.1em;color:rgba(100,116,139,0.7)">Name</label>
            <input
              type="text"
              name="name"
              required
              placeholder={`e.g. ${sportConfig.label} Stats`}
              style={inputStyle}
            />
          </div>
          <div>
            <label class="block uppercase font-bold mb-2" style="font-size:10px;letter-spacing:0.1em;color:rgba(100,116,139,0.7)">Type</label>
            <select
              name="type"
              required
              style={inputStyle}
            >
              {typeOptions.map((opt) => (
                <option value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div class="sm:col-span-2">
            <label class="block uppercase font-bold mb-2" style="font-size:10px;letter-spacing:0.1em;color:rgba(100,116,139,0.7)">URL</label>
            <input
              type="url"
              name="url"
              required
              placeholder="https://..."
              style={inputStyle}
            />
          </div>
          <div class="sm:col-span-2">
            <label class="block uppercase font-bold mb-2" style="font-size:10px;letter-spacing:0.1em;color:rgba(100,116,139,0.7)">Description (optional)</label>
            <input
              type="text"
              name="description"
              placeholder="What does this source provide?"
              style={inputStyle}
            />
          </div>
          <div class="sm:col-span-2">
            <button
              type="submit"
              class="btn-primary text-sm px-6 py-2.5 rounded-xl"
            >
              Add Source
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};
