/**
 * OnSync Logic Utilities
 * Ported from original React Native logic for React Web
 */

/**
 * Calculates D-Day string from a start date
 */
export const getDDay = (startDateStr) => {
  if (!startDateStr) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startObj = new Date(startDateStr);
  startObj.setHours(0, 0, 0, 0);
  const diffTime = startObj - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "D-Day";
  if (diffDays > 0) return `D-${diffDays}`;
  return `D+${Math.abs(diffDays)}`;
};

/**
 * Calculates current production day (e.g., 2nd day)
 */
export const getDayNumber = (dateStr, projectStartDate) => {
  if (!projectStartDate || !dateStr) return null;
  const start = new Date(projectStartDate);
  start.setHours(0, 0, 0, 0);
  const current = new Date(dateStr);
  current.setHours(0, 0, 0, 0);
  const diffTime = current - start;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1;
};

/**
 * Formats a JS Date object to YYYY-MM-DD
 */
export const formatDate = (date) => {
  if (!date) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Calculates total inclusive days between two dates
 */
export const calculateTotalDays = (start, end) => {
  if (!start || !end) return 0;
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  
  if (endDay < startDay) return 0;
  
  const diffTime = Math.abs(endDay - startDay);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};
