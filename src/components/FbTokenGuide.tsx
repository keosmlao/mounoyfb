/**
 * ຄູ່ມືເອົາ access token — ວາງໄວ້ຕິດກັບຊ່ອງທີ່ຕ້ອງໃສ່ ເພື່ອບໍ່ຕ້ອງໄປຫາເອກະສານບ່ອນອື່ນ.
 * ອ້າງອີງ: developers.facebook.com/docs/marketing-api/overview/authorization
 */

const STEPS: Array<{ title: string; body: React.ReactNode }> = [
  {
    title: "1. ຕ້ອງມີຢູ່ກ່ອນ",
    body: (
      <>
        ບັນຊີໂຄສະນາໃນ <Ext href="https://adsmanager.facebook.com">Ads Manager</Ext>{" "}
        ແລະ ບັນຊີທຸລະກິດໃນ{" "}
        <Ext href="https://business.facebook.com">Business Manager</Ext> (ຟຣີ).
        ເພຈຂອງຮ້ານຄວນຢູ່ໃນ Business Manager ອັນດຽວກັນ.
      </>
    ),
  },
  {
    title: "2. ສ້າງ App",
    body: (
      <>
        ໄປ <Ext href="https://developers.facebook.com/apps">developers.facebook.com/apps</Ext>{" "}
        → <b>Create App</b> → ເລືອກປະເພດ <b>Business</b> → ຕັ້ງຊື່ (ເຊັ່ນ “Mounoy Ads”).
        ຈາກນັ້ນໃນໜ້າ App ໃຫ້ກົດ <b>Add Product</b> → <b>Marketing API</b>.
      </>
    ),
  },
  {
    title: "3. ເອົາ Access Token (ແນະນຳ: System User — ບໍ່ໝົດອາຍຸ)",
    body: (
      <>
        <Ext href="https://business.facebook.com/settings">Business Settings</Ext> →{" "}
        <b>Users → System Users</b> → <b>Add</b> → ຕັ້ງບົດບາດ <b>Admin</b>
        <br />
        → <b>Assign Assets</b>: ເລືອກບັນຊີໂຄສະນາ ແລະ ເພຈ ໃຫ້ system user ນີ້
        <br />
        → <b>Generate New Token</b> → ເລືອກ App ທີ່ສ້າງໄວ້ → ຕິກສິດ{" "}
        <code className="rounded bg-[var(--surface-2)] px-1">ads_read</code> → ສ້າງ token
        <br />
        <span className="text-[var(--fg-subtle)]">
          ຄັດລອກ token ໄວ້ທັນທີ — Facebook ສະແດງໃຫ້ເບິ່ງເທື່ອດຽວ
        </span>
      </>
    ),
  },
  {
    title: "ວິທີໄວກວ່າ (ສຳລັບທົດລອງເທົ່ານັ້ນ)",
    body: (
      <>
        <Ext href="https://developers.facebook.com/tools/explorer">Graph API Explorer</Ext>{" "}
        → ເລືອກ App → ເພີ່ມສິດ{" "}
        <code className="rounded bg-[var(--surface-2)] px-1">ads_read</code> →{" "}
        <b>Generate Access Token</b>. ໃຊ້ໄດ້ 1–2 ຊົ່ວໂມງເທົ່ານັ້ນ ແລ້ວຕ້ອງສ້າງໃໝ່
        — ເໝາະແຕ່ລອງເບິ່ງວ່າຕໍ່ໄດ້ບໍ່.
      </>
    ),
  },
  {
    title: "4. ເອົາ Ad Account ID",
    body: (
      <>
        ໃນ Ads Manager ເບິ່ງບ່ອນເລືອກບັນຊີ ຫຼື ໃນ URL — ຮູບແບບ{" "}
        <code className="rounded bg-[var(--surface-2)] px-1">act_1234567890</code>.
        ເອົາໄປໃສ່ຢູ່ໜ້າ <b>ບັນຊີໂຄສະນາ</b> ຂອງລະບົບນີ້.
      </>
    ),
  },
];

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="link">
      {children}
    </a>
  );
}

export function FbTokenGuide() {
  return (
    <details className="border-t border-[var(--border)]">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
        ເອົາ Access Token ຈາກໃສ? — ກົດເບິ່ງຂັ້ນຕອນ
      </summary>

      <div className="px-4 pb-4">
        <ol className="flex flex-col gap-3">
          {STEPS.map((step) => (
            <li key={step.title}>
              <p className="text-sm font-medium">{step.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-[var(--fg-muted)]">
                {step.body}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-4 rounded-lg bg-[var(--surface-2)] p-3 text-sm">
          <p className="font-medium">ຕ້ອງຜ່ານ App Review ບໍ່?</p>
          <p className="mt-1 text-[var(--fg-muted)]">
            <b>ບໍ່ຕ້ອງ</b> ຖ້າອ່ານສະເພາະບັນຊີໂຄສະນາຂອງຕົນເອງ — Standard Access
            ທີ່ໄດ້ມາພ້ອມ Marketing API ພຽງພໍແລ້ວ (ມີຂີດຈຳກັດການເອີ້ນຕໍ່າກວ່າ
            ແຕ່ພຽງພໍສຳລັບການດຶງຜົນລາຍວັນ). ຈະຕ້ອງຂໍ <b>Advanced Access</b>{" "}
            ຜ່ານ App Review ກໍ່ຕໍ່ເມື່ອຈະດຶງບັນຊີຂອງລູກຄ້າຄົນອື່ນ ຫຼື ຕ້ອງການ
            ຈຳນວນການເອີ້ນສູງຂຶ້ນ.
          </p>
        </div>

        <p className="mt-3 text-xs text-[var(--fg-subtle)]">
          ເອກະສານທາງການ:{" "}
          <Ext href="https://developers.facebook.com/docs/marketing-api/overview/authorization">
            Marketing API — Authorization
          </Ext>
        </p>
      </div>
    </details>
  );
}
