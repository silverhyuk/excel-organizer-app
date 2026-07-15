import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Download, 
  RefreshCw, 
  Sliders, 
  Plus, 
  Trash2, 
  X, 
  Search, 
  Hotel, 
  TrendingDown, 
  TrendingUp, 
  DollarSign, 
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { parseExcelTransactions, exportToExcel } from './utils/excelParser';
import { getRules, saveRules, classifyTransaction } from './utils/classifier';
import baldDancerImg from './assets/bald_dancer.jpg';

function App() {
  const [transactions, setTransactions] = useState([]);
  const [rules, setRules] = useState(getRules());
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
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

  // Re-classify all transactions when rules change or new transactions load
  useEffect(() => {
    if (transactions.length > 0) {
      const updated = transactions.map(tx => ({
        ...tx,
        category: classifyTransaction(tx.description, rules)
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
        category: classifyTransaction(tx.description, rules)
      }));
      
      setTransactions(classified);
      setSelectedCategory('all');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || '엑셀 파일을 읽는 과정에서 오류가 발생했습니다.');
    }
  };

  // Export current transactions to excel
  const handleExport = () => {
    if (transactions.length === 0) return;
    
    try {
      const buffer = exportToExcel(transactions, rules);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `[정리완료]_${fileName}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('엑셀 내보내기 중 오류가 발생했습니다.');
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

  // Manually update transaction category
  const handleManualCategoryChange = (txId, newCat) => {
    const updated = transactions.map(tx => {
      if (tx.id === txId) {
        return { ...tx, category: newCat };
      }
      return tx;
    });
    setTransactions(updated);
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
  const totalWithdrawal = transactions
    .filter(tx => selectedCategory === 'all' || tx.category === selectedCategory)
    .reduce((sum, tx) => sum + tx.withdrawal, 0);

  const totalDeposit = transactions
    .filter(tx => selectedCategory === 'all' || tx.category === selectedCategory)
    .reduce((sum, tx) => sum + tx.deposit, 0);

  // Overall sums (independent of selectedCategory for summary cards)
  const grandWithdrawal = transactions.reduce((sum, tx) => sum + tx.withdrawal, 0);
  const grandDeposit = transactions.reduce((sum, tx) => sum + tx.deposit, 0);
  
  // Hotel Category specific sum
  const hotelWithdrawal = transactions
    .filter(tx => tx.category === 'hotel')
    .reduce((sum, tx) => sum + tx.withdrawal, 0);

  // Filtered transactions for the main table list
  const filteredTransactions = transactions.filter(tx => {
    const matchesCategory = selectedCategory === 'all' || tx.category === selectedCategory;
    const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          String(tx.withdrawal).includes(searchTerm) ||
                          String(tx.deposit).includes(searchTerm);
    return matchesCategory && matchesSearch;
  });

  // Calculate percentages for statistics chart
  const categoryStats = Object.keys(rules).map(key => {
    const sum = transactions
      .filter(tx => tx.category === key)
      .reduce((sum, tx) => sum + tx.withdrawal, 0);
    const pct = grandWithdrawal > 0 ? (sum / grandWithdrawal) * 100 : 0;
    return {
      key,
      name: rules[key].name,
      colorClass: rules[key].colorClass,
      amount: sum,
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
            <div className="glass-panel stat-card">
              <div className="stat-header">
                <span>총 지출액 (출금)</span>
                <TrendingDown size={18} style={{ color: 'var(--accent-rose)' }} />
              </div>
              <div className="stat-val expense">
                ₩{grandWithdrawal.toLocaleString()}
              </div>
              <div className="stat-footer">파일 내 모든 지출 항목 합계</div>
            </div>

            <div className="glass-panel stat-card" style={{ borderColor: 'var(--border-glass-active)', boxShadow: 'var(--shadow-neon)' }}>
              <div className="stat-header">
                <span style={{ color: 'var(--accent-rose)', fontWeight: 600 }}>🏨 호텔 / 숙박 지출금</span>
                <Hotel size={18} style={{ color: 'var(--accent-rose)' }} />
              </div>
              <div className="stat-val" style={{ color: 'var(--accent-rose)', textShadow: '0 0 10px rgba(244, 63, 94, 0.3)' }}>
                ₩{hotelWithdrawal.toLocaleString()}
              </div>
              <div className="stat-footer">호텔/숙박 카테고리로 분류된 지출</div>
            </div>

            <div className="glass-panel stat-card">
              <div className="stat-header">
                <span>총 수입액 (입금)</span>
                <TrendingUp size={18} style={{ color: 'var(--accent-emerald)' }} />
              </div>
              <div className="stat-val income">
                ₩{grandDeposit.toLocaleString()}
              </div>
              <div className="stat-footer">급여, 이체입금 등 전체 수입 합계</div>
            </div>

            <div className="glass-panel stat-card">
              <div className="stat-header">
                <span>순 지출 흐름</span>
                <DollarSign size={18} style={{ color: 'var(--accent-cyan)' }} />
              </div>
              <div className="stat-val net">
                ₩{(grandWithdrawal - grandDeposit).toLocaleString()}
              </div>
              <div className="stat-footer">총 지출액 - 총 수입액</div>
            </div>
          </div>

          {/* Sub Grid (Sidebar Rules & Main Table) */}
          <div className="dashboard-grid">
            
            {/* Sidebar Column: Categories List & Rules Toggle */}
            <div className="glass-panel sidebar-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>지출 카테고리</h3>
                <button 
                  className="secondary" 
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                  onClick={() => setIsRulesModalOpen(true)}
                  id="btn-rules-manager"
                >
                  <Sliders size={12} /> 분류규칙 설정
                </button>
              </div>

              <div className="category-list">
                <div 
                  className={`category-item ${selectedCategory === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedCategory('all')}
                >
                  <span style={{ fontWeight: 500 }}>전체보기</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{transactions.length}건</span>
                </div>

                {categoryStats.map(stat => (
                  <div 
                    key={stat.key}
                    className={`category-item ${selectedCategory === stat.key ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(stat.key)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className={`category-badge ${stat.colorClass}`}>{stat.name}</span>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                      ₩{stat.amount.toLocaleString()} ({stat.percentage.toFixed(0)}%)
                    </span>
                  </div>
                ))}
              </div>

              {/* Custom SVG Mini Progress Bars Chart */}
              <div className="custom-chart-container" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>지출 점유율</span>
                {categoryStats.filter(stat => stat.amount > 0).map(stat => (
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
                          background: stat.key === 'hotel' ? 'var(--accent-rose)' :
                                      stat.key === 'food' ? '#f59e0b' :
                                      stat.key === 'transport' ? 'var(--accent-blue)' :
                                      stat.key === 'shopping' ? '#a855f7' : 'var(--text-secondary)'
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
                    {selectedCategory === 'all' ? '전체 내역' : rules[selectedCategory].name} ({filteredTransactions.length}건)
                  </span>
                  {selectedCategory !== 'all' && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      선택된 지출 합계: <strong style={{ color: 'var(--text-primary)' }}>₩{totalWithdrawal.toLocaleString()}</strong>
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
                            {/* Category Selector for Manual Overrides */}
                            <select 
                              value={tx.category}
                              onChange={(e) => handleManualCategoryChange(tx.id, e.target.value)}
                              style={{ 
                                padding: '0.2rem 0.5rem', 
                                fontSize: '0.8rem', 
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                background: tx.category === 'hotel' ? 'rgba(244, 63, 94, 0.15)' :
                                            tx.category === 'food' ? 'rgba(245, 158, 11, 0.15)' :
                                            tx.category === 'transport' ? 'rgba(59, 130, 246, 0.15)' :
                                            tx.category === 'shopping' ? 'rgba(168, 85, 247, 0.15)' :
                                            'rgba(255, 255, 255, 0.05)',
                                color: tx.category === 'hotel' ? 'var(--accent-rose)' :
                                       tx.category === 'food' ? '#f59e0b' :
                                       tx.category === 'transport' ? 'var(--accent-blue)' :
                                       tx.category === 'shopping' ? '#a855f7' :
                                       'var(--text-secondary)',
                                fontWeight: 500,
                                cursor: 'pointer'
                              }}
                            >
                              {Object.keys(rules).map(key => (
                                <option key={key} value={key} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                                  {rules[key].name}
                                </option>
                              ))}
                            </select>
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
                {Object.keys(rules).filter(k => k !== 'etc').map(key => (
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
