import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { fundApi } from "../utils/api";
import { FundSearchResult, FundWithEstimation } from "../types";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import "./FundExplorer.css";

export function FundExplorer() {
  const navigate = useNavigate();
  const [funds, setFunds] = useState<FundSearchResult[]>([]);
  const [filteredFunds, setFilteredFunds] = useState<FundSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedFund, setSelectedFund] = useState<FundSearchResult | null>(
    null,
  );
  const [addWatchlist, setAddWatchlist] = useState(true);
  const [addHolding, setAddHolding] = useState(false);
  const [adding, setAdding] = useState(false);
  const [top10Funds, setTop10Funds] = useState<FundWithEstimation[]>([]);
  const [top10Loading, setTop10Loading] = useState(true);

  const fetchFunds = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const response = await fundApi.getAll(pageNum, 100);
      setFunds(response.data.results);
      setFilteredFunds(response.data.results);
      setTotal(response.data.total);
      setTotalPages(response.data.totalPages);
      setPage(response.data.page);
    } catch (error) {
      console.error("Failed to fetch funds:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFunds(1);
  }, [fetchFunds]);

  useEffect(() => {
    const fetchTop10 = async () => {
      setTop10Loading(true);
      try {
        const response = await fundApi.getTop10();
        setTop10Funds(response.data.top10);
      } catch (error) {
        console.error("Failed to fetch top 10 funds:", error);
      } finally {
        setTop10Loading(false);
      }
    };
    fetchTop10();
  }, []);

  useEffect(() => {
    if (!searchKeyword.trim()) {
      setFilteredFunds(funds);
      return;
    }

    const keyword = searchKeyword.toLowerCase();
    const filtered = funds.filter(
      (fund) =>
        fund.code.includes(searchKeyword) ||
        fund.name.toLowerCase().includes(keyword) ||
        (fund.type && fund.type.toLowerCase().includes(keyword)),
    );
    setFilteredFunds(filtered);
  }, [searchKeyword, funds]);

  const handleAddFund = async () => {
    if (!selectedFund) return;

    setAdding(true);
    try {
      await fundApi.add(selectedFund.code, addWatchlist, addHolding);
      setSelectedFund(null);
      alert("添加成功！");
    } catch (error: any) {
      alert(error.response?.data?.error || "添加失败");
    } finally {
      setAdding(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchFunds(newPage);
    }
  };

  return (
    <div className="explorer-container">
      <header className="explorer-header">
        <div className="header-content">
          <div className="header-left">
            <button className="back-btn" onClick={() => navigate("/")}>
              ← 返回
            </button>
            <h1>基金浏览</h1>
          </div>
          <div className="header-info">
            共 <span className="highlight">{total.toLocaleString()}</span>{" "}
            只基金
          </div>
        </div>
      </header>

      <main className="explorer-main">
        <div className="top10-section">
          <h2 className="section-title">
            <span className="title-icon">🔥</span>
            今日热门 TOP10
          </h2>
          {top10Loading ? (
            <div className="top10-loading">
              <div className="loading-spinner" />
              <p>加载热门基金...</p>
            </div>
          ) : top10Funds.length > 0 ? (
            <div className="top10-grid">
              {top10Funds.map((fund, index) => (
                <div
                  key={fund.code}
                  className="top10-card"
                  onClick={() =>
                    setSelectedFund({
                      code: fund.code,
                      name: fund.name,
                      type: fund.type || "",
                    })
                  }
                >
                  <div className="top10-rank">#{index + 1}</div>
                  <div className="top10-info">
                    <div className="top10-name">{fund.name}</div>
                    <div className="top10-code">{fund.code}</div>
                  </div>
                  <div
                    className={`top10-rate ${
                      fund.estimation?.estimate_growth_rate?.startsWith("-")
                        ? "negative"
                        : "positive"
                    }`}
                  >
                    {fund.estimation?.estimate_growth_rate || "--"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="top10-empty">
              <p>暂无数据（非交易时间）</p>
            </div>
          )}
        </div>

        <div className="search-section">
          <Input
            placeholder="搜索基金代码、名称或类型..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="search-input"
          />
          {searchKeyword && (
            <span className="search-result-count">
              找到 {filteredFunds.length} 只基金
            </span>
          )}
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>加载中...</p>
          </div>
        ) : (
          <>
            <div className="fund-grid">
              {filteredFunds.map((fund) => (
                <div
                  key={fund.code}
                  className={`fund-card ${selectedFund?.code === fund.code ? "selected" : ""}`}
                  onClick={() => setSelectedFund(fund)}
                >
                  <div className="fund-card-code">{fund.code}</div>
                  <div className="fund-card-name">{fund.name}</div>
                  {fund.type && (
                    <div className="fund-card-type">{fund.type}</div>
                  )}
                </div>
              ))}
            </div>

            {!searchKeyword && totalPages > 1 && (
              <div className="pagination">
                <button
                  className="page-btn"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                >
                  上一页
                </button>
                <span className="page-info">
                  第 {page} / {totalPages} 页
                </span>
                <button
                  className="page-btn"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {selectedFund && (
        <div className="modal-overlay" onClick={() => setSelectedFund(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>添加基金</h3>
              <button
                className="close-btn"
                onClick={() => setSelectedFund(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="fund-detail">
                <div className="detail-row">
                  <span className="detail-label">代码</span>
                  <span className="detail-value code">{selectedFund.code}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">名称</span>
                  <span className="detail-value">{selectedFund.name}</span>
                </div>
                {selectedFund.type && (
                  <div className="detail-row">
                    <span className="detail-label">类型</span>
                    <span className="detail-value">{selectedFund.type}</span>
                  </div>
                )}
              </div>
              <div className="add-options">
                <label className="category-label">添加到</label>
                <div className="checkbox-group-modal">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={addWatchlist}
                      onChange={(e) => setAddWatchlist(e.target.checked)}
                    />
                    自选
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={addHolding}
                      onChange={(e) => setAddHolding(e.target.checked)}
                    />
                    持有
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="secondary" onClick={() => setSelectedFund(null)}>
                取消
              </Button>
              <Button
                onClick={handleAddFund}
                loading={adding}
                disabled={!addWatchlist && !addHolding}
              >
                确认添加
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
