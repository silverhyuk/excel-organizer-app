import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Upload, 
  Download, 
  RefreshCw, 
  Sliders, 
  Plus, 
  Trash2, 
  X, 
  Search, 
  TrendingDown, 
  TrendingUp, 
  DollarSign, 
  FileSpreadsheet,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Moon,
  ShieldCheck,
  Sun
} from 'lucide-react';
import { calculateReportCategoryView, parseExcelFile, exportToExcel } from './utils/excelParser';
import { getRules, saveRules, classifyTransaction } from './utils/classifier';
import {
  addLearnedVendorRule,
  createReportCategory,
  createReportDetail,
  cloneDefaultReportCategories,
  loadReportCategories,
  saveReportCategories
} from './utils/reportConfig';
import { createReportNaming, normalizeDownloadFileName } from './utils/reportNaming';
import { sumTransactionAmounts } from './utils/transactionTotals';
import { createSettlementValidationReport } from './utils/settlementValidation';
import { getDetailPatterns, MATCH_TYPE_OPTIONS } from './utils/vendorMatcher';
import { getNextTheme, resolveTheme, THEME_STORAGE_KEY, THEMES } from './utils/theme';
import BaldDodgeGame from './components/BaldDodgeGame';
import FinancialCharts from './components/FinancialCharts';
import reportTemplateUrl from '../result.xlsx?url';

function VendorPatternsInput({ detail, onChange }) {
  const value = detail.patternText ?? getDetailPatterns(detail).join('\n');
  return (
    <textarea
      value={value}
      aria-label="거래처 키워드와 별칭"
      onChange={(event) => onChange(event.target.value)}
      placeholder={detail.matchType === 'salary' ? '급여 자동 판별' : '한국전력공사\n한전\nKEPCO'}
      disabled={detail.matchType === 'salary'}
    />
  );
}

