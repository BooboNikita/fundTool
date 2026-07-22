import axios from "axios";
import { FundEstimation } from "../types";

const FUND_VALUATION_LAST_URL =
  "https://fundcomapi.tiantianfunds.com/mm/newCore/FundValuationLast";

const FUND_VALUATION_LAST_FIELDS = "FCODE,SHORTNAME,GSZZL,GZTIME,GSZ,NAV,PDATE";
const FUND_VALUATION_LAST_BATCH_SIZE = 50;
const FUND_VALUATION_LAST_TIMEOUT_MS = 8000;

interface FundValuationLastResolver {
  promise: Promise<FundEstimation>;
  resolve: (value: FundEstimation) => void;
  reject: (reason?: any) => void;
}

const fundValuationLastInflight = new Map<string, FundValuationLastResolver>();
const fundValuationLastQueue = new Set<string>();
let fundValuationLastTimer: NodeJS.Timeout | null = null;

function normalizeEstimateGrowthRate(gszzl: any): string {
  if (gszzl == null) return "";
  const str = String(gszzl).trim();
  if (!str) return "";
  if (str.endsWith("%")) return str;
  return `${str}%`;
}

function mapFundValuationToEstimation(item: any): FundEstimation | null {
  const code = item.FCODE != null ? String(item.FCODE).trim() : "";
  if (!code) return null;

  return {
    code,
    fund_code: code,
    name: item.SHORTNAME != null ? String(item.SHORTNAME) : "",
    net_value_date: item.PDATE != null ? String(item.PDATE) : "",
    net_value: item.NAV != null ? String(item.NAV) : "",
    estimate_net_value: item.GSZ != null ? String(item.GSZ) : "",
    estimate_growth_rate: normalizeEstimateGrowthRate(item.GSZZL),
    estimate_time:
      item.GZTIME != null
        ? String(item.GZTIME).replace(/:(\d{2}):\d{2}$/, ":$1")
        : "",
  };
}

async function processFundValuationLastQueue() {
  if (fundValuationLastQueue.size === 0) return;

  const currentQueue = Array.from(fundValuationLastQueue);
  fundValuationLastQueue.clear();
  fundValuationLastTimer = null;

  const chunks: string[][] = [];
  for (
    let i = 0;
    i < currentQueue.length;
    i += FUND_VALUATION_LAST_BATCH_SIZE
  ) {
    chunks.push(currentQueue.slice(i, i + FUND_VALUATION_LAST_BATCH_SIZE));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const url = `${FUND_VALUATION_LAST_URL}?FCODES=${encodeURIComponent(
          chunk.join(",")
        )}&FIELDS=${encodeURIComponent(FUND_VALUATION_LAST_FIELDS)}`;
        const response = await axios.get(url, {
          timeout: FUND_VALUATION_LAST_TIMEOUT_MS,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Referer: "https://fundcomapi.tiantianfunds.com/",
          },
        });
        const json = response.data;
        if (!json?.success) {
          throw new Error("FundValuationLast API returned failure");
        }
        const items = Array.isArray(json.data) ? json.data : [];
        const foundMap = new Map<string, FundEstimation>();
        for (const item of items) {
          const estimation = mapFundValuationToEstimation(item);
          if (estimation) {
            foundMap.set(estimation.code, estimation);
          }
        }

        for (const code of chunk) {
          const resolver = fundValuationLastInflight.get(code);
          if (!resolver) continue;
          const val = foundMap.get(code);
          if (val) {
            resolver.resolve(val);
          } else {
            resolver.reject(new Error(`FundValuationLast no data for ${code}`));
          }
          fundValuationLastInflight.delete(code);
        }
      } catch (error) {
        for (const code of chunk) {
          const resolver = fundValuationLastInflight.get(code);
          if (!resolver) continue;
          resolver.reject(error);
          fundValuationLastInflight.delete(code);
        }
      }
    })
  );
}

function fetchFundValuationLastBatched(
  fundCode: string
): Promise<FundEstimation> {
  const code = fundCode != null ? String(fundCode).trim() : "";
  if (!code) return Promise.reject(new Error("基金编码无效"));

  const existing = fundValuationLastInflight.get(code);
  if (existing) {
    return existing.promise;
  }

  let resolveFn: (value: FundEstimation) => void;
  let rejectFn: (reason?: any) => void;
  const promise = new Promise<FundEstimation>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });
  fundValuationLastInflight.set(code, {
    promise,
    resolve: resolveFn!,
    reject: rejectFn!,
  });

  fundValuationLastQueue.add(code);

  if (fundValuationLastQueue.size > 0 && !fundValuationLastTimer) {
    fundValuationLastTimer = setTimeout(processFundValuationLastQueue, 0);
  }

  return promise;
}

export async function fetchFundEstimation(
  fundCode: string
): Promise<FundEstimation | null> {
  try {
    return await fetchFundValuationLastBatched(fundCode);
  } catch (error) {
    console.error(`Failed to fetch estimation for ${fundCode}:`, error);
    return null;
  }
}

export async function fetchFundEstimations(
  fundCodes: string[]
): Promise<Map<string, FundEstimation>> {
  const uniqueCodes = [
    ...new Set(fundCodes.map((c) => String(c).trim()).filter(Boolean)),
  ];
  const results = await Promise.all(
    uniqueCodes.map((code) =>
      fetchFundValuationLastBatched(code).catch(() => null)
    )
  );
  const map = new Map<string, FundEstimation>();
  results.forEach((estimation, index) => {
    if (estimation) {
      map.set(uniqueCodes[index], estimation);
    }
  });
  return map;
}
