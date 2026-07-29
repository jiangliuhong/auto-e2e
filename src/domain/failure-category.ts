/**
 * 失败分类（plan §13.2）。
 */
export const FAILURE_CATEGORIES = [
  'product_defect',
  'test_defect',
  'environment_failure',
  'data_failure',
  'auth_failure',
  'browser_failure',
  'flaky',
  'unknown',
] as const;

export type FailureCategory = (typeof FAILURE_CATEGORIES)[number];

export const FAILURE_CATEGORY_LABELS: Record<FailureCategory, string> = {
  product_defect: '业务缺陷',
  test_defect: '测试脚本问题',
  environment_failure: '环境或启动失败',
  data_failure: '测试数据问题',
  auth_failure: '登录或权限问题',
  browser_failure: '浏览器执行问题',
  flaky: '疑似不稳定测试',
  unknown: '无法判断',
};

export function isFailureCategory(value: unknown): value is FailureCategory {
  return typeof value === 'string' && (FAILURE_CATEGORIES as readonly string[]).includes(value);
}
