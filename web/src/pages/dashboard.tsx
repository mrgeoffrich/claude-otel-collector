import { useEffect, useState } from "react";
import {
  getDashboardStats,
  getTokenUsage,
  getCostData,
  type DashboardStats,
  type TokenUsageBucket,
  type CostData,
} from "@/lib/api";
import { formatTokens, formatDuration, formatPercent } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#0088FE"];

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground font-normal">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tokenData, setTokenData] = useState<TokenUsageBucket[]>([]);
  const [costData, setCostData] = useState<CostData | null>(null);
  const [hours] = useState(24);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getDashboardStats(hours),
      getTokenUsage(hours),
      getCostData(hours),
    ])
      .then(([s, t, c]) => {
        setStats(s);
        setTokenData(t);
        setCostData(c);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [hours]);

  if (loading) {
    return <div className="text-muted-foreground">Loading dashboard...</div>;
  }

  if (!stats) {
    return <div className="text-muted-foreground">Failed to load dashboard data</div>;
  }

  const modelPieData = costData
    ? Object.entries(costData.modelDistribution).map(
        ([model, { count }]) => ({
          name: model,
          value: count,
        }),
      )
    : [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard (Last {hours}h)</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="Total Tokens"
          value={formatTokens(
            stats.totalInputTokens +
              stats.totalOutputTokens +
              stats.totalCacheReadTokens,
          )}
          subtitle={`${formatTokens(stats.totalInputTokens)} in / ${formatTokens(stats.totalOutputTokens)} out`}
        />
        <StatCard
          title="LLM Spans"
          value={String(stats.spans)}
          subtitle={`${stats.failedSpans} failed, ${stats.sessions} sessions`}
        />
        <StatCard
          title="Cache Hit Rate"
          value={formatPercent(stats.cacheHitRate)}
          subtitle={`${formatTokens(stats.totalCacheReadTokens)} cached`}
        />
        <StatCard
          title="Avg TTFT"
          value={stats.avgTtftMs != null ? formatDuration(stats.avgTtftMs) : "-"}
          subtitle={stats.avgDurationMs != null ? `Avg duration: ${formatDuration(stats.avgDurationMs)}` : undefined}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        {/* Token usage over time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Token Usage Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {tokenData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={tokenData}>
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(v) =>
                      new Date(v).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    }
                    fontSize={12}
                  />
                  <YAxis
                    tickFormatter={(v) => formatTokens(v)}
                    fontSize={12}
                  />
                  <Tooltip
                    formatter={(v) => Number(v).toLocaleString()}
                    labelFormatter={(v) => new Date(v).toLocaleString()}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="inputTokens"
                    stackId="1"
                    fill="#8884d8"
                    stroke="#8884d8"
                    name="Input"
                  />
                  <Area
                    type="monotone"
                    dataKey="outputTokens"
                    stackId="1"
                    fill="#82ca9d"
                    stroke="#82ca9d"
                    name="Output"
                  />
                  <Area
                    type="monotone"
                    dataKey="cacheReadTokens"
                    stackId="1"
                    fill="#ffc658"
                    stroke="#ffc658"
                    name="Cache Read"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                No data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Model distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Model Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {modelPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={modelPieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name} (${value})`}
                  >
                    {modelPieData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={COLORS[i % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                No data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
