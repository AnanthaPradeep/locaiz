import type { ReactNode } from "react";

export function SupplierQuoteTable<T extends { id: string }>({
  quotes,
  heading,
  rows,
  actions,
  differences = false,
}: {
  quotes: T[];
  heading: (quote: T) => ReactNode;
  rows: { label: string; value: (quote: T) => ReactNode }[];
  actions: (quote: T) => ReactNode;
  differences?: boolean;
}) {
  return (
    <div
      className="quote-table-region"
      role="region"
      aria-label="Supplier quote comparison"
      tabIndex={0}
    >
      <table className="quote-table">
        <thead>
          <tr>
            <th scope="col">Term</th>
            {quotes.map((quote) => (
              <th key={quote.id} scope="col">
                {heading(quote)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows
            .filter(
              (row) => !differences || new Set(quotes.map(row.value)).size > 1,
            )
            .map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {quotes.map((quote) => (
                  <td key={quote.id}>{row.value(quote)}</td>
                ))}
              </tr>
            ))}
          <tr>
            <th scope="row">Actions</th>
            {quotes.map((quote) => (
              <td key={quote.id}>{actions(quote)}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
