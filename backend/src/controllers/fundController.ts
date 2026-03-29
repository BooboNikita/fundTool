import { Response } from 'express';
import axios from 'axios';
import db from '../models/database';
import { AuthRequest } from '../types/express';
import { FundEstimation, FundSearchResult } from '../types';

const FUND_NAME_URL = 'https://fund.eastmoney.com/js/fundcode_search.js';
const FUND_ESTIMATE_URL = 'http://fundgz.1234567.com.cn/js';

const JSONPGZ_RE = /jsonpgz\(\s*(\{.*?\})\s*\)\s*;?\s*$/;

interface FundInfo {
  code: string;
  name: string;
  type: string;
}

let fundInfoCache: Map<string, FundInfo> | null = null;
let cacheTime: number = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000;

async function getFundInfoMap(): Promise<Map<string, FundInfo>> {
  const now = Date.now();
  if (fundInfoCache && now - cacheTime < CACHE_TTL) {
    return fundInfoCache;
  }

  try {
    const response = await axios.get(FUND_NAME_URL, {
      responseType: 'arraybuffer',
      timeout: 15000
    });
    
    const content = response.data.toString('utf-8');
    const map = new Map<string, FundInfo>();
    
    const fundArrayMatch = content.match(/\[([\s\S]*)\]/);
    if (fundArrayMatch) {
      const fundItems = fundArrayMatch[1].match(/\["[^"]+","[^"]+","[^"]+","[^"]+","[^"]+"\]/g);
      if (fundItems) {
        for (const item of fundItems) {
          const parts = item.match(/"([^"]+)"/g);
          if (parts && parts.length >= 4) {
            const code = parts[0].replace(/"/g, '');
            const name = parts[2].replace(/"/g, '');
            const type = parts[3].replace(/"/g, '');
            map.set(code, { code, name, type });
          }
        }
      }
    }
    
    fundInfoCache = map;
    cacheTime = now;
    console.log(`Loaded ${map.size} funds`);
    return map;
  } catch (error) {
    console.error('Failed to fetch fund names:', error);
    return fundInfoCache || new Map();
  }
}

export async function searchFund(req: AuthRequest, res: Response): Promise<void> {
  const { keyword, limit = 50 } = req.query;
  
  if (!keyword || typeof keyword !== 'string') {
    res.status(400).json({ error: 'Keyword is required' });
    return;
  }

  try {
    const fundMap = await getFundInfoMap();
    const results: FundSearchResult[] = [];
    const keywordLower = keyword.toLowerCase();
    const limitNum = parseInt(limit as string) || 50;
    
    for (const [, info] of fundMap) {
      if (info.code.includes(keyword) || info.name.toLowerCase().includes(keywordLower)) {
        results.push({ code: info.code, name: info.name, type: info.type });
        if (results.length >= limitNum) break;
      }
    }
    
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: 'Failed to search funds' });
  }
}

export async function getAllFunds(req: AuthRequest, res: Response): Promise<void> {
  const { page = 1, limit = 100 } = req.query;
  
  try {
    const fundMap = await getFundInfoMap();
    const allFunds = Array.from(fundMap.values());
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 100;
    const start = (pageNum - 1) * limitNum;
    const end = start + limitNum;
    
    const results = allFunds.slice(start, end);
    
    res.json({ 
      results,
      total: allFunds.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(allFunds.length / limitNum)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get funds' });
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
  const { code, note = '', is_watchlist = true, is_holding = false } = req.body;
  
  if (!code) {
    res.status(400).json({ error: 'Fund code is required' });
    return;
  }

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const fundMap = await getFundInfoMap();
    const fundInfo = fundMap.get(code);
    const fundName = fundInfo?.name || code;
    
    const [result] = await db.execute(
      'INSERT INTO funds (user_id, code, name, note, is_watchlist, is_holding) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, code, fundName, note, is_watchlist ? 1 : 0, is_holding ? 1 : 0]
    );
    
    const insertId = (result as any).insertId;
    
    res.status(201).json({
      message: 'Fund added successfully',
      fund: {
        id: insertId,
        code,
        name: fundName,
        note,
        is_watchlist: !!is_watchlist,
        is_holding: !!is_holding
      }
    });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Fund already exists in your portfolio' });
    } else {
      console.error('Add fund error:', error);
      res.status(500).json({ error: 'Failed to add fund' });
    }
  }
}

export async function updateFundFlags(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  const { code } = req.params;
  const { is_watchlist, is_holding } = req.body;
  
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  
  try {
    const [result] = await db.execute(
      'UPDATE funds SET is_watchlist = ?, is_holding = ? WHERE user_id = ? AND code = ?',
      [is_watchlist ? 1 : 0, is_holding ? 1 : 0, userId, code]
    );
    
    if ((result as any).affectedRows === 0) {
      res.status(404).json({ error: 'Fund not found in your portfolio' });
      return;
    }
    
    res.json({ message: 'Fund flags updated successfully' });
  } catch (error) {
    console.error('Update fund flags error:', error);
    res.status(500).json({ error: 'Failed to update fund flags' });
  }
}

export async function removeFund(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  const { code } = req.params;
  
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  
  try {
    const [result] = await db.execute(
      'DELETE FROM funds WHERE user_id = ? AND code = ?',
      [userId, code]
    );
    
    if ((result as any).affectedRows === 0) {
      res.status(404).json({ error: 'Fund not found in your portfolio' });
      return;
    }
    
    res.json({ message: 'Fund removed successfully' });
  } catch (error) {
    console.error('Remove fund error:', error);
    res.status(500).json({ error: 'Failed to remove fund' });
  }
}

export async function getPortfolio(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  const { filter } = req.query;
  
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  
  try {
    let query = 'SELECT id, code, name, note, is_watchlist, is_holding, created_at FROM funds WHERE user_id = ?';
    const params: any[] = [userId];
    
    if (filter === 'watchlist') {
      query += ' AND is_watchlist = TRUE';
    } else if (filter === 'holding') {
      query += ' AND is_holding = TRUE';
    }
    
    query += ' ORDER BY created_at DESC';
    
    const [rows] = await db.execute(query, params);
    
    res.json({ funds: rows });
  } catch (error) {
    console.error('Get portfolio error:', error);
    res.status(500).json({ error: 'Failed to get portfolio' });
  }
}

export async function getPortfolioEstimation(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  const { filter } = req.query;
  
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  
  try {
    let query = 'SELECT id, code, name, note, is_watchlist, is_holding FROM funds WHERE user_id = ?';
    const params: any[] = [userId];
    
    if (filter === 'watchlist') {
      query += ' AND is_watchlist = TRUE';
    } else if (filter === 'holding') {
      query += ' AND is_holding = TRUE';
    }
    
    query += ' ORDER BY created_at DESC';
    
    const [rows] = await db.execute(query, params);
    const funds = rows as any[];
    
    if (funds.length === 0) {
      res.json({ estimations: [] });
      return;
    }
    
    const estimations = await Promise.all(
      funds.map(async (fund) => {
        const estimation = await fetchFundEstimation(fund.code);
        return {
          ...fund,
          is_watchlist: !!fund.is_watchlist,
          is_holding: !!fund.is_holding,
          estimation
        };
      })
    );
    
    res.json({ estimations });
  } catch (error) {
    console.error('Get portfolio estimation error:', error);
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
    console.error('Get fund estimation error:', error);
    res.status(500).json({ error: 'Failed to get fund estimation' });
  }
}
