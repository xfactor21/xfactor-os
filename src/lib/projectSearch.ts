import {
  flattenProjectFiles,
  isLikelyTextProjectFile,
  isSensitiveProjectFile,
  readProjectTextFile,
  type ProjectEntry,
} from './projectFolder';

export interface ProjectSearchHit {
  path: string;
  line: number;
  column: number;
  preview: string;
}

export interface ProjectSearchResult {
  hits: ProjectSearchHit[];
  scannedFiles: number;
  skippedSensitive: number;
  truncated: boolean;
}

export async function searchProjectText(
  rootPath: string,
  entries: ProjectEntry[],
  query: string,
  options: {
    caseSensitive?: boolean;
    includeSensitive?: boolean;
    maxFiles?: number;
    maxHits?: number;
    maxTotalChars?: number;
  } = {},
): Promise<ProjectSearchResult> {
  const needle = query.trim();
  if (!needle) return { hits: [], scannedFiles: 0, skippedSensitive: 0, truncated: false };

  const maxFiles = options.maxFiles ?? 1200;
  const maxHits = options.maxHits ?? 250;
  const maxTotalChars = options.maxTotalChars ?? 8_000_000;
  const compareNeedle = options.caseSensitive ? needle : needle.toLowerCase();
  const hits: ProjectSearchHit[] = [];
  let scannedFiles = 0;
  let skippedSensitive = 0;
  let totalChars = 0;
  let truncated = false;

  for (const entry of flattenProjectFiles(entries)) {
    if (scannedFiles >= maxFiles || hits.length >= maxHits || totalChars >= maxTotalChars) {
      truncated = true;
      break;
    }
    if (!isLikelyTextProjectFile(entry.relativePath)) continue;
    if (!options.includeSensitive && isSensitiveProjectFile(entry.relativePath)) {
      skippedSensitive += 1;
      continue;
    }
    let content: string;
    try {
      content = await readProjectTextFile(rootPath, entry.relativePath);
    } catch {
      continue;
    }
    scannedFiles += 1;
    totalChars += content.length;
    if (totalChars > maxTotalChars) {
      truncated = true;
      break;
    }
    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const compareLine = options.caseSensitive ? line : line.toLowerCase();
      let from = 0;
      while (from <= compareLine.length) {
        const columnIndex = compareLine.indexOf(compareNeedle, from);
        if (columnIndex < 0) break;
        hits.push({
          path: entry.relativePath,
          line: index + 1,
          column: columnIndex + 1,
          preview: line.trim().slice(0, 280),
        });
        if (hits.length >= maxHits) {
          truncated = true;
          break;
        }
        from = columnIndex + Math.max(1, compareNeedle.length);
      }
      if (hits.length >= maxHits) break;
    }
  }

  return { hits, scannedFiles, skippedSensitive, truncated };
}
