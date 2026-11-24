# Quote data model

The browser stores structured requirement details on new records. Existing records keep their display text and sourcing fields. Use the comparison details form to supply missing fields. Comparison selections, shortlisted IDs, clarification drafts and selection history live in a separate workspace keyed by requirement ID.

Future live persistence can use buyer_requirements, supplier_quotes, supplier_quote_revisions, requirement_quote_shortlists, quote_clarification_requests and requirement_quote_decisions. Apply row-level security around ownership and authorised supplier access. Suppliers own their revisions. Buyers own their decisions and cannot mutate quoted terms. The server must validate that a current, unexpired revision belongs to the requirement, enforce ownership, write idempotently, and maintain an audit trail. Verify grants, RLS and negative access tests before enabling this adapter. Phase 1 does not use a hosted database for this feature.
