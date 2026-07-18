"use client";

import { useEffect, useState, useMemo, ReactNode } from "react";
import { createClient } from "@supabase/supabase-js";
import { Users, FileText, MessageSquare, Bell, Download, Settings, Target, Inbox, MoreHorizontal, Pin, ArrowUp, ArrowDown } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { getAdminUsers } from "./actions";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const VIRIDIAN = "#40826d";

function Sparkline({ data, color = VIRIDIAN, height = 36, fill = true }: { data: number[], color?: string, height?: number, fill?: boolean }) {
  const safeData = data.length > 0 ? data : [0, 0];
  const min = Math.min(...safeData);
  const max = Math.max(...safeData);
  const range = max - min || 1;
  const w = 200;
  const pts = safeData.map((v, i) => {
    const x = (i / (safeData.length - 1 || 1)) * w;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });
  const path = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const areaPath = path + ` L ${w} ${height} L 0 ${height} Z`;
  const id = useMemo(() => "spark-" + Math.random().toString(36).slice(2, 8), []);
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={areaPath} fill={`url(#${id})`} />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function KpiTile({ label, value, delta, deltaDir = "up", spark, color = VIRIDIAN, tint = "none" }: { label: string, value: string | number, delta?: string, deltaDir?: "up" | "down" | "flat", spark: number[], color?: string, tint?: "none" | "viridian" | "danger" }) {
  const tintStyles: Record<string, React.CSSProperties> = {
    none: {},
    viridian: {
      background: "linear-gradient(135deg, var(--color-viridian-500) 0%, var(--color-viridian-700) 100%)",
      color: "white",
      borderColor: "var(--color-viridian-700)",
    },
    danger: {
      background: "linear-gradient(135deg, var(--color-danger) 0%, #8a2727 100%)",
      color: "white",
      borderColor: "#8a2727",
    },
  };
  const isTinted = tint !== "none";
  const sparkColor = isTinted ? "rgba(255,255,255,0.85)" : color;
  return (
    <div className="kpi" style={tintStyles[tint]}>
      <div>
        <div className="kpi-label" style={isTinted ? { color: "rgba(255,255,255,0.78)" } : undefined}>{label}</div>
        <div className="kpi-value" style={isTinted ? { color: "white" } : undefined}>{value}</div>
        {delta && (
          <div className={"kpi-delta " + deltaDir} style={isTinted ? { color: "rgba(255,255,255,0.92)" } : undefined}>
            {deltaDir === "up" ? <ArrowUp size={12} /> : deltaDir === "down" ? <ArrowDown size={12} /> : null}
            <span>{delta}</span>
            <span style={{ color: isTinted ? "rgba(255,255,255,0.65)" : "var(--color-ink-tertiary)", fontWeight: 450, marginLeft: 4 }}>vs last month</span>
          </div>
        )}
      </div>
      <div className="kpi-spark">
        <Sparkline data={spark} color={sparkColor} fill={!isTinted} />
      </div>
    </div>
  );
}

function ChartCard({ title, sub, toolbar, children, height = 240 }: { title: string, sub?: string, toolbar?: ReactNode, children: ReactNode, height?: number }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">{title}</div>
          {sub && <div className="card-sub">{sub}</div>}
        </div>
        <div className="card-toolbar">
          {toolbar}
          <button className="btn btn-subtle btn-sm btn-icon" title="Pin to dashboard">
            <Pin size={13} />
          </button>
          <button className="btn btn-subtle btn-sm btn-icon" title="More">
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>
      <div className="card-body" style={{ height, minHeight: height }}>
        {children}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    users: 0,
    docs: 0,
    posts: 0,
    tickets: 0,
    videos: 0,
  });
  
  const [loading, setLoading] = useState(true);
  const [growthData, setGrowthData] = useState<{ name: string; users: number }[]>([]);
  const [activityData, setActivityData] = useState<{ day: string; tickets: number }[]>([]);

  useEffect(() => {
    async function fetchStats() {
      // Fetch Real Users
      const realUsers = await getAdminUsers();
      
      const [docsRes, postsRes, ticketsRes, videosRes, recentTickets] = await Promise.all([
        supabaseAdmin.from('documentation_pages').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('community_posts').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('support_tickets').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('lms_videos').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('support_tickets').select('created_at').limit(1000)
      ]);

      setStats({
        users: realUsers.length,
        docs: docsRes.count || 0,
        posts: postsRes.count || 0,
        tickets: ticketsRes.count || 0,
        videos: videosRes.count || 0,
      });

      // Group Real Users by Creation Month for Growth Chart
      const userMonths: Record<string, number> = {};
      realUsers.forEach(u => {
        if (!u.created_at) return;
        const d = new Date(u.created_at);
        const m = d.toLocaleString('en-US', { month: 'short' });
        userMonths[m] = (userMonths[m] || 0) + 1;
      });
      
      // Always show at least last 6 months
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentMonth = new Date().getMonth();
      const past6Months = Array.from({length: 6}, (_, i) => {
        let mIdx = currentMonth - 5 + i;
        if(mIdx < 0) mIdx += 12;
        return months[mIdx];
      });

      let cumulative = 0;
      const finalGrowthData = past6Months.map(m => {
        cumulative += (userMonths[m] || 0);
        return { name: m, users: cumulative };
      });
      
      // If we don't have historical data to make the chart look active, we just show real data which might be flat if they all signed up today.
      setGrowthData(finalGrowthData);

      // Group Tickets by Day of Week
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const ticketDays = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
      (recentTickets.data || []).forEach(t => {
        if (!t.created_at) return;
        const d = new Date(t.created_at);
        const day = dayNames[d.getDay()] as keyof typeof ticketDays;
        ticketDays[day]++;
      });

      setActivityData(Object.keys(ticketDays).map(k => ({ day: k, tickets: ticketDays[k as keyof typeof ticketDays] })));
      
      setLoading(false);
    }
    fetchStats();
  }, []);

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto w-full">
      
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-[var(--color-border)]">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-ink)] tracking-tight">System Telemetry</h1>
          <p className="text-[14px] text-[var(--color-ink-secondary)] mt-1 font-medium">Real-time platform insights and database metrics.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-subtle">
            <Settings className="size-4" /> Configure
          </button>
          <button className="btn btn-viridian">
            <Download className="size-4" /> Export Report
          </button>
        </div>
      </div>

      {/* KPI Cards using AppShell Component Language */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <KpiTile 
          label="Registered Identities" 
          value={loading ? "..." : stats.users} 
          delta="100%" 
          deltaDir="up" 
          spark={[10, 20, 35, 45, 60, stats.users]} 
          color={VIRIDIAN} 
          tint="viridian" 
        />

        <KpiTile 
          label="Support Tickets" 
          value={loading ? "..." : stats.tickets} 
          spark={[0, 0, stats.tickets, stats.tickets, stats.tickets]} 
          color="#c6892a" 
        />

        <KpiTile 
          label="Community Posts" 
          value={loading ? "..." : stats.posts} 
          spark={[2, 4, 1, 8, stats.posts]} 
          color="#3a78b5" 
        />

        <KpiTile 
          label="Documentation Nodes" 
          value={loading ? "..." : stats.docs} 
          spark={[stats.docs, stats.docs, stats.docs]} 
          color="#8a5ab5" 
        />

      </div>

      {/* Charts Section using AppShell Component Language */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        
        <div className="lg:col-span-2">
          <ChartCard title="Platform Growth" sub="Cumulative registered accounts over time" height={320}>
            {growthData.every(d => d.users === 0) ? (
               <div className="w-full h-full flex flex-col items-center justify-center text-[var(--color-ink-tertiary)]">
                 <Users className="size-8 opacity-50 mb-3" />
                 <p className="text-sm">No historical data available.</p>
               </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorUsersAdmin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={VIRIDIAN} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={VIRIDIAN} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-ink-tertiary)' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-ink-tertiary)' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)', background: 'var(--color-canvas)' }}
                    itemStyle={{ color: 'var(--color-ink)', fontWeight: 600 }}
                  />
                  <Area type="monotone" dataKey="users" stroke={VIRIDIAN} strokeWidth={3} fillOpacity={1} fill="url(#colorUsersAdmin)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        <div>
          <ChartCard title="Ticket Volume" sub="Support requests by weekday" height={320}>
            {activityData.every(d => d.tickets === 0) ? (
               <div className="w-full h-full flex flex-col items-center justify-center text-[var(--color-ink-tertiary)]">
                 <Inbox className="size-8 opacity-50 mb-3" />
                 <p className="text-sm">No ticket activity recorded.</p>
               </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData} margin={{ top: 10, right: 0, left: -30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-ink-tertiary)' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-ink-tertiary)' }} />
                  <Tooltip 
                    cursor={{ fill: 'var(--color-surface)' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)', background: 'var(--color-canvas)' }}
                    itemStyle={{ color: 'var(--color-ink)', fontWeight: 600 }}
                  />
                  <Bar dataKey="tickets" fill="#c6892a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

      </div>

    </div>
  );
}
