# トランザクションテーブル定義 (TRANSACTIONS)

| 論理名 | 物理名 | データ型 | 桁数 | 必須 | PK | 備考 |
|---|---|---|---|---|---|---|
| トランザクションID | transaction_id | VARCHAR | 36 | 〇 | 〇 | UUID |
| ユーザーID | user_id | VARCHAR | 36 | 〇 | - | 外部キー |
| 金額 | amount | DECIMAL | 10,2 | 〇 | - | |
| 通貨 | currency | VARCHAR | 3 | 〇 | - | JPY, USD等 |
| ステータス | status | VARCHAR | 10 | 〇 | - | PENDING, SUCCESS, FAILED のみ |
| 作成日時 | created_at | DATETIME | - | 〇 | - | |
