/**
 * 日曜始まり・土曜締め（FiveM 和食さくら 週次サイクル）計算ユーティリティ
 */

export interface WeekPeriod {
  weekKey: string;
  weekLabel: string;
  startDate: string; // ISO
  endDate: string;   // ISO
  isCurrentWeek: boolean;
  isLastWeek: boolean;
}

/**
 * 指定した日付が属する週の日曜日（00:00:00.000）を取得
 */
export function getSunday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 = 日曜日, 6 = 土曜日
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * 指定した日付が属する週の土曜日（23:59:59.999）を取得
 */
export function getSaturday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() + (6 - day));
  date.setHours(23, 59, 59, 999);
  return date;
}

/**
 * 日付フォーマット YYYY-MM-DD
 */
function toYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * ラベルフォーマット 2026/09/06(日) 〜 09/12(土)
 */
export function formatWeekLabel(start: Date, end: Date): string {
  const sYear = start.getFullYear();
  const sMonth = String(start.getMonth() + 1).padStart(2, "0");
  const sDay = String(start.getDate()).padStart(2, "0");

  const eMonth = String(end.getMonth() + 1).padStart(2, "0");
  const eDay = String(end.getDate()).padStart(2, "0");

  return `${sYear}/${sMonth}/${sDay}(日) 〜 ${eMonth}/${eDay}(土)`;
}

/**
 * 直近 N 週分のリストを取得（今週、先週、前々週...）
 */
export function getRecentWeeks(weekCount: number = 8): WeekPeriod[] {
  const now = new Date();
  const currentSunday = getSunday(now);
  const weeks: WeekPeriod[] = [];

  for (let i = 0; i < weekCount; i++) {
    const start = new Date(currentSunday);
    start.setDate(start.getDate() - i * 7);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    const weekKey = `${toYMD(start)}_${toYMD(end)}`;
    const isCurrentWeek = i === 0;
    const isLastWeek = i === 1;

    let weekLabel = formatWeekLabel(start, end);
    if (isCurrentWeek) {
      weekLabel += " 【今週・進行中】";
    } else if (isLastWeek) {
      weekLabel += " 【先週・締め済 (査定週)】";
    }

    weeks.push({
      weekKey,
      weekLabel,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      isCurrentWeek,
      isLastWeek,
    });
  }

  return weeks;
}

/**
 * 指定したISO日時が対象の週の範囲内か判定
 */
export function isDateInWeek(dateStr: string, startIso: string, endIso: string): boolean {
  try {
    const d = new Date(dateStr).getTime();
    const s = new Date(startIso).getTime();
    const e = new Date(endIso).getTime();
    return d >= s && d <= e;
  } catch {
    return false;
  }
}
