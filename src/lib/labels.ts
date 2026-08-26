import type {
  CampaignObjective,
  DataSource,
  EntityStatus,
  InsightLevel,
  LeadStatus,
  OrderStatus,
} from "@/generated/prisma/enums";

export const STATUS_LABEL: Record<EntityStatus, string> = {
  DRAFT: "ຮ່າງ",
  ACTIVE: "ກຳລັງຍິງ",
  PAUSED: "ຢຸດຊົ່ວຄາວ",
  COMPLETED: "ຈົບແລ້ວ",
  ARCHIVED: "ເກັບເຂົ້າຄັງ",
};

export const STATUS_TONE: Record<EntityStatus, string> = {
  DRAFT: "neutral",
  ACTIVE: "success",
  PAUSED: "warning",
  COMPLETED: "info",
  ARCHIVED: "neutral",
};

export const OBJECTIVE_LABEL: Record<CampaignObjective, string> = {
  MESSAGES: "ຂໍ້ຄວາມ (ທັກແຊັດ)",
  TRAFFIC: "ດຶງຄົນເຂົ້າເວັບ",
  ENGAGEMENT: "ການມີສ່ວນຮ່ວມ",
  LEADS: "ເກັບລາຍຊື່ລູກຄ້າ",
  SALES: "ຍອດຂາຍ",
  AWARENESS: "ການຮັບຮູ້ແບຣນ",
  VIDEO_VIEWS: "ຍອດເບິ່ງວິດີໂອ",
  APP_PROMOTION: "ໂປຣໂມດແອັບ",
};

export const LEVEL_LABEL: Record<InsightLevel, string> = {
  ACCOUNT: "ບັນຊີໂຄສະນາ",
  CAMPAIGN: "ແຄມເປນ",
  ADSET: "ຊຸດໂຄສະນາ",
  AD: "ໂຄສະນາ",
};

export const SOURCE_LABEL: Record<DataSource, string> = {
  MANUAL: "ປ້ອນມື",
  API: "ດຶງຈາກ API",
};

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "ໃໝ່",
  CONTACTED: "ຕິດຕໍ່ແລ້ວ",
  QUALIFIED: "ສົນໃຈຈິງ",
  WON: "ປິດການຂາຍ",
  LOST: "ຫຼຸດ",
};

export const LEAD_STATUS_TONE: Record<LeadStatus, string> = {
  NEW: "info",
  CONTACTED: "neutral",
  QUALIFIED: "warning",
  WON: "success",
  LOST: "danger",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "ລໍຖ້າຢືນຢັນ",
  CONFIRMED: "ຢືນຢັນແລ້ວ",
  SHIPPED: "ສົ່ງອອກແລ້ວ",
  DELIVERED: "ຮັບສຳເລັດ",
  RETURNED: "ຕີກັບ",
  CANCELLED: "ຍົກເລີກ",
};

export const ORDER_STATUS_TONE: Record<OrderStatus, string> = {
  PENDING: "warning",
  CONFIRMED: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  RETURNED: "danger",
  CANCELLED: "neutral",
};

export const LEAD_CHANNELS = [
  "Messenger",
  "ຄອມເມັນ",
  "Lead Form",
  "WhatsApp",
  "ໂທເຂົ້າ",
  "ອື່ນໆ",
];

export const CREATIVE_TYPES = ["IMAGE", "VIDEO", "CAROUSEL", "COLLECTION"];

export const CURRENCIES = ["USD", "LAK", "THB"];

/** ຊ່ວຍສ້າງ options ໃຫ້ <select> ຈາກ record ຂ້າງເທິງ */
export function options<T extends string>(
  record: Record<T, string>,
): Array<{ value: T; label: string }> {
  return (Object.keys(record) as T[]).map((value) => ({
    value,
    label: record[value],
  }));
}
