/**
 * OutboundDashboard — métricas agregadas dos disparos da IA SDR.
 *
 * Renderizado como tab "Pinn WhatsApp" dentro do Pinn SDR.
 *
 * Cards: KPIs grandes (sent, responded, reply rate, scheduled)
 * Charts: timeseries 30d (recharts), funil, comparação por touch
 * Tabelas: top campanhas, distribuição por instância, atividade recente
 */
import { useMemo } from "react";
import {
  Box, Card, CardContent, Chip, CircularProgress, Stack,
  Table, TableBody, TableCell, TableHead, TableRow,
  Typography, alpha,
} from "@mui/material";
import {
  AccessTime as ClockIcon, CheckCircle as CheckIcon,
  ChatBubble as ChatIcon, Send as SendIcon, TrendingUp as TrendIcon,
  WhatsApp as WhatsAppIcon,
} from "@mui/icons-material";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip as ReTooltip, XAxis, YAxis,
} from "recharts";

import { useWhatsAppDashboard } from "../hooks/useDashboard";
import type {
  AnalyticsCampaignRow, AnalyticsInstanceRow, AnalyticsRecentRow,
} from "../types";

// Identidade Pinn — laranja principal em todos os gráficos/KPIs.
// O verde fica reservado pro ícone do WhatsApp em si (marca alheia).
const ORANGE = "#F97316";
const ORANGE_SOFT = "#FED7AA";
const WHATSAPP_GREEN = "#25D366";  // só pro ícone

