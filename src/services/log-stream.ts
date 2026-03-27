export type LogLine = {
  type: "info" | "fetch" | "ai" | "error" | "done" | "clear";
  text: string;
  ts: number;
};

type Subscriber = (line: LogLine) => void;

const subscribers = new Set<Subscriber>();
const history: LogLine[] = [];
const MAX_HISTORY = 500;

export function emit(line: Omit<LogLine, "ts">) {
  const full: LogLine = { ...line, ts: Date.now() };
  history.push(full);
  if (history.length > MAX_HISTORY) history.shift();
  for (const sub of subscribers) {
    try {
      sub(full);
    } catch {
      // subscriber disconnected
    }
  }
}

export function subscribe(fn: Subscriber): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function getHistory(): LogLine[] {
  return [...history];
}

export function clearHistory() {
  history.length = 0;
  emit({ type: "clear", text: "" });
}
