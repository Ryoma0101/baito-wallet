# AGENT.md

AIエージェントがこのリポジトリで作業する際の指針。必ず最初に読むこと。

---

## プロジェクト概要

大学生・主婦層向けのアルバイト給与管理アプリ。詳細は `spec.md` を参照。

---

## 技術スタック

- **React Native + Expo GO**（expo-router でファイルベースルーティング）
- **TypeScript**（strict モード）
- **expo-sqlite**（ローカルDB、サーバー通信なし）
- **RevenueCat**（課金管理）
- ユーザーデータはすべてローカル保存。外部DBへの送信は禁止

---

## ディレクトリ構成

```
src/                      # ソースコード（@/ エイリアスで参照可能）
  app/                    # Expo Router のルート
    (tabs)/               # タブナビゲーション
      _layout.tsx         # タブレイアウト
      index.tsx           # ホーム（残り枠・ゲージ）
      shifts.tsx          # シフト一覧・入力
      payslips.tsx        # 給与明細
      settings.tsx        # 設定
    onboarding/           # オンボーディング（初回のみ）
      index.tsx
    _layout.tsx           # ルートレイアウト

  components/             # 再利用可能なUIコンポーネント
  lib/
    db.ts                 # SQLite の初期化・マイグレーション
    tax.ts                # 扶養壁の判定ロジック（純粋関数）
    revenue.ts            # 収入集計ロジック（見込み・実績の合算）
    rules.ts              # GitHub JSON のfetch・キャッシュ
  constants/
    walls.ts              # フォールバック用のデフォルト税制数値
  types/
    index.ts              # 共通型定義
  __tests__/              # ユニットテスト
    rules.test.ts
```

---

## コーディングルール

### 全般
- TypeScript の `strict: true` を維持する
- `any` 型の使用禁止。不明な型は `unknown` を使い、型ガードで絞る
- コンポーネントはすべて関数コンポーネント（クラスコンポーネント禁止）
- `console.log` はデバッグ用途のみ。コミット前に削除する

### DB操作
- DB操作はすべて `lib/db.ts` 経由で行う。コンポーネントから直接SQLを書かない
- マイグレーションは `lib/db.ts` の `migrations` 配列で管理する（番号順に実行）
- スキーマ変更時は既存データを壊さないよう `ALTER TABLE` で対応する

### 税制ロジック
- 扶養壁の判定ロジックは `lib/tax.ts` に集約する
- 壁の金額は直接ハードコードしない。`constants/walls.ts` のデフォルト値か、`lib/rules.ts` でfetchした値を使う
- `lib/tax.ts` の関数は純粋関数（副作用なし）にする。テストしやすくするため

```typescript
// Good: 純粋関数
export function calcWalls(settings: UserSettings, rules: TaxRules): WallResult { ... }

// Bad: 直接DBやfetchに依存
export async function calcWalls(): Promise<WallResult> { ... }
```

### 収入計算
- 収入集計は「payslipsの実績値を優先し、未入力の月はshiftsの見込み値で補完」するルールを守る
- この集計ロジックは `lib/revenue.ts` に実装する

### 課金
- 有料機能のゲートは `lib/purchases.ts` の `isPremium()` で一元管理する
- コンポーネント内で RevenueCat を直接呼び出さない

---

## やってはいけないこと

- ユーザーの収入・個人情報を外部サーバーに送信する
- Supabase・Firebase など外部DBを追加する
- `expo-sqlite` 以外のストレージ（AsyncStorage等）に収入データを保存する
- 税制の数値を複数箇所にハードコードする（`constants/walls.ts` に一元化）
- 有料機能のロジックを無料ユーザーにも実行してしまう（表示だけブロックはNG）

---

## よくあるタスクのパターン

### 新しい画面を追加する
1. `app/` 以下に `.tsx` ファイルを作成（Expo Router が自動でルート登録）
2. `components/` に必要なUIパーツを切り出す
3. DBアクセスが必要なら `lib/db.ts` にクエリ関数を追加

### DBスキーマを変更する
1. `lib/db.ts` の `migrations` 配列に新しいマイグレーションを追加
2. バージョン番号を1つ増やす
3. 既存テーブルへの変更は `ALTER TABLE` を使う（DROP & CREATE は禁止）

### 税制の数値を更新する
1. GitHubリポジトリの `public/tax_rules.json` を更新する
2. `constants/walls.ts` のフォールバック値も同じ数値に更新する
3. アプリのアップデートは不要（次回起動時に自動fetch）

### 有料機能を追加する
1. `spec.md` の有料機能リストに追記する
2. ロジックを実装する（無料ユーザーにも計算は走らせない）
3. `isPremium()` でゲートを張る
4. RevenueCat のダッシュボードでエンタイトルメントを確認する

---

## GitHub JSON のフォールバック

`lib/rules.ts` でのfetchが失敗した場合（オフライン等）は、`constants/walls.ts` のデフォルト値を使う。

