import test from "node:test";
import assert from "node:assert/strict";
import { aggregateOrders, orderTotals } from "./orders";

test("ນັບຍອດຂາຍຈິງສະເພາະອໍເດີທີ່ສົ່ງສຳເລັດ", () => {
  const total = aggregateOrders(
    [
      {
        status: "DELIVERED",
        saleAmount: 1_000_000,
        productCost: 600_000,
        shippingCost: 30_000,
        otherCost: 20_000,
        refundAmount: 50_000,
      },
      {
        status: "CONFIRMED",
        saleAmount: 2_000_000,
        productCost: 1_000_000,
        shippingCost: 0,
        otherCost: 0,
        refundAmount: 0,
      },
    ],
    100_000,
  );

  assert.equal(total.delivered, 1);
  assert.equal(total.confirmed, 1);
  assert.equal(total.netRevenue, 950_000);
  assert.equal(total.orderMargin, 300_000);
  assert.equal(total.contributionProfit, 200_000);
  assert.equal(total.actualRoas, 9.5);
});

test("ອໍເດີຕີກັບບໍ່ນັບຍອດຂາຍ ແຕ່ນັບຄ່າສົ່ງທີ່ເສຍໄປ", () => {
  const row = orderTotals({
    status: "RETURNED",
    saleAmount: 800_000,
    productCost: 400_000,
    shippingCost: 35_000,
    otherCost: 15_000,
    refundAmount: 800_000,
  });

  assert.equal(row.returned, 1);
  assert.equal(row.netRevenue, 0);
  assert.equal(row.productCost, 0);
  assert.equal(row.fulfillmentCost, 50_000);
  assert.equal(row.orderMargin, -50_000);
});

test("ຄ່າເງິນຕິດລົບຈາກ form ບໍ່ສາມາດເພີ່ມກຳໄລ", () => {
  const row = orderTotals({
    status: "DELIVERED",
    saleAmount: -1,
    productCost: -1,
    shippingCost: -1,
    otherCost: -1,
    refundAmount: -1,
  });
  assert.equal(row.netRevenue, 0);
  assert.equal(row.orderMargin, 0);
});
