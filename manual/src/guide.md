# プロジェクト運用ガイド

pmpm を使ったプロジェクト運用のポイントをまとめます。最小限のルールで進捗とリスクを見える化し、日々の判断を速くすることが目的です。

## 計画

- プロジェクト開始時に `start` と `due` を明示する
- マイルストーンは「意思決定」や「合意点」を中心に置く
- 重要な不確実性はリスクとして登録し、回避や軽減の方針を書く

```bash
pmpm project update <key> --status ACTIVE
pmpm milestone create --name "要件合意" --due 2026-03-10
pmpm risk create --title "法務レビュー遅延" --probability LOW --impact HIGH --owner @hiroki
```

## 実行

- タスクは「成果物が確認できる粒度」で作る
- タスクの依存関係を明示し、ブロッカーを先に見つける
- 重要なやり取りはコメントに残し、判断の根拠を保持する

```bash
pmpm task add --title "CSV 仕様確定" --assignee @tanaka
pmpm dep add --from <仕様確定ID> --to <実装ID>
pmpm comment add <task-id> -m "合意済み。顧客要望は v2 で扱う"
```

## 進捗管理

- 週次で `--group-by status` を確認して偏りを発見する
- 期限超過のタスクは早めにスコープ調整を判断する

```bash
pmpm task list --group-by status --count
pmpm task list --filter 'due<2026-04-15 AND status!="Done"'
```

## 時間とコスト

- タスク単位で時間を記録し、見積もり精度を上げる
- 週次の集計で、ボトルネックや過負荷を把握する

```bash
pmpm time log <task-id> --minutes 90 --comment "調査"
pmpm time list --user me --from 2026-03-01 --to 2026-03-31
```

## ドキュメントの扱い

- 会議の結論や仕様はドキュメントに集約する
- ドキュメントはタスクより長期的な参照先として使う

```bash
pmpm doc create --title "意思決定ログ" --body "# 決定事項\n- ..."
```

## ワークフローの整備

- チームに合ったワークフローを作り、ステージを明文化する
- レビュー待ちの滞留を防ぐため、担当者と基準を決める

```bash
pmpm workflow create --name "開発フロー"
pmpm workflow stage add <workflow-id> --name "In Review" --category ACTIVE --position 3
pmpm workflow set-default <workflow-id>
```
