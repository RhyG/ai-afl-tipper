import type { FC } from "hono/jsx";
import { PROVIDER_MODELS } from "../services/runtime-config";
import { SPORTS, type SportId } from "../sports";

interface LayoutProps {
  title?: string;
  currentPath?: string;
  aiProvider?: string;
  aiModel?: string;
  sport?: SportId;
  children?: unknown;
}

export const Layout: FC<LayoutProps> = ({
  title,
  currentPath = "/",
  aiProvider = "claude",
  aiModel = "claude-opus-4-6",
  sport = "afl",
  children,
}) => {
  const models = PROVIDER_MODELS[aiProvider] ?? [];
  const sportConfig = SPORTS[sport];
  const pageTitle = title ?? `${sportConfig.label} AI Tipper`;

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{pageTitle}</title>
        <link rel="icon" type="image/svg+xml" href={`/public/favicon-${sport}.svg`} />
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/htmx.org@2.0.4"></script>
        <style dangerouslySetInnerHTML={{
          __html: `
            * { box-sizing: border-box; }

            body {
              background-color: #040d1a;
              background-image:
                radial-gradient(ellipse 140% 30% at 50% 0%, rgba(249,115,22,0.09) 0%, transparent 65%),
                radial-gradient(ellipse 60% 20% at 0% 100%, rgba(6,182,212,0.04) 0%, transparent 50%);
              min-height: 100vh;
            }

            /* Sticky nav with orange accent line */
            .site-nav {
              background: rgba(5, 12, 28, 0.96);
              backdrop-filter: blur(12px);
              border-bottom: 1px solid rgba(249,115,22,0.2);
              box-shadow: 0 1px 0 rgba(249,115,22,0.08), 0 8px 32px rgba(0,0,0,0.7);
            }

            /* Card base */
            .fixture-card {
              background: linear-gradient(160deg, rgba(17,27,51,0.9) 0%, rgba(4,13,26,1) 100%);
              border: 1px solid rgba(255,255,255,0.06);
              border-radius: 14px;
              transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
            }
            .fixture-card:hover {
              transform: translateY(-3px);
              border-color: rgba(249,115,22,0.2);
              box-shadow: 0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(249,115,22,0.1);
            }
            .fixture-card.card-live {
              border-color: rgba(239,68,68,0.5) !important;
              box-shadow: 0 0 0 1px rgba(239,68,68,0.2), 0 8px 32px rgba(239,68,68,0.1), 0 16px 48px rgba(0,0,0,0.7) !important;
            }
            .fixture-card.card-correct {
              border-color: rgba(52,211,153,0.35) !important;
              box-shadow: 0 0 0 1px rgba(52,211,153,0.1) !important;
            }
            .fixture-card.card-wrong {
              border-color: rgba(239,68,68,0.25) !important;
            }
            .fixture-card.card-tipped {
              border-color: rgba(249,115,22,0.3) !important;
            }

            /* Card team header gradient strip */
            .card-teams {
              background: linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%);
              border-bottom: 1px solid rgba(255,255,255,0.05);
            }

            /* Primary button with gradient + glow */
            .btn-primary {
              background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
              border: 1px solid rgba(249,115,22,0.4);
              box-shadow: 0 4px 16px rgba(249,115,22,0.3), inset 0 1px 0 rgba(255,255,255,0.15);
              color: white;
              font-weight: 700;
              letter-spacing: 0.01em;
              transition: all 0.15s ease;
            }
            .btn-primary:hover {
              background: linear-gradient(135deg, #fb923c 0%, #f97316 100%);
              box-shadow: 0 6px 24px rgba(249,115,22,0.45), inset 0 1px 0 rgba(255,255,255,0.2);
              transform: translateY(-1px);
            }

            /* Secondary button */
            .btn-secondary {
              background: rgba(255,255,255,0.05);
              border: 1px solid rgba(255,255,255,0.1);
              color: rgba(203,213,225,0.8);
              transition: all 0.15s ease;
            }
            .btn-secondary:hover {
              background: rgba(255,255,255,0.08);
              border-color: rgba(255,255,255,0.15);
              color: white;
            }

            /* Round nav */
            .round-display {
              background: linear-gradient(135deg, rgba(17,27,51,0.8) 0%, rgba(4,13,26,0.8) 100%);
              border: 1px solid rgba(255,255,255,0.07);
              border-radius: 12px;
            }

            /* Live ring animation */
            @keyframes live-ring {
              0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.6); }
              50% { box-shadow: 0 0 0 5px rgba(239,68,68,0); }
            }
            .live-dot { animation: live-ring 1.6s ease infinite; }

            /* Confidence bar */
            .conf-bar-track {
              background: rgba(255,255,255,0.07);
              border-radius: 999px;
              overflow: hidden;
              height: 6px;
            }
            .conf-bar-fill {
              height: 100%;
              border-radius: 999px;
              transition: width 0.5s ease;
            }
            .conf-high  { background: linear-gradient(90deg, #10b981, #34d399); }
            .conf-mid   { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
            .conf-low   { background: linear-gradient(90deg, #f97316, #f43f5e); }

            /* HTMX indicators */
            .htmx-indicator { opacity: 0; transition: opacity 200ms ease-in; }
            .htmx-request .htmx-indicator { opacity: 1; }
            .htmx-request.htmx-indicator { opacity: 1; }
            @keyframes spin { to { transform: rotate(360deg); } }
            .htmx-request .spin-on-load { animation: spin 0.7s linear infinite; }
            .htmx-request .hide-on-load { opacity: 0; }

            /* Terminal */
            .terminal-sheet {
              background: #060d1a;
              border-top: 1px solid rgba(249,115,22,0.25);
              border-left: 1px solid rgba(249,115,22,0.12);
              border-right: 1px solid rgba(249,115,22,0.12);
            }
            .terminal-header {
              background: rgba(8,15,30,0.95);
              border-bottom: 1px solid rgba(249,115,22,0.15);
            }
            #terminal-output::-webkit-scrollbar { width: 3px; }
            #terminal-output::-webkit-scrollbar-track { background: transparent; }
            #terminal-output::-webkit-scrollbar-thumb { background: rgba(249,115,22,0.35); border-radius: 2px; }

            /* Accuracy bar */
            .accuracy-bar {
              background: linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%);
              border: 1px solid rgba(255,255,255,0.06);
              border-radius: 12px;
            }
          `
        }} />
      </head>
      <body class="text-slate-100">
        {/* Startup validation overlay */}
        <div
          id="startup-overlay"
          hx-get="/status/startup"
          hx-trigger="load"
          hx-swap="outerHTML"
        />
        <nav class="site-nav sticky top-0 z-30">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-16 gap-4">

              {/* Brand + sport toggle */}
              <div class="flex items-center gap-3 shrink-0">
                <div class="flex items-center gap-1.5">
                  <span class="text-2xl leading-none">{sportConfig.emoji}</span>
                  <div class="hidden sm:block leading-none">
                    <span class="text-lg font-black tracking-tighter text-white">AI</span>
                    <span class="text-lg font-black tracking-tighter" style="color:#f97316"> TIPPER</span>
                  </div>
                </div>
                {/* Sport toggle */}
                <div class="flex rounded-lg overflow-hidden text-xs font-bold" style="border:1px solid rgba(255,255,255,0.1)">
                  {(Object.values(SPORTS) as typeof SPORTS[SportId][]).map((s) => (
                    <a
                      href={`/?sport=${s.id}`}
                      class={`px-3 py-1.5 transition-all ${
                        s.id === sport
                          ? "text-white"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                      style={s.id === sport ? "background:linear-gradient(135deg,#f97316,#ea580c)" : "background:rgba(255,255,255,0.04)"}
                    >
                      {s.emoji} {s.label}
                    </a>
                  ))}
                </div>
              </div>

              {/* AI provider settings */}
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
                  class="text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                  style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1)"
                >
                  {Object.keys(PROVIDER_MODELS).map((p) => (
                    <option value={p} selected={p === aiProvider}>{p}</option>
                  ))}
                </select>

                <select
                  name="model"
                  id="nav-model"
                  class="text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none max-w-[160px]"
                  style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1)"
                >
                  {models.map((m) => (
                    <option value={m} selected={m === aiModel}>{m}</option>
                  ))}
                </select>

                <button
                  type="submit"
                  class="btn-secondary text-xs px-2.5 py-1.5 rounded-lg shrink-0"
                >
                  Save
                </button>

                <span id="ai-settings-badge" class="text-xs text-slate-600 shrink-0"></span>
              </form>

              {/* Nav links */}
              <div class="flex gap-1 shrink-0">
                <a
                  href={`/?sport=${sport}`}
                  class={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${
                    currentPath === "/"
                      ? "text-white"
                      : "text-slate-500 hover:text-slate-200"
                  }`}
                  style={currentPath === "/" ? "background:linear-gradient(135deg,#f97316,#ea580c);box-shadow:0 4px 12px rgba(249,115,22,0.3)" : ""}
                >
                  Dashboard
                </a>
                <a
                  href={`/sources?sport=${sport}`}
                  class={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${
                    currentPath === "/sources"
                      ? "text-white"
                      : "text-slate-500 hover:text-slate-200"
                  }`}
                  style={currentPath === "/sources" ? "background:linear-gradient(135deg,#f97316,#ea580c);box-shadow:0 4px 12px rgba(249,115,22,0.3)" : ""}
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
          <div
            id="terminal-header"
            class="terminal-header rounded-t-xl flex items-center justify-between px-4 py-2.5 cursor-pointer select-none"
            onclick="toggleTerminal()"
          >
            <div class="flex items-center gap-2">
              <div class="flex gap-1.5">
                <span class="w-3 h-3 rounded-full bg-red-500/80" />
                <span class="w-3 h-3 rounded-full bg-yellow-500/80" />
                <span class="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span class="text-xs text-slate-500 font-mono ml-1">ai-tipper — output</span>
              <span id="terminal-live-dot" class="hidden w-2 h-2 rounded-full live-dot ml-1" style="background:#f97316" />
            </div>
            <div class="flex items-center gap-3">
              <button
                onclick="event.stopPropagation(); clearTerminal()"
                class="text-xs font-mono transition-colors"
                style="color:rgba(249,115,22,0.4)"
                onmouseover="this.style.color='rgba(249,115,22,0.9)'"
                onmouseout="this.style.color='rgba(249,115,22,0.4)'"
                title="Clear"
              >
                clear
              </button>
              <span id="terminal-chevron" class="text-slate-600 text-xs">▲</span>
            </div>
          </div>

          <div
            class="terminal-sheet h-72 overflow-y-auto p-4 font-mono text-sm leading-relaxed"
            id="terminal-output"
          >
            <span class="text-slate-700">Waiting for tip generation...</span>
          </div>
        </div>

        {/* Terminal toggle FAB */}
        <button
          onclick="toggleTerminal()"
          class="fixed bottom-4 right-4 z-40 text-xs font-mono px-3 py-2 rounded-lg shadow-xl transition-all flex items-center gap-2"
          style="background:rgba(5,12,28,0.95);border:1px solid rgba(249,115,22,0.25);color:rgba(249,115,22,0.7)"
          onmouseover="this.style.borderColor='rgba(249,115,22,0.6)';this.style.color='rgba(249,115,22,1)'"
          onmouseout="this.style.borderColor='rgba(249,115,22,0.25)';this.style.color='rgba(249,115,22,0.7)'"
          id="terminal-fab"
          title="Toggle AI terminal"
        >
          <span>⌥</span>
          <span>terminal</span>
        </button>

        <script dangerouslySetInnerHTML={{ __html: `
          let _termOpen = false;
          let _es = null;

          const TEXT_COLORS = {
            info:  'color:#94a3b8',
            fetch: 'color:#22d3ee',
            ai:    'color:#6ee7b7',
            error: 'color:#f87171',
            done:  'color:#fb923c',
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
            out.innerHTML = '<span style="color:#334155">Terminal cleared.</span>';
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
            const placeholder = out.querySelector('span');
            if (placeholder && out.children.length === 1 && placeholder.textContent.includes('Waiting')) placeholder.remove();

            const styleStr = TEXT_COLORS[type] || 'color:#cbd5e1';
            const span = document.createElement('span');
            span.style.cssText = styleStr;
            span.textContent = text;
            out.appendChild(span);
            out.scrollTop = out.scrollHeight;
          }

          window.addEventListener('load', () => connectSSE());
        `}} />
      </body>
    </html>
  );
};