```typescript
// constants/walls.ts のデフォルト値は常に最新に保つこと
export const DEFAULT_WALLS = {
  income_tax: 1_780_000,
  dependent_specific_limit: 1_500_000,
  social_insurance_basic: 1_300_000,
  social_insurance_large_company: 1_060_000,
  // ...
}
```

---

## ブランチ設計

```
main          # リリース済みの安定版のみ。直接コミット禁止
develop       # 開発の統合ブランチ。各featureはここにマージ
│
├── feature/onboarding        # オンボーディング画面
├── feature/home              # ホーム画面（残り枠・ゲージ）
├── feature/shift-input       # シフト入力
├── feature/job-registration  # バイト先登録
├── feature/payslip-input     # 給与明細入力
├── feature/monthly-chart     # 月次グラフ（過去）
├── feature/tax-news          # 税制ニュース表示
├── feature/forecast-chart    # 収入予測グラフ（有料）
├── feature/pace-alert        # ペース警告（有料）
└── feature/tax-support       # 確定申告サポート（有料）
```

### ルール
- `feature/*` ブランチは必ず `develop` から切る
- `develop` → `main` へのマージはリリース時のみ
- 1機能 = 1ブランチ。複数機能を1ブランチに混ぜない
- マージ前に自動テストがすべてパスすること

---

## テスト方針

### AIエージェント（Antigravity）が作成するもの
- `lib/tax.ts` の全関数のユニットテスト（必須）
- `lib/revenue.ts` の全関数のユニットテスト（必須）
- `lib/rules.ts` のfetch・フォールバックのユニットテスト（必須）

### 作成しないもの
- UIテスト・スナップショットテスト（人間がUIを目視確認する）
- E2Eテスト

### テストフレームワーク
- **Jest + ts-jest**（Expoプロジェクト標準）
- テストファイルは `src/__tests__/` ディレクトリに配置
- ファイル名は `[対象ファイル名].test.ts`

### テストの書き方
```typescript
// __tests__/tax.test.ts の例
import { calcWalls } from '../lib/tax';

describe('calcWalls', () => {
  test('19歳・親の扶養 → 社保150万円', () => {
    const result = calcWalls(
      { birth_date: '2007-04-01', dependent_type: 'parent', large_company: false },
      DEFAULT_WALLS
    );
    expect(result.social_insurance).toBe(1_500_000);
  });

  test('23歳・親の扶養 → 社保130万円', () => {
    const result = calcWalls(
      { birth_date: '2003-04-01', dependent_type: 'parent', large_company: false },
      DEFAULT_WALLS
    );
    expect(result.social_insurance).toBe(1_300_000);
  });

  test('扶養なし → 壁はincome_taxのみ', () => {
    const result = calcWalls(
      { birth_date: '2000-01-01', dependent_type: 'none', large_company: false },
      DEFAULT_WALLS
    );
    expect(result.social_insurance).toBeNull();
  });
});
```

### カバレッジ目標
- `lib/tax.ts`: 100%（すべての分岐を網羅）
- `lib/revenue.ts`: 100%
- `lib/rules.ts`: 80%以上

---

## コミットメッセージ規則

**日本語で簡潔に**。フォーマットは以下の通り：

```
<種別>: <変更内容の要約>
```

### 種別一覧
| 種別 | 使いどころ |
|---|---|
| `追加` | 新機能・新ファイルの追加 |
| `修正` | バグ修正 |
| `変更` | 既存機能の変更・リファクタリング |
| `削除` | ファイル・コードの削除 |
| `テスト` | テストの追加・修正 |
| `設定` | 設定ファイル・環境の変更 |
| `ドキュメント` | spec.md・AGENT.md等の更新 |

### 例
```
追加: オンボーディング画面の初期実装
修正: 23歳境界値での扶養判定バグを修正
テスト: tax.tsのユニットテストを追加
変更: 収入集計ロジックをrevenue.tsに移動
設定: Jest環境をts-jest対応に更新
```

---

## AIエージェント（Antigravity）とDeepSeekの役割分担

### Antigravity（Gemini）が担当する
- 画面（app/配下の.tsxファイル）の実装
- コンポーネント（components/配下）の実装
- DB操作関数（lib/db.ts）の実装
- RevenueCat連携（lib/purchases.ts）の実装
- lib/rules.ts（GitHub JSONのfetch）の実装
- 上記に対応するユニットテストの作成

### DeepSeekに相談してから実装する
- `lib/tax.ts`（扶養壁の判定ロジック）
  - 分岐が複雑で税制知識が必要なため、ロジック設計をDeepSeekと壁打ちしてから実装する
- `lib/revenue.ts`（収入集計ロジック）
  - 「payslips優先・shiftsで補完」のエッジケースをDeepSeekで検証してから実装する

### 判断に迷ったら
- 純粋なロジック・計算 → DeepSeekで設計
- UI・DB・連携 → Antigravityで実装

---

## spec.md との関係

`spec.md` が仕様の唯一の正とする。実装が `spec.md` と矛盾する場合は `spec.md` を優先し、実装を修正する。仕様変更が必要な場合は `spec.md` を先に更新してから実装する。
