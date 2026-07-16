import { invoke } from '@tauri-apps/api/core';
import {
  createLearnedVendorDetail,
  matchesDetail,
  normalizeMatchType,
  validateMatchPattern
} from './vendorMatcher.js';

const BROWSER_STORAGE_KEY = 'excel_organizer_report_categories';

export const DEFAULT_REPORT_CATEGORIES = [
  {
    id: 'salary', label: '급여',
    details: [{ id: 'salary-default', label: '총 급여', keyword: '', matchType: 'salary' }]
  },
  {
    id: 'utilities', label: '공과금',
    details: [
      { id: 'gas', label: '가스', keyword: '코원에너지' },
      { id: 'water', label: '수도', keyword: '맑은물관리사업소' },
      { id: 'electricity', label: '전기', keyword: '한전㈜카인드' },
      { id: 'district-heating', label: '지역난방', keyword: '한국지역난방공사' }
    ]
  },
  {
    id: 'card', label: '지출카드',
    details: [{ id: 'suhyup-card', label: '지출카드(수협)', keyword: '수협카드대금' }]
  },
  {
    id: 'advertising', label: '광고비',
    details: [
      { id: 'yanolja', label: '야놀자', keyword: '㈜놀유니버스' },
      { id: 'yeogi', label: '여기어때', keyword: '㈜여기어때' },
      { id: 'jamjari', label: '잠자리', keyword: '서병주(잠자리컴퍼니)' }
    ]
  },
  {
    id: 'expenses', label: '지출',
    details: [
      ['세탁비', '김옥희'], ['객실 세탁비', '㈜에이치투오솔'], ['비품비', '㈜아나한별유통'],
      ['식자재', '고려유통'], ['음식물쓰레기', '유림기업'], ['소독비', '지앤씨바이오'],
      ['에어컨 F.M', '㈜하이엠솔루텍'], ['엘리베이터 F.M', '현대엘레베이터'],
      ['카리프트 F.M', '현대엘레베이터'], ['매트세척비', '이희윤'], ['벤사', '아하소프트'],
      ['산하정보기술', '산하정보기술'], ['노무법인 신아', '노무법인신아'],
      ['세무법인 최종현', '최종현(최종현세무회계)'], ['에스원', '㈜에스원'],
      ['KT(전화)', 'KT'], ['KT(인터넷)', 'KT통신요금'], ['복사기', '카피올'],
      ['손해보험', '한화손해보험'], ['향기마케팅', '㈜에바센트'], ['도솔소방방재', '도솔방재'],
      ['전기관리', '한빛전기'], ['객실 OTT', '㈜엑세스'], ['셔틀버스 서비스', '㈜주안운수']
    ].map(([label, keyword], index) => ({ id: `expense-${index + 1}`, label, keyword }))
  },
  {
    id: 'misc', label: '기타잡비', enabled: true,
    details: [
      ['생수텍', '홍현기'], ['객실카드홀더', '홍현기'], ['카드키 단말기', '황영주'],
      ['식자재', '이순이'], ['디너 소주/맥주', '㈜장안주류판매']
    ].map(([label, keyword], index) => ({ id: `misc-${index + 1}`, label, keyword }))
  }
];

export function cloneDefaultReportCategories() {
  return structuredClone(DEFAULT_REPORT_CATEGORIES);
}

function createId(prefix) {
  const randomId = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${randomId}`;
}

export function createReportCategory(label = '새 카테고리') {
  return {
    id: createId('category'),
    label,
    enabled: true,
    details: []
  };
}

export function createReportDetail({ label, keyword, aliases = [], matchType = 'contains' }) {
  return {
    id: createId('detail'),
    label,
    keyword,
    aliases,
    matchType: normalizeMatchType(matchType)
  };
}

export function normalizeReportCategories(config) {
  if (!Array.isArray(config)) return cloneDefaultReportCategories();
  const seenIds = new Set();
  const normalized = config.map((category, categoryIndex) => {
    if (!category || typeof category !== 'object') return null;
    let id = String(category.id || createId('category'));
    if (seenIds.has(id)) id = createId('category');
    seenIds.add(id);
    const fallbackLabel = `카테고리 ${categoryIndex + 1}`;
    const details = Array.isArray(category.details) ? category.details : [];
    return {
      id,
      label: String(category.label || fallbackLabel).trim() || fallbackLabel,
      enabled: id === 'misc' || category.enabled !== false,
      details: details.map(detail => {
        const keyword = String(detail?.keyword || '').trim();
        const aliases = [...new Set(
          (Array.isArray(detail?.aliases) ? detail.aliases : [])
            .map(alias => String(alias || '').trim())
            .filter(alias => alias && alias !== keyword)
        )];
        return {
          id: String(detail?.id || createId('detail')),
          label: String(detail?.label || '').trim(),
          keyword,
          aliases,
          matchType: detail?.matchType === 'salary' ? 'salary' : normalizeMatchType(detail?.matchType)
        };
      }).filter(detail => detail.label)
    };
  }).filter(Boolean);

  if (!normalized.some(category => category.id === 'misc')) {
    normalized.push(structuredClone(DEFAULT_REPORT_CATEGORIES.find(category => category.id === 'misc')));
  }
  return normalized;
}

export function validateReportCategories(categories) {
  for (const category of categories) {
    for (const detail of category.details) {
      if (detail.matchType !== 'regex') continue;
      for (const pattern of [detail.keyword, ...(detail.aliases || [])].filter(Boolean)) {
        const error = validateMatchPattern(pattern, detail.matchType);
        if (error) return `${category.label} > ${detail.label}: ${error}`;
      }
    }
  }
  return '';
}

export function addLearnedVendorRule(categories, categoryId, description) {
  const category = categories.find(item => item.id === categoryId && item.enabled !== false);
  if (!category || category.details.some(detail => matchesDetail(description, detail))) {
    return { categories, added: false };
  }
  const learnedDetail = createLearnedVendorDetail(description);
  return {
    added: true,
    categories: categories.map(item => (
      item.id === categoryId ? { ...item, details: [...item.details, learnedDetail] } : item
    ))
  };
}

export async function loadReportCategories() {
  try {
    const saved = await invoke('load_report_config');
    if (saved) return normalizeReportCategories(JSON.parse(saved));
  } catch {
    const saved = localStorage.getItem(BROWSER_STORAGE_KEY);
    if (saved) return normalizeReportCategories(JSON.parse(saved));
  }
  return cloneDefaultReportCategories();
}

export async function saveReportCategories(categories) {
  const normalized = normalizeReportCategories(categories);
  const validationError = validateReportCategories(normalized);
  if (validationError) throw new Error(validationError);
  const serialized = JSON.stringify(normalized, null, 2);
  try {
    await invoke('save_report_config', { config: serialized });
  } catch {
    localStorage.setItem(BROWSER_STORAGE_KEY, serialized);
  }
  return normalized;
}
