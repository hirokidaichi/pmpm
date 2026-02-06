import { describe, it, expect } from "vitest";
import {
  formatTable,
  formatJson,
  formatYaml,
  formatOutput,
} from "../../src/output/formatter.js";

// ── Test Data ──

const sampleTasks = [
  {
    id: "01HXK00100000000",
    title: "ログイン画面実装",
    status: "In Progress",
    assignee: "tanaka",
    importance: "HIGH",
  },
  {
    id: "01HXK00200000000",
    title: "API設計",
    status: "Open",
    assignee: "suzuki",
    importance: "NORMAL",
  },
];

const singleItem = {
  id: "01HXK001",
  name: "Engineering",
  slug: "eng",
  description: "エンジニアリングチーム",
};

// ── formatJson ──

describe("formatJson", () => {
  it("配列データをJSON形式で出力する", () => {
    const output = formatJson(sampleTasks);
    const parsed = JSON.parse(output);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].title).toBe("ログイン画面実装");
  });

  it("単一オブジェクトをJSON形式で出力する", () => {
    const output = formatJson(singleItem);
    const parsed = JSON.parse(output);

    expect(parsed.name).toBe("Engineering");
  });

  it("インデント付きで出力される", () => {
    const output = formatJson({ key: "value" });
    expect(output).toContain("\n");
    expect(output).toContain("  ");
  });

  it("空配列を正しく出力する", () => {
    const output = formatJson([]);
    expect(JSON.parse(output)).toEqual([]);
  });

  it("null 値を含むデータを正しく出力する", () => {
    const output = formatJson({ id: "1", value: null });
    const parsed = JSON.parse(output);
    expect(parsed.value).toBeNull();
  });

  it("日本語を正しく出力する", () => {
    const output = formatJson({ title: "ログイン画面実装" });
    expect(output).toContain("ログイン画面実装");
  });

  it("fields オプションで配列データのフィールドを絞れる", () => {
    const output = formatJson(sampleTasks, { fields: "id,title" });
    const parsed = JSON.parse(output);

    expect(parsed[0]).toHaveProperty("id");
    expect(parsed[0]).toHaveProperty("title");
    expect(parsed[0]).not.toHaveProperty("status");
    expect(parsed[0]).not.toHaveProperty("assignee");
  });
});

// ── formatTable ──

describe("formatTable", () => {
  it("ヘッダーとデータ行を含む", () => {
    const output = formatTable(sampleTasks);
    const lines = output.split("\n");

    expect(lines[0]).toContain("ID");
    expect(lines[0]).toContain("TITLE");
    expect(lines).toHaveLength(3); // header + 2 rows
  });

  it("空配列の場合は 'No results found.' を返す", () => {
    const output = formatTable([]);
    expect(output).toBe("No results found.");
  });

  it("fields オプションで表示カラムを絞れる (カンマ区切り文字列)", () => {
    const output = formatTable(sampleTasks, { fields: "id,title" });
    const lines = output.split("\n");

    expect(lines[0]).toContain("ID");
    expect(lines[0]).toContain("TITLE");
    expect(lines[0]).not.toContain("STATUS");
    expect(lines[0]).not.toContain("ASSIGNEE");
  });

  it("ヘッダーは大文字で表示される", () => {
    const output = formatTable(sampleTasks);
    const header = output.split("\n")[0];

    // ヘッダーの各カラム名が大文字であることを確認
    expect(header).toContain("ID");
    expect(header).toContain("TITLE");
    expect(header).toContain("STATUS");
  });

  it("null/undefined 値は '-' で表示される", () => {
    const data = [{ id: "abc", value: null, other: undefined }];
    const output = formatTable(data);

    expect(output).toContain("-");
    expect(output).not.toContain("null");
    expect(output).not.toContain("undefined");
  });

  it("ID が8文字を超える場合は truncate される", () => {
    const data = [{ id: "01HXK00100000000", name: "test" }];
    const output = formatTable(data);

    expect(output).toContain("01HXK001...");
    expect(output).not.toContain("01HXK00100000000");
  });

  it("noHeader オプションでヘッダーを非表示にできる", () => {
    const output = formatTable(sampleTasks, { noHeader: true });
    const lines = output.split("\n");

    // ヘッダーなしなのでデータ行のみ
    expect(lines).toHaveLength(2);
    // 先頭行はヘッダーではなくデータ行
    expect(lines[0]).not.toContain("TITLE");
    expect(lines[0]).toContain("ログイン画面実装");
  });

  it("配列値はカンマ区切りで表示される", () => {
    const data = [{ id: "1", tags: ["frontend", "urgent"] }];
    const output = formatTable(data);

    expect(output).toContain("frontend, urgent");
  });

  it("オブジェクト値は name プロパティで表示される", () => {
    const data = [{ id: "1", project: { name: "Backend" } }];
    const output = formatTable(data);

    expect(output).toContain("Backend");
  });
});

// ── formatYaml ──

describe("formatYaml", () => {
  it("単一オブジェクトをYAML形式で出力する", () => {
    const output = formatYaml(singleItem);

    expect(output).toContain("id:");
    expect(output).toContain("name:");
    expect(output).toContain("Engineering");
  });

  it("配列データをYAML形式で出力する", () => {
    const output = formatYaml(sampleTasks);

    expect(output).toContain("-");
    expect(output).toContain("title:");
  });

  it("fields オプションでフィールドを絞れる", () => {
    const output = formatYaml(sampleTasks, { fields: "id,title" });

    expect(output).toContain("id:");
    expect(output).toContain("title:");
    expect(output).not.toContain("status:");
    expect(output).not.toContain("assignee:");
  });
});

// ── formatOutput ──

describe("formatOutput", () => {
  it("json フォーマットを処理する", () => {
    const output = formatOutput(sampleTasks, { format: "json" });
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it("table フォーマットを処理する", () => {
    const output = formatOutput(sampleTasks, { format: "table" });
    expect(output).toContain("ID");
    expect(output).toContain("TITLE");
  });

  it("yaml フォーマットを処理する", () => {
    const output = formatOutput(sampleTasks, { format: "yaml" });
    expect(output).toContain("title:");
  });

  it("デフォルトは table フォーマット", () => {
    const output = formatOutput(sampleTasks);
    // table フォーマットはヘッダー行を含む
    expect(output).toContain("ID");
  });

  it("quiet モードでは ID のみ出力する (配列)", () => {
    const output = formatOutput(sampleTasks, { quiet: true });
    const lines = output.split("\n").filter((l) => l.length > 0);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("01HXK00100000000");
    expect(lines[1]).toBe("01HXK00200000000");
  });

  it("quiet モードでは ID のみ出力する (単一オブジェクト)", () => {
    const output = formatOutput(singleItem, { quiet: true });
    expect(output).toBe("01HXK001");
  });

  it("単一オブジェクトは key-value ペアで表示される (table フォーマット)", () => {
    const output = formatOutput(singleItem, { format: "table" });

    // key-value 形式: key  value
    expect(output).toContain("id");
    expect(output).toContain("name");
    expect(output).toContain("Engineering");
  });

  it("fields オプションでカラムを絞る", () => {
    const output = formatOutput(sampleTasks, {
      format: "table",
      fields: "id,title",
    });

    expect(output).toContain("ID");
    expect(output).toContain("TITLE");
    expect(output).not.toContain("STATUS");
  });

  it("文字列やプリミティブはそのまま出力される", () => {
    const output = formatOutput("hello world");
    expect(output).toBe("hello world");
  });
});
