import type { FC } from "hono/jsx";
import { Layout } from "./layout";
import { SourceRow } from "./components/source-row";

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

interface SourcesPageProps {
  sources: Source[];
  aiProvider?: string;
  aiModel?: string;
}

export const SourcesPage: FC<SourcesPageProps> = ({ sources, aiProvider, aiModel }) => {
  return (
    <Layout title="Data Sources — AFL AI Tipper" currentPath="/sources" aiProvider={aiProvider} aiModel={aiModel}>
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-white">Data Sources</h1>
        <span class="text-sm text-gray-500">{sources.filter((s) => s.enabled).length} active</span>
      </div>

      {/* Table */}
      <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-8">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs text-gray-500 uppercase tracking-wider bg-gray-800/50">
              <th class="px-4 py-3">Name</th>
              <th class="px-4 py-3">Type</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3">URL</th>
              <th class="px-4 py-3">Enabled</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody
            id="sources-table"
            hx-get="/sources/rows"
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
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 class="text-base font-semibold text-white mb-4">Add New Source</h2>
        <form
          hx-post="/sources"
          hx-target="#sources-table"
          hx-swap="beforeend"
          hx-on--after-request="this.reset()"
          class="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <div>
            <label class="block text-xs text-gray-400 mb-1.5">Name</label>
            <input
              type="text"
              name="name"
              required
              placeholder="e.g. AFL Stats"
              class="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1.5">Type</label>
            <select
              name="type"
              required
              class="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            >
              <option value="rss">RSS</option>
              <option value="api">API</option>
              <option value="url">URL</option>
              <option value="squiggle-tips">Squiggle Tips</option>
            </select>
          </div>
          <div class="sm:col-span-2">
            <label class="block text-xs text-gray-400 mb-1.5">URL</label>
            <input
              type="url"
              name="url"
              required
              placeholder="https://..."
              class="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div class="sm:col-span-2">
            <label class="block text-xs text-gray-400 mb-1.5">Description (optional)</label>
            <input
              type="text"
              name="description"
              placeholder="What does this source provide?"
              class="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div class="sm:col-span-2">
            <button
              type="submit"
              class="bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm px-5 py-2 rounded-lg transition-colors"
            >
              Add Source
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};
