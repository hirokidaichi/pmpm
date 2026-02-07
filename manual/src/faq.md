# FAQ

## Q. チームでの最小限のルールはありますか

A. まずは次の 3 点だけ決めることをおすすめします。

- ステータスの使い分け
- 期限の基準
- 重要度の基準

## Q. タスクの粒度はどこまで細かくすべきですか

A. 進捗が 1 日から 3 日で確認できる粒度が目安です。粒度が荒い場合はサブタスクを作り、依存関係で整理します。

## Q. コメントとドキュメントの使い分けは

A. コメントはその場の判断や会話のログ、ドキュメントは長期参照の仕様や方針に使います。

## Q. まず何から始めるべきですか

A. `workspace` と `project` の作成、主要メンバーの追加、初期マイルストーンの作成から始めると運用が安定します。

```bash
pmpm workspace create --name "Engineering" --slug eng
pmpm project create --key NEW --name "新規プロジェクト"
pmpm project members add @hiroki --role LEAD
pmpm milestone create --name "初期合意" --due 2026-03-10
```