function App() {
  const [theme, setTheme] = useState(() => {
    let savedTheme = null;
    try {
      savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      // Fall back to the operating system preference when storage is unavailable.
    }
    return resolveTheme(savedTheme, window.matchMedia?.('(prefers-color-scheme: dark)')?.matches);
  });
  const [transactions, setTransactions] = useState([]);
  const [rules, setRules] = useState(getRules());
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [reviewMode, setReviewMode] = useState('all');
  const [learningTransactionIds, setLearningTransactionIds] = useState(() => new Set());
  const [reviewStatus, setReviewStatus] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [reportCategories, setReportCategories] = useState(cloneDefaultReportCategories);
  const [editingReportCategoryId, setEditingReportCategoryId] = useState('utilities');
  const [newDetailLabel, setNewDetailLabel] = useState('');
  const [newDetailKeyword, setNewDetailKeyword] = useState('');
  const [newDetailMatchType, setNewDetailMatchType] = useState('contains');
  const [reportConfigStatus, setReportConfigStatus] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [reportTitle, setReportTitle] = useState('');
  const [downloadFileName, setDownloadFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [focusedTransactionIds, setFocusedTransactionIds] = useState([]);
  const reportCategoriesRef = useRef(reportCategories);
  const learnSaveQueueRef = useRef(Promise.resolve());

  // Editing Rule State
  const [editingCategoryKey, setEditingCategoryKey] = useState('hotel');
  const [newKeyword, setNewKeyword] = useState('');

  // Listen for the Escape key to toggle the easter egg
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowEasterEgg(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const handleThemeToggle = () => {
    const nextTheme = getNextTheme(theme);
    setTheme(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The active theme still applies for the current session.
    }
  };

  useEffect(() => {
    let active = true;
    loadReportCategories().then(categories => {
      if (active) {
        setReportCategories(categories);
        setEditingReportCategoryId(current => (
          categories.some(category => category.id === current) ? current : categories[0]?.id || 'misc'
        ));
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (reviewStatus?.type !== 'success') return undefined;
    const timeoutId = window.setTimeout(() => setReviewStatus(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [reviewStatus]);

  useEffect(() => {
    reportCategoriesRef.current = reportCategories;
  }, [reportCategories]);

  // Re-classify all transactions when rules change or new transactions load
  useEffect(() => {
    if (transactions.length > 0) {
      const updated = transactions.map(tx => ({
        ...tx,
        category: classifyTransaction(tx.description, rules, tx)
      }));
      setTransactions(updated);
    }
  }, [rules]);

  // Handle Drag & Drop events
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    setErrorMsg('');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleFileChange = async (e) => {
    setErrorMsg('');
    const files = e.target.files;
    if (files.length > 0) {
      await processFile(files[0]);
    }
  };

  // Process the uploaded excel file
  const processFile = async (file) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setErrorMsg('엑셀 파일(.xlsx, .xls)만 업로드할 수 있습니다.');
      return;
    }

    try {
      setFileName(file.name);
      const arrayBuffer = await file.arrayBuffer();
      const { transactions: rawTxList, accountHolderName: parsedAccountHolderName } = await parseExcelFile(arrayBuffer);
      const reportNaming = createReportNaming(rawTxList, file.name, parsedAccountHolderName);
      
      // Classify initial transactions
      const classified = rawTxList.map(tx => ({
        ...tx,
        category: classifyTransaction(tx.description, rules, tx)
      }));
      
      setTransactions(classified);
      setAccountHolderName(parsedAccountHolderName);
      setReportTitle(reportNaming.title);
      setDownloadFileName(reportNaming.fileName);
      setSelectedCategory('all');
      setReviewMode('all');
      setLearningTransactionIds(new Set());
      setReviewStatus(null);
      setFocusedTransactionIds([]);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || '엑셀 파일을 읽는 과정에서 오류가 발생했습니다.');
    }
  };

  // Export current transactions to excel
  const handleExport = async (event) => {
    event?.preventDefault();
    if (transactions.length === 0 || !validationReport.canExport) return;
    
    try {
      const fallbackNaming = createReportNaming(transactions, fileName, accountHolderName);
      const safeReportTitle = reportTitle.trim() || fallbackNaming.title;
      const safeDownloadFileName = normalizeDownloadFileName(downloadFileName || fallbackNaming.fileName);
      setReportTitle(safeReportTitle);
      setDownloadFileName(safeDownloadFileName);
      const templateResponse = await fetch(reportTemplateUrl);
      if (!templateResponse.ok) throw new Error('기준 양식을 불러오지 못했습니다.');
      const templateBuffer = await templateResponse.arrayBuffer();
      const buffer = await exportToExcel(transactions, rules, templateBuffer, {
        reportCategories,
        reportTitle: safeReportTitle
      });
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = safeDownloadFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIsExportModalOpen(false);
    } catch (err) {
      console.error(err);
      alert(err.message || '엑셀 내보내기 중 오류가 발생했습니다.');
    }
  };

  const updateReportDetail = (detailId, field, value) => {
    setReportConfigStatus('');
    setReportCategories(categories => categories.map(category => (
      category.id === editingReportCategoryId
        ? { ...category, details: category.details.map(detail => detail.id === detailId ? { ...detail, [field]: value } : detail) }
        : category
    )));
  };

  const updateReportDetailPatterns = (detailId, value) => {
    const [keyword = '', ...aliases] = value.split('\n').map(pattern => pattern.trim()).filter(Boolean);
    setReportConfigStatus('');
    setReportCategories(categories => categories.map(category => (
      category.id === editingReportCategoryId
        ? {
            ...category,
            details: category.details.map(detail => (
              detail.id === detailId ? { ...detail, keyword, aliases, patternText: value } : detail
            ))
          }
        : category
    )));
  };

  const updateReportCategoryLabel = (value) => {
    setReportConfigStatus('');
    setReportCategories(categories => categories.map(category => (
      category.id === editingReportCategoryId ? { ...category, label: value } : category
    )));
  };

  const updateReportCategoryEnabled = (enabled) => {
    if (editingReportCategoryId === 'misc') return;
    setReportConfigStatus('');
    setReportCategories(categories => categories.map(category => (
      category.id === editingReportCategoryId ? { ...category, enabled } : category
    )));
    if (!enabled && selectedCategory === editingReportCategoryId) setSelectedCategory('all');
  };

  const handleRemoveReportDetail = (detailId) => {
    setReportConfigStatus('');
    setReportCategories(categories => categories.map(category => (
      category.id === editingReportCategoryId
        ? { ...category, details: category.details.filter(detail => detail.id !== detailId) }
        : category
    )));
  };

  const handleAddReportDetail = () => {
    const category = reportCategories.find(item => item.id === editingReportCategoryId);
    if (!category || !newDetailLabel.trim() || !newDetailKeyword.trim()) return;
    const [keyword, ...aliases] = newDetailKeyword.split('\n').map(pattern => pattern.trim()).filter(Boolean);
    if (!keyword) return;
    setReportCategories(categories => categories.map(item => (
      item.id === editingReportCategoryId
        ? {
            ...item,
            details: [...item.details, createReportDetail({
              label: newDetailLabel.trim(),
              keyword,
              aliases,
              matchType: newDetailMatchType
            })]
          }
        : item
    )));
    setNewDetailLabel('');
    setNewDetailKeyword('');
    setNewDetailMatchType('contains');
    setReportConfigStatus('');
  };

  const handleAddReportCategory = () => {
    const category = createReportCategory(`새 카테고리 ${reportCategories.length + 1}`);
    setReportCategories(categories => [...categories, category]);
    setEditingReportCategoryId(category.id);
    setNewDetailLabel('');
    setNewDetailKeyword('');
    setNewDetailMatchType('contains');
    setReportConfigStatus('');
  };

  const handleRemoveReportCategory = () => {
    if (editingReportCategoryId === 'misc') return;
    const category = reportCategories.find(item => item.id === editingReportCategoryId);
    if (!category || !window.confirm(`'${category.label}' 큰 카테고리를 삭제하시겠습니까?`)) return;
    const remaining = reportCategories.filter(item => item.id !== editingReportCategoryId);
    setReportCategories(remaining);
    setEditingReportCategoryId(remaining[0]?.id || 'misc');
    if (selectedCategory === editingReportCategoryId) setSelectedCategory('all');
    setNewDetailLabel('');
    setNewDetailKeyword('');
    setNewDetailMatchType('contains');
    setReportConfigStatus('');
  };

  const handleSaveReportCategories = async () => {
    try {
      const saved = await saveReportCategories(reportCategories);
      setReportCategories(saved);
      setReportConfigStatus('저장됨');
      return true;
    } catch (error) {
      console.error(error);
      setReportConfigStatus(error.message || '저장 실패');
      return false;
    }
  };

  const handleResetReportCategories = () => {
    const defaults = cloneDefaultReportCategories();
    setReportCategories(defaults);
    setEditingReportCategoryId('utilities');
    setNewDetailLabel('');
    setNewDetailKeyword('');
    setNewDetailMatchType('contains');
    setReportConfigStatus('기본값으로 복원됨 · 저장 필요');
  };

  // Add keyword to current editing category
  const handleAddKeyword = (e) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;

    const trimmed = newKeyword.trim().toLowerCase();
    
    // Check for duplicates in any category
    let exists = false;
    Object.values(rules).forEach(cat => {
      if (cat.keywords.some(kw => kw.toLowerCase() === trimmed)) {
        exists = true;
      }
    });

    if (exists) {
      alert('이미 등록된 키워드입니다.');
      return;
    }

    const updatedRules = { ...rules };
    updatedRules[editingCategoryKey].keywords.push(trimmed);
    
    setRules(updatedRules);
    saveRules(updatedRules);
    setNewKeyword('');
  };

  // Remove keyword from category
  const handleRemoveKeyword = (categoryKey, keyword) => {
    const updatedRules = { ...rules };
    updatedRules[categoryKey].keywords = updatedRules[categoryKey].keywords.filter(
      kw => kw !== keyword
    );
    
    setRules(updatedRules);
    saveRules(updatedRules);
  };

  // Manually selected categories take precedence over automatic report rules.
  const handleManualCategoryChange = async (txId, categoryId) => {
    const transaction = transactions.find(tx => tx.id === txId);
    const shouldLearn = learningTransactionIds.has(txId) && categoryId !== 'misc';
    setReviewStatus(null);
    setTransactions(current => current.map(tx => (
      tx.id === txId ? { ...tx, categoryOverride: categoryId } : tx
    )));
    if (!shouldLearn || !transaction) return;

    try {
      const learnAndSave = async () => {
        const learned = addLearnedVendorRule(reportCategoriesRef.current, categoryId, transaction.description);
        if (!learned.added) return { added: false, categories: reportCategoriesRef.current };
        const saved = await saveReportCategories(learned.categories);
        reportCategoriesRef.current = saved;
        setReportCategories(saved);
        return { added: true, categories: saved };
      };
      const queuedSave = learnSaveQueueRef.current.then(learnAndSave, learnAndSave);
      learnSaveQueueRef.current = queuedSave.catch(() => undefined);
      const result = await queuedSave;
      if (!result.added) {
        setReviewStatus({ type: 'info', message: '이미 같은 거래처에 적용되는 규칙이 있습니다.' });
        return;
      }
      setTransactions(current => current.map(tx => (
        tx.id === txId ? { ...tx, categoryOverride: undefined } : tx
      )));
      const categoryLabel = result.categories.find(category => category.id === categoryId)?.label || '선택한 카테고리';
      setReviewStatus({
        type: 'success',
        message: `'${transaction.description}' 거래처를 ${categoryLabel} 규칙으로 저장했습니다.`
      });
      setLearningTransactionIds(current => {
        const next = new Set(current);
        next.delete(txId);
        return next;
      });
    } catch (error) {
      console.error(error);
      setReviewStatus({ type: 'error', message: error.message || '거래처 규칙을 저장하지 못했습니다.' });
    }
  };

  const handleSelectCategory = (categoryId) => {
    setSelectedCategory(categoryId);
    setReviewMode('all');
    setFocusedTransactionIds([]);
  };

  const handleSelectReviewMode = (mode) => {
    setSelectedCategory('all');
    setReviewMode(mode);
    setFocusedTransactionIds([]);
  };

  const handleValidationNavigation = (transactionIds) => {
    if (transactionIds.length === 0) return;
    setSelectedCategory('all');
    setReviewMode('all');
    setSearchTerm('');
    setFocusedTransactionIds(transactionIds);
    setIsExportModalOpen(false);
    requestAnimationFrame(() => document.getElementById('transaction-list')?.scrollIntoView({ behavior: 'smooth' }));
  };

  // Reset to default rules
  const handleResetRules = () => {
    if (window.confirm('분류 규칙을 초기 상태로 되돌리시겠습니까?')) {
      localStorage.removeItem('excel_organizer_classification_rules');
      const defaults = getRules();
      setRules(defaults);
    }
  };

  // Reset/Reset view to upload another file
  const handleResetApp = () => {
    setTransactions([]);
    setFileName('');
    setAccountHolderName('');
    setReportTitle('');
    setDownloadFileName('');
    setIsExportModalOpen(false);
    setSearchTerm('');
    setFocusedTransactionIds([]);
    setErrorMsg('');
    setReviewMode('all');
    setLearningTransactionIds(new Set());
    setReviewStatus(null);
  };

  // Calculations for Stats
  // Overall sums (independent of selectedCategory for summary cards)
  const grandWithdrawal = transactions.reduce((sum, tx) => sum + tx.withdrawal, 0);
  const grandDeposit = transactions.reduce((sum, tx) => sum + tx.deposit, 0);

  const reportCategoryView = useMemo(
    () => calculateReportCategoryView(transactions, reportCategories),
    [transactions, reportCategories]
  );
  const validationReport = useMemo(
    () => createSettlementValidationReport(transactions, reportCategories),
    [transactions, reportCategories]
  );
  const focusedTransactionIdSet = useMemo(
    () => new Set(focusedTransactionIds),
    [focusedTransactionIds]
  );
  const categorizedTransactions = useMemo(() => {
    const conflictByIndex = new Map(reportCategoryView.conflicts.map(conflict => [conflict.transactionIndex, conflict]));
    const unclassifiedIndexes = new Set(reportCategoryView.unclassifiedIndexes);
    return transactions.map((tx, index) => ({
      ...tx,
      category: reportCategoryView.assignments[index],
      isUnclassified: unclassifiedIndexes.has(index),
      ruleConflict: conflictByIndex.get(index) || null
    }));
  }, [transactions, reportCategoryView]);
  const unclassifiedTransactions = useMemo(
    () => categorizedTransactions.filter(tx => tx.isUnclassified),
    [categorizedTransactions]
  );
  const unclassifiedTotal = useMemo(
    () => unclassifiedTransactions.reduce((sum, tx) => sum + tx.withdrawal, 0),
    [unclassifiedTransactions]
  );
  const selectedTransactions = categorizedTransactions.filter(
    tx => selectedCategory === 'all' || tx.category === selectedCategory
  );
  const selectedTotal = sumTransactionAmounts(selectedTransactions);
  const selectedIncomeOnly = selectedTransactions.length > 0 && selectedTransactions.every(
    tx => tx.deposit > 0 && !(tx.withdrawal > 0)
  );

  // Filtered transactions for the main table list
  const filteredTransactions = categorizedTransactions.filter(tx => {
    const matchesCategory = selectedCategory === 'all' || tx.category === selectedCategory;
    const matchesReview = reviewMode === 'unclassified'
      ? tx.isUnclassified
      : reviewMode === 'conflicts' ? Boolean(tx.ruleConflict) : true;
    const matchesValidation = focusedTransactionIds.length === 0 || focusedTransactionIdSet.has(tx.id);
    const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          String(tx.withdrawal).includes(searchTerm) ||
                          String(tx.deposit).includes(searchTerm);
    return matchesCategory && matchesReview && matchesValidation && matchesSearch;
  });

  // Calculate percentages for statistics chart
  const categoryStats = [
    { id: 'income', label: '수입', total: grandDeposit },
    ...reportCategoryView.categories
  ].map(category => {
    const isIncome = category.id === 'income';
    const total = isIncome ? grandDeposit : grandWithdrawal;
    const pct = total > 0 ? (category.total / total) * 100 : 0;
    return {
      key: category.id,
      name: category.label,
      colorClass: isIncome ? 'income' : category.id,
      amount: category.total,
      percentage: pct
    };
  }).sort((a, b) => b.amount - a.amount); // Sort by highest expenditure first

  const tableTitle = reviewMode === 'unclassified'
    ? '미분류 거래 검토'
    : reviewMode === 'conflicts' ? '규칙 충돌 검토'
      : selectedCategory === 'all' ? '전체 내역' : categoryStats.find(stat => stat.key === selectedCategory)?.name;

  return (
    <div className="app-container">
      {/* Header */}
      <header className="glass-panel app-header">
        <div className="logo-container">
          <span className="logo-text">딸깍 정리기</span>
          {fileName && <span className="current-file" title={fileName}>{fileName}</span>}
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="secondary icon-button theme-toggle"
            onClick={handleThemeToggle}
            aria-label={theme === THEMES.DARK ? '라이트 모드로 전환' : '다크 모드로 전환'}
            title={theme === THEMES.DARK ? '라이트 모드' : '다크 모드'}
          >
            {theme === THEMES.DARK ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          {transactions.length > 0 && (
            <>
              <button className="secondary" onClick={handleResetApp}>
                <RefreshCw size={16} /> 다른 파일 업로드
              </button>
              <button onClick={() => setIsExportModalOpen(true)}>
                <Download size={16} /> 검토 완료 · 다운로드
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      {transactions.length === 0 ? (
        // UPLOAD VIEW
        <main className="upload-view">
          <div 
            className={`drop-zone glass-panel ${isDragging ? 'active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            id="excel-drop-zone"
          >
            <input 
              id="file-upload-input" 
              type="file" 
              accept=".xlsx, .xls" 
              className="visually-hidden"
              onChange={handleFileChange}
            />
            <Upload className="drop-zone-icon" />
            <span className="upload-eyebrow">EXCEL ORGANIZER</span>
            <h1 className="upload-title">계좌 거래 내역을 빠르게 정리하세요</h1>
            <p className="upload-desc">엑셀 파일을 끌어다 놓거나 아래 버튼으로 선택하세요.</p>
            <button
              type="button"
              className="upload-button"
              onClick={(event) => {
                event.stopPropagation();
                document.getElementById('file-upload-input').click();
              }}
            >
              <FileSpreadsheet size={17} /> 엑셀 파일 선택
            </button>
            <span className="upload-formats">.xlsx · .xls</span>
          </div>

          {errorMsg && (
            <div className="glass-panel inline-alert error" role="alert">
              <AlertCircle size={20} />
              <span>{errorMsg}</span>
            </div>
          )}

          <section className="glass-panel upload-guide" aria-label="사용 순서">
            <ol className="upload-steps">
              <li><strong>1</strong><span><b>파일 선택</b>은행 거래 내역 업로드</span></li>
              <li><strong>2</strong><span><b>자동 분류</b>거래와 카테고리 확인</span></li>
              <li><strong>3</strong><span><b>검토·저장</b>미분류 확인 후 다운로드</span></li>
            </ol>
            <div className="privacy-note">
              <ShieldCheck size={18} />
              <span><strong>데이터는 이 기기에서만 처리됩니다.</strong> 파일과 거래 정보는 서버로 전송되지 않습니다.</span>
            </div>
          </section>
        </main>
      ) : (
        // DASHBOARD VIEW
        <>
          {/* Top Summary Widgets */}
          <div className="stats-grid">
            <div className="glass-panel stat-card stat-income">
              <div className="stat-header">
                <span>총 수입액 (입금)</span>
                <TrendingUp size={18} style={{ color: 'var(--accent-emerald)' }} />
              </div>
              <div className="stat-val income">
                ₩{grandDeposit.toLocaleString()}
              </div>
              <div className="stat-footer">급여, 이체입금 등 전체 수입 합계</div>
            </div>

            <div className="glass-panel stat-card stat-expense">
              <div className="stat-header">
                <span>총 지출액 (출금)</span>
                <TrendingDown size={18} style={{ color: 'var(--accent-rose)' }} />
              </div>
              <div className="stat-val expense">
                ₩{grandWithdrawal.toLocaleString()}
              </div>
              <div className="stat-footer">파일 내 모든 지출 항목 합계</div>
            </div>

            <div className="glass-panel stat-card stat-net">
              <div className="stat-header">
                <span>순 현금흐름</span>
                <DollarSign size={18} style={{ color: 'var(--accent-cyan)' }} />
              </div>
              <div className="stat-val net">
                ₩{(grandDeposit - grandWithdrawal).toLocaleString()}
              </div>
              <div className="stat-footer">총 수입액 - 총 지출액</div>
            </div>
          </div>

          {/* Sub Grid (Sidebar Rules & Main Table) */}
          <div className="dashboard-grid">
            
            {/* Sidebar Column: Categories List & Rules Toggle */}
            <div className="glass-panel sidebar-panel">
              <div className="sidebar-header">
                <h3>거래 카테고리</h3>
                <div>
                  <button
                    className="secondary compact-button"
                    onClick={() => setIsSummaryModalOpen(true)}
                    id="btn-summary-manager"
                  >
                    <Plus size={12} /> 카테고리 관리
                  </button>
                </div>
              </div>

              <div className="category-list">
                <div className="review-queue">
                  <div className="review-queue-title">
                    <strong>검토 필요</strong>
                    <span>{unclassifiedTransactions.length + reportCategoryView.conflicts.length}건</span>
                  </div>
                  <button
                    className={`review-queue-button ${reviewMode === 'unclassified' ? 'active' : ''}`}
                    onClick={() => handleSelectReviewMode('unclassified')}
                  >
                    <span>미분류 거래 {unclassifiedTransactions.length}건</span>
                    <strong>₩{unclassifiedTotal.toLocaleString()}</strong>
                  </button>
                  <button
                    className={`review-queue-button secondary ${reviewMode === 'conflicts' ? 'active' : ''}`}
                    onClick={() => handleSelectReviewMode('conflicts')}
                  >
                    <span>규칙 충돌</span>
                    <strong>{reportCategoryView.conflicts.length}건</strong>
                  </button>
                </div>
                <button
                  type="button"
                  className={`category-item ${selectedCategory === 'all' ? 'active' : ''}`}
                  onClick={() => handleSelectCategory('all')}
                >
                  <span className="category-label">전체보기</span>
                  <span className="category-count">{transactions.length}건</span>
                </button>

                <div className="category-group category-group-income">
                  <div className="category-group-title">
                    <span>수입</span>
                    <span>입금 기준</span>
                  </div>
                  {categoryStats.filter(stat => stat.key === 'income').map(stat => (
                    <button
                      type="button"
                      key={stat.key}
                      className={`category-item ${selectedCategory === stat.key ? 'active' : ''}`}
                      onClick={() => handleSelectCategory(stat.key)}
                    >
                      <span className={`category-badge ${stat.colorClass}`}>{stat.name}</span>
                      <span className="category-amount">₩{stat.amount.toLocaleString()}</span>
                    </button>
                  ))}
                </div>

                <div className="category-group category-group-expense">
                  <div className="category-group-title">
                    <span>지출</span>
                    <span>출금 기준</span>
                  </div>
                  {categoryStats.filter(stat => stat.key !== 'income').map(stat => (
                    <button
                      type="button"
                      key={stat.key}
                      className={`category-item ${selectedCategory === stat.key ? 'active' : ''}`}
                      onClick={() => handleSelectCategory(stat.key)}
                    >
                      <span className={`category-badge ${stat.colorClass}`}>{stat.name}</span>
                      <span className="category-amount">
                        ₩{stat.amount.toLocaleString()} ({stat.percentage.toFixed(0)}%)
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom SVG Mini Progress Bars Chart */}
              <div className="custom-chart-container category-share">
                <span className="category-share-title">지출 점유율</span>
                {categoryStats.filter(stat => stat.key !== 'income' && stat.amount > 0).map(stat => (
                  <div key={stat.key} className="chart-bar-row">
                    <div className="chart-bar-info">
                      <span>{stat.name}</span>
                      <span>{stat.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="chart-bar-track">
                      <div 
                        className={`chart-bar-fill ${stat.colorClass}`}
                        style={{ width: `${stat.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Transactions Data List */}
            <div className="glass-panel table-panel" id="transaction-list">
              <div className="table-header-row">
                <div className="table-title-group">
                  <span className="table-title">
                    {tableTitle} ({filteredTransactions.length}건)
                  </span>
                  {selectedCategory !== 'all' && reviewMode === 'all' && (
                    <span className="selected-total">
                      선택된 {selectedIncomeOnly ? '입금' : '지출'} 합계: <strong>₩{selectedTotal.toLocaleString()}</strong>
                    </span>
                  )}
                </div>

                {/* Search Input */}
                <div className="table-search">
                  <Search size={16} className="table-search-icon" aria-hidden="true" />
                  <input 
                    type="text" 
                    placeholder="거래처/금액 검색..." 
                    value={searchTerm} 
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setFocusedTransactionIds([]);
                    }}
                    className="table-search-input"
                  />
                  {searchTerm && (
                    <button type="button" className="table-search-clear" onClick={() => setSearchTerm('')} aria-label="검색어 지우기">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {reviewStatus && (
                <div className={`review-status ${reviewStatus.type}`} role="status">
                  <span>{reviewStatus.message}</span>
                  <button className="review-status-close" onClick={() => setReviewStatus(null)} aria-label="안내 닫기">
                    <X size={14} />
                  </button>
                </div>
              )}

              {focusedTransactionIds.length > 0 && (
                <div className="validation-filter-banner">
                  <span>검증 경고에 해당하는 거래 {filteredTransactions.length}건만 표시 중입니다.</span>
                  <button type="button" className="secondary" onClick={() => setFocusedTransactionIds([])}>
                    전체 거래 보기
                  </button>
                </div>
              )}

              {/* Transactions Table */}
              <div className="table-container">
                {filteredTransactions.length === 0 ? (
                  <div className="empty-state">
                    <FileSpreadsheet className="empty-state-icon" />
                    <p>검색 결과가 없습니다.</p>
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>거래일시</th>
                        <th>거래처 (적요)</th>
                        <th>구분</th>
                        <th className="amount-heading">출금액(지출)</th>
                        <th className="amount-heading">입금액(수입)</th>
                        <th className="amount-heading">잔액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((tx) => (
                        <tr key={tx.id}>
                          <td className="transaction-date">{tx.date}</td>
                          <td>
                            <div className="transaction-description">{tx.description}</div>
                            {tx.isUnclassified && <span className="review-badge unclassified">미분류</span>}
                            {tx.ruleConflict && (
                              <span className="review-badge conflict" title={tx.ruleConflict.matches.map(match => `${match.categoryLabel} > ${match.detailLabel}`).join('\n')}>
                                규칙 {tx.ruleConflict.matches.length}개 일치 · 위쪽 규칙 우선
                              </span>
                            )}
                          </td>
                          <td>
                            {tx.withdrawal > 0 ? (
                              <div className="transaction-category-editor">
                                <select
                                  value={tx.category}
                                  onChange={(event) => handleManualCategoryChange(tx.id, event.target.value)}
                                  aria-label={`${tx.description} 카테고리`}
                                >
                                  {reportCategories.filter(category => category.enabled !== false).map(category => (
                                    <option key={category.id} value={category.id}>
                                      {category.label}
                                    </option>
                                  ))}
                                </select>
                                {tx.isUnclassified && (
                                  <label className="learn-vendor-option">
                                    <input
                                      type="checkbox"
                                      checked={learningTransactionIds.has(tx.id)}
                                      onChange={(event) => setLearningTransactionIds(current => {
                                        const next = new Set(current);
                                        if (event.target.checked) next.add(tx.id);
                                        else next.delete(tx.id);
                                        return next;
                                      })}
                                    />
                                    같은 거래처 기억
                                  </label>
                                )}
                              </div>
                            ) : (
                              <span className={`category-badge ${tx.category}`}>
                                {categoryStats.find(stat => stat.key === tx.category)?.name}
                              </span>
                            )}
                          </td>
                          <td className="amount-col out">
                            {tx.withdrawal > 0 ? `₩${tx.withdrawal.toLocaleString()}` : '-'}
                          </td>
                          <td className="amount-col in">
                            {tx.deposit > 0 ? `₩${tx.deposit.toLocaleString()}` : '-'}
                          </td>
                          <td className="amount-col balance-col">
                            ₩{tx.balance.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

          </div>

          <FinancialCharts transactions={transactions} categoryStats={categoryStats} />
        </>
      )}

      {/* Export Settings Modal */}
      {isExportModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsExportModalOpen(false)}>
          <form
            className="modal-content glass-panel export-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-modal-title"
            onSubmit={handleExport}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                setIsExportModalOpen(false);
              }
            }}
          >
            <div className="export-modal-header">
              <div>
                <h3 id="export-modal-title">내보내기 전 정산 검증</h3>
                <p>검증 결과와 보고서 정보를 확인한 뒤 다운로드하세요.</p>
              </div>
              <button
                type="button"
                className="secondary export-modal-close"
                onClick={() => setIsExportModalOpen(false)}
                aria-label="내보내기 팝업 닫기"
              >
                <X size={18} />
              </button>
            </div>

            <div className="export-modal-source">
              <span>원본 파일</span>
              <strong>{fileName}</strong>
            </div>

            <section className="validation-report" aria-label="정산 검증 결과">
              <div className={`validation-item ${validationReport.errors.length > 0 ? 'error' : 'success'}`}>
                {validationReport.errors.length > 0 ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                <div>
                  <strong>대시보드와 보고서 합계</strong>
                  <span>
                    {validationReport.errors[0]?.description
                      || `수입 ₩${validationReport.totals.reportDeposit.toLocaleString()} · 지출 ₩${validationReport.totals.reportWithdrawal.toLocaleString()}`}
                  </span>
                </div>
                <b>{validationReport.errors.length > 0 ? '오류' : '일치'}</b>
              </div>

              {validationReport.warnings.map(item => (
                <div className="validation-item warning" key={item.id}>
                  <AlertTriangle size={20} />
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </div>
                  <button
                    type="button"
                    className="secondary validation-navigation"
                    onClick={() => handleValidationNavigation(item.transactionIds)}
                  >
                    거래 보기 <ArrowRight size={14} />
                  </button>
                </div>
              ))}

              {validationReport.warnings.length === 0 && validationReport.errors.length === 0 && (
                <div className="validation-empty">
                  <CheckCircle2 size={18} /> 미분류·중복 의심·잔액 흐름 이상이 없습니다.
                </div>
              )}
            </section>

            <div className="form-group">
              <label htmlFor="report-title">보고서 제목</label>
              <input
                id="report-title"
                value={reportTitle}
                onChange={(event) => setReportTitle(event.target.value)}
                placeholder="보고서 제목"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="download-file-name">다운로드 파일명</label>
              <input
                id="download-file-name"
                value={downloadFileName}
                onChange={(event) => setDownloadFileName(event.target.value)}
                onBlur={() => setDownloadFileName(normalizeDownloadFileName(downloadFileName))}
                placeholder="사업장_YYYY-MM_월정산.xlsx"
              />
            </div>

            <div className="export-modal-actions">
              <button type="button" className="secondary" onClick={() => setIsExportModalOpen(false)}>
                취소
              </button>
              <button type="submit" disabled={!validationReport.canExport}>
                <Download size={16} /> {validationReport.canExport ? '검증 완료 · 다운로드' : '오류 수정 필요'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rules Manager Modal */}
      {isRulesModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsRulesModalOpen(false)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sliders size={20} className="glow-text" /> 자동 분류 키워드 규칙 관리
              </h3>
              <button className="secondary" style={{ padding: '0.25rem', borderRadius: '50%' }} onClick={() => setIsRulesModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Select category to manage */}
            <div className="form-group">
              <label>카테고리 선택</label>
              <select 
                value={editingCategoryKey}
                onChange={(e) => setEditingCategoryKey(e.target.value)}
                style={{ width: '100%' }}
              >
                {Object.keys(rules).filter(k => k !== 'etc' && k !== 'income').map(key => (
                  <option key={key} value={key}>
                    {rules[key].name}
                  </option>
                ))}
              </select>
            </div>

            {/* Keyword tag cloud */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>{rules[editingCategoryKey].name} 키워드 리스트</label>
              <div className="tag-list" style={{ minHeight: '100px', padding: '1rem', border: '1px solid var(--border-glass)', borderRadius: '8px', background: 'rgba(0, 0, 0, 0.2)' }}>
                {rules[editingCategoryKey].keywords.length === 0 ? (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>등록된 키워드가 없습니다.</span>
                ) : (
                  rules[editingCategoryKey].keywords.map(kw => (
                    <span key={kw} className="keyword-tag">
                      {kw}
                      <X 
                        size={10} 
                        className="keyword-tag-remove" 
                        onClick={() => handleRemoveKeyword(editingCategoryKey, kw)} 
                      />
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Add new keyword form */}
            <form onSubmit={handleAddKeyword} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <input 
                type="text" 
                placeholder="새 분류 키워드 입력 (예: 호스텔)" 
                value={newKeyword} 
                onChange={(e) => setNewKeyword(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit">
                <Plus size={16} /> 추가
              </button>
            </form>

            {/* Bottom Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-glass)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
              <button className="secondary danger" onClick={handleResetRules}>
                규칙 초기화
              </button>
              <button onClick={() => setIsRulesModalOpen(false)}>
                설정 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Major Category Manager Modal */}
      {isSummaryModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsSummaryModalOpen(false)}>
          <div className="modal-content report-settings-modal glass-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>큰 카테고리 설정</h3>
                <p style={{ marginTop: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  큰 카테고리와 그 안의 작은 카테고리를 필요한 만큼 추가하거나 삭제하세요.
                </p>
              </div>
              <button className="secondary" style={{ padding: '0.25rem', borderRadius: '50%' }} onClick={() => setIsSummaryModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="major-category-tabs">
              {reportCategories.map(category => (
                <button
                  key={category.id}
                  className={`${editingReportCategoryId === category.id ? '' : 'secondary'} ${category.enabled === false ? 'disabled-category' : ''}`}
                  onClick={() => {
                    setEditingReportCategoryId(category.id);
                    setNewDetailLabel('');
                    setNewDetailKeyword('');
                    setNewDetailMatchType('contains');
                  }}
                >
                  {category.label}
                </button>
              ))}
              <button className="secondary add-major-category" onClick={handleAddReportCategory}>
                <Plus size={15} /> 큰 카테고리 추가
              </button>
            </div>

            {(() => {
              const category = reportCategories.find(item => item.id === editingReportCategoryId);
              if (!category) return null;
              return (
                <>
                  <div className="report-category-name-row">
                    <div className="form-group report-category-name">
                      <label htmlFor="report-category-label">큰 카테고리 이름</label>
                      <input
                        id="report-category-label"
                        value={category.label}
                        onChange={(event) => updateReportCategoryLabel(event.target.value)}
                        placeholder="큰 카테고리 이름"
                      />
                    </div>
                    {category.id !== 'misc' && (
                      <button className="secondary danger remove-major-category" onClick={handleRemoveReportCategory}>
                        <Trash2 size={15} /> 큰 카테고리 삭제
                      </button>
                    )}
                  </div>
                  <label className="report-category-enabled">
                    <input
                      type="checkbox"
                      checked={category.enabled !== false}
                      disabled={category.id === 'misc'}
                      onChange={(event) => updateReportCategoryEnabled(event.target.checked)}
                    />
                    <span>
                      이 큰 카테고리 사용
                      {category.id === 'misc' && <small>미분류 지출 합계를 위해 항상 사용됩니다.</small>}
                    </span>
                  </label>
                  <div className="report-detail-header">
                    <strong>작은 카테고리 항목</strong>
                    <span>{category.details.length}개 · 앞쪽 항목 우선</span>
                  </div>
                  <div className="report-detail-columns" aria-hidden="true">
                    <span>항목명</span>
                    <span>매칭</span>
                    <span>키워드·별칭 (한 줄에 하나)</span>
                    <span />
                  </div>
                  <div className="report-detail-list">
                    {category.details.map(detail => (
                      <div className="report-detail-item" key={detail.id}>
                        <input
                          value={detail.label}
                          aria-label="상세 항목명"
                          onChange={(event) => updateReportDetail(detail.id, 'label', event.target.value)}
                          placeholder="항목명"
                        />
                        <select
                          value={detail.matchType || 'contains'}
                          aria-label="거래처 매칭 방식"
                          onChange={(event) => updateReportDetail(detail.id, 'matchType', event.target.value)}
                          disabled={detail.matchType === 'salary'}
                        >
                          {detail.matchType === 'salary'
                            ? <option value="salary">급여 자동 판별</option>
                            : MATCH_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                        <VendorPatternsInput
                          detail={detail}
                          onChange={(value) => updateReportDetailPatterns(detail.id, value)}
                        />
                        <button className="secondary danger" onClick={() => handleRemoveReportDetail(detail.id)} aria-label={`${detail.label} 삭제`}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="report-detail-add">
                    <input value={newDetailLabel} onChange={(event) => setNewDetailLabel(event.target.value)} placeholder="새 항목명" />
                    <select value={newDetailMatchType} onChange={(event) => setNewDetailMatchType(event.target.value)} aria-label="새 항목 매칭 방식">
                      {MATCH_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <textarea value={newDetailKeyword} onChange={(event) => setNewDetailKeyword(event.target.value)} placeholder={'거래처 키워드\n별칭1\n별칭2'} />
                    <button onClick={handleAddReportDetail} disabled={!newDetailLabel.trim() || !newDetailKeyword.split('\n').some(pattern => pattern.trim())}>
                      <Plus size={15} /> 추가
                    </button>
                  </div>
                </>
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-glass)', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                {reportConfigStatus || '저장 버튼을 누르면 다음 실행에도 설정이 유지됩니다.'}
              </span>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button className="secondary" onClick={handleResetReportCategories}>기본값 복원</button>
                <button onClick={async () => { if (await handleSaveReportCategories()) setIsSummaryModalOpen(false); }}>저장</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Easter Egg Overlay */}
      {showEasterEgg && (
        <div className="easter-egg-overlay" onClick={() => setShowEasterEgg(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <BaldDodgeGame onClose={() => setShowEasterEgg(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
