import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fundApi } from '../utils/api';
import { FundWithEstimation, FundSearchResult } from '../types';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card, CardHeader, CardBody } from '../components/Card';
import './Home.css';

export function Home() {
  const { user, logout } = useAuth();
  const [funds, setFunds] = useState<FundWithEstimation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<FundSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [note, setNote] = useState('');
  const [addingCode, setAddingCode] = useState('');

  const fetchPortfolio = useCallback(async (showRefreshLoader = false) => {
    try {
      if (showRefreshLoader) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const response = await fundApi.getPortfolioEstimation();
      setFunds(response.data.estimations);
    } catch (error) {
      console.error('Failed to fetch portfolio:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  const handleSearch = async () => {
    if (!searchKeyword.trim()) return;
    
    setSearching(true);
    try {
      const response = await fundApi.search(searchKeyword.trim());
      setSearchResults(response.data.results);
    } catch (error) {
      console.error('Failed to search funds:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleAddFund = async (code: string) => {
    try {
      await fundApi.add(code, note);
      setShowSearch(false);
      setSearchKeyword('');
      setSearchResults([]);
      setNote('');
      setAddingCode('');
      fetchPortfolio();
    } catch (error: any) {
      alert(error.response?.data?.error || '添加失败');
    }
  };

  const handleRemoveFund = async (code: string) => {
    if (!confirm('确定要删除这只基金吗？')) return;
    
    try {
      await fundApi.remove(code);
      fetchPortfolio();
    } catch (error: any) {
      alert(error.response?.data?.error || '删除失败');
    }
  };

  const formatGrowthRate = (rate: string | undefined) => {
    if (!rate) return '--';
    const numRate = parseFloat(rate.replace('%', ''));
    const isPositive = numRate >= 0;
    return (
      <span className={isPositive ? 'rate-positive' : 'rate-negative'}>
        {isPositive ? '+' : ''}{rate}
      </span>
    );
  };

  return (
    <div className="home-container">
      <header className="home-header">
        <div className="header-content">
          <h1>基金净值浏览</h1>
          <div className="header-right">
            <span className="user-name">欢迎，{user?.username}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              退出登录
            </Button>
          </div>
        </div>
      </header>

      <main className="home-main">
        <div className="home-actions">
          <Button onClick={() => setShowSearch(true)}>添加基金</Button>
          <Button variant="secondary" onClick={() => fetchPortfolio(true)} loading={refreshing}>
            刷新估值
          </Button>
        </div>

        {showSearch && (
          <Card className="search-card">
            <CardHeader>
              <span>添加基金</span>
              <Button variant="ghost" size="sm" onClick={() => {
                setShowSearch(false);
                setSearchResults([]);
                setSearchKeyword('');
                setNote('');
              }}>
                ✕
              </Button>
            </CardHeader>
            <CardBody>
              <div className="search-form">
                <div className="search-input-row">
                  <Input
                    placeholder="输入基金代码或名称搜索"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch} loading={searching}>搜索</Button>
                </div>
                
                {searchResults.length > 0 && (
                  <div className="search-results">
                    {searchResults.map((result) => (
                      <div key={result.code} className="search-result-item">
                        <div className="result-info">
                          <span className="result-code">{result.code}</span>
                          <span className="result-name">{result.name}</span>
                        </div>
                        {addingCode === result.code ? (
                          <div className="add-form">
                            <Input
                              placeholder="备注（可选）"
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              size={10}
                            />
                            <Button size="sm" onClick={() => handleAddFund(result.code)}>确认</Button>
                            <Button variant="ghost" size="sm" onClick={() => setAddingCode('')}>取消</Button>
                          </div>
                        ) : (
                          <Button size="sm" onClick={() => setAddingCode(result.code)}>添加</Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        )}

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>加载中...</p>
          </div>
        ) : funds.length === 0 ? (
          <Card className="empty-state">
            <CardBody>
              <p>暂无持仓基金</p>
              <Button onClick={() => setShowSearch(true)}>添加第一只基金</Button>
            </CardBody>
          </Card>
        ) : (
          <div className="fund-list">
            {funds.map((fund) => (
              <Card key={fund.code} className="fund-card">
                <CardBody>
                  <div className="fund-header">
                    <div className="fund-title">
                      <span className="fund-name">{fund.estimation?.name || fund.name}</span>
                      <span className="fund-code">{fund.code}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleRemoveFund(fund.code)}
                      className="remove-btn"
                    >
                      删除
                    </Button>
                  </div>
                  
                  {fund.note && <div className="fund-note">{fund.note}</div>}
                  
                  <div className="fund-data">
                    <div className="data-item">
                      <span className="data-label">净值日期</span>
                      <span className="data-value">{fund.estimation?.net_value_date || '--'}</span>
                    </div>
                    <div className="data-item">
                      <span className="data-label">单位净值</span>
                      <span className="data-value">{fund.estimation?.net_value || '--'}</span>
                    </div>
                    <div className="data-item">
                      <span className="data-label">估算净值</span>
                      <span className="data-value">{fund.estimation?.estimate_net_value || '--'}</span>
                    </div>
                    <div className="data-item highlight">
                      <span className="data-label">估算涨幅</span>
                      <span className="data-value">
                        {formatGrowthRate(fund.estimation?.estimate_growth_rate)}
                      </span>
                    </div>
                  </div>
                  
                  {fund.estimation?.estimate_time && (
                    <div className="fund-time">
                      估值时间：{fund.estimation.estimate_time}
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
