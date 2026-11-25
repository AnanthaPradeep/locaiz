import { useQuery } from "@tanstack/react-query";
import { useMarketMutation, useMarketSession } from "./market-account";
import { formText, marketClient } from "./market-foundation";

type Review = {
  id: string;
  target: "product" | "supplier";
  rating: number;
  body: string;
  state: "pending" | "published" | "hidden";
  created_at?: string;
};
const fields = "id,target,rating,body,state,created_at";
async function reviewAction(command: string, payload: Record<string, unknown>) {
  const { data, error } = await marketClient!.rpc("market_review_action", {
    command,
    payload,
  });
  if (error) throw error;
  return data;
}
function ReviewFields({ existing }: { existing?: Review }) {
  return (
    <>
      <label>
        Rating
        <select name="rating" defaultValue={existing?.rating ?? 5}>
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <label>
        Review
        <textarea
          name="body"
          minLength={10}
          maxLength={2000}
          defaultValue={existing?.body}
          required
        />
      </label>
    </>
  );
}

export function ReviewPurchase({
  order,
  product,
}: {
  order: string;
  product: boolean;
}) {
  const mutation = useMarketMutation();
  const own = useQuery({
    queryKey: ["market", "own-reviews", order],
    queryFn: () => reviewAction("own", { id: order }) as Promise<Review[]>,
  });
  return (
    <details className="record">
      <summary>Review this completed purchase</summary>
      {own.isPending && <p role="status">Checking review eligibility</p>}
      {own.isError && (
        <p>
          Review eligibility could not be confirmed.{" "}
          <button className="outline" onClick={() => void own.refetch()}>
            Check eligibility again
          </button>
        </p>
      )}
      {own.isSuccess &&
        (product ? ["supplier", "product"] : ["supplier"]).map((target) => {
          const existing = own.data.find((review) => review.target === target);
          return (
            <form
              className="form"
              key={target + (existing?.id ?? "new")}
              onSubmit={(event) => {
                event.preventDefault();
                const fields = new FormData(event.currentTarget);
                void mutation.run(
                  () =>
                    reviewAction("save", {
                      id: order,
                      target,
                      rating: formText(fields, "rating"),
                      body: formText(fields, "body"),
                    }),
                  "Review sent for moderation.",
                );
              }}
            >
              <h4>
                {target === "product" ? "Product review" : "Supplier review"}
              </h4>
              {existing && (
                <p>
                  Current status {existing.state}. Edits return the review to
                  moderation.
                </p>
              )}
              <ReviewFields existing={existing} />
              <button className="button" disabled={mutation.pending}>
                {existing ? "Save review edit" : "Submit review"}
              </button>
            </form>
          );
        })}
      {mutation.feedback}
    </details>
  );
}

export function PublicReviews({
  business,
  product = null,
}: {
  business: string;
  product?: string | null;
}) {
  const session = useMarketSession();
  const mutation = useMarketMutation();
  const reviews = useQuery({
    queryKey: ["market", "public-reviews", business, product],
    queryFn: async () => {
      let list = marketClient!
        .from("market_reviews")
        .select(fields)
        .eq("business_id", business)
        .eq("state", "published");
      list = product
        ? list.eq("product_id", product)
        : list.is("product_id", null);
      const [entries, summary] = await Promise.all([
        list.order("created_at", { ascending: false }).limit(10),
        marketClient!
          .rpc("market_review_summary", {
            subject_business: business,
            subject_product: product,
          })
          .single(),
      ]);
      if (entries.error) throw entries.error;
      if (summary.error) throw summary.error;
      return {
        entries: entries.data as Review[],
        summary: summary.data as {
          review_count: number;
          average_rating: number | null;
        },
      };
    },
  });
  return (
    <section className="record market-stack" aria-label="Verified reviews">
      <h2>Verified reviews</h2>
      {reviews.isPending && <p role="status">Loading reviews</p>}
      {reviews.isError && (
        <p role="alert">
          Unable to load reviews.{" "}
          <button className="outline" onClick={() => void reviews.refetch()}>
            Retry reviews
          </button>
        </p>
      )}
      {reviews.isSuccess &&
        (reviews.data.summary.review_count > 0 ? (
          <p>
            {reviews.data.summary.average_rating} out of 5 from{" "}
            {reviews.data.summary.review_count} verified purchases
          </p>
        ) : (
          <p>No published verified reviews yet.</p>
        ))}
      {reviews.data?.entries.map((review) => (
        <article className="record" key={review.id}>
          <h3>{review.rating} out of 5</h3>
          <p className="muted">Verified purchase</p>
          <p className="journey-message">{review.body}</p>
          {session && (
            <details>
              <summary>Report review</summary>
              <form
                className="form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const reason = formText(
                    new FormData(event.currentTarget),
                    "reason",
                  );
                  void mutation.run(
                    () => reviewAction("report", { id: review.id, reason }),
                    "Review report sent.",
                  );
                }}
              >
                <label>
                  Report reason
                  <textarea
                    name="reason"
                    minLength={10}
                    maxLength={1000}
                    required
                  />
                </label>
                <button className="outline" disabled={mutation.pending}>
                  Send review report
                </button>
              </form>
            </details>
          )}
        </article>
      ))}
      {mutation.feedback}
    </section>
  );
}

