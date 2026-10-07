// Example numbers for the landing page's product preview. The real
// dashboard reads from the API (see components/dashboard/dashboard-content).

export const dashboardStats = {
  activeAlerts: 2,
  openIncidents: 4,
  // Pre-formatted for display, plus the raw seconds the dashboard's
  // target-comparison indicator needs (see lib/constants.ts). The API will
  // return seconds only — formatting happens once analytics/summary
  // (day 49) is wired up, same as the display strings below.
  mtta: "4m 12s",
  mttaSeconds: 4 * 60 + 12,
  mttr: "38m",
  mttrSeconds: 38 * 60,
  // Percent change against the previous 7 days. Negative means it went
  // down, which is the good direction for every one of these numbers.
  trends: {
    activeAlerts: -40,
    openIncidents: -20,
    mtta: -32,
    mttr: 12,
  },
};

export type OnCallEntry = {
  team: string;
  user: string;
  until: string;
};

export const onCallNow: OnCallEntry[] = [
  { team: "Platform Team", user: "Priyanshu Maurya", until: "Mon 10:00" },
  { team: "Payments Team", user: "Sneha Kapoor", until: "Mon 10:00" },
  { team: "Infrastructure", user: "Rahul Verma", until: "Tue 09:00" },
  { team: "Customer Support", user: "Aman Gupta", until: "Wed 18:00" },
];
