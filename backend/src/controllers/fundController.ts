import { Response } from 'express';
import axios from 'axios';
import db from '../models/database';
import { AuthRequest } from '../types/express';
import { FundEstimation, FundSearchResult } from '../types';

const FUND_NAME_URL = 'https://fund.eastmoney.com/js/fundcode_search.js';
const FUND_ESTIMATE_URL = 'http://fundgz.1234567.com.cn/js';

const JSONPGZ_RE = /jsonpgz\(\s*(\{.*?\})\s*\)\s*;?\s*$/;

let fundNameCache: Map<string, string> | null = null;
let cacheTime: number = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000;

async function getFundNameMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (fundNameCache && now - cacheTime < CACHE_TTL) {
    return fundNameCache;
  }

  try {
    const response = await axios.get(FUND_NAME_URL, {
      responseType: 'arraybuffer',
      timeout: 15000
    });
    
    const content = response.data.toString('utf-8');
    const map = new Map<string, string>();
    
    const fundArrayMatch = content.match(/\[([\s\S]*)\]/);
    if (fundArrayMatch) {
      const fundItems = fundArrayMatch[1].match(/\["[^"]+","[^"]+","[^"]+","[^"]+","[^"]+"\]/g);
      if (fundItems) {
        for (const item of fundItems) {
          const parts = item.match(/"([^"]+)"/g);
          if (parts && parts.length >= 3) {
            const code = parts[0].replace(/"/g, '');
            const name = parts[2].replace(/"/g, '');
            map.set(code, name);
          }
        }
      }
    }
    
    fundNameCache = map;
    cacheTime = now;
    console.log(`Loaded ${map.size} funds`);
    return map;
  } catch (error) {
    console.error('Failed to fetch fund names:', error);
    return fundNameCache || new Map();
  }
}

export async function searchFund(req: AuthRequest, res: Response): Promise<void> {
  const { keyword } = req.query;
  
  if (!keyword || typeof keyword !== 'string') {
    res.status(400).json({ error: 'Keyword is required' });
    return;
  }

  try {
    const fundMap = await getFundNameMap();
    const results: FundSearchResult[] = [];
    const keywordLower = keyword.toLowerCase();
    const isCode = /^\d{6}$/.test(keyword);
    
    for (const [code, name] of fundMap) {
      if (isCode) {
        if (code === keyword) {
          results.push({ code, name });
          break;
        }
      } else {
        if (name.toLowerCase().includes(keywordLower) || code.includes(keyword)) {
          results.push({ code, name });
          if (results.length >= 20) break;
        }
      }
    }
    
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: 'Failed to search funds' });
  }
}

async function fetchFundEstimation(fundCode: string): Promise<FundEstimation | null> {
  const url = `${FUND_ESTIMATE_URL}/${fundCode}.js`;
  const params = { rt: Date.now() };
  
  try {
    const response = await axios.get(url, {
      params,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'http://fundgz.1234567.com.cn/'
      },
      responseType: 'arraybuffer'
    });
    
    let text = response.data.toString('utf-8');
    
    if (!text.includes('jsonpgz(')) {
      try {
        text = response.data.toString('gbk');
      } catch {
        text = response.data.toString('utf-8');
      }
    }
    
    const match = text.match(JSONPGZ_RE);
    if (!match) {
      return null;
    }
    
    const payload = JSON.parse(match[1]);
    let gszzl = payload.gszzl;
    if (typeof gszzl === 'string' && gszzl && !gszzl.endsWith('%')) {
      gszzl = gszzl + '%';
    }
    
    return {
      code: payload.fundcode || fundCode,
      fund_code: payload.fundcode || fundCode,
      name: payload.name,
      net_value_date: payload.jzrq,
      net_value: payload.dwjz,
      estimate_net_value: payload.gsz,
      estimate_growth_rate: gszzl,
      estimate_time: payload.gztime
    };
  } catch (error) {
    console.error(`Failed to fetch estimation for ${fundCode}:`, error);
    return null;
  }
}

export async function addFund(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  const { code, note = '' } = req.body;
  
  if (!code) {
    res.status(400).json({ error: 'Fund code is required' });
    return;
  }

  try {
    const fundMap = await getFundNameMap();
    let fundName = fundMap.get(code);
    
    if (!fundName) {
      fundName = code;
    }
    
    const stmt = db.prepare('INSERT INTO funds (user_id, code, name, note) VALUES (?, ?, ?, ?)');
    const result = stmt.run(userId, code, fundName, note);
    
    res.status(201).json({
      message: 'Fund added successfully',
      fund: {
        id: result.lastInsertRowid,
        code,
        name: fundName,
        note
      }
    });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      res.status(409).json({ error: 'Fund already exists in your portfolio' });
    } else {
      res.status(500).json({ error: 'Failed to add fund' });
    }
  }
}

export function removeFund(req: AuthRequest, res: Response): void {
  const userId = req.userId;
  const { code } = req.params;
  
  try {
    const stmt = db.prepare('DELETE FROM funds WHERE user_id = ? AND code = ?');
    const result = stmt.run(userId, code);
    
    if (result.changes === 0) {
      res.status(404).json({ error: 'Fund not found in your portfolio' });
      return;
    }
    
    res.json({ message: 'Fund removed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove fund' });
  }
}

export function getPortfolio(req: AuthRequest, res: Response): void {
  const userId = req.userId;
  
  try {
    const stmt = db.prepare('SELECT id, code, name, note, created_at FROM funds WHERE user_id = ? ORDER BY created_at DESC');
    const funds = stmt.all(userId);
    
    res.json({ funds });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get portfolio' });
  }
}

export async function getPortfolioEstimation(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  
  try {
    const stmt = db.prepare('SELECT id, code, name, note FROM funds WHERE user_id = ? ORDER BY created_at DESC');
    const funds = stmt.all(userId) as any[];
    
    if (funds.length === 0) {
      res.json({ estimations: [] });
      return;
    }
    
    const estimations = await Promise.all(
      funds.map(async (fund) => {
        const estimation = await fetchFundEstimation(fund.code);
        return {
          ...fund,
          estimation
        };
      })
    );
    
    res.json({ estimations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get portfolio estimation' });
  }
}

export async function getFundEstimation(req: AuthRequest, res: Response): Promise<void> {
  const { code } = req.params;
  
  if (!code) {
    res.status(400).json({ error: 'Fund code is required' });
    return;
  }
  
  try {
    const estimation = await fetchFundEstimation(code);
    
    if (!estimation) {
      res.status(404).json({ error: 'Failed to get fund estimation' });
      return;
    }
    
    res.json({ estimation });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get fund estimation' });
  }
}
