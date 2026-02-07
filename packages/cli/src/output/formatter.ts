import { stringify as yamlStringify } from "yaml";
import pc from "picocolors";
import type { OutputFormat } from "@pmpm/shared/constants";

// ── Types ──

export interface FormatOptions {
  format?: OutputFormat;
  fields?: string;
  quiet?: boolean;
  noHeader?: boolean;
}

// ── Color State ──

let _noColor = false;

export function setNoColor(value: boolean): void {
  _noColor = value;
}

function isColorEnabled(): boolean {
  if (_noColor) return false;
  if (process.env.NO_COLOR !== undefined) return false;
  return true;
}

function c(fn: (s: string) => string, text: string): string {
  return isColorEnabled() ? fn(text) : text;
}

// ── Importance Colorizer ──

function colorizeImportance(value: string): string {
  switch (value) {
    case "CRITICAL":
      return c(pc.red, value);
    case "HIGH":
      return c(pc.yellow, value);
    case "LOW":
      return c(pc.gray, value);
    default:
      return value;
  }
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
    const header = keys.map((k) => c(pc.bold, k.toUpperCase().padEnd(widths[k]))).join("  ");
    lines.push(header);
  }

  // Rows
  for (const row of filtered) {
    const line = keys
      .map((k) => {
        const cell = formatCellValue(row[k]);
        const displayValue = k === "id" ? truncateId(cell) : cell;
        const padded = displayValue.padEnd(widths[k]);
        if (k === "id") return c(pc.dim, padded);
        if (k === "importance") {
          // Pad first with plain text, then colorize
          const padding = " ".repeat(Math.max(0, widths[k] - displayValue.length));
          return colorizeImportance(displayValue) + padding;
        }
        return padded;
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

// ── CSV Formatter (RFC 4180) ──

function escapeCsvField(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n") || value.includes("\r")) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export function formatCsv(
  data: unknown,
  opts: FormatOptions = {}
): string {
  if (!Array.isArray(data) || data.length === 0) {
    if (!Array.isArray(data) && typeof data === "object" && data !== null) {
      // Single object: wrap in array
      data = [data];
    } else {
      return "";
    }
  }

  const rows = opts.fields
    ? selectFields(data as Record<string, unknown>[], opts.fields)
    : (data as Record<string, unknown>[]);

  if (rows.length === 0) return "";

  const keys = Object.keys(rows[0]);
  const lines: string[] = [];

  if (!opts.noHeader) {
    lines.push(keys.map((k) => escapeCsvField(k)).join(","));
  }

  for (const row of rows) {
    const line = keys
      .map((k) => escapeCsvField(formatCellValue(row[k])))
      .join(",");
    lines.push(line);
  }

  return lines.join("\n");
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
    case "csv":
      return formatCsv(data, opts);
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

/** Extract FormatOptions from Commander's optsWithGlobals() result */
export function extractFormatOpts(opts: Record<string, unknown>): FormatOptions {
  return {
    format: opts.format as OutputFormat | undefined,
    fields: opts.fields as string | undefined,
    quiet: opts.quiet as boolean | undefined,
    noHeader: opts.headers === false,
  };
}

export function printOutput(data: unknown, opts: FormatOptions = {}): void {
  const output = formatOutput(data, opts);
  if (output) {
    console.log(output);
  }
}

// ── Success / Error Messages ──

export function printSuccess(message: string): void {
  console.log(c(pc.green, message));
}

export function printError(message: string): void {
  console.error(c(pc.red, `Error: ${message}`));
}

export function printWarning(message: string): void {
  console.error(c(pc.yellow, `Warning: ${message}`));
}
