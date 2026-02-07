# Get Started: シナリオで学ぶ

このセクションでは、新規機能リリースを想定したプロジェクトの立ち上げから運用までを、pmpm の CLI で一通り体験します。

## シナリオ

- 目的: 2026-04-15 に「請求レポート自動生成」機能をリリースする
- 体制: リード 1 名、開発 2 名、ステークホルダー 1 名
- 進め方: マイルストーンと依存関係を明確にし、日々のタスクと時間を記録する

## 1. 初期セットアップ

```bash
pmpm auth login

pmpm workspace create --name "Product Engineering" --slug eng
pmpm workspace use eng

pmpm project create --key BILL --name "請求レポート自動生成" --start 2026-03-01 --due 2026-04-15
pmpm project use BILL
```

## 2. 体制とマイルストーン

```bash
pmpm project members add @hiroki --role LEAD --title "プロジェクトリード"
pmpm project members add @tanaka --role MEMBER
pmpm project members add @suzuki --role MEMBER
pmpm project members add @client_a --role STAKEHOLDER

pmpm milestone create --name "仕様合意" --due 2026-03-10
pmpm milestone create --name "実装完了" --due 2026-04-05
pmpm milestone create --name "リリース" --due 2026-04-15
```

## 3. タスク設計と依存関係

```bash
pmpm task add --title "要件ヒアリング" --assignee @hiroki --due 2026-03-05
pmpm task add --title "API設計" --assignee @tanaka --due 2026-03-08
pmpm task add --title "UI設計" --assignee @suzuki --due 2026-03-08
pmpm task add --title "実装" --assignee @tanaka --due 2026-04-01
pmpm task add --title "QA/受け入れ" --assignee @hiroki --due 2026-04-10

pmpm dep add --from <API設計のID> --to <実装のID> --type FS
pmpm dep add --from <UI設計のID> --to <実装のID> --type FS
pmpm dep add --from <実装のID> --to <QA/受け入れのID> --type FS
```

ヒント: 依存関係は「先に終えるべきタスク」を `--from` に、「待つ側」を `--to` に指定します。

## 4. 日々の進行とコミュニケーション

```bash
pmpm task list --status "In Progress" --assignee me
pmpm task show <task-id>

pmpm comment add <task-id> -m "API案を共有しました。レビューお願いします @hiroki"
pmpm task edit <task-id> --status "In Review"
```

## 5. 時間管理

```bash
pmpm time start <task-id>
# ...作業...
pmpm time stop --comment "API 実装の基本形まで完了"

pmpm time list --user me --from 2026-03-01 --to 2026-03-31
```

## 6. リスク登録とフォロー

```bash
pmpm risk create --title "仕様変更によるスコープ拡大" --probability MEDIUM --impact HIGH --owner @hiroki
pmpm risk update <risk-id> --status MITIGATING --mitigation "変更要望は週次レビューで必ず合意"
```

## 7. ドキュメント整備

```bash
pmpm doc create --title "要件定義" --body "# 要件\n- ..."
pmpm doc create --title "API 仕様" --body "# API\n- ..."
```

## 8. 進捗の把握

```bash
pmpm task list --group-by status --count
pmpm task list --filter 'due<2026-04-15 AND status!="Done"'
```

この一連の流れをテンプレートとして、プロジェクトの種類に合わせてタスクやリスク、マイルストーンの粒度を調整してください。
