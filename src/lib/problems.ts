export type ProblemSeverity = 'error' | 'warning' | 'info';

export interface WorkbenchProblem {
  id: string;
  severity: ProblemSeverity;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  code?: string;
  source: 'typescript' | 'vite' | 'runtime' | 'process';
}

function cleanFile(raw?: string): string | undefined {
  if (!raw) return undefined;
  return raw
    .replace(/^file:\/\//, '')
    .replace(/^\/workspace\//, '')
    .replace(/^workspace\//, '')
    .trim();
}

function severityOf(raw?: string): ProblemSeverity {
  const value = raw?.toLowerCase();
  if (value?.includes('warn')) return 'warning';
  if (value?.includes('info')) return 'info';
  return 'error';
}

export function parseWorkbenchProblems(output: string): WorkbenchProblem[] {
  const problems: WorkbenchProblem[] = [];
  const seen = new Set<string>();
  const add = (problem: Omit<WorkbenchProblem, 'id'>) => {
    const key = `${problem.source}|${problem.file ?? ''}|${problem.line ?? ''}|${problem.column ?? ''}|${problem.code ?? ''}|${problem.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    problems.push({ ...problem, id: `problem-${problems.length + 1}` });
  };

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // TypeScript: src/App.tsx(12,7): error TS2322: ...
    let match = line.match(/^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+TS(\d+):\s*(.+)$/i);
    if (match) {
      add({
        source: 'typescript',
        severity: severityOf(match[4]),
        file: cleanFile(match[1]),
        line: Number(match[2]),
        column: Number(match[3]),
        code: `TS${match[5]}`,
        message: match[6].trim(),
      });
      continue;
    }

    // Vite/esbuild/common compilers: /workspace/src/App.tsx:12:7: ERROR: ...
    match = line.match(/^(.+?):(\d+):(\d+):\s*(?:(ERROR|WARNING)\s*:?)?\s*(.+)$/i);
    if (match && /[./\\]/.test(match[1])) {
      add({
        source: 'vite',
        severity: severityOf(match[4]),
        file: cleanFile(match[1]),
        line: Number(match[2]),
        column: Number(match[3]),
        message: match[5].trim(),
      });
      continue;
    }

    // Runtime stacks: at fn (/workspace/src/main.js:12:7)
    match = line.match(/\((.+?):(\d+):(\d+)\)$/);
    if (match) {
      add({
        source: 'runtime',
        severity: 'error',
        file: cleanFile(match[1]),
        line: Number(match[2]),
        column: Number(match[3]),
        message: line.replace(/^at\s+/, ''),
      });
      continue;
    }

    if (/\b(error|failed|fatal)\b/i.test(line) && line.length < 1000) {
      add({ source: 'process', severity: 'error', message: line });
    } else if (/\bwarning\b/i.test(line) && line.length < 1000) {
      add({ source: 'process', severity: 'warning', message: line });
    }
  }

  return problems.slice(0, 300);
}
