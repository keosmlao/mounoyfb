import { Badge, Card, CardHeader, EmptyState, Field } from "@/components/ui";
import { SubmitButton, DeleteButton } from "@/components/SubmitButton";
import { formatTimeLao } from "@/lib/date";
import {
  createUser,
  setUserActive,
  setUserPassword,
  setUserRole,
} from "@/app/(app)/settings/users-actions";
import { UserRole } from "@/generated/prisma/enums";

export type UserRow = {
  id: string;
  name: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  lastLoginAt: Date | null;
};

const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "ຜູ້ດູແລລະບົບ",
  MEMBER: "ຜູ້ໃຊ້ທົ່ວໄປ",
};

/**
 * ຈັດການຜູ້ໃຊ້.
 *
 * ຍັງບໍ່ມີຈັກຄົນ = ລະບົບໃຊ້ລະຫັດຜ່ານດຽວຮ່ວມກັນຢູ່ ຈຶ່ງບອກໃຫ້ຮູ້ຊັດ
 * ວ່າພໍສ້າງຄົນທຳອິດແລ້ວ ວິທີເຂົ້າລະບົບຈະປ່ຽນ — ບໍ່ດັ່ງນັ້ນຄົນຈະງຶດ
 * ວ່າເປັນຫຍັງລະຫັດເກົ່າໃຊ້ບໍ່ໄດ້ແລ້ວ.
 */
export function UserAdmin({
  users,
  meId,
}: {
  users: UserRow[];
  /** ຄົນທີ່ກຳລັງເປີດໜ້ານີ້ຢູ່ — ບໍ່ໃຫ້ປິດບັນຊີຕົນເອງ */
  meId: string | null;
}) {
  const first = users.length === 0;

  return (
    <Card className="xl:col-span-2" id="users">
      <CardHeader
        title="ຜູ້ໃຊ້"
        subtitle={
          first
            ? "ດຽວນີ້ໃຊ້ລະຫັດຜ່ານດຽວຮ່ວມກັນ — ສ້າງຄົນທຳອິດແລ້ວຈະປ່ຽນເປັນ login ດ້ວຍຊື່ + ລະຫັດ"
            : "ບັນທຶກການກະທຳຈະບອກໄດ້ວ່າໃຜເປັນຄົນລຶບ ຫຼື ປ່ຽນງົບ"
        }
      />

      {first ? (
        <p className="border-b border-[var(--border)] bg-[var(--warning-soft)] px-3 py-2 text-xs text-[var(--fg-muted)]">
          ⚠ ພໍສ້າງຜູ້ໃຊ້ຄົນທຳອິດ <strong>ລະຫັດຜ່ານຮ່ວມໃນ .env ຈະໃຊ້ບໍ່ໄດ້ອີກ</strong> —
          ຄົນທຳອິດຖືກຕັ້ງເປັນຜູ້ດູແລລະບົບອັດຕະໂນມັດ. ຢ່າລືມລະຫັດທີ່ຕັ້ງ.
        </p>
      ) : null}

      {users.length > 0 ? (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>ຊື່ເຂົ້າລະບົບ</th>
                <th>ຊື່ທີ່ສະແດງ</th>
                <th>ສິດ</th>
                <th>ເຂົ້າລ່າສຸດ</th>
                <th>ປ່ຽນລະຫັດ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isMe = u.id === meId;
                const toggleRole = setUserRole.bind(
                  null,
                  u.id,
                  u.role === "ADMIN" ? UserRole.MEMBER : UserRole.ADMIN,
                );
                const toggleActive = setUserActive.bind(null, u.id, !u.active);
                const resetPassword = setUserPassword.bind(null, u.id);

                return (
                  <tr key={u.id}>
                    <td className="font-medium">
                      {u.name}
                      {isMe ? (
                        <span className="ml-1 text-[0.7rem] text-[var(--fg-subtle)]">
                          (ທ່ານ)
                        </span>
                      ) : null}
                    </td>
                    <td className="text-xs">{u.displayName}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge tone={u.role === "ADMIN" ? "info" : "neutral"}>
                          {ROLE_LABEL[u.role]}
                        </Badge>
                        {u.active ? null : <Badge tone="warning">ປິດຢູ່</Badge>}
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-xs text-[var(--fg-muted)]">
                      {u.lastLoginAt ? formatTimeLao(u.lastLoginAt) : "ຍັງບໍ່ເຄີຍ"}
                    </td>
                    <td>
                      <form action={resetPassword} className="flex gap-1">
                        <input
                          name="password"
                          type="password"
                          required
                          minLength={8}
                          placeholder="ລະຫັດໃໝ່"
                          className="field !py-0.5 !text-xs"
                          autoComplete="new-password"
                        />
                        <SubmitButton className="btn btn-sm" pendingText="...">
                          ຕັ້ງ
                        </SubmitButton>
                      </form>
                    </td>
                    <td className="num">
                      <div className="flex flex-wrap justify-end gap-1">
                        <form action={toggleRole}>
                          <SubmitButton className="btn btn-sm" pendingText="...">
                            {u.role === "ADMIN" ? "ຖອດສິດດູແລ" : "ໃຫ້ສິດດູແລ"}
                          </SubmitButton>
                        </form>
                        <form action={toggleActive}>
                          {u.active ? (
                            <DeleteButton
                              label="ປິດບັນຊີ"
                              confirmText={`ປິດບັນຊີ “${u.name}”? ເຂົ້າລະບົບບໍ່ໄດ້ອີກ ແຕ່ປະຫວັດຍັງຢູ່`}
                            />
                          ) : (
                            <SubmitButton className="btn btn-sm" pendingText="...">
                              ເປີດຄືນ
                            </SubmitButton>
                          )}
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="ຍັງບໍ່ມີຜູ້ໃຊ້" hint="ສ້າງຄົນທຳອິດຢູ່ຟອມລຸ່ມນີ້" />
      )}

      <form
        action={createUser}
        className="grid gap-3 border-t border-[var(--border)] p-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Field label="ຊື່ເຂົ້າລະບົບ *" hint="a-z, 0-9, ຈຸດ, ຂີດ">
          <input name="name" required className="field" placeholder="noy" />
        </Field>
        <Field label="ຊື່ທີ່ສະແດງ">
          <input name="displayName" className="field" placeholder="ນາງ ນ້ອຍ" />
        </Field>
        <Field label="ລະຫັດຜ່ານ *" hint="ຢ່າງໜ້ອຍ 8 ຕົວ">
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="field"
          />
        </Field>
        <Field label="ສິດ">
          <select
            name="role"
            defaultValue="MEMBER"
            disabled={first}
            className="field"
          >
            <option value="MEMBER">{ROLE_LABEL.MEMBER}</option>
            <option value="ADMIN">{ROLE_LABEL.ADMIN}</option>
          </select>
        </Field>
        <div className="sm:col-span-2 xl:col-span-4">
          <SubmitButton>ເພີ່ມຜູ້ໃຊ້</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