export function ReviewModeration() {
  const mutation = useMarketMutation();
  const queue = useQuery({
    queryKey: ["market", "review-moderation"],
    queryFn: async () => {
      const [pending, reports] = await Promise.all([
        marketClient!
          .from("market_reviews")
          .select(fields)
          .eq("state", "pending")
          .order("created_at")
          .limit(30),
        marketClient!
          .from("market_review_audit")
          .select("id,review_id,note")
          .eq("action", "reported")
          .order("id", { ascending: false })
          .limit(30),
      ]);
      if (pending.error) throw pending.error;
      if (reports.error) throw reports.error;
      const ids = [...new Set(reports.data.map((report) => report.review_id))];
      const flagged = ids.length
        ? await marketClient!
            .from("market_reviews")
            .select(fields)
            .in("id", ids)
            .eq("state", "published")
        : null;
      if (flagged?.error) throw flagged.error;
      return {
        entries: [
          ...(pending.data as Review[]),
          ...((flagged?.data as Review[]) ?? []),
        ],
        reports: reports.data,
      };
    },
  });
  return (
    <section className="record market-stack" aria-label="Review moderation">
      <h2>Review moderation</h2>
      {queue.isPending && <p role="status">Loading reviews</p>}
      {queue.isError && (
        <p role="alert">
          Unable to load review moderation.{" "}
          <button className="outline" onClick={() => void queue.refetch()}>
            Retry moderation
          </button>
        </p>
      )}
      {queue.data?.entries.length === 0 && (
        <p>No pending or reported published reviews.</p>
      )}
      {queue.data?.entries.map((review) => (
        <form
          className="record form"
          key={review.id}
          onSubmit={(event) => {
            event.preventDefault();
            const button = (event.nativeEvent as SubmitEvent)
              .submitter as HTMLButtonElement;
            const reason = formText(
              new FormData(event.currentTarget),
              "reason",
            );
            void mutation.run(
              () =>
                reviewAction("moderate", {
                  id: review.id,
                  state: button.value,
                  reason,
                }),
              "Moderation decision saved.",
            );
          }}
        >
          <p>
            {review.target} · {review.rating} out of 5 · {review.state}
          </p>
          <p className="journey-message">{review.body}</p>
          {queue.data?.reports
            .filter((report) => report.review_id === review.id)
            .map((report) => (
              <p key={report.id}>Report · {report.note}</p>
            ))}
          <label>
            Moderation reason
            <textarea name="reason" minLength={10} maxLength={1000} required />
          </label>
          <div className="journey-actions">
            {review.state === "pending" && (
              <button
                className="button"
                value="published"
                disabled={mutation.pending}
              >
                Publish review
              </button>
            )}
            <button
              className="outline"
              value="hidden"
              disabled={mutation.pending}
            >
              Hide review
            </button>
          </div>
        </form>
      ))}
      {mutation.feedback}
    </section>
  );
}
