import { Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import db from '../models/database';
import { AuthRequest } from '../types/express';
import { DingTalkConfig } from '../types';

const FUND_ESTIMATE_URL = 'http://fundgz.1234567.com.cn/js';
const JSONPGZ_RE = /jsonpgz\(\s*(\{.*?\})\s*\)\s*;?\s*$/;

interface DingTalkConfigFull {
  id: number;
  user_id: number;
  webhook_url: string;
  secret: string;
  push_times: string | string[];
  push_interval_hours: number;
  push_enabled: boolean;
  push_watchlist: boolean;
  push_holding: boolean;
  last_push_time: string | null;
}

async function fetchFundEstimation(fundCode: string): Promise<any> {
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
      name: payload.name,
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

function generateSign(secret: string, timestamp: string): string {
  const stringToSign = `${timestamp}\n${secret}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(stringToSign);
  return encodeURIComponent(hmac.digest('base64'));
}

async function sendDingTalkMessage(webhookUrl: string, secret: string, message: string): Promise<boolean> {
  try {
    const timestamp = Date.now().toString();
    const sign = secret ? generateSign(secret, timestamp) : '';
    
    const url = sign 
      ? `${webhookUrl}&timestamp=${timestamp}&sign=${sign}`
      : webhookUrl;
    
    await axios.post(url, {
      msgtype: 'markdown',
      markdown: {
        title: '基金净值日报',
        text: message
      }
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return true;
  } catch (error) {
    console.error('Failed to send DingTalk message:', error);
    return false;
  }
}

function parsePushTimes(pushTimes: string | string[] | null): string[] {
  if (!pushTimes) return [];
  if (Array.isArray(pushTimes)) return pushTimes;
  try {
    return JSON.parse(pushTimes);
  } catch {
    return [];
  }
}

function formatTableMessage(estimations: any[], categories: { watchlist: any[], holding: any[] }): string {
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  let message = `## 📊 基金净值日报\n> ${now}\n\n`;
  
  if (categories.watchlist.length > 0) {
    message += `### 🔖 自选基金\n\n`;
    message += `| 基金名称 | 基金代码 | 估算净值 | 估算涨幅 |\n`;
    message += `|:---------|:---------|:---------|:---------|\n`;
    
    categories.watchlist.forEach(est => {
      const rate = est.estimate_growth_rate;
      const rateNum = rate !== '--' ? parseFloat(rate.replace('%', '')) : 0;
      const rateText = rateNum >= 0 ? `+${rate}` : rate;
      const rateColor = rateNum >= 0 ? '🟢' : (rateNum < 0 ? '🔴' : '⚪');
      message += `| ${est.name} | ${est.code} | ${est.estimate_net_value} | ${rateColor} ${rateText} |\n`;
    });
    message += `\n共 ${categories.watchlist.length} 只\n\n`;
  }
  
  if (categories.holding.length > 0) {
    message += `### 💰 持有基金\n\n`;
    message += `| 基金名称 | 基金代码 | 估算净值 | 估算涨幅 |\n`;
    message += `|:---------|:---------|:---------|:---------|\n`;
    
    categories.holding.forEach(est => {
      const rate = est.estimate_growth_rate;
      const rateNum = rate !== '--' ? parseFloat(rate.replace('%', '')) : 0;
      const rateText = rateNum >= 0 ? `+${rate}` : rate;
      const rateColor = rateNum >= 0 ? '🟢' : (rateNum < 0 ? '🔴' : '⚪');
      message += `| ${est.name} | ${est.code} | ${est.estimate_net_value} | ${rateColor} ${rateText} |\n`;
    });
    message += `\n共 ${categories.holding.length} 只\n\n`;
  }
  
  const total = estimations.length;
  message += `---\n> 共计 ${total} 只基金`;
  
  return message;
}

async function doPushForUser(config: DingTalkConfigFull): Promise<boolean> {
  try {
    let query = 'SELECT code, name, is_watchlist, is_holding FROM funds WHERE user_id = ? AND (';
    const params: any[] = [config.user_id];
    
    const conditions: string[] = [];
    if (config.push_watchlist) {
      conditions.push('is_watchlist = TRUE');
    }
    if (config.push_holding) {
      conditions.push('is_holding = TRUE');
    }
    
    if (conditions.length === 0) return false;
    
    query += conditions.join(' OR ') + ')';
    
    const [fundRows] = await db.execute(query, params);
    const funds = fundRows as any[];
    
    if (funds.length === 0) return false;
    
    const estimations = await Promise.all(
      funds.map(async (fund) => {
        const estimation = await fetchFundEstimation(fund.code);
        return {
          code: fund.code,
          name: estimation?.name || fund.name,
          is_watchlist: fund.is_watchlist,
          is_holding: fund.is_holding,
          estimate_net_value: estimation?.estimate_net_value || '--',
          estimate_growth_rate: estimation?.estimate_growth_rate || '--'
        };
      })
    );
    
    const categories = {
      watchlist: config.push_watchlist ? estimations.filter(e => e.is_watchlist) : [],
      holding: config.push_holding ? estimations.filter(e => e.is_holding) : []
    };
    
    const message = formatTableMessage(estimations, categories);
    const success = await sendDingTalkMessage(config.webhook_url, config.secret || '', message);
    
    if (success) {
      await db.execute(
        'UPDATE dingtalk_config SET last_push_time = NOW() WHERE user_id = ?',
        [config.user_id]
      );
    }
    
    return success;
  } catch (error) {
    console.error(`Error pushing for user ${config.user_id}:`, error);
    return false;
  }
}

export async function getDingTalkConfig(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  
  try {
    const [rows] = await db.execute(
      'SELECT id, webhook_url, secret, push_times, push_interval_hours, push_enabled, push_watchlist, push_holding, last_push_time FROM dingtalk_config WHERE user_id = ?',
      [userId]
    );
    
    const configs = rows as DingTalkConfigFull[];
    if (configs.length === 0) {
      res.json({ config: null });
      return;
    }
    
    const config = configs[0];
    const pushTimes = parsePushTimes(config.push_times);
    
    res.json({
      config: {
        webhook_url: config.webhook_url,
        secret: config.secret ? '******' : '',
        push_times: pushTimes,
        push_interval_hours: config.push_interval_hours,
        push_enabled: config.push_enabled,
        push_watchlist: config.push_watchlist,
        push_holding: config.push_holding
      }
    });
  } catch (error) {
    console.error('Get DingTalk config error:', error);
    res.status(500).json({ error: 'Failed to get DingTalk config' });
  }
}

export async function saveDingTalkConfig(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  const { webhook_url, secret, push_times, push_interval_hours, push_enabled, push_watchlist, push_holding } = req.body;
  
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  
  if (!webhook_url) {
    res.status(400).json({ error: 'Webhook URL is required' });
    return;
  }
  
  const timesJson = JSON.stringify(push_times || ['09:00']);
  const interval = push_interval_hours || 0;
  
  try {
    await db.execute(
      `INSERT INTO dingtalk_config (user_id, webhook_url, secret, push_times, push_interval_hours, push_enabled, push_watchlist, push_holding) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
       webhook_url = VALUES(webhook_url), 
       secret = VALUES(secret), 
       push_times = VALUES(push_times), 
       push_interval_hours = VALUES(push_interval_hours),
       push_enabled = VALUES(push_enabled),
       push_watchlist = VALUES(push_watchlist),
       push_holding = VALUES(push_holding)`,
      [userId, webhook_url, secret || '', timesJson, interval, push_enabled ? 1 : 0, push_watchlist ? 1 : 0, push_holding ? 1 : 0]
    );
    
    res.json({ message: 'DingTalk config saved successfully' });
  } catch (error) {
    console.error('Save DingTalk config error:', error);
    res.status(500).json({ error: 'Failed to save DingTalk config' });
  }
}

export async function testDingTalkPush(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  const { webhook_url, secret } = req.body;
  
  if (!webhook_url) {
    res.status(400).json({ error: 'Webhook URL is required' });
    return;
  }
  
  try {
    const message = `## 🔔 钉钉推送测试成功！

> 基金净值监控服务运行正常

### 测试表格

| 项目 | 状态 |
|:-----|:-----|
| 服务状态 | 🟢 正常 |
| 推送功能 | 🟢 可用 |
| 消息格式 | 🟢 Markdown |
`;
    const success = await sendDingTalkMessage(webhook_url, secret || '', message);
    
    if (success) {
      res.json({ message: 'Test message sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send test message' });
    }
  } catch (error) {
    console.error('Test DingTalk push error:', error);
    res.status(500).json({ error: 'Failed to send test message' });
  }
}

export async function pushFundEstimations(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  
  try {
    const [configRows] = await db.execute(
      'SELECT id, webhook_url, secret, push_times, push_interval_hours, push_enabled, push_watchlist, push_holding, last_push_time FROM dingtalk_config WHERE user_id = ?',
      [userId]
    );
    
    const configs = configRows as DingTalkConfigFull[];
    if (configs.length === 0 || !configs[0].push_enabled) {
      res.status(400).json({ error: 'Push is not enabled' });
      return;
    }
    
    const success = await doPushForUser(configs[0]);
    
    if (success) {
      res.json({ message: 'Push sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send push' });
    }
  } catch (error) {
    console.error('Push fund estimations error:', error);
    res.status(500).json({ error: 'Failed to push fund estimations' });
  }
}

let schedulerInterval: NodeJS.Timeout | null = null;

function isWithinTradingHours(): boolean {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  
  if (day === 0 || day === 6) {
    return false;
  }
  
  const currentMinutes = hour * 60 + minute;
  const startMinutes = 9 * 60 + 30;
  const endMinutes = 15 * 60;
  
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

export async function startScheduler(): Promise<void> {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }
  
  const checkAndPush = async () => {
    try {
      const [configRows] = await db.execute(
        'SELECT user_id, webhook_url, secret, push_times, push_interval_hours, push_enabled, push_watchlist, push_holding, last_push_time FROM dingtalk_config WHERE push_enabled = TRUE'
      );
      
      const configs = configRows as DingTalkConfigFull[];
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
      
      for (const config of configs) {
        const pushTimes = parsePushTimes(config.push_times);
        const intervalHours = config.push_interval_hours || 0;
        
        let shouldPush = false;
        
        if (intervalHours > 0 && config.last_push_time) {
          const lastPush = new Date(config.last_push_time);
          const hoursSinceLastPush = (now.getTime() - lastPush.getTime()) / (1000 * 60 * 60);
          if (hoursSinceLastPush >= intervalHours && isWithinTradingHours()) {
            shouldPush = true;
          }
        } else if (pushTimes.includes(currentTime)) {
          shouldPush = true;
        }
        
        if (shouldPush) {
          console.log(`Triggering push for user ${config.user_id}`);
          await doPushForUser(config);
        }
      }
    } catch (error) {
      console.error('Scheduler error:', error);
    }
  };
  
  schedulerInterval = setInterval(checkAndPush, 60000);
  console.log('DingTalk push scheduler started');
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('DingTalk push scheduler stopped');
  }
}