export function OutboundDashboard() {
  const { data, isLoading, error } = useWhatsAppDashboard(30);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }
  if (error || !data) {
    return (
      <Card>
        <CardContent>
          <Typography color="error">
            Falha ao carregar métricas: {(error as Error)?.message ?? "sem dados"}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack spacing={3}>
      {/* ═════════ KPI Cards ═════════ */}
      <Box sx={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 2,
      }}>
        <KpiCard
          icon={<SendIcon />}
          label="Mensagens enviadas"
          value={data.overview.total_sent}
          sub={`Últimos ${data.period_days}d`}
          color={ORANGE}
        />
        <KpiCard
          icon={<ChatIcon />}
          label="Respostas recebidas"
          value={data.overview.total_responded}
          sub="Lead engajou com a Mari"
          color="#3b82f6"
        />
        <KpiCard
          icon={<TrendIcon />}
          label="Taxa de resposta"
          value={`${data.overview.reply_rate_pct.toFixed(1)}%`}
          sub="Respondidos ÷ enviados"
          color="#0ea5e9"
        />
        <KpiCard
          icon={<CheckIcon />}
          label="Reuniões marcadas"
          value={data.overview.total_scheduled}
          sub="Lead virou meeting"
          color="#8b5cf6"
        />
      </Box>

      {/* ═════════ Timeseries (volume diário) ═════════ */}
      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Volume por dia — últimos {data.period_days} dias
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Disparos vs respostas. Picos mostram melhores momentos de campanha.
              </Typography>
            </Box>
          </Stack>
          <Box sx={{ width: "100%", height: 240 }}>
            {data.timeseries.length === 0 ? (
              <EmptyMini text="Sem dados no período" />
            ) : (
              <ResponsiveContainer>
                <AreaChart data={data.timeseries}>
                  <defs>
                    <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ORANGE} stopOpacity={0.7} />
                      <stop offset="100%" stopColor={ORANGE} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={alpha("#000", 0.06)} />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(v) => {
                      try {
                        return new Date(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
                      } catch { return v; }
                    }}
                    fontSize={12}
                  />
                  <YAxis fontSize={12} allowDecimals={false} />
                  <ReTooltip
                    labelFormatter={(v) => new Date(v).toLocaleDateString("pt-BR")}
                    formatter={(v: number) => v.toLocaleString("pt-BR")}
                  />
                  <Area
                    type="monotone" dataKey="sent" name="Enviadas"
                    stroke={ORANGE} strokeWidth={2} fill="url(#sentGrad)"
                  />
                  <Area
                    type="monotone" dataKey="responded" name="Respondidas"
                    stroke="#3b82f6" strokeWidth={2} fill="#3b82f6"
                    fillOpacity={0.15}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* ═════════ By touch + By instance (lado a lado) ═════════ */}
      <Box sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        gap: 3,
      }}>
        {/* Performance por touch */}
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={700} mb={0.5}>
              Performance por touch
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" mb={2}>
              Reply rate por D0/D2/D5/D9. Identifica qual touch convém repensar.
            </Typography>
            <Box sx={{ width: "100%", height: 220 }}>
              {data.by_touch.length === 0 ? (
                <EmptyMini text="Sem dados por touch ainda" />
              ) : (
                <ResponsiveContainer>
                  <BarChart data={data.by_touch.map(t => ({
                    label: `D${t.touch_index === 0 ? 0 : (t.touch_index === 1 ? 2 : t.touch_index === 2 ? 5 : 9)}`,
                    sent: t.sent,
                    responded: t.responded,
                    reply_rate: t.reply_rate_pct,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke={alpha("#000", 0.06)} />
                    <XAxis dataKey="label" fontSize={12} />
                    <YAxis fontSize={12} allowDecimals={false} />
                    <ReTooltip />
                    <Bar dataKey="sent" name="Enviadas" fill={ORANGE_SOFT} stroke={ORANGE} strokeWidth={1} />
                    <Bar dataKey="responded" name="Respondidas" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Box>
          </CardContent>
        </Card>

        {/* Distribuição por instância */}
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={700} mb={0.5}>
              Por número WhatsApp
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" mb={2}>
              Distribuição de envios + reply rate por instância Evolution.
            </Typography>
            {data.by_instance.length === 0 ? (
              <EmptyMini text="Nenhum envio ainda" />
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Número</TableCell>
                    <TableCell align="right">Sent</TableCell>
                    <TableCell align="right">Reply</TableCell>
                    <TableCell align="right">%</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.by_instance.map((i: AnalyticsInstanceRow) => (
                    <TableRow key={i.instance} hover>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <WhatsAppIcon sx={{ fontSize: 16, color: WHATSAPP_GREEN }} />
                          <Typography variant="body2">{i.instance}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell align="right">{i.sent}</TableCell>
                      <TableCell align="right">{i.responded}</TableCell>
                      <TableCell align="right">
                        <Chip
                          size="small"
                          label={`${i.reply_rate_pct.toFixed(1)}%`}
                          color={i.reply_rate_pct > 5 ? "success"
                              : i.reply_rate_pct > 1 ? "default" : "warning"}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* ═════════ Top campanhas ═════════ */}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={700} mb={0.5}>
            Top campanhas
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" mb={2}>
            Ranking pelas que mais dispararam nos últimos {data.period_days} dias.
          </Typography>
          {data.by_campaign.length === 0 ? (
            <EmptyMini text="Nenhuma campanha com dispatch ainda" />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Campanha</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Enrolled</TableCell>
                  <TableCell align="right">Sent</TableCell>
                  <TableCell align="right">Respondidos</TableCell>
                  <TableCell align="right">Reply rate</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.by_campaign.map((c: AnalyticsCampaignRow) => (
                  <TableRow key={c.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{c.name}</Typography>
                    </TableCell>
                    <TableCell><Chip size="small" label={c.status} /></TableCell>
                    <TableCell align="right">{c.leads_enrolled}</TableCell>
                    <TableCell align="right">{c.sent}</TableCell>
                    <TableCell align="right">{c.responded}</TableCell>
                    <TableCell align="right">
                      <Chip
                        size="small"
                        label={`${c.reply_rate_pct.toFixed(1)}%`}
                        color={c.reply_rate_pct > 5 ? "success"
                            : c.reply_rate_pct > 1 ? "default" : "warning"}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ═════════ Atividade recente ═════════ */}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={700} mb={0.5}>
            Atividade recente
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" mb={2}>
            Últimos 20 disparos da Mari.
          </Typography>
          {data.recent.length === 0 ? (
            <EmptyMini text="Sem disparos ainda" />
          ) : (
            <Box sx={{ maxHeight: 360, overflow: "auto" }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Quando</TableCell>
                    <TableCell>Lead (phone)</TableCell>
                    <TableCell>Campanha</TableCell>
                    <TableCell>Touch</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.recent.map((r: AnalyticsRecentRow) => (
                    <TableRow key={r.id} hover>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <ClockIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                          <Typography variant="caption">{formatTimeAgo(r.sent_at)}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>
                        {r.phone}
                      </TableCell>
                      <TableCell>{r.campaign_name}</TableCell>
                      <TableCell>D{r.touch_index === 0 ? 0 : (r.touch_index === 1 ? 2 : r.touch_index === 2 ? 5 : 9)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={r.status}
                          color={r.status === "sent" ? "success"
                              : r.status === "responded" ? "info" : "default"}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

// ────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub: string;
  color: string;
}) {
  return (
    <Card sx={{
      borderLeft: 4,
      borderLeftColor: color,
      transition: "transform 0.15s",
      "&:hover": { transform: "translateY(-2px)" },
    }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{
            width: 40, height: 40, borderRadius: 1.5,
            bgcolor: alpha(color, 0.12),
            color,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {icon}
          </Box>
          <Box flex={1}>
            <Typography variant="caption" color="text.secondary" sx={{
              textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600,
            }}>
              {label}
            </Typography>
            <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.2 }}>
              {value}
            </Typography>
            <Typography variant="caption" color="text.secondary">{sub}</Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function EmptyMini({ text }: { text: string }) {
  return (
    <Box sx={{
      height: "100%", minHeight: 120, display: "flex",
      alignItems: "center", justifyContent: "center",
    }}>
      <Typography variant="caption" color="text.secondary">{text}</Typography>
    </Box>
  );
}

function formatTimeAgo(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
