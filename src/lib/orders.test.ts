import test from "node:test";
import assert from "node:assert/strict";
import { aggregateOrders, orderTotals, splitOrderByProduct, sumOrderTotals } from "./orders";

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

test("ບິນຫຼາຍສິນຄ້າແບ່ງເງິນຕາມສັດສ່ວນມູນຄ່າ ແລະ ລວມຄືນໄດ້ເທົ່າເດີມ", () => {
  const order = {
    status: "DELIVERED" as const,
    saleAmount: 300_000,
    productCost: 120_000,
    shippingCost: 30_000,
    otherCost: 0,
    refundAmount: 0,
  };
  const parts = splitOrderByProduct(order, [
    { productId: "shirt", productName: "ເສື້ອ", quantity: 2, unitPrice: 100_000 },
    { productId: "hat", productName: "ໝວກ", quantity: 1, unitPrice: 100_000 },
  ])!;

  assert.equal(parts.length, 2);
  const shirt = parts.find((p) => p.productId === "shirt")!.row;
  assert.equal(Math.round(shirt.saleAmount), 200_000);
  assert.equal(Math.round(shirt.shippingCost), 20_000);

  const merged = sumOrderTotals(parts.map((p) => p.row));
  assert.equal(Math.round(merged.netRevenue), 300_000);
  assert.equal(Math.round(merged.orderMargin), orderTotals(order).orderMargin);
});

test("ບິນສິນຄ້າດຽວ ບໍ່ແບ່ງ", () => {
  const order = { status: "PENDING" as const, saleAmount: 1, productCost: 0, shippingCost: 0, otherCost: 0, refundAmount: 0 };
  assert.equal(splitOrderByProduct(order, []), null);
  assert.equal(
    splitOrderByProduct(order, [
      { productId: "a", productName: "A", quantity: 1, unitPrice: 5 },
      { productId: "a", productName: "A", quantity: 2, unitPrice: 5 },
    ]),
    null,
  );
});
