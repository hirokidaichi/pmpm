# CLI リファレンス

pmpm は `pmpm <resource> <verb>` の形で統一されています。読み取り系は `list`, `show`, `search`、書き込み系は `add`, `edit`, `delete` が基本です。

## 共通オプション

- `--format table|json|yaml` 出力形式
- `--fields a,b,c` 表示する列を絞る
- `--filter 'expr'` 高度なフィルタ式
- `--sort field:asc,field2:desc` ソート
- `--count` 件数のみ
- `--group-by field` 集計

例:

```bash
pmpm task list --filter 'status="Open" AND assignee=@tanaka'
pmpm task list --group-by status --count
pmpm task list --fields id,title,status
```

## 主要リソース

- `workspace` ワークスペース
- `project` プロジェクト
- `task` タスク
- `comment` コメント
- `dep` 依存関係
- `time` 時間計測
- `doc` ドキュメント
- `milestone` マイルストーン
- `risk` リスク

## よく使うコマンド

```bash
# ワークスペースとプロジェクト
pmpm workspace list
pmpm workspace use <slug>
pmpm project list
pmpm project use <key>

# タスク
pmpm task add --title "ログイン実装" --assignee @tanaka
pmpm task list --status "In Progress"
pmpm task show <id>
pmpm task edit <id> --status "Done"

# 依存関係
pmpm dep add --from <task-a> --to <task-b>

# 時間管理
pmpm time start <task-id>
pmpm time stop --comment "レビュー対応"

# ドキュメント
pmpm doc create --title "設計" --body "# 設計\n- ..."
```

## フィルタの考え方

フィルタは `field=value` 形式で AND/OR を組み合わせます。

```bash
pmpm task list --filter 'status="Open" AND (assignee=@hiroki OR assignee=@tanaka)'
pmpm task list --filter 'due<2026-04-15 AND importance>=HIGH'
```
