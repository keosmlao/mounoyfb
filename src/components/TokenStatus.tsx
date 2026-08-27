import { Badge } from "@/components/ui";
import { formatAgo, formatTimeLao } from "@/lib/date";
import {
  TOKEN_EXPIRY_WARN_DAYS,
  tokenDaysLeft,
  type TokenState,
} from "@/lib/sync-health";

/**
 * ບອກວ່າ token ຍັງໃຊ້ໄດ້ບໍ່ ແລະ ຈະໝົດອາຍຸເມື່ອໃດ.
 *
 * ຄ່າມາຈາກຮອບກວດເບື້ອງຫຼັງ (ທຸກໆ 6 ຊົ່ວໂມງ) ບໍ່ໄດ້ຖາມ Facebook ຕອນເປີດໜ້າ —
 * ຈຶ່ງບອກເວລາທີ່ກວດຄັ້ງຫຼ້າສຸດໄວ້ນຳ ບໍ່ໃຫ້ຄົນເຂົ້າໃຈຜິດວ່າເປັນຄ່າສົດ.
 */
export function TokenStatus({ state }: { state: TokenState }) {
  const expiresAt = state.expiresAt;
  const daysLeft = tokenDaysLeft(state);

  let tone = "neutral";
  let label = "ຍັງບໍ່ໄດ້ກວດ";
  let detail = "ຈະກວດເອງພາຍໃນບໍ່ດົນ ຫຼື ກົດ “ທົດສອບການເຊື່ອມຕໍ່” ຂ້າງເທິງ";

  if (state.valid === false) {
    tone = "danger";
    label = "ໃຊ້ບໍ່ໄດ້ແລ້ວ";
    detail = state.error ?? "Facebook ປະຕິເສດ token ນີ້";
  } else if (state.valid === true) {
    if (!expiresAt) {
      tone = "success";
      label = "ໃຊ້ໄດ້";
      detail = "ບໍ່ມີວັນໝົດອາຍຸ (token ຂອງ system user)";
    } else if (daysLeft !== null) {
      if (daysLeft <= 0) {
        tone = "danger";
        label = "ໝົດອາຍຸແລ້ວ";
        detail = `ໝົດຕັ້ງແຕ່ ${formatTimeLao(expiresAt)}`;
      } else {
        const soon = daysLeft <= TOKEN_EXPIRY_WARN_DAYS;
        tone = soon ? "warning" : "success";
        label = soon ? `ຈະໝົດໃນ ${daysLeft} ວັນ` : "ໃຊ້ໄດ້";
        detail = `ໝົດອາຍຸ ${formatTimeLao(expiresAt)} (ອີກ ${daysLeft} ວັນ)`;
      }
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--border)] px-4 py-3">
      <span className="text-sm font-medium">ສະຖານະ token</span>
      <Badge tone={tone}>{label}</Badge>
      {/* ຈໍແຄບ: ຄຳອະທິບາຍລົງແຖວໃໝ່ເຕັມແຖວ ບໍ່ໃຫ້ບີບປ້າຍຈົນອ່ານບໍ່ອອກ */}
      <p className="w-full text-xs text-[var(--fg-muted)] sm:w-auto sm:flex-1">
        {detail}
      </p>
      {state.checkedAt ? (
        <span className="w-full text-xs text-[var(--fg-subtle)] sm:w-auto">
          ກວດຫຼ້າສຸດ {formatAgo(state.checkedAt)}
        </span>
      ) : null}
    </div>
  );
}
