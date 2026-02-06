import { stringify as yamlStringify } from "yaml";
import type { OutputFormat } from "@pmpm/shared/constants";

// ── Types ──

export interface FormatOptions {
  format?: OutputFormat;
  fields?: string;
  quiet?: boolean;
  noHeader?: boolean;
}

// ── Field Selection ──

function selectFields(
  data: Record<string, unknown>[],
  fields?: string
): Record<string, unknown>[] {
  if (!fields) return data;
  const keys = fields.split(",").map((f) => f.trim());
  return data.map((row) => {
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      if (key in row) {
        result[key] = row[key];
      }
    }
    return result;
  });
}

// ── Table Formatter ──

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (Array.isArray(value)) {
    return value
      .map((v) =>
        typeof v === "object" && v !== null
          ? (v as Record<string, unknown>).displayName ||
            (v as Record<string, unknown>).name ||
            (v as Record<string, unknown>).alias ||
            JSON.stringify(v)
          : String(v)
      )
      .join(", ");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return (
      (obj.name as string) ||
      (obj.displayName as string) ||
      (obj.alias as string) ||
      JSON.stringify(value)
    );
  }
  return String(value);
}

function truncateId(id: string): string {
  if (id.length > 8) {
    return id.substring(0, 8) + "...";
  }
  return id;
}

export function formatTable(
  data: Record<string, unknown>[],
  opts: FormatOptions = {}
): string {
  if (data.length === 0) return "No results found.";

  const filtered = selectFields(data, opts.fields);
  const keys = Object.keys(filtered[0]);

  // Calculate column widths
  const widths: Record<string, number> = {};
  for (const key of keys) {
    const header = key.toUpperCase();
    widths[key] = header.length;
    for (const row of filtered) {
      const cell = formatCellValue(row[key]);
      const displayValue = key === "id" ? truncateId(cell) : cell;
      widths[key] = Math.max(widths[key], displayValue.length);
    }
  }

  const lines: string[] = [];

  // Header
  if (!opts.noHeader) {
    const header = keys.map((k) => k.toUpperCase().padEnd(widths[k])).join("  ");
    lines.push(header);
  }

  // Rows
  for (const row of filtered) {
    const line = keys
      .map((k) => {
        const cell = formatCellValue(row[k]);
        const displayValue = k === "id" ? truncateId(cell) : cell;
        return displayValue.padEnd(widths[k]);
      })
      .join("  ");
    lines.push(line);
  }

  return lines.join("\n");
}

// ── JSON Formatter ──

export function formatJson(
  data: unknown,
  opts: FormatOptions = {}
): string {
  if (opts.fields && Array.isArray(data)) {
    data = selectFields(data as Record<string, unknown>[], opts.fields);
  }
  return JSON.stringify(data, null, 2);
}

// ── YAML Formatter ──

export function formatYaml(
  data: unknown,
  opts: FormatOptions = {}
): string {
  if (opts.fields && Array.isArray(data)) {
    data = selectFields(data as Record<string, unknown>[], opts.fields);
  }
  return yamlStringify(data);
}

// ── Unified Output ──

export function formatOutput(
  data: unknown,
  opts: FormatOptions = {}
): string {
  // Quiet mode: output IDs only
  if (opts.quiet) {
    if (Array.isArray(data)) {
      return data
        .map((item) => {
          if (typeof item === "object" && item !== null) {
            return (item as Record<string, unknown>).id ?? "";
          }
          return String(item);
        })
        .join("\n");
    }
    if (typeof data === "object" && data !== null) {
      return String((data as Record<string, unknown>).id ?? "");
    }
    return String(data);
  }

  const format = opts.format ?? "table";

  switch (format) {
    case "json":
      return formatJson(data, opts);
    case "yaml":
      return formatYaml(data, opts);
    case "table":
    default:
      if (Array.isArray(data)) {
        return formatTable(data, opts);
      }
      // Single object: show key-value pairs
      if (typeof data === "object" && data !== null) {
        return formatSingleObject(data as Record<string, unknown>, opts);
      }
      return String(data);
  }
}

// ── Single Object Display ──

function formatSingleObject(
  data: Record<string, unknown>,
  opts: FormatOptions = {}
): string {
  const filtered = opts.fields
    ? selectFields([data], opts.fields)[0]
    : data;

  const keys = Object.keys(filtered);
  const maxKeyLen = Math.max(...keys.map((k) => k.length));

  return keys
    .map((k) => {
      const label = k.padEnd(maxKeyLen);
      const value = formatCellValue(filtered[k]);
      return `${label}  ${value}`;
    })
    .join("\n");
}

// ── Print Helper ──

export function printOutput(data: unknown, opts: FormatOptions = {}): void {
  const output = formatOutput(data, opts);
  if (output) {
    console.log(output);
  }
}

// ── Success / Error Messages ──

export function printSuccess(message: string): void {
  console.log(message);
}

export function printError(message: string): void {
  console.error(`Error: ${message}`);
}

export function printWarning(message: string): void {
  console.error(`Warning: ${message}`);
}
