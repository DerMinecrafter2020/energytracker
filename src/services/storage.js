import { fetchLogs, createLog, deleteLog as deleteApiLog } from './api';

export const fetchTodayLogs = async (date, userIdentity = {}) => {
  return fetchLogs(date, userIdentity);
};

export const addLog = async (logData) => {
  return createLog(logData);
};

export const removeLog = async (logId) => {
  return deleteApiLog(logId);
};
