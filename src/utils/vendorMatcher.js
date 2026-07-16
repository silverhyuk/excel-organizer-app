export const MATCH_TYPE_OPTIONS = [
  { value: 'contains', label: '포함' },
  { value: 'exact', label: '정확히 일치' },
  { value: 'regex', label: '정규식' }
];

const MATCH_TYPES = new Set(MATCH_TYPE_OPTIONS.map(option => option.value));

const LEGACY_ALIASES = {
  '한전카인드': ['한전'],
  '에스원': ['s1'],
  '한화손해보험': ['한화손'],
  '도솔방재': ['도솔'],
  '한빛전기': ['한빛'],
  '서병주잠자리컴퍼니': ['서병주', '잠자리'],
  '코원에너지': ['코원'],
  '맑은물관리사업소': ['맑은물'],
  '한국지역난방공사': ['난방'],
  '수협카드대금': ['수협카드'],
  '여기어때': ['여기어때컴퍼'],
  '에이치투오솔': ['에이치투오'],
  '아나한별유통': ['아나한별'],
  '유림기업': ['유림'],
  '하이엠솔루텍': ['하이엠'],
  '현대엘레베이터': ['현대엘'],
  '산하정보기술': ['산하'],
  '노무법인신아': ['신아'],
  '최종현최종현세무회계': ['최종현']
};

export function normalizeMatchType(matchType) {
  return MATCH_TYPES.has(matchType) ? matchType : 'contains';
}

export function normalizeVendorText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^\s*\d{3}(?=\s*[a-z가-힣㈜(])/i, '')
    .replace(/주식회사|유한회사|㈜|\(\s*주\s*\)/g, '')
    .replace(/[^a-z0-9가-힣]/g, '');
}

export function getDetailPatterns(detail) {
  const patterns = [detail?.keyword, ...(Array.isArray(detail?.aliases) ? detail.aliases : [])]
    .map(pattern => String(pattern || '').trim())
    .filter(Boolean);
  return [...new Set(patterns)];
}

export function validateMatchPattern(pattern, matchType) {
  if (normalizeMatchType(matchType) !== 'regex') return '';
  try {
    new RegExp(pattern, 'i');
    return '';
  } catch {
    return `잘못된 정규식입니다: ${pattern}`;
  }
}

function matchesPattern(description, pattern, matchType) {
  if (matchType === 'regex') {
    try {
      return new RegExp(pattern, 'i').test(String(description || ''));
    } catch {
      return false;
    }
  }

  const normalizedDescription = normalizeVendorText(description);
  const normalizedPattern = normalizeVendorText(pattern);
  if (!normalizedPattern) return false;
  if (matchType === 'exact') return normalizedDescription === normalizedPattern;
  if (normalizedDescription.includes(normalizedPattern)) return true;
  return (LEGACY_ALIASES[normalizedPattern] || []).some(alias => normalizedDescription.includes(alias));
}

export function matchesDetail(description, detail) {
  const matchType = normalizeMatchType(detail?.matchType);
  return getDetailPatterns(detail).some(pattern => matchesPattern(description, pattern, matchType));
}

export function getDetailRuleKey(detail) {
  const matchType = normalizeMatchType(detail?.matchType);
  const patterns = getDetailPatterns(detail).map(pattern => (
    matchType === 'regex' ? pattern : normalizeVendorText(pattern)
  ));
  return `${matchType}:${patterns.join('|')}`;
}

function createId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createLearnedVendorDetail(description) {
  const keyword = String(description || '').trim();
  const label = keyword.replace(/^\d{3}\s*/, '').trim() || keyword;
  return {
    id: `learned-${createId()}`,
    label,
    keyword,
    aliases: [],
    matchType: 'exact'
  };
}
