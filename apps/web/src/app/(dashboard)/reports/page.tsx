'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, TrendingUp, BedDouble, Ticket, Sparkles, Shield, RefreshCw, Filter } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { format, subDays } from 'date-fns'
import { th } from 'date-fns/locale'
import { AppShell } from '@/components/layout/app-shell'
import { GlassPanel } from '@/components/ui/glass-panel'
import { StatCard } from '@/components/ui/stat-card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { reportsApi, auditLogsApi } from '@/lib/api'
import { useState as useLocalState } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

const COLORS = ['#fbbf24', '#60a5fa', '#34d399', '#f87171', '#a78bfa', '#fb923c']

const TABS = [
  { id: 'revenue', label: 'รายได้', icon: TrendingUp },
  { id: 'occupancy', label: 'Occupancy', icon: BedDouble },
  { id: 'sources', label: 'ช่องทางการจอง', icon: Ticket },
  { id: 'housekeeping', label: 'แม่บ้าน', icon: Sparkles },
  { id: 'audit', label: 'Audit Log', icon: Shield },
]

export default function ReportsPage() {
  const { isAdmin } = useAuth()
  const today = format(new Date(), 'yyyy-MM-dd')
  const [activeTab, setActiveTab] = useState('revenue')
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(today)
  const [auditPage, setAuditPage] = useState(1)
  const [auditAction, setAuditAction] = useState('')
  const [auditSearch, setAuditSearch] = useState('')

  const { data: revenueData, isLoading: revLoading } = useQuery({
    queryKey: ['report-revenue', dateFrom, dateTo],
    queryFn: () => reportsApi.dailyRevenue({ from: dateFrom, to: dateTo }).then(r => r.data),
    enabled: activeTab === 'revenue',
  })

  const { data: occupancy, isLoading: occLoading } = useQuery({
    queryKey: ['report-occupancy', today],
    queryFn: () => reportsApi.occupancy(today).then(r => r.data),
    enabled: activeTab === 'occupancy',
  })

  const { data: sources, isLoading: srcLoading } = useQuery({
    queryKey: ['report-sources', dateFrom, dateTo],
    queryFn: () => reportsApi.bookingSources(dateFrom, dateTo).then(r => r.data),
    enabled: activeTab === 'sources',
  })

  const { data: hkData, isLoading: hkLoading } = useQuery({
    queryKey: ['report-hk', today],
    queryFn: () => reportsApi.housekeeping(today).then(r => r.data),
    enabled: activeTab === 'housekeeping',
  })

  const { data: auditData, isLoading: auditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ['audit-logs', dateFrom, dateTo, auditAction, auditSearch, auditPage],
    queryFn: () => auditLogsApi.list({
      from: dateFrom, to: dateTo,
      action: auditAction || undefined,
      userId: auditSearch || undefined,
      page: auditPage, limit: 30,
    }).then(r => r.data),
    enabled: activeTab === 'audit' && isAdmin,
    staleTime: 30_000,
  })

  const { data: auditActions } = useQuery({
    queryKey: ['audit-actions'],
    queryFn: () => auditLogsApi.getActions().then(r => r.data),
    enabled: activeTab === 'audit' && isAdmin,
    staleTime: 300_000,
  })

  const totalRevenue = Array.isArray(revenueData) ? revenueData.reduce((sum: number, d: { totalNet: number }) => sum + (d.totalNet || 0), 0) : 0

  return (
    <AppShell title="รายงาน" subtitle="วิเคราะห์ข้อมูลธุรกิจ">
      <div className="space-y-5">
        {/* Date range picker */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-stone-400">
            <span>จาก</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 rounded-lg border border-white/15 bg-black/25 px-2 text-sm text-stone-100 focus:border-amber-300/40 focus:outline-none" />
            <span>ถึง</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 rounded-lg border border-white/15 bg-black/25 px-2 text-sm text-stone-100 focus:border-amber-300/40 focus:outline-none" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
          {TABS.filter(t => t.id !== 'audit' || isAdmin).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn('flex items-center gap-2 flex-shrink-0 rounded-xl px-3 py-2 text-sm font-medium transition-all', activeTab === tab.id ? 'bg-amber-400/15 text-amber-200 border border-amber-300/20' : 'text-stone-500 hover:text-stone-300')}>
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Revenue Tab */}
        {activeTab === 'revenue' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <StatCard label="รายได้รวม (หลังหัก Refund)" value={formatCurrency(totalRevenue)} icon={TrendingUp} variant="amber" />
              <StatCard label="จำนวนวัน" value={Array.isArray(revenueData) ? revenueData.length : 0} subtext="ช่วงที่เลือก" icon={BarChart3} />
              <StatCard label="รายได้เฉลี่ย/วัน" value={formatCurrency(Array.isArray(revenueData) && revenueData.length ? totalRevenue / revenueData.length : 0)} icon={TrendingUp} variant="emerald" />
            </div>
            {revLoading ? <Skeleton className="h-64 rounded-2xl" /> : Array.isArray(revenueData) && revenueData.length > 0 ? (
              <GlassPanel dense padding="md">
                <h3 className="mb-4 text-sm font-semibold text-stone-200">รายได้รายวัน</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={(revenueData as Array<{ date: string; totalNet: number; totalGross: number }>).map(d => ({ date: format(new Date(d.date), 'dd/MM', { locale: th }), net: Math.round(d.totalNet), gross: Math.round(d.totalGross) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: '#78716c', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#78716c', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12 }} formatter={(v) => formatCurrency(Number(v))} />
                    <Bar dataKey="net" fill="#fbbf24" radius={[4, 4, 0, 0]} name="รายได้สุทธิ" />
                  </BarChart>
                </ResponsiveContainer>
              </GlassPanel>
            ) : <EmptyState icon={TrendingUp} title="ไม่มีข้อมูลรายได้" />}
          </div>
        )}

        {/* Occupancy Tab */}
        {activeTab === 'occupancy' && (
          <div className="space-y-5">
            {occLoading ? <Skeleton className="h-48 rounded-2xl" /> : occupancy ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                <StatCard label="ห้องทั้งหมด" value={occupancy.totalRooms} icon={BedDouble} />
                <StatCard label="มีผู้เข้าพัก" value={occupancy.occupied} icon={BedDouble} variant="rose" />
                <StatCard label="จองแล้ว" value={occupancy.reserved ?? 0} icon={BedDouble} variant="sky" />
                <StatCard label="ห้องว่าง" value={occupancy.available} icon={BedDouble} variant="emerald" />
                <StatCard label="Occupancy" value={`${occupancy.occupancyPct}%`} icon={BarChart3} variant="amber" />
              </div>
            ) : null}
            {occupancy && (
              <GlassPanel dense padding="md" className="flex items-center justify-center">
                <PieChart width={300} height={200}>
                  <Pie data={[
                    { name: 'เข้าพัก', value: occupancy.occupied },
                    { name: 'จองแล้ว', value: occupancy.reserved ?? 0 },
                    { name: 'ว่าง', value: occupancy.available },
                    { name: 'OOO', value: occupancy.outOfOrder },
                  ].filter(d => d.value > 0)} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {[occupancy.occupied, occupancy.reserved ?? 0, occupancy.available, occupancy.outOfOrder].filter(v => v > 0).map((_: number, i: number) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12 }} />
                </PieChart>
              </GlassPanel>
            )}
          </div>
        )}

        {/* Sources Tab */}
        {activeTab === 'sources' && (
          <div className="space-y-4">
            {srcLoading ? <Skeleton className="h-64 rounded-2xl" /> : Array.isArray(sources) && sources.length > 0 ? (
              <GlassPanel dense padding="md">
                <h3 className="mb-4 text-sm font-semibold text-stone-200">ช่องทางการจอง</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    {(sources as Array<{ sourceId: string; name: string; count: number; revenue: number }>).map((s, i) => (
                      <div key={s.sourceId} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-sm text-stone-300">{s.name}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-stone-200">{s.count} การจอง</div>
                          <div className="text-xs text-stone-500">{formatCurrency(s.revenue)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={(sources as Array<{ name: string; count: number }>).map(s => ({ name: s.name, value: s.count }))} cx="50%" cy="50%" outerRadius={70} dataKey="value">
                        {(sources as Array<{ name: string }>).map((_: { name: string }, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12 }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </GlassPanel>
            ) : <EmptyState icon={Ticket} title="ไม่มีข้อมูล" />}
          </div>
        )}

        {/* Housekeeping Tab */}
        {activeTab === 'housekeeping' && (
          <div className="space-y-4">
            {hkLoading ? <Skeleton className="h-48 rounded-2xl" /> : hkData ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatCard label="งานทั้งหมด" value={hkData.total} icon={Sparkles} />
                <StatCard label="รอดำเนินการ" value={hkData.pending} icon={Sparkles} variant="amber" />
                <StatCard label="กำลังทำ" value={hkData.inProgress} icon={Sparkles} variant="sky" />
                <StatCard label="เสร็จแล้ว" value={hkData.done} icon={Sparkles} variant="emerald" />
              </div>
            ) : null}
          </div>
        )}

        {/* Audit Log Tab */}
        {activeTab === 'audit' && isAdmin && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <select value={auditAction} onChange={e => { setAuditAction(e.target.value); setAuditPage(1) }}
                className="h-8 rounded-lg border border-white/15 bg-black/25 px-3 text-sm text-stone-300 focus:border-amber-300/40 focus:outline-none">
                <option value="">ทุก Action</option>
                {(auditActions as string[] || []).map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <button onClick={() => refetchAudit()}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-white/15 bg-white/[0.06] text-stone-400 hover:text-stone-100 hover:bg-white/[0.10] transition-colors text-sm">
                <RefreshCw className="h-3.5 w-3.5" /> รีเฟรช
              </button>
              {auditData?.total !== undefined && (
                <span className="text-xs text-stone-500">ทั้งหมด {auditData.total} รายการ</span>
              )}
            </div>

            <GlassPanel dense padding="none">
              {auditLoading ? (
                <div className="p-4 space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : !(auditData?.logs?.length) ? (
                <div className="flex flex-col items-center gap-2 py-10 text-stone-500">
                  <Shield className="h-8 w-8 opacity-30" />
                  <p className="text-sm">ไม่มี audit log ในช่วงวันที่เลือก</p>
                  <p className="text-xs text-stone-600">ลองขยายช่วงวันที่หรือเลือก Action อื่น</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/[0.03]">
                          <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-stone-500">เวลา</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Action</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-stone-500">ผู้ดำเนินการ</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Entity</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-stone-500">IP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(auditData.logs as Array<{
                          id: string; createdAt: string; action: string; entityType: string
                          entityId?: string | null; ipAddress?: string | null
                          user?: { firstName: string; lastName: string } | null
                        }>).map(log => {
                          const actionColors: Record<string, string> = {
                            LOGIN: 'text-emerald-400', LOGOUT: 'text-stone-400',
                            CHECK_IN: 'text-sky-400', CHECK_OUT: 'text-amber-400',
                            BOOKING_CREATE: 'text-violet-400', BOOKING_CANCEL: 'text-rose-400',
                            PAYMENT_RECEIVE: 'text-emerald-400', PAYMENT_VOID: 'text-rose-400',
                            PAYMENT_REFUND: 'text-violet-400', CHANGE_PIN: 'text-amber-400',
                          }
                          const color = actionColors[log.action] || 'text-stone-400'
                          return (
                            <tr key={log.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                              <td className="px-4 py-2.5 whitespace-nowrap text-xs text-stone-500 font-mono">
                                {formatDate(log.createdAt, 'dd/MM/yy HH:mm:ss')}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs font-medium font-mono ${color}`}>
                                  {log.action}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-stone-300 text-xs">
                                {log.user ? `${log.user.firstName} ${log.user.lastName}` : '-'}
                              </td>
                              <td className="px-4 py-2.5 text-stone-400 text-xs">
                                {log.entityType}
                                {log.entityId && <span className="ml-1 font-mono text-stone-600">#{log.entityId.slice(0, 8)}</span>}
                              </td>
                              <td className="px-4 py-2.5 text-stone-600 text-xs font-mono">{log.ipAddress || '-'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {auditData.total > 30 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
                      <span className="text-xs text-stone-500">
                        หน้า {auditPage} / {Math.ceil(auditData.total / 30)}
                      </span>
                      <div className="flex gap-2">
                        <button disabled={auditPage === 1} onClick={() => setAuditPage(p => p - 1)}
                          className="px-3 py-1 rounded-lg border border-white/15 text-xs text-stone-400 hover:bg-white/[0.06] disabled:opacity-40 transition-colors">
                          ← ก่อนหน้า
                        </button>
                        <button disabled={auditPage * 30 >= auditData.total} onClick={() => setAuditPage(p => p + 1)}
                          className="px-3 py-1 rounded-lg border border-white/15 text-xs text-stone-400 hover:bg-white/[0.06] disabled:opacity-40 transition-colors">
                          ถัดไป →
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </GlassPanel>
          </div>
        )}
      </div>
    </AppShell>
  )
}
