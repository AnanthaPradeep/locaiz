import { expect, it } from "vitest";
import { requestStatus, type Assignment, type StockRequest } from "./client";

it("derives request status from independent shop replies and the deadline", () => {
  const now = Date.parse("2026-11-23T10:00:00Z");
  const request = {
    cancelled_at: null,
    expires_at: "2026-11-23T11:00:00Z",
    stock_request_shops: [],
  } as unknown as StockRequest;
  const status = (...replies: Assignment["status"][]) =>
    requestStatus(
      {
        ...request,
        stock_request_shops: replies.map(
          (reply) => ({ status: reply }) as Assignment,
        ),
      },
      now,
    );
  expect(status("pending", "pending")).toBe("Pending");
  expect(status("available", "pending")).toBe("Partially responded");
  expect(status("available", "out_of_stock")).toBe("All responded");
  request.expires_at = "2026-11-23T09:00:00Z";
  expect(status("available", "pending")).toBe("Expired");
  request.cancelled_at = "2026-11-23T08:00:00Z";
  expect(status("pending", "pending")).toBe("Cancelled");
});
