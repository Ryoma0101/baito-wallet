import { fetchTaxRules, buildFallbackRules, TAX_RULES_URL } from '../lib/rules';
import { DEFAULT_WALLS } from '../constants/walls';
import type { TaxRules } from '../types';

// ---------- テスト用データ ----------

const VALID_TAX_RULES: TaxRules = {
  version: '2026',
  updated_at: '2026-01-01',
  walls: {
    income_tax: 1_780_000,
    dependent_general: 1_780_000,
    dependent_specific_age_min: 19,
    dependent_specific_age_max: 22,
    dependent_specific_limit: 1_500_000,
    social_insurance_basic: 1_300_000,
    social_insurance_large_company: 1_060_000,
    residence_tax_approx: 1_100_000,
  },
  news: [
    {
      id: '2026-reform-178',
      title: '178万円の壁が2026年分から適用',
      body: 'テスト用の本文',
      published_at: '2026-01-01',
      important: true,
      target: ['all'],
    },
  ],
};

// ---------- fetchのモック ----------

const originalFetch = globalThis.fetch;

function mockFetchSuccess(data: unknown) {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  }) as typeof fetch;
}

function mockFetchHttpError(status: number) {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({}),
  }) as typeof fetch;
}

function mockFetchNetworkError() {
  globalThis.fetch = jest.fn().mockRejectedValue(
    new Error('Network error'),
  ) as typeof fetch;
}

function mockFetchAbort() {
  globalThis.fetch = jest.fn().mockImplementation(() => {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new DOMException('Aborted', 'AbortError')), 10);
    });
  }) as typeof fetch;
}

function mockFetchInvalidJson() {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.reject(new SyntaxError('Unexpected token')),
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ---------- テストケース ----------

describe('fetchTaxRules', () => {
  test('fetch成功時 → パースされたTaxRulesを返す', async () => {
    mockFetchSuccess(VALID_TAX_RULES);

    const result = await fetchTaxRules();

    expect(result.version).toBe('2026');
    expect(result.walls.income_tax).toBe(1_780_000);
    expect(result.walls.social_insurance_basic).toBe(1_300_000);
    expect(result.news).toHaveLength(1);
    expect(result.news[0].id).toBe('2026-reform-178');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      TAX_RULES_URL,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  test('HTTPエラー（404等）→ フォールバック値を返す', async () => {
    mockFetchHttpError(404);

    const result = await fetchTaxRules();

    expect(result.version).toBe('fallback');
    expect(result.walls.income_tax).toBe(DEFAULT_WALLS.income_tax);
    expect(result.news).toHaveLength(0);
  });

  test('ネットワークエラー → フォールバック値を返す', async () => {
    mockFetchNetworkError();

    const result = await fetchTaxRules();

    expect(result.version).toBe('fallback');
    expect(result.walls.income_tax).toBe(DEFAULT_WALLS.income_tax);
  });

  test('タイムアウト（AbortError）→ フォールバック値を返す', async () => {
    mockFetchAbort();

    const result = await fetchTaxRules();

    expect(result.version).toBe('fallback');
    expect(result.walls.income_tax).toBe(DEFAULT_WALLS.income_tax);
  });

  test('不正なJSONレスポンス → フォールバック値を返す', async () => {
    mockFetchInvalidJson();

    const result = await fetchTaxRules();

    expect(result.version).toBe('fallback');
    expect(result.walls.income_tax).toBe(DEFAULT_WALLS.income_tax);
  });

  test('必須フィールドが欠けたJSON → フォールバック値を返す', async () => {
    const incomplete = {
      version: '2026',
      updated_at: '2026-01-01',
      walls: {
        income_tax: 1_780_000,
        // dependent_general が欠けている
      },
      news: [],
    };
    mockFetchSuccess(incomplete);

    const result = await fetchTaxRules();

    expect(result.version).toBe('fallback');
    expect(result.walls.income_tax).toBe(DEFAULT_WALLS.income_tax);
  });

  test('wallsが文字列を含むJSON → フォールバック値を返す', async () => {
    const badTypes = {
      ...VALID_TAX_RULES,
      walls: { ...VALID_TAX_RULES.walls, income_tax: '1780000' },
    };
    mockFetchSuccess(badTypes);

    const result = await fetchTaxRules();

    expect(result.version).toBe('fallback');
  });
});

describe('buildFallbackRules', () => {
  test('DEFAULT_WALLSの値でTaxRulesを生成する', () => {
    const result = buildFallbackRules();

    expect(result.version).toBe('fallback');
    expect(result.walls.income_tax).toBe(DEFAULT_WALLS.income_tax);
    expect(result.walls.social_insurance_basic).toBe(DEFAULT_WALLS.social_insurance_basic);
    expect(result.walls.social_insurance_large_company).toBe(DEFAULT_WALLS.social_insurance_large_company);
    expect(result.news).toEqual([]);
  });
});
