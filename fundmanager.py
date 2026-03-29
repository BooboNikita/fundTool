import akshare as ak
import pandas as pd
import json
import os
import re
import time
from datetime import datetime
from typing import Optional, Dict, List, Any
import httpx

class FundManager:
    PORTFOLIO_FILE = "portfolio.json"
    _JSONPGZ_RE = re.compile(r"jsonpgz\(\s*(\{.*?\})\s*\)\s*;?\s*$", re.DOTALL)

    @staticmethod
    def get_portfolio() -> List[Dict[str, str]]:
        """
        读取持仓配置
        """
        if not os.path.exists(FundManager.PORTFOLIO_FILE):
            return []
        
        try:
            with open(FundManager.PORTFOLIO_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get("funds", [])
        except Exception as e:
            print(f"Error reading portfolio: {e}")
            return []

    @staticmethod
    def save_portfolio(funds: List[Dict[str, str]]) -> bool:
        """
        保存持仓配置
        """
        try:
            with open(FundManager.PORTFOLIO_FILE, 'w', encoding='utf-8') as f:
                json.dump({"funds": funds}, f, ensure_ascii=False, indent=4)
            return True
        except Exception as e:
            print(f"Error saving portfolio: {e}")
            return False

    @staticmethod
    def add_fund(fund_identity: str, note: str = "") -> Dict[str, Any]:
        """
        添加基金到持仓
        """
        code = FundManager.get_fund_code(fund_identity)
        if not code:
            return {"error": f"Fund not found for '{fund_identity}'"}
            
        portfolio = FundManager.get_portfolio()
        # 检查是否已存在
        for f in portfolio:
            if f['code'] == code:
                return {"message": f"Fund {code} already exists in portfolio."}
        
        # 获取基金名称（简单获取）
        try:
            df_funds = ak.fund_name_em()
            name = df_funds[df_funds['基金代码'] == code].iloc[0]['基金简称']
        except:
            name = fund_identity

        new_fund = {
            "code": code,
            "name": name,
            "note": note
        }
        portfolio.append(new_fund)
        
        if FundManager.save_portfolio(portfolio):
            return {"message": f"Added {name} ({code}) to portfolio.", "fund": new_fund}
        else:
            return {"error": "Failed to save portfolio."}

    @staticmethod
    def remove_fund(fund_identity: str) -> Dict[str, Any]:
        """
        从持仓移除基金
        """
        # 尝试解析代码，如果解析不到，就直接按输入的字符串去匹配代码或名称
        code = FundManager.get_fund_code(fund_identity)
        target_code = code if code else fund_identity
        
        portfolio = FundManager.get_portfolio()
        initial_len = len(portfolio)
        
        # 过滤掉匹配的
        new_portfolio = [
            f for f in portfolio 
            if f['code'] != target_code and f['name'] != fund_identity
        ]
        
        if len(new_portfolio) == initial_len:
            return {"message": f"Fund '{fund_identity}' not found in portfolio."}
            
        if FundManager.save_portfolio(new_portfolio):
            return {"message": f"Removed fund matching '{fund_identity}' from portfolio."}
        else:
            return {"error": "Failed to save portfolio."}

    @staticmethod
    def get_fund_code(name_or_code: str) -> Optional[str]:
        """
        根据名称或代码获取基金代码。
        如果是数字且长度匹配，假设是代码。
        否则进行模糊搜索。
        """
        name_or_code = name_or_code.strip()
        
        # 简单的代码判断：6位数字
        if name_or_code.isdigit() and len(name_or_code) == 6:
            return name_or_code
            
        print(f"Searching fund code for: {name_or_code}")
        try:
            df_funds = ak.fund_name_em()
            
            # 1. 直接包含匹配
            mask = df_funds['基金简称'].str.contains(name_or_code) | df_funds['基金代码'].str.contains(name_or_code)
            matches = df_funds[mask]
            
            # 2. 尝试去掉常见后缀再搜
            if matches.empty:
                cleaned = name_or_code.replace("ETF", "").replace("联接", "").replace("A", "").replace("C", "").strip()
                if cleaned and cleaned != name_or_code:
                    print(f"Trying cleaned name: {cleaned}")
                    mask = df_funds['基金简称'].str.contains(cleaned)
                    matches = df_funds[mask]

            # 3. 尝试分离公司名
            if matches.empty:
                companies = ["易方达", "华夏", "南方", "博时", "广发", "汇添富", "富国", "嘉实", "招商"]
                for co in companies:
                    if name_or_code.startswith(co):
                        rest = name_or_code[len(co):].strip()
                        # 去掉可能的连接符或后缀
                        rest = rest.replace("ETF", "").replace("联接", "").replace("A", "").replace("C", "")
                        if rest:
                            print(f"Trying split: {co} + {rest}")
                            mask = df_funds['基金简称'].str.contains(co) & df_funds['基金简称'].str.contains(rest)
                            matches = df_funds[mask]
                            if not matches.empty:
                                break

            if matches.empty:
                print(f"No match found for {name_or_code}")
                return None
            
            # 返回第一个匹配项
            result = matches.iloc[0]['基金代码']
            print(f"Found fund: {matches.iloc[0]['基金简称']} ({result})")
            return result
        except Exception as e:
            print(f"Error searching fund: {e}")
            return None

    @staticmethod
    def _fetch_today_estimation_1234567(fund_code: str) -> Dict[str, Any]:
        url = f"http://fundgz.1234567.com.cn/js/{fund_code}.js"
        params = {"rt": str(int(time.time() * 1000))}
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "http://fundgz.1234567.com.cn/",
            "Accept": "*/*",
        }

        with httpx.Client(timeout=10.0, headers=headers) as client:
            resp = client.get(url, params=params)
            resp.raise_for_status()
            text = resp.text
            if "jsonpgz(" not in text:
                try:
                    text = resp.content.decode("gbk", errors="ignore")
                except Exception:
                    text = resp.content.decode(errors="ignore")

        match = FundManager._JSONPGZ_RE.search(text.strip())
        if not match:
            raise ValueError(f"Unexpected response for fund {fund_code}: {text[:120]}")

        payload = json.loads(match.group(1))
        resolved_code = payload.get("fundcode") or fund_code
        gszzl = payload.get("gszzl")
        if isinstance(gszzl, str):
            stripped = gszzl.strip()
            if stripped and not stripped.endswith("%"):
                gszzl = stripped + "%"
        return {
            "code": resolved_code,
            "fund_code": resolved_code,
            "name": payload.get("name"),
            "net_value_date": payload.get("jzrq"),
            "net_value": payload.get("dwjz"),
            "estimate_net_value": payload.get("gsz"),
            "estimate_growth_rate": gszzl,
            "estimate_time": payload.get("gztime"),
            "raw": payload,
        }

    @staticmethod
    def get_today_estimation(fund_identity: str) -> Dict[str, Any]:
        """
        获取今日净值估算
        """
        fund_code = FundManager.get_fund_code(fund_identity)
        if not fund_code:
            return {"error": f"Fund not found for '{fund_identity}'"}
            
        try:
            return FundManager._fetch_today_estimation_1234567(fund_code)
            
        except Exception as e:
            return {"error": f"Failed to get estimation: {str(e)}"}

    @staticmethod
    def get_fund_history(fund_identity: str, days: int = 5) -> Dict[str, Any]:
        """
        获取最近N天的净值
        """
        fund_code = FundManager.get_fund_code(fund_identity)
        if not fund_code:
            return {"error": f"Fund not found for '{fund_identity}'"}
            
        try:
            df_nav = ak.fund_open_fund_info_em(symbol=fund_code, indicator="单位净值走势")
            if df_nav.empty:
                return {"fund_code": fund_code, "message": "No history data found."}
                
            recent = df_nav.tail(days).sort_values(by='净值日期', ascending=False)
            
            return {
                "fund_code": fund_code,
                "history": recent.to_dict(orient='records')
            }
        except Exception as e:
            return {"error": f"Failed to get history: {str(e)}"}

    @staticmethod
    def get_portfolio_estimation() -> Dict[str, Any]:
        """
        获取所有持仓基金的今日估值
        """
        portfolio = FundManager.get_portfolio()
        if not portfolio:
            return {"message": "Portfolio is empty."}
        
        try:
            results = []
            for fund in portfolio:
                code = fund['code']
                name = fund.get('name', 'Unknown')

                item = FundManager._fetch_today_estimation_1234567(code)
                if not item.get("name"):
                    item["name"] = name
                results.append(item)
                    
            return {"estimations": results}
            
        except Exception as e:
            return {"error": f"Failed to get portfolio estimation: {str(e)}"}


if __name__ == "__main__":
    fund_manager = FundManager()
    print(fund_manager.get_today_estimation("012733"))