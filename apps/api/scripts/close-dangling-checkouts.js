/**
 * One-off maintenance script: close "dangling checkout" bookings.
 *
 * A dangling checkout = a booking still `checked_in` whose scheduled checkout has
 * already passed, but whose room(s) have since been physically turned over
 * (currentStatus != 'occupied'). The guest actually left; the front desk simply
 * never pressed "check out", so the folio lingers open (often unpaid).
 *
 * This script closes them HISTORICALLY, without the side effects of the normal
 * checkout flow:
 *   - applies any held deposits
 *   - writes off the remaining balance via a negative folio adjustment line
 *   - closes the folio with closedAt = the scheduled checkout date (backdated)
 *   - sets booking + bookingRooms to checked_out
 *   - does NOT touch room.currentStatus and does NOT create housekeeping tasks
 *   - logs BookingStatusLog + AuditLog for a full audit trail
 *
 * Safety: DRY_RUN is ON by default — it only previews. Set DRY_RUN=false to apply.
 * Idempotent: bookings already checked_out are skipped. Rooms still 'occupied'
 * (genuine overstays) are skipped.
 *
 * Run:  node scripts/close-dangling-checkouts.js            (preview)
 *       DRY_RUN=false node scripts/close-dangling-checkouts.js   (apply)
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const DRY_RUN = process.env.DRY_RUN !== 'false';
// Optional allow-list: only process these booking numbers (comma-separated).
const ONLY = (process.env.ONLY || '').split(',').map(s => s.trim()).filter(Boolean);

function folioBalance(folio) {
  const charges = folio.items.filter(i => !i.isVoided).reduce((s, i) => s + Number(i.totalAmount), 0);
  const payments = folio.payments
    .filter(pm => pm.status === 'paid' || pm.status === 'partial_refunded')
    .reduce((s, pm) => s + Number(pm.amount) - (pm.refunds?.reduce((rs, r) => rs + Number(r.amount), 0) || 0), 0);
  const deposits = folio.deposits
    .filter(d => d.status === 'applied' || d.status === 'held')
    .reduce((s, d) => s + Number(d.amount), 0);
  return { charges, payments, deposits, balance: charges - payments - deposits };
}

(async () => {
  console.log(`\n=== close-dangling-checkouts (${DRY_RUN ? 'DRY RUN — no changes' : 'APPLY — writing changes'}) ===\n`);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const targetDate = new Date(todayStr);

  // Actor for *_by / userId columns (audit trail attribution).
  const actor = await p.user.findFirst({ where: { active: true }, orderBy: { createdAt: 'asc' } });
  if (!actor) { console.error('No active user found for audit attribution. Aborting.'); process.exit(1); }
  console.log(`Actor (audit): ${actor.firstName} ${actor.lastName} (${actor.id})\n`);

  // Candidate bookings: checked_in, scheduled checkout already passed.
  const candidates = await p.booking.findMany({
    where: { status: 'checked_in', checkOutDate: { lt: targetDate } },
    include: {
      bookingRooms: { include: { room: { select: { roomNumber: true, currentStatus: true, active: true } } } },
      folios: {
        include: {
          items: true,
          payments: { include: { refunds: true } },
          deposits: true,
        },
      },
    },
    orderBy: { checkOutDate: 'asc' },
  });

  let closed = 0, skippedOverstay = 0, totalWriteOff = 0;

  for (const b of candidates) {
    const rooms = b.bookingRooms.map(br => br.room?.roomNumber ?? '(none)').join(',');
    // Genuine overstay vs dangling-behind-a-new-guest.
    // A room still 'occupied' AND active normally means the guest is physically
    // in-house (genuine overstay) — leave it for manual handling. A soft-deleted
    // (inactive) room no longer represents real occupancy, so its lingering booking
    // is dangling and gets closed.
    // EXCEPTION: if a DIFFERENT active booking currently occupies that same room
    // *today*, this booking's guest must have already left (a new guest took the
    // room), so it is definitely a dangling checkout — close it, don't skip.
    let genuineOverstay = false;
    for (const br of b.bookingRooms) {
      if (!br.roomId || !(br.room?.active && br.room?.currentStatus === 'occupied')) continue;
      const otherCoversToday = await p.bookingRoom.count({
        where: {
          roomId: br.roomId,
          bookingId: { not: b.id },
          status: { notIn: ['cancelled', 'no_show', 'checked_out'] },
          checkInDate: { lte: targetDate },
          checkOutDate: { gt: targetDate },
          booking: { status: { notIn: ['cancelled', 'no_show', 'checked_out'] } },
        },
      });
      if (otherCoversToday === 0) { genuineOverstay = true; break; }
    }
    if (genuineOverstay) {
      skippedOverstay++;
      console.log(`SKIP  ${b.bookingNumber} rooms=${rooms} — room still 'occupied' with no newer guest (genuine overstay, needs manual handling)`);
      continue;
    }

    const folio = b.folios[0];
    const bal = folio ? folioBalance(folio) : { charges: 0, payments: 0, deposits: 0, balance: 0 };
    const heldDeposits = folio ? folio.deposits.filter(d => d.status === 'held') : [];
    const coStr = b.checkOutDate.toISOString().slice(0, 10);
    const writeOff = Math.max(0, bal.balance);
    totalWriteOff += writeOff;

    console.log(
      `CLOSE ${b.bookingNumber} rooms=${rooms} co=${coStr} | charges=${bal.charges} paid=${bal.payments} dep=${bal.deposits} | heldDep=${heldDeposits.length} | write-off=${writeOff.toFixed(2)}`
    );

    if (DRY_RUN) { closed++; continue; }

    await p.$transaction(async (tx) => {
      if (folio) {
        for (const d of heldDeposits) {
          await tx.deposit.update({ where: { id: d.id }, data: { status: 'applied' } });
        }
        if (writeOff > 0.01) {
          await tx.folioItem.create({
            data: {
              folioId: folio.id,
              itemType: 'write_off',
              description: `ตัดหนี้ (write-off) — ปิดการเข้าพักย้อนหลัง (ครบกำหนด ${coStr})`,
              quantity: 1,
              unitPrice: -writeOff,
              totalAmount: -writeOff,
              serviceDate: b.checkOutDate,
              createdBy: actor.id,
            },
          });
        }
        await tx.folio.update({
          where: { id: folio.id },
          data: { status: 'closed', closedAt: b.checkOutDate },
        });
      }

      await tx.booking.update({ where: { id: b.id }, data: { status: 'checked_out' } });
      await tx.bookingRoom.updateMany({
        where: { bookingId: b.id, status: { notIn: ['cancelled', 'no_show', 'checked_out'] } },
        data: { status: 'checked_out' },
      });

      await tx.bookingStatusLog.create({
        data: {
          bookingId: b.id,
          oldStatus: 'checked_in',
          newStatus: 'checked_out',
          changedBy: actor.id,
          remark: `ปิดย้อนหลังผ่านสคริปต์ (dangling checkout) — ครบกำหนด ${coStr}${writeOff > 0.01 ? `, ตัดหนี้ ฿${writeOff.toFixed(2)}` : ''}`,
        },
      });

      await tx.auditLog.create({
        data: {
          propertyId: b.propertyId,
          userId: actor.id,
          action: 'CHECK_OUT_HISTORICAL',
          entityType: 'booking',
          entityId: b.id,
          oldValueJson: { status: 'checked_in', folioBalance: bal.balance },
          newValueJson: { status: 'checked_out', closedAt: coStr, writeOff, note: 'dangling checkout cleanup' },
        },
      });
    });

    closed++;
  }

  console.log(`\n--- Summary ---`);
  console.log(`${DRY_RUN ? 'Would close' : 'Closed'}: ${closed} booking(s)`);
  console.log(`Skipped (genuine overstay, room occupied): ${skippedOverstay}`);
  console.log(`Total write-off: ฿${totalWriteOff.toFixed(2)}`);
  if (DRY_RUN) console.log(`\n(DRY RUN — nothing was changed. Re-run with DRY_RUN=false to apply.)`);
  await p.$disconnect();
})();
