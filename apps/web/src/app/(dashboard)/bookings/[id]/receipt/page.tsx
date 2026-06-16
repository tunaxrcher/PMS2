'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Printer, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { bookingsApi, foliosApi } from '@/lib/api'
import { formatDate, formatDateTime, formatCurrency, calcNights } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AppShell } from '@/components/layout/app-shell'
import { Skeleton } from '@/components/ui/skeleton'

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>()

  const { data: booking, isLoading: bookingLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => bookingsApi.get(id).then(r => r.data),
  })

  const folioId = booking?.folios?.[0]?.id

  const { data: folio, isLoading: folioLoading } = useQuery({
    queryKey: ['folio', folioId],
    queryFn: () => foliosApi.get(folioId!).then(r => r.data),
    enabled: !!folioId,
  })

  const { data: summary } = useQuery({
    queryKey: ['folio-summary', folioId],
    queryFn: () => foliosApi.summary(folioId!).then(r => r.data),
    enabled: !!folioId,
  })

  const handlePrint = () => window.print()

  if (bookingLoading || folioLoading) {
    return (
      <AppShell title="ใบเสร็จ">
        <Skeleton className="h-96 w-full rounded-2xl" />
      </AppShell>
    )
  }

  if (!booking || !folio) return null

  const nights = calcNights(booking.checkInDate, booking.checkOutDate)

  return (
    <AppShell
      title="ใบเสร็จ"
      subtitle={`การจอง #${booking.bookingNumber}`}
      headerActions={
        <div className="flex gap-2">
          <Link href={`/bookings/${id}`}>
            <Button variant="secondary" size="sm"><ArrowLeft className="h-4 w-4" /> กลับ</Button>
          </Link>
          <Button onClick={handlePrint}><Printer className="h-4 w-4" /> พิมพ์ใบเสร็จ</Button>
        </div>
      }
    >
      {/* Print area */}
      <div id="receipt-print" className="mx-auto max-w-2xl">
        <div className="rounded-3xl border border-white/15 bg-black/35 backdrop-blur-xl p-8 shadow-[0_24px_80px_rgba(0,0,0,0.55)] print:shadow-none print:bg-white print:text-black print:border-gray-300 print:rounded-none">

          {/* Header */}
          <div className="mb-6 flex flex-col items-center border-b border-white/10 pb-6 print:border-gray-300">
            <div className="relative mb-3 h-10 w-36">
              <Image src="/images/logo.png" alt="Logo" fill className="object-contain" />
            </div>
            <h1 className="text-xl font-bold text-stone-100 print:text-black">Serene Resort & Spa</h1>
            <p className="text-sm text-stone-400 print:text-gray-600">123 ถ.ริมชายหาด จ.สุราษฎร์ธานี 84310</p>
            <p className="text-sm text-stone-400 print:text-gray-600">Tel: 077-123-456</p>
            <div className="mt-4 rounded-xl bg-amber-400/10 border border-amber-300/20 px-6 py-2 print:bg-gray-100 print:border-gray-300">
              <h2 className="text-lg font-bold text-amber-200 print:text-black text-center">ใบเสร็จรับเงิน / RECEIPT</h2>
            </div>
          </div>

          {/* Booking info */}
          <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <span className="text-stone-500 print:text-gray-500 w-28 flex-shrink-0">หมายเลขจอง:</span>
                <span className="font-mono font-semibold text-amber-300 print:text-black">{booking.bookingNumber}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-stone-500 print:text-gray-500 w-28 flex-shrink-0">ชื่อผู้เข้าพัก:</span>
                <span className="font-medium text-stone-100 print:text-black">{booking.guest?.firstName} {booking.guest?.lastName}</span>
              </div>
              {booking.guest?.phone && (
                <div className="flex gap-2">
                  <span className="text-stone-500 print:text-gray-500 w-28 flex-shrink-0">เบอร์โทร:</span>
                  <span className="text-stone-300 print:text-black">{booking.guest.phone}</span>
                </div>
              )}
              {booking.bookingSource && (
                <div className="flex gap-2">
                  <span className="text-stone-500 print:text-gray-500 w-28 flex-shrink-0">ช่องทาง:</span>
                  <span className="text-stone-300 print:text-black">{booking.bookingSource.name}</span>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <span className="text-stone-500 print:text-gray-500 w-24 flex-shrink-0">Check-in:</span>
                <span className="text-stone-100 print:text-black">{formatDate(booking.checkInDate)}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-stone-500 print:text-gray-500 w-24 flex-shrink-0">Check-out:</span>
                <span className="text-stone-100 print:text-black">{formatDate(booking.checkOutDate)}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-stone-500 print:text-gray-500 w-24 flex-shrink-0">จำนวนคืน:</span>
                <span className="text-stone-100 print:text-black">{nights} คืน</span>
              </div>
              <div className="flex gap-2">
                <span className="text-stone-500 print:text-gray-500 w-24 flex-shrink-0">ห้องพัก:</span>
                <span className="text-stone-100 print:text-black">
                  {booking.bookingRooms?.[0]?.room ? `${booking.bookingRooms[0].room.roomNumber}` : booking.bookingRooms?.[0]?.roomType?.name}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-stone-500 print:text-gray-500 w-24 flex-shrink-0">ผู้เข้าพัก:</span>
                <span className="text-stone-100 print:text-black">{booking.adults} ผู้ใหญ่ {booking.children > 0 ? `${booking.children} เด็ก` : ''}</span>
              </div>
            </div>
          </div>

          {/* Charge items */}
          <div className="mb-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500 print:text-gray-500">รายการค่าใช้จ่าย</h3>
            <div className="overflow-hidden rounded-xl border border-white/10 print:border-gray-300">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.04] print:bg-gray-50 print:border-gray-300">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-stone-500 print:text-gray-500">รายการ</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-stone-500 print:text-gray-500">จำนวน</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-stone-500 print:text-gray-500">ราคา/หน่วย</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-stone-500 print:text-gray-500">รวม</th>
                  </tr>
                </thead>
                <tbody>
                  {(folio.items as Array<{ id: string; description: string; quantity: number; unitPrice: number | string; totalAmount: number | string; isVoided?: boolean }> || [])
                    .filter((item: { isVoided?: boolean }) => !item.isVoided)
                    .map((item) => (
                    <tr key={item.id} className="border-b border-white/5 print:border-gray-200">
                      <td className="px-4 py-2.5 text-stone-200 print:text-black">{item.description}</td>
                      <td className="px-4 py-2.5 text-center text-stone-400 print:text-gray-600">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-right text-stone-400 print:text-gray-600">{formatCurrency(Number(item.unitPrice))}</td>
                      <td className={`px-4 py-2.5 text-right font-medium print:text-black ${Number(item.totalAmount) < 0 ? 'text-rose-400' : 'text-stone-100'}`}>
                        {formatCurrency(Number(item.totalAmount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payments */}
          {(folio.payments as Array<{ id: string; paymentMethod: string; amount: number | string; paidAt: string; status: string; referenceNo?: string | null }> || [])
            .filter((p: { status: string }) => ['paid', 'partial_refunded'].includes(p.status)).length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500 print:text-gray-500">การชำระเงิน</h3>
              <div className="space-y-2">
                {(folio.payments as Array<{ id: string; paymentMethod: string; amount: number | string; paidAt: string; status: string; referenceNo?: string | null }>)
                  .filter((p) => ['paid', 'partial_refunded'].includes(p.status))
                  .map(p => {
                    const methodLabel: Record<string, string> = { cash: 'เงินสด', transfer: 'โอนเงิน', credit_card: 'บัตรเครดิต', ota: 'OTA', other: 'อื่นๆ' }
                    return (
                      <div key={p.id} className="flex items-center justify-between rounded-xl bg-emerald-400/[0.07] border border-emerald-300/15 px-4 py-2.5 print:bg-green-50 print:border-green-300">
                        <div>
                          <span className="text-sm text-emerald-300 print:text-green-700 font-medium">{methodLabel[p.paymentMethod] || p.paymentMethod}</span>
                          {p.referenceNo && <span className="ml-2 text-xs text-stone-500 print:text-gray-500">#{p.referenceNo}</span>}
                          <div className="text-xs text-stone-500 print:text-gray-500">{formatDate(p.paidAt, 'dd/MM/yyyy HH:mm')}</div>
                        </div>
                        <span className="font-semibold text-emerald-300 print:text-green-700">{formatCurrency(Number(p.amount))}</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* Deposits */}
          {(folio.deposits as Array<{ id: string; depositType: string; amount: number | string; status: string; paymentMethod: string }> || [])
            .filter((d: { status: string }) => d.status === 'applied').length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500 print:text-gray-500">มัดจำที่นำมาหัก</h3>
              {(folio.deposits as Array<{ id: string; depositType: string; amount: number | string; status: string; paymentMethod: string }>)
                .filter((d) => d.status === 'applied')
                .map(d => (
                  <div key={d.id} className="flex items-center justify-between rounded-xl bg-sky-400/[0.07] border border-sky-300/15 px-4 py-2 print:bg-blue-50 print:border-blue-300">
                    <span className="text-sm text-sky-300 print:text-blue-700">มัดจำ</span>
                    <span className="font-semibold text-sky-300 print:text-blue-700">-{formatCurrency(Number(d.amount))}</span>
                  </div>
                ))}
            </div>
          )}

          {/* Summary */}
          {summary && (
            <div className="rounded-xl border border-amber-300/20 bg-amber-400/[0.07] px-5 py-4 print:bg-yellow-50 print:border-yellow-300">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-stone-300 print:text-gray-700">
                  <span>ยอดรวมทั้งหมด</span>
                  <span>{formatCurrency(summary.totalCharges)}</span>
                </div>
                {summary.totalPayments > 0 && (
                  <div className="flex justify-between text-emerald-400 print:text-green-700">
                    <span>ชำระแล้ว</span>
                    <span>-{formatCurrency(summary.totalPayments)}</span>
                  </div>
                )}
                {summary.totalDepositsApplied > 0 && (
                  <div className="flex justify-between text-sky-400 print:text-blue-700">
                    <span>หักมัดจำ</span>
                    <span>-{formatCurrency(summary.totalDepositsApplied)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-amber-300/20 pt-2 print:border-gray-400">
                  <span className="font-bold text-stone-100 print:text-black text-base">ยอดคงเหลือ</span>
                  <span className={`font-bold text-base print:text-black ${summary.balance > 0.01 ? 'text-amber-300' : 'text-emerald-300'}`}>
                    {formatCurrency(summary.balance)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 border-t border-white/10 pt-4 text-center print:border-gray-200">
            <p className="text-xs text-stone-500 print:text-gray-500">ขอบคุณที่ใช้บริการ Serene Resort & Spa</p>
            <p className="text-xs text-stone-600 print:text-gray-400 mt-1">
              พิมพ์เมื่อ: {formatDateTime(new Date())}
            </p>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          nav, header, .no-print { display: none !important; }
          #receipt-print { margin: 0; padding: 0; }
        }
      `}</style>
    </AppShell>
  )
}
