-- Multi-SAN + wildcard SSL: store all identifiers and per-authorization DNS-01 challenges.
ALTER TABLE customer_certificates ADD COLUMN hostnames_json TEXT;
ALTER TABLE customer_certificates ADD COLUMN dns01_challenges_json TEXT;
