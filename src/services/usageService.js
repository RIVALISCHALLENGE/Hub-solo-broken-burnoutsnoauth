// UsageService.js
// Service to fetch usage analytics for admin dashboard
import { db } from "../firebase.js";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";

export const UsageService = {
  // Fetch daily active users for the last N days
  async getDAU(days = 14) {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - days + 1);
    const startTimestamp = Timestamp.fromDate(start);
    const q = query(collection(db, "user_activity"), where("date", ">=", startTimestamp));
    const snapshot = await getDocs(q);
    // Aggregate by day
    const counts = {};
    snapshot.forEach(doc => {
      const d = doc.data();
      const day = d.date?.toDate().toISOString().slice(0, 10);
      if (day) counts[day] = (counts[day] || 0) + 1;
    });
    // Fill missing days
    const result = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      result.push({ date: key, count: counts[key] || 0 });
    }
    return result;
  },

  // Fetch monthly active users for the last N months
  async getMAU(months = 6) {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth() - months + 1, 1);
    const startTimestamp = Timestamp.fromDate(start);
    const q = query(collection(db, "user_activity"), where("date", ">=", startTimestamp));
    const snapshot = await getDocs(q);
    // Aggregate by month
    const counts = {};
    snapshot.forEach(doc => {
      const d = doc.data();
      const date = d.date?.toDate();
      if (date) {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        if (!counts[key]) counts[key] = new Set();
        counts[key].add(d.userId);
      }
    });
    // Fill missing months
    const result = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      result.push({ month: key, count: counts[key] ? counts[key].size : 0 });
    }
    return result;
  },

  // Fetch retention rates (day 1, 7, 30)
  async getRetention() {
    // This is a placeholder for a real retention calculation
    // You would need to track user signups and their activity on subsequent days
    // For now, return an empty array
    return [];
  },

  // Fetch average/median session lengths (in minutes)
  async getSessionLengths() {
    // This is a placeholder for a real session length calculation
    // You would need to track session start/end times in user_activity or a sessions collection
    // For now, return an empty array
    return [];
  },

  // Fetch top games and top users
  async getTopGamesAndUsers() {
    // This is a placeholder for a real top games/users calculation
    // You would need to aggregate from leaderboard or activity data
    // For now, return empty arrays
    return { topGames: [], topUsers: [] };
  },
};
