import React, { useState, useEffect, useMemo } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { calculateReportCategoryView, parseExcelTransactions, exportToExcel } from './utils/excelParser';
import { getRules, saveRules, classifyTransaction } from './utils/classifier';
import { cloneDefaultReportCategories, loadReportCategories, saveReportCategories } from './utils/reportConfig';
import { sumTransactionAmounts } from './utils/transactionTotals';
import FinancialCharts from './components/FinancialCharts';
import baldDancerImg from './assets/bald_dancer.jpg';
import reportTemplateUrl from '../result.xlsx?url';

function App() {
  const [transactions, setTransactions] = useState([]);
  const [rules, setRules] = useState(getRules());
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [reportCategories, setReportCategories] = useState(cloneDefaultReportCategories);
  const [editingReportCategoryId, setEditingReportCategoryId] = useState('utilities');
  const [newDetailLabel, setNewDetailLabel] = useState('');
  const [newDetailKeyword, setNewDetailKeyword] = useState('');
  const [reportConfigStatus, setReportConfigStatus] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showEasterEgg, setShowEasterEgg] = useState(false);

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
    let active = true;
    loadReportCategories().then(categories => {
      if (active) setReportCategories(categories);
    });
    return () => { active = false; };
  }, []);

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
      const rawTxList = await parseExcelTransactions(arrayBuffer);
      
      // Classify initial transactions
      const classified = rawTxList.map(tx => ({
        ...tx,
        category: classifyTransaction(tx.description, rules, tx)
      }));
      
      setTransactions(classified);
      setSelectedCategory('all');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || '엑셀 파일을 읽는 과정에서 오류가 발생했습니다.');
    }
  };

  // Export current transactions to excel
  const handleExport = async () => {
    if (transactions.length === 0) return;
    
    try {
      const templateResponse = await fetch(reportTemplateUrl);
      if (!templateResponse.ok) throw new Error('기준 양식을 불러오지 못했습니다.');
      const templateBuffer = await templateResponse.arrayBuffer();
      const buffer = await exportToExcel(transactions, rules, templateBuffer, { reportCategories });
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'result.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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

  const updateReportCategoryLabel = (value) => {
    setReportConfigStatus('');
    setReportCategories(categories => categories.map(category => (
      category.id === editingReportCategoryId ? { ...category, label: value } : category
    )));
  };

  const updateReportCategoryEnabled = (enabled) => {
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
    const detailLimit = category.id === 'misc' ? category.detailRows.length - 1 : category.detailRows.length;
    if (!newDetailLabel.trim() || !newDetailKeyword.trim() || category.details.length >= detailLimit) return;
    setReportCategories(categories => categories.map(item => (
      item.id === editingReportCategoryId
        ? { ...item, details: [...item.details, { id: crypto.randomUUID(), label: newDetailLabel.trim(), keyword: newDetailKeyword.trim() }] }
        : item
    )));
    setNewDetailLabel('');
    setNewDetailKeyword('');
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
      setReportConfigStatus('저장 실패');
      return false;
    }
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
  const handleManualCategoryChange = (txId, categoryId) => {
    setTransactions(current => current.map(tx => (
      tx.id === txId ? { ...tx, categoryOverride: categoryId } : tx
    )));
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
    setSearchTerm('');
    setErrorMsg('');
  };

  // Calculations for Stats
  // Overall sums (independent of selectedCategory for summary cards)
  const grandWithdrawal = transactions.reduce((sum, tx) => sum + tx.withdrawal, 0);
  const grandDeposit = transactions.reduce((sum, tx) => sum + tx.deposit, 0);

  const reportCategoryView = useMemo(
    () => calculateReportCategoryView(transactions, reportCategories),
    [transactions, reportCategories]
  );
  const categorizedTransactions = transactions.map((tx, index) => ({
    ...tx,
    category: reportCategoryView.assignments[index]
  }));
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
    const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          String(tx.withdrawal).includes(searchTerm) ||
                          String(tx.deposit).includes(searchTerm);
    return matchesCategory && matchesSearch;
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

  return (
    <div className="app-container">
      {/* Header */}
      <header className="glass-panel">
        <div className="logo-container">
          <span className="logo-text">딸깍 정리기</span>
          <span className="logo-badge">Premium Desktop v0.1</span>
        </div>
        {transactions.length > 0 && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="secondary" onClick={handleResetApp}>
              <RefreshCw size={16} /> 다른 파일 업로드
            </button>
            <button onClick={handleExport}>
              <Download size={16} /> 정리된 엑셀 다운로드
            </button>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      {transactions.length === 0 ? (
        // UPLOAD VIEW
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px', margin: '3rem auto 0', width: '100%' }}>
          <div 
            className={`drop-zone glass-panel ${isDragging ? 'active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-upload-input').click()}
            id="excel-drop-zone"
          >
            <input 
              id="file-upload-input" 
              type="file" 
              accept=".xlsx, .xls" 
              style={{ display: 'none' }} 
              onChange={handleFileChange}
            />
            <Upload className="drop-zone-icon" />
            <h2 className="upload-title">계좌 거래 내역 엑셀 파일을 여기에 끌어다 놓으세요</h2>
            <p className="upload-desc">또는 영역을 클릭하여 PC에서 파일을 찾아보세요 (.xlsx, .xls)</p>
          </div>

          {errorMsg && (
            <div className="glass-panel" style={{ borderColor: 'var(--accent-rose)', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--accent-rose)', background: 'rgba(244, 63, 94, 0.05)' }}>
              <AlertCircle size={20} />
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{errorMsg}</span>
            </div>
          )}

          {/* Intro Information */}
          <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>💡 엑셀 업로드 팁</h3>
            <ul style={{ paddingLeft: '1.25rem', fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li>국민, 신한, 우리, 농협, 하나 등 국내 모든 은행의 거래내역 엑셀을 그대로 지원합니다.</li>
              <li>파일에 들어있는 열 이름(예: 거래일시, 출금액, 적요 등)을 똑똑하게 자동으로 분석하여 매핑해 드립니다.</li>
              <li>데이터는 안전하게 귀하의 브라우저 로컬 환경에서만 처리되며 서버로 전송되지 않습니다.</li>
            </ul>
          </div>
        </div>
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

          <FinancialCharts transactions={transactions} categoryStats={categoryStats} />

          {/* Sub Grid (Sidebar Rules & Main Table) */}
          <div className="dashboard-grid">
            
            {/* Sidebar Column: Categories List & Rules Toggle */}
            <div className="glass-panel sidebar-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>거래 카테고리</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="secondary"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                    onClick={() => setIsSummaryModalOpen(true)}
                    id="btn-summary-manager"
                  >
                    <Plus size={12} /> 큰 카테고리 설정
                  </button>
                </div>
              </div>

              <div className="category-list">
                <div 
                  className={`category-item ${selectedCategory === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedCategory('all')}
                >
                  <span style={{ fontWeight: 500 }}>전체보기</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{transactions.length}건</span>
                </div>

                <div className="category-group category-group-income">
                  <div className="category-group-title">
                    <span>수입</span>
                    <span>입금 기준</span>
                  </div>
                  {categoryStats.filter(stat => stat.key === 'income').map(stat => (
                    <div
                      key={stat.key}
                      className={`category-item ${selectedCategory === stat.key ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(stat.key)}
                    >
                      <span className={`category-badge ${stat.colorClass}`}>{stat.name}</span>
                      <span className="category-amount">₩{stat.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div className="category-group category-group-expense">
                  <div className="category-group-title">
                    <span>지출</span>
                    <span>출금 기준</span>
                  </div>
                  {categoryStats.filter(stat => stat.key !== 'income').map(stat => (
                    <div
                      key={stat.key}
                      className={`category-item ${selectedCategory === stat.key ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(stat.key)}
                    >
                      <span className={`category-badge ${stat.colorClass}`}>{stat.name}</span>
                      <span className="category-amount">
                        ₩{stat.amount.toLocaleString()} ({stat.percentage.toFixed(0)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom SVG Mini Progress Bars Chart */}
              <div className="custom-chart-container" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>지출 점유율</span>
                {categoryStats.filter(stat => stat.key !== 'income' && stat.amount > 0).map(stat => (
                  <div key={stat.key} className="chart-bar-row">
                    <div className="chart-bar-info">
                      <span>{stat.name}</span>
                      <span>{stat.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="chart-bar-track">
                      <div 
                        className={`chart-bar-fill ${stat.colorClass}`}
                        style={{ 
                          width: `${stat.percentage}%`,
                          background: stat.key === 'salary' ? '#8a6f48' :
                                      stat.key === 'utilities' ? '#668b8c' :
                                      stat.key === 'card' ? '#486581' :
                                      stat.key === 'advertising' ? '#9b7256' :
                                      stat.key === 'expenses' ? '#b86d62' : '#7b817c'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Transactions Data List */}
            <div className="glass-panel table-panel">
              <div className="table-header-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className="table-title">
                    {selectedCategory === 'all' ? '전체 내역' : categoryStats.find(stat => stat.key === selectedCategory)?.name} ({filteredTransactions.length}건)
                  </span>
                  {selectedCategory !== 'all' && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      선택된 {selectedIncomeOnly ? '입금' : '지출'} 합계: <strong style={{ color: 'var(--text-primary)' }}>₩{selectedTotal.toLocaleString()}</strong>
                    </span>
                  )}
                </div>

                {/* Search Input */}
                <div style={{ position: 'relative', width: '250px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    placeholder="거래처/금액 검색..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem 1rem 0.45rem 2rem', fontSize: '0.85rem' }}
                  />
                  {searchTerm && (
                    <X 
                      size={14} 
                      onClick={() => setSearchTerm('')} 
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--text-muted)' }} 
                    />
                  )}
                </div>
              </div>

              {/* Transactions Table */}
              <div className="table-container">
                {filteredTransactions.length === 0 ? (
                  <div className="empty-state">
                    <FileSpreadsheet className="empty-state-icon" />
                    <p style={{ fontSize: '0.95rem' }}>검색 결과가 없습니다.</p>
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>거래일시</th>
                        <th>거래처 (적요)</th>
                        <th>구분</th>
                        <th style={{ textAlign: 'right' }}>출금액(지출)</th>
                        <th style={{ textAlign: 'right' }}>입금액(수입)</th>
                        <th style={{ textAlign: 'right' }}>잔액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((tx) => (
                        <tr key={tx.id}>
                          <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{tx.date}</td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{tx.description}</div>
                          </td>
                          <td>
                            {tx.withdrawal > 0 ? (
                              <select
                                value={tx.category}
                                onChange={(event) => handleManualCategoryChange(tx.id, event.target.value)}
                                aria-label={`${tx.description} 카테고리`}
                                style={{ minWidth: '105px', padding: '0.3rem 0.5rem', fontSize: '0.8rem', fontWeight: 500 }}
                              >
                                {reportCategories.filter(category => category.enabled !== false).map(category => (
                                  <option key={category.id} value={category.id}>
                                    {category.label}
                                  </option>
                                ))}
                              </select>
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
                          <td className="amount-col" style={{ color: 'var(--text-muted)' }}>
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
        </>
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
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>큰 카테고리 설정</h3>
                <p style={{ marginTop: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  큰 카테고리 이름과 그 안의 작은 카테고리 항목을 수정하세요.
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
                  }}
                >
                  {category.label}
                </button>
              ))}
            </div>

            {(() => {
              const category = reportCategories.find(item => item.id === editingReportCategoryId);
              const detailLimit = category.id === 'misc' ? category.detailRows.length - 1 : category.detailRows.length;
              const isFull = category.details.length >= detailLimit;
              return (
                <>
                  <div className="form-group report-category-name">
                    <label htmlFor="report-category-label">큰 카테고리 이름</label>
                    <input
                      id="report-category-label"
                      value={category.label}
                      onChange={(event) => updateReportCategoryLabel(event.target.value)}
                      placeholder="큰 카테고리 이름"
                    />
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
                    <span>{category.details.length}/{detailLimit}개</span>
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
                        <input
                          value={detail.keyword}
                          aria-label="거래처 키워드"
                          onChange={(event) => updateReportDetail(detail.id, 'keyword', event.target.value)}
                          placeholder={detail.matchType === 'salary' ? '급여 자동 판별' : '거래처 키워드'}
                          disabled={detail.matchType === 'salary'}
                        />
                        <button className="secondary danger" onClick={() => handleRemoveReportDetail(detail.id)} aria-label={`${detail.label} 삭제`}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="report-detail-add">
                    <input value={newDetailLabel} onChange={(event) => setNewDetailLabel(event.target.value)} placeholder="새 항목명" disabled={isFull} />
                    <input value={newDetailKeyword} onChange={(event) => setNewDetailKeyword(event.target.value)} placeholder="거래처 키워드" disabled={isFull} />
                    <button onClick={handleAddReportDetail} disabled={isFull || !newDetailLabel.trim() || !newDetailKeyword.trim()}>
                      <Plus size={15} /> 추가
                    </button>
                  </div>
                  {isFull && <p className="report-detail-limit">현재 Excel 양식에서 {category.label}은 최대 {detailLimit}개까지 사용할 수 있습니다.</p>}
                </>
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-glass)', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                {reportConfigStatus || '저장 버튼을 누르면 다음 실행에도 설정이 유지됩니다.'}
              </span>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button className="secondary" onClick={() => setReportCategories(cloneDefaultReportCategories())}>기본값 복원</button>
                <button onClick={async () => { if (await handleSaveReportCategories()) setIsSummaryModalOpen(false); }}>저장</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Easter Egg Overlay */}
      {showEasterEgg && (
        <div className="easter-egg-overlay" onClick={() => setShowEasterEgg(false)}>
          <div className="easter-egg-content" onClick={(e) => e.stopPropagation()}>
            <h1 className="disco-title">빡빡이 댄스 타임! 🕺</h1>
            <div className="dancer-container">
              <img 
                src={baldDancerImg} 
                alt="Dancing Bald Man" 
                className="dancing-bald-man"
              />
            </div>
            <p className="disco-subtitle">ESC를 다시 누르거나 화면을 클릭하여 돌아가기</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
