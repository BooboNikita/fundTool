import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { fundApi } from "../utils/api";
import { FundWithEstimation, FundSearchResult } from "../types";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Card, CardHeader, CardBody } from "../components/Card";
import "./Home.css";

type FilterType = "all" | "watchlist" | "holding";

export function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [funds, setFunds] = useState<FundWithEstimation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<FundSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [note, setNote] = useState("");
  const [addingCode, setAddingCode] = useState("");
  const [addWatchlist, setAddWatchlist] = useState(true);
  const [addHolding, setAddHolding] = useState(false);

  const fetchPortfolio = useCallback(
    async (showRefreshLoader = false) => {
      try {
        if (showRefreshLoader) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        const filter = activeFilter === "all" ? undefined : activeFilter;
        const response = await fundApi.getPortfolioEstimation(filter);
        setFunds(response.data.estimations);
      } catch (error) {
        console.error("Failed to fetch portfolio:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeFilter],
  );

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  const handleSearch = async () => {
    if (!searchKeyword.trim()) return;

    setSearching(true);
    try {
      const response = await fundApi.search(searchKeyword.trim(), 30);
      setSearchResults(response.data.results);
    } catch (error) {
      console.error("Failed to search funds:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleAddFund = async (code: string) => {
    try {
      await fundApi.add(code, addWatchlist, addHolding, note);
      setShowSearch(false);
      setSearchKeyword("");
      setSearchResults([]);
      setNote("");
      setAddingCode("");
      fetchPortfolio();
    } catch (error: any) {
      alert(error.response?.data?.error || "添加失败");
    }
  };

  const handleToggleFlag = async (
    code: string,
    field: "is_watchlist" | "is_holding",
    value: boolean,
  ) => {
    const fund = funds.find((f) => f.code === code);
    if (!fund) return;

    const newWatchlist = field === "is_watchlist" ? value : fund.is_watchlist;
    const newHolding = field === "is_holding" ? value : fund.is_holding;

    try {
      await fundApi.updateFlags(code, newWatchlist, newHolding);
      fetchPortfolio();
    } catch (error: any) {
      alert(error.response?.data?.error || "更新失败");
    }
  };

  const handleRemoveFund = async (code: string) => {
    if (!confirm("确定要删除这只基金吗？")) return;

    try {
      await fundApi.remove(code);
      fetchPortfolio();
    } catch (error: any) {
      alert(error.response?.data?.error || "删除失败");
    }
  };

  const formatGrowthRate = (rate: string | undefined) => {
    if (!rate) return <span className="rate-neutral">--</span>;
    const numRate = parseFloat(rate.replace("%", ""));
    const isPositive = numRate >= 0;
    return (
      <span className={isPositive ? "rate-positive" : "rate-negative"}>
        {isPositive ? "+" : ""}
        {rate}
      </span>
    );
  };

  const getCategoryTags = (fund: FundWithEstimation) => {
    const tags: string[] = [];
    if (fund.is_watchlist && fund.is_holding) {
      tags.push("自选+持有");
    } else if (fund.is_watchlist) {
      tags.push("自选");
    } else if (fund.is_holding) {
      tags.push("持有");
    }
    return tags;
  };

  return (
    <div className="home-container">
      <header className="home-header">
        <div className="header-content">
          <h1>基金净值浏览</h1>
          <div className="header-right">
            <span className="user-name">欢迎，{user?.username}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              退出
            </Button>
          </div>
        </div>
      </header>

      <main className="home-main">
        <div className="home-toolbar">
          <div className="category-tabs">
            <button
              className={`tab ${activeFilter === "all" ? "active" : ""}`}
              onClick={() => setActiveFilter("all")}
            >
              全部
            </button>
            <button
              className={`tab ${activeFilter === "watchlist" ? "active" : ""}`}
              onClick={() => setActiveFilter("watchlist")}
            >
              自选
            </button>
            <button
              className={`tab ${activeFilter === "holding" ? "active" : ""}`}
              onClick={() => setActiveFilter("holding")}
            >
              持有
            </button>
          </div>
          <div className="toolbar-actions">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/settings")}
            >
              设置
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/explorer")}
            >
              基金浏览
            </Button>
            <Button size="sm" onClick={() => setShowSearch(true)}>
              添加基金
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fetchPortfolio(true)}
              loading={refreshing}
            >
              刷新
            </Button>
          </div>
        </div>

        {showSearch && (
          <Card className="search-card">
            <CardHeader>
              <span>添加基金</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowSearch(false);
                  setSearchResults([]);
                  setSearchKeyword("");
                  setNote("");
                }}
              >
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
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <Button onClick={handleSearch} loading={searching}>
                    搜索
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="search-results">
                    {searchResults.map((result) => (
                      <div key={result.code} className="search-result-item">
                        <div className="result-info">
                          <span className="result-code">{result.code}</span>
                          <span className="result-name">{result.name}</span>
                          {result.type && (
                            <span className="result-type">{result.type}</span>
                          )}
                        </div>
                        {addingCode === result.code ? (
                          <div className="add-form">
                            <div className="checkbox-group">
                              <label className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={addWatchlist}
                                  onChange={(e) =>
                                    setAddWatchlist(e.target.checked)
                                  }
                                />
                                自选
                              </label>
                              <label className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={addHolding}
                                  onChange={(e) =>
                                    setAddHolding(e.target.checked)
                                  }
                                />
                                持有
                              </label>
                            </div>
                            <Input
                              placeholder="备注"
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                            />
                            <Button
                              size="sm"
                              onClick={() => handleAddFund(result.code)}
                              disabled={!addWatchlist && !addHolding}
                            >
                              确认
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setAddingCode("")}
                            >
                              取消
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => setAddingCode(result.code)}
                          >
                            添加
                          </Button>
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
              <Button onClick={() => setShowSearch(true)}>
                添加第一只基金
              </Button>
            </CardBody>
          </Card>
        ) : (
          <div className="fund-list">
            {funds.map((fund) => (
              <div key={fund.code} className="fund-item">
                <div className="fund-main">
                  <div className="fund-info">
                    <span className="fund-name">
                      {fund.estimation?.name || fund.name}
                    </span>
                    <span className="fund-code">{fund.code}</span>
                    {getCategoryTags(fund).map((tag) => (
                      <span
                        key={tag}
                        className={`fund-category ${
                          fund.is_watchlist && fund.is_holding
                            ? "both"
                            : fund.is_watchlist
                              ? "watchlist"
                              : "holding"
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="fund-values">
                    <div className="value-item">
                      <span className="value-label">净值</span>
                      <span className="value-num">
                        {fund.estimation?.net_value || "--"}
                      </span>
                    </div>
                    <div className="value-item">
                      <span className="value-label">估值</span>
                      <span className="value-num">
                        {fund.estimation?.estimate_net_value || "--"}
                      </span>
                    </div>
                    <div className="value-item highlight">
                      <span className="value-label">涨幅</span>
                      <span className="value-num">
                        {formatGrowthRate(
                          fund.estimation?.estimate_growth_rate,
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="fund-actions">
                  <label className="checkbox-label-sm">
                    <input
                      type="checkbox"
                      checked={fund.is_watchlist}
                      onChange={(e) =>
                        handleToggleFlag(
                          fund.code,
                          "is_watchlist",
                          e.target.checked,
                        )
                      }
                    />
                    自选
                  </label>
                  <label className="checkbox-label-sm">
                    <input
                      type="checkbox"
                      checked={fund.is_holding}
                      onChange={(e) =>
                        handleToggleFlag(
                          fund.code,
                          "is_holding",
                          e.target.checked,
                        )
                      }
                    />
                    持有
                  </label>
                  <button
                    className="action-btn delete"
                    onClick={() => handleRemoveFund(fund.code)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
