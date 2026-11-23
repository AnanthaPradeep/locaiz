# Catalogue data model

src/demo-retail.ts contains the fifty primary retail discovery records. The five existing IDs remain stable. Unique slugs identify image files; the PDP uses the stable ID. The rows contain a category, fictional maker, INR demo price where applicable, specifications and stock. Product-specific options model different sizes, capacities or resistance levels. The original gift-packaging cart keys remain compatible. Quote-only listings have no checkout price.

The existing catalogue repository exposes Shop and universal search. Published sourcing lookup remains separate and uses its existing repository contract. Explicit product links connect sourcing records without merging supplier stock or mixing currencies. Future live catalogue imports should supply stable product and variant identifiers and trusted data for verification, availability and pricing.
