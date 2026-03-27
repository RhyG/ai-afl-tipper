import type { FC } from "hono/jsx";
import { PROVIDER_MODELS } from "../services/runtime-config";

interface LayoutProps {
  title?: string;
  currentPath?: string;
  aiProvider?: string;
  aiModel?: string;
  children?: unknown;
}

export const Layout: FC<LayoutProps> = ({
  title = "AFL AI Tipper",
  currentPath = "/",
  aiProvider = "claude",
  aiModel = "claude-opus-4-6",
  children,
}) => {
  const models = PROVIDER_MODELS[aiProvider] ?? [];

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/htmx.org@2.0.4"></script>
        <script dangerouslySetInnerHTML={{
          __html: `
            tailwind.config = {
              theme: { extend: { colors: { afl: { blue: '#003087', gold: '#FFB81C' } } } }
            }
          `
        }} />
        <style dangerouslySetInnerHTML={{
          __html: `
            .htmx-indicator { opacity: 0; transition: opacity 200ms ease-in; }
            .htmx-request .htmx-indicator { opacity: 1; }
            .htmx-request.htmx-indicator { opacity: 1; }
          `
        }} />
      </head>
      <body class="bg-gray-950 text-gray-100 min-h-screen">
        <nav class="bg-gray-900 border-b border-gray-800">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-16 gap-4">

              {/* Brand */}
              <div class="flex items-center gap-2 shrink-0">
                <span class="text-2xl">🏈</span>
                <span class="text-xl font-bold text-white">AFL AI Tipper</span>
              </div>

              {/* AI provider settings — inline in nav */}
              <form
                class="flex items-center gap-2"
                hx-post="/settings/ai"
                hx-target="#ai-settings-badge"
                hx-swap="outerHTML"
              >
                <select
                  name="provider"
                  id="nav-provider"
                  hx-get="/settings/ai/models"
                  hx-target="#nav-model"
                  hx-swap="innerHTML"
                  hx-trigger="change"
                  hx-include="[name='provider']"
                  class="bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500"
                >
                  {Object.keys(PROVIDER_MODELS).map((p) => (
                    <option value={p} selected={p === aiProvider}>{p}</option>
                  ))}
                </select>

                <select
                  name="model"
                  id="nav-model"
                  class="bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500 max-w-[160px]"
                >
                  {models.map((m) => (
                    <option value={m} selected={m === aiModel}>{m}</option>
                  ))}
                </select>

                <button
                  type="submit"
                  class="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
                >
                  Save
                </button>

                <span id="ai-settings-badge" class="text-xs text-gray-600 shrink-0"></span>
              </form>

              {/* Nav links */}
              <div class="flex gap-1 shrink-0">
                <a
                  href="/"
                  class={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentPath === "/" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
                >
                  Dashboard
                </a>
                <a
                  href="/sources"
                  class={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentPath === "/sources" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
                >
                  Sources
                </a>
              </div>

            </div>
          </div>
        </nav>

        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
          {children as any}
        </main>

        {/* Terminal bottom sheet */}
        <div
          id="terminal-sheet"
          class="fixed bottom-0 left-0 right-0 z-50 transform translate-y-full transition-transform duration-300 ease-in-out"
        >
          {/* Drag handle / header */}
          <div
            id="terminal-header"
            class="bg-gray-800 border-t border-gray-700 border-x border-x-gray-700 rounded-t-xl mx-0 flex items-center justify-between px-4 py-2 cursor-pointer select-none"
            onclick="toggleTerminal()"
          >
            <div class="flex items-center gap-2">
              <div class="flex gap-1.5">
                <span class="w-3 h-3 rounded-full bg-red-500/80" />
                <span class="w-3 h-3 rounded-full bg-yellow-500/80" />
                <span class="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span class="text-xs text-gray-400 font-mono ml-1">afl-tipper — ai output</span>
              <span id="terminal-live-dot" class="hidden w-2 h-2 rounded-full bg-green-400 animate-pulse ml-1" />
            </div>
            <div class="flex items-center gap-3">
              <button
                onclick="event.stopPropagation(); clearTerminal()"
                class="text-xs text-gray-600 hover:text-gray-400 font-mono transition-colors"
                title="Clear"
              >
                clear
              </button>
              <span id="terminal-chevron" class="text-gray-500 text-xs">▲</span>
            </div>
          </div>

          {/* Terminal body */}
          <div
            class="bg-gray-950 border-x border-b border-gray-700 h-72 overflow-y-auto p-4 font-mono text-sm leading-relaxed"
            id="terminal-output"
          >
            <span class="text-gray-600">Waiting for tip generation...</span>
          </div>
        </div>

        {/* Terminal toggle FAB (always visible) */}
        <button
          onclick="toggleTerminal()"
          class="fixed bottom-4 right-4 z-40 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white text-xs font-mono px-3 py-2 rounded-lg shadow-lg transition-colors flex items-center gap-2"
          id="terminal-fab"
          title="Toggle AI terminal"
        >
          <span>⌥</span>
          <span>terminal</span>
        </button>

        <script dangerouslySetInnerHTML={{ __html: `
          let _termOpen = false;
          let _es = null;
          let _buffer = '';
          let _flushTimer = null;

          const TEXT_COLORS = {
            info:  'text-gray-400',
            fetch: 'text-cyan-400',
            ai:    'text-green-300',
            error: 'text-red-400',
            done:  'text-yellow-300',
            clear: '',
          };

          function openTerminal() {
            if (_termOpen) return;
            _termOpen = true;
            document.getElementById('terminal-sheet').classList.remove('translate-y-full');
            document.getElementById('terminal-chevron').textContent = '▼';
            connectSSE();
          }

          function closeTerminal() {
            if (!_termOpen) return;
            _termOpen = false;
            document.getElementById('terminal-sheet').classList.add('translate-y-full');
            document.getElementById('terminal-chevron').textContent = '▲';
          }

          function toggleTerminal() {
            _termOpen ? closeTerminal() : openTerminal();
          }

          function clearTerminal() {
            const out = document.getElementById('terminal-output');
            out.innerHTML = '<span class="text-gray-600">Terminal cleared.</span>';
            fetch('/tips/clear', { method: 'POST' });
          }

          function connectSSE() {
            if (_es) return;
            _es = new EventSource('/tips/stream');
            document.getElementById('terminal-live-dot').classList.remove('hidden');

            _es.onmessage = (e) => {
              const line = JSON.parse(e.data);
              if (line.type === 'clear') {
                document.getElementById('terminal-output').innerHTML = '';
                return;
              }
              appendText(line.type, line.text);
            };

            _es.onerror = () => {
              document.getElementById('terminal-live-dot').classList.add('hidden');
            };

            _es.onopen = () => {
              document.getElementById('terminal-live-dot').classList.remove('hidden');
            };
          }

          function appendText(type, text) {
            const out = document.getElementById('terminal-output');
            // Remove placeholder
            const placeholder = out.querySelector('.text-gray-600');
            if (placeholder && out.children.length === 1) placeholder.remove();

            const colorClass = TEXT_COLORS[type] || 'text-gray-300';
            const span = document.createElement('span');
            span.className = colorClass;
            span.textContent = text;
            out.appendChild(span);
            out.scrollTop = out.scrollHeight;
          }

          // Open terminal automatically when tip generation starts
          document.addEventListener('htmx:beforeRequest', (e) => {
            const url = e.detail?.requestConfig?.path || '';
            if (url.includes('/tips/generate')) {
              openTerminal();
            }
          });

          // Connect SSE on load so history is immediately available if terminal opens
          window.addEventListener('load', () => connectSSE());
        `}} />
      </body>
    </html>
  );
};
