# ユーザーテーブル定義 (USERS)

| 論理名 | 物理名 | データ型 | 桁数 | 必須 | PK | 備考 |
|---|---|---|---|---|---|---|
| ユーザーID | id | VARCHAR | 36 | 〇 | 〇 | UUID |
| ユーザー名 | username | VARCHAR | 50 | 〇 | - | |
| メールアドレス | email | VARCHAR | 255 | 〇 | - | |
| 有効フラグ | is_active | BOOLEAN | - | 〇 | - | 1: 有効, 0: 無効 |
| 最終ログイン日時 | last_login_at | DATETIME | - | - | - | |
| 権限 | role | VARCHAR | 20 | 〇 | - | |
