// Default category classification rules
const DEFAULT_RULES = {
  hotel: {
    name: '호텔/숙박 지출',
    colorClass: 'hotel',
    keywords: ['호텔', '신라', '힐튼', '메리어트', '하얏트', '야놀자', '여기어때', '모텔', '펜션', '리조트', 'stay', '스테이', 'glamping', '글램핑', '에어비앤비', 'airbnb']
  },
  food: {
    name: '식비/카페',
    colorClass: 'food',
    keywords: ['식당', '배달의민족', '요기요', '쿠팡이츠', '스타벅스', '카페', '투썸', '이디야', '치킨', '피자', '스시', '한식', '중식', '일식', '갈비', '고기', '마트', '편의점', 'cu', 'gs25', '세븐일레븐', '올리브영', '푸드', '식료품']
  },
  transport: {
    name: '교통/차량',
    colorClass: 'transport',
    keywords: ['택시', '카카오t', '버스', '지하철', '코레일', 'ktx', '주유', '충전', '주차', '하이패스', '대리운전', '쏘카', '그린카']
  },
  shopping: {
    name: '쇼핑/생활',
    colorClass: 'shopping',
    keywords: ['쿠팡', '네이버페이', 'g마켓', '11번가', '옥션', '무신사', '백화점', '이마트', '홈플러스', '다이소', '의류', '패션']
  },
  etc: {
    name: '기타 지출',
    colorClass: 'etc',
    keywords: [] // Catch-all category
  }
};

const STORAGE_KEY = 'excel_organizer_classification_rules';

/**
 * Load rules from local storage or get defaults
 */
export function getRules() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved rules, resetting to defaults.', e);
    }
  }
  return DEFAULT_RULES;
}

/**
 * Save rules to local storage
 */
export function saveRules(rules) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}

/**
 * Classify a transaction based on description/memo
 * @param {string} description - The transaction description (적요/가맹점명/내용)
 * @param {object} rules - The current classification rules
 * @returns {string} The matched category key (e.g. 'hotel', 'food', 'etc')
 */
export function classifyTransaction(description, rules = getRules()) {
  if (!description) return 'etc';
  
  const descLower = description.toLowerCase().trim();

  // Check each category's keywords (except 'etc')
  for (const [key, category] of Object.entries(rules)) {
    if (key === 'etc') continue;
    
    for (const keyword of category.keywords) {
      if (descLower.includes(keyword.toLowerCase())) {
        return key;
      }
    }
  }
  
  return 'etc';
}
