# Future APIs — Dropshipping Research

Research conducted March 5, 2026. Four parallel research agents covered supplier APIs, AliExpress/China-focused APIs, print-on-demand APIs, and aggregator/logistics APIs.

---

## Part 1 — Dropshipping Supplier APIs

### CJDropshipping

- **Docs:** https://developers.cjdropshipping.com
- **What it does:** Full REST API — product catalog, inventory, order creation, logistics/shipping quotes, dispute management, webhooks
- **Auth:** Token-based (access token via API email + key, time-limited)
- **Pricing:** Free with CJDropshipping account
- **Rate limits:** Not published; per-endpoint restrictions apply
- **Webhooks:** Yes — real-time order/shipment sync
- **Notable:** Sandbox available; AliExpress sourcing via same API; actively maintained changelog

---

### Wholesale2B

- **Docs:** https://www.wholesale2b.com/dropship-api-plan.html
- **What it does:** 1.5M+ products from 100+ suppliers; product catalog, inventory sync, order placement, webhook tracking push-back, returns/cancellations
- **Auth:** API key
- **Pricing:** Free signup; paid API plan (price not publicly listed)
- **Webhooks:** Yes — tracking codes pushed automatically on shipment
- **Notable:** White-label SaaS option; intelligent supplier routing; HD product images; multi-warehouse

---

### Inventory Source

- **Docs:** https://developers.inventorysource.com
- **What it does:** Real-time product data, inventory, order fulfillment, tracking across 230+ suppliers (3.5M+ products)
- **Auth:** OAuth 2.0 (partner) / API key (retailer direct)
- **Pricing:** Paid only — ~$99/month automation, ~$150/month full automation
- **Webhooks:** Not confirmed
- **Notable:** 230+ pre-integrated US suppliers; EDI support; Partner program (multi-retailer OAuth)

---

### AutoDS

- **Docs:** https://www.autods.com/api/
- **What it does:** Product imports from 25+ sources, auto-fulfillment, price/stock monitoring, order management, tracking updates; supports eBay, Shopify, Facebook, Amazon
- **Auth:** API key / access token (account-gated)
- **Pricing:** From ~$29.90/month; API tied to paid plan
- **Webhooks:** Not confirmed
- **Notable:** AI title/description optimization; automated price optimization; eBay-specific variant handling

---

### Spocket

- **Docs:** No public REST API
- **Pricing:** $39.99–$299.99/month (14-day trial)
- **Notable:** US/EU supplier focus; not suitable for headless/custom integrations

---

### Zendrop

- **Docs:** https://api.zendrop.com (login-gated)
- **What it does:** Auto-fulfillment, US-warehoused products, print-on-demand, custom packaging
- **Auth:** Not publicly documented
- **Pricing:** Free plan (limited) to ~$79/month
- **Notable:** US fulfillment warehouse; API access requires direct account contact

---

### Worldwide Brands

- **Docs:** https://www.worldwidebrands.com
- **Type:** Supplier directory only — no REST API
- **Pricing:** One-time ~$299 lifetime membership
- **Notable:** 8,000+ vetted suppliers, 16M+ products; for discovery only, not automation

---

### Summary

| Platform | Public REST API | Auth | Free Tier | Best For |
|---|---|---|---|---|
| CJDropshipping | Yes (full docs) | Access token | Yes | Custom integrations, global sourcing |
| Wholesale2B | Yes | API key | Signup free; API paid | White-label, multi-channel |
| Inventory Source | Yes | OAuth 2.0 / API key | No | Enterprise, multi-supplier automation |
| AutoDS | Yes (account-gated) | API key/token | No | eBay/Shopify full automation |
| Spocket | No | N/A | No (trial only) | Platform-based stores |
| Zendrop | Yes (account-gated) | Not documented | Free (limited) | US-focused Shopify stores |
| Worldwide Brands | No | N/A | No | Supplier discovery only |

---

## Part 2 — AliExpress & Chinese Supplier APIs

### AliExpress Open Platform / Dropshipper API

- **Docs:** https://openservice.aliexpress.com/doc/doc.htm
- **Dropship landing:** https://ds.aliexpress.com/dropshipping-api
- **What it does:** Product catalog, inventory, order placement + bulk management, order tracking, OAuth seller authorization, category/attribute tree, DS-specific endpoint group
- **Auth:** OAuth 2.0 + HMAC-SHA256 signed requests; App Key + App Secret
- **Pricing:** Free to register; approval required; no per-call fees (revenue share / markup model)
- **Rate limits:** Not published; enforced internally post-approval
- **Notable:** Migrated to new platform (2024); prior keys may require re-registration; dedicated Dropshippers API section

---

### AliExpress Affiliate API

- **Docs:** https://portals.aliexpress.com / https://openservice.aliexpress.com
- **What it does:** Product search for affiliate listings, affiliate link generation, commission reporting, hot product feeds, category-based discovery
- **Auth:** App Key + HMAC-SHA256 signed requests; Affiliate Tracking ID issued separately
- **Pricing:** Free; commission 3–9% by category
- **Notable:** Separate from Dropshipper API — marketing/affiliate use only, no order placement

---

### DSers Supplier API

- **Docs:** https://www.dsers.dev/api/supplier_middle_platform_api
- **What it does:** Supplier integration into DSers platform — product updates, order status pushes, supplier account binding/unbinding via OAuth
- **Auth:** OAuth 2.0 token exchange
- **Pricing:** Developer registration at accounts.dsers.com required; DSers free and paid tiers
- **Webhooks:** Yes (push model) — `supplier product update hook`, `supplier order webhook`
- **Notable:** Designed for suppliers wanting to become DSers-compatible sources; not for end-user dropshippers calling AliExpress products

---

### Oberlo

- **Status:** DISCONTINUED June 30, 2022
- **Replacement:** DSers (official AliExpress Shopify partner)

---

### EPROLO

- **Docs:** https://eprolo.com/eprolo-api/ (public landing; private docs sent by account rep)
- **What it does:** Product sourcing, order fulfillment, branded packaging, inventory/shipping tracking sync; supports Shopify, WooCommerce, TikTok Shop, Amazon, Etsy
- **Auth:** API key (manually requested via account rep)
- **Pricing:** Free platform; API also free but not self-serve
- **Notable:** Docs delivered privately per partner; US/EU/CN warehouses; POD via InkedJoy

---

### BigBuy

- **Docs:** https://api.bigbuy.eu/rest/doc/
- **Base URL:** `https://api.bigbuy.eu/`
- **What it does:** Catalog API (24-language product data, real-time pricing), Orders API, Shipping Costs API, Tracking API; FTP catalog sync also available
- **Auth:** API key (bearer header); requires active Wholesaler Pack
- **Pricing:** Bundled with paid packs (no free API tier); largest EU B2B dropship supplier
- **Notable:** 24 languages; EU-primary; multi-channel integration platform (MIP) for Amazon/eBay available separately

---

### HyperSKU

- **Docs:** https://support.hypersku.com/en (help center only)
- **What it does:** Chinese supplier sourcing, shipping rate calculation, quality examination, custom branding, order fulfillment/tracking, POD
- **Auth:** Not publicly documented
- **Pricing:** Free plan (limited); premium plans for higher volume
- **Notable:** 7 US-oriented warehouses; no standalone public API docs — partnership or Shopify App required

---

### Yakkyofy

- **Docs:** https://developers.yakkyofy.com/docs/
- **Base URL:** `https://rest.yakkyofy.com/`
- **What it does:** Order management (create, retrieve, track), order lifecycle, cash-on-delivery (Italy only), shipment tracking webhook
- **Auth:** API key (`X-API-Key` header)
- **Rate limits:** 60 requests/minute; HTTP 429 with rate limit headers
- **Webhooks:** Yes — HTTPS POST, retried up to 10 times; configured via "Manage Stores"
- **Pricing:** Free to register; no separate API tier documented
- **Notable:** No sandbox; API v0.0.1 (early); EU/Italian market focus; no catalog/product browsing — orders only

---

### Summary

| API | Auth | Public Docs | Free Tier | Rate Limit | Best For |
|---|---|---|---|---|---|
| AliExpress (Dropshipper) | OAuth 2.0 + HMAC | Yes (post-approval) | Yes | Not published | Direct AliExpress dropshipping |
| AliExpress Affiliate | App Key + HMAC | Yes | Yes (commission) | Not published | Affiliate/marketing |
| DSers Supplier API | OAuth 2.0 | Yes | Dev registration | Not published | Becoming a DSers supplier |
| Oberlo | N/A | N/A | N/A | N/A | Discontinued June 2022 |
| EPROLO | API Key (private) | Private (on request) | Yes | Not published | Free branded dropshipping |
| BigBuy | API Key | Yes (paid plan req.) | No | Not published | EU wholesale/dropshipping |
| HyperSKU | Not documented | No | Yes (limited) | Not published | US-focused agent sourcing |
| Yakkyofy | API Key | Yes | Yes | 60 req/min | EU order fulfillment, COD Italy |

---

## Part 3 — Print-on-Demand APIs

### Printful

- **Docs:** https://developers.printful.com/docs/ (v1) | https://developers.printful.com/docs/v2-beta/ (v2 beta)
- **Base URL:** `https://api.printful.com/`
- **What it does:** Product catalog, store sync, order creation/management/estimation, mockup generation (async), file library, shipping rate calculation, tax queries, store/warehouse management, reporting
- **Auth:** OAuth 2.0 — Private Token (single-store) or Public App OAuth (multi-merchant)
- **Rate limits:** 120 req/60s general; 10 req/60s mockup generator; 30 req/60s unauthenticated catalog; 5 req/60s large carts
- **Pricing:** Free (pay per fulfillment); Printful Subscription offers discounted pricing
- **Webhooks:** Yes — 13+ events (`package_shipped`, `order_created`, `stock_updated`, etc.); signed in v2 beta
- **Notable:** Async mockup generator with layout templates; multi-technique (DTG, embroidery, screen print, sublimation); multi-placement prints; merged with Printify (Nov 2024) but both still operate independently

---

### Printify

- **Docs:** https://developers.printify.com
- **Base URL:** `https://api.printify.com/v1/` / `https://api.printify.com/v2/`
- **What it does:** Shop management, catalog browsing (blueprints, print providers, variants), product creation/update/publish, order submission, image upload, shipping cost calculation, webhook management
- **Auth:** Bearer Personal Access Token (1-year expiry) or OAuth 2.0 (multi-merchant, 6-hour access token + refresh)
- **Rate limits:** 600 req/min global; 100 req/min catalog; 200 product publishes/30 min
- **Pricing:** Free (pay per fulfillment); Printify Plus for discounts
- **Webhooks:** Yes — HMAC SHA-256 signed (`X-Pfy-Signature`); events include `order:created`, `order:shipment:created`, `order:shipment:delivered`, etc.
- **Notable:** Multi-provider architecture (blueprints fulfilled by multiple suppliers); Printify Express 2-3 day US delivery; OpenAPI spec + Postman collection; JSON:API in v2

---

### Gelato

- **Docs:** https://dashboard.gelato.com/docs/
- **Base URL:** `https://order.gelatoapis.com`
- **What it does:** Order creation/retrieval/cancellation/quoting, catalog + variant browsing, pricing and stock queries, shipping methods, e-commerce product/template management, branded packaging, embroidery
- **Auth:** API Key (`X-API-KEY` header)
- **Rate limits:** Not stated; HTTP 429 with exponential backoff recommended
- **Pricing:** Free (pay per fulfillment); Gelato+ subscription for discounts
- **Webhooks:** Yes — configurable events for order status and shipment
- **Notable:** Global production in 30+ countries; multi-version Orders API (v2/v3/v4); template-based product creation; branded inserts and custom labels

---

### SPOD / Spreadconnect

- **Docs:** https://developer.spreadshirt.net | https://www.spreadshop.net/spreadconnect-api/
- **What it does:** Print-on-demand fulfillment via REST; product catalog, order fulfillment, shipping; integrates with Shopify, WooCommerce, Magento, Squarespace, OrderDesk
- **Auth:** Registration required; API key-based (REST)
- **Rate limits:** Not documented
- **Pricing:** Free (pay per fulfillment); 48-hour production claim; EU-primary
- **Webhooks:** Not clearly documented
- **Notable:** 50,000+ free designs; 200+ product catalog; organic/sustainable options; strong EU presence

---

### Gooten

- **Docs:** https://www.gooten.com/api-documentation/getting-started/
- **What it does:** Product catalog, order creation/submission, shipping management, order status tracking
- **Auth:** Recipe ID (catalog) + API Keys (orders); Postman Collection maintained
- **Rate limits:** Not documented
- **Pricing:** B2B/enterprise; per-order pricing (negotiated volume); approval required
- **Webhooks:** Yes — real-time order status; OrderDesk integration
- **Notable:** Globally distributed production network; Postman maintained alongside docs; BigCommerce/Shopify/Etsy integrations

---

### Apliiq

- **Docs:** https://help.apliiq.com/portal/en/kb/help/api
- **What it does:** Product catalog, order creation for custom apparel; supports private labeling, relabeling, woven labels, embroidery, inside-tag printing
- **Auth:** HMAC (API Key + Shared Secret via `x-apliiq-auth` header); requires creating a custom store in Apliiq account
- **Rate limits:** Not documented
- **Pricing:** Free (pay per fulfillment); branding elements (woven labels, patches) carry additional fees
- **Webhooks:** Not documented
- **Notable:** Premium apparel focus; sewn-in labels, patches, embroidery; no minimum orders; Shopify app also available

---

### Teelaunch

- **Docs:** https://api.teelaunch.com/documentation
- **Base URL:** `https://api.teelaunch.com/api/v1/`
- **What it does:** Account management, product catalog, order submission and tracking; apparel, home goods, accessories
- **Auth:** API key (header)
- **Rate limits:** Not documented
- **Pricing:** Free (pay per fulfillment); free Shopify app
- **Webhooks:** Not prominently documented
- **Notable:** OpenAPI 3.0/Swagger UI; Postman Collection provided; family-run; primarily Shopify-focused

---

### CustomCat

- **Docs:** https://help.customcat.com/getting-started-with-customcat-api
- **What it does:** Custom product creation, order fulfillment automation, catalog browsing
- **Auth:** API key (dashboard-generated)
- **Rate limits:** Not documented
- **Pricing:** Free ($0/month) or CustomCat Pro ($30/month for discounted product pricing)
- **Webhooks:** Not prominently documented
- **Notable:** Fastest production in POD (1-3 business days claim); 500+ products; DTG, dye sublimation, embroidery; Shopify, WooCommerce, BigCommerce native apps

---

### Summary

| API | Auth | Rate Limit | Webhooks | Free Tier | Best For |
|---|---|---|---|---|---|
| Printful | OAuth 2.0 | 120 req/min | Yes (13+ events, signed v2) | Yes | Full-featured POD API |
| Printify | Bearer / OAuth 2.0 | 600 req/min | Yes (HMAC signed) | Yes | Multi-provider POD |
| Gelato | API Key | 429 on excess | Yes | Yes | Global production network |
| SPOD/Spreadconnect | API Key | Not documented | Unclear | Yes | EU POD |
| Gooten | Recipe ID + API Keys | Not documented | Yes | Enterprise | B2B/enterprise POD |
| Apliiq | HMAC | Not documented | Not documented | Per-order | Premium private-label apparel |
| Teelaunch | API Key | Not documented | Unclear | Yes | Shopify POD |
| CustomCat | API Key | Not documented | Not documented | Yes ($0 plan) | Fast production, large catalog |

---

## Part 4 — Aggregator Platforms & Logistics APIs

### Syncee

- **Docs:** https://syncee.com/api (registration required for full access)
- **What it does:** B2B dropshipping marketplace — product import, inventory sync, order routing, price automation; 12,000+ verified suppliers
- **Auth:** API key
- **Pricing:** Free marketplace tier; retailer plans from ~$29–$129/month; API on higher tiers
- **Rate limits:** Not documented
- **Webhooks:** Not documented
- **Notable:** Shopify, WooCommerce, BigCommerce, Wix, Ecwid; DataFeed Manager for CSV/XML; Alibaba direct integration; EU/US supplier focus

---

### Tradelle

- **Docs:** https://www.tradelle.io
- **What it does:** Product research + supplier platform; trending products with sales data, one-click Shopify import, order automation
- **Auth:** N/A — no public REST API
- **Notable:** Platform/SaaS only; Shopify app integration; not suitable for headless builds

---

### Doba

- **Docs:** https://open.doba.com/apidoc/supplier
- **Base URL:** `https://open.doba.com/`
- **What it does:** Product catalog, order management, shipping, inventory; both Retailer API and Supplier API
- **Auth:** RSA asymmetric key pair (upload public key; Doba signs with private key)
- **Pricing:** Subscription-based (~$24.99–$49.99/month); API requires additional developer approval
- **Rate limits:** Not published
- **Webhooks:** Not confirmed
- **Notable:** Separate Supplier and Retailer APIs; US-focused supplier network; AI-assisted features

---

### SaleHoo

- **Docs:** https://www.salehoo.com/api (gated; approval required)
- **What it does:** Supplier directory API — 8,000+ verified suppliers, product data for custom integrations
- **Auth:** Not publicly documented; developer partner registration required
- **Pricing:** $67/year (Directory) or $27/month (Dropship); API is a separate gated developer program
- **Rate limits:** Not documented
- **Notable:** Pre-vetted suppliers; SDK samples post-approval; no instant self-service

---

### Dropified

- **Docs:** https://www.dropified.com
- **What it does:** AI-powered dropshipping automation — AliExpress, Amazon, Alibaba, eBay imports; order fulfillment; AI content generation
- **Auth:** N/A — no public REST API
- **Pricing:** ~$47–$127/month; Shopify/WooCommerce app only
- **Notable:** No developer API; SaaS tool only

---

### AppScenic

- **Docs:** https://appscenic.com/integrations | https://helpdesk.appscenic.com
- **What it does:** Supplier-facing Public API — create/update products, sync stock/prices, sync orders 24/7, push tracking numbers
- **Auth:** Bearer token (Settings → API → Generate New Token)
- **Pricing:** Subscription from ~$24/month; API included with supplier account
- **Rate limits:** Not documented
- **Webhooks:** Yes — order and tracking events
- **Notable:** 1M+ EU/US/UK products; Shopify and WooCommerce direct integrations; 24/7 automated order sync

---

### EasyPost

- **Docs:** https://docs.easypost.com/
- **Base URL:** `https://api.easypost.com/v2`
- **What it does:** Multi-carrier shipping — create shipments, compare rates, purchase labels, address validation, package tracking, insurance; 100+ carriers (USPS, UPS, FedEx, DHL, etc.)
- **Auth:** API key (`Authorization: EasyPost <API_KEY>`; separate test/live keys)
- **Rate limits:** 5 req/s on index endpoints; HTTP 429
- **Pricing:** Usage-based; free up to 3,000 labels/month; enterprise negotiated rates
- **Webhooks:** Yes — tracking updates, label creation events
- **Notable:** 100+ carrier integrations; client libraries for Python, Ruby, Go, PHP, Java, .NET, Node.js; 99.99% uptime SLA; customs/duties support

---

### Shippo

- **Docs:** https://docs.goshippo.com/
- **Base URL:** `https://api.goshippo.com`
- **What it does:** Multi-carrier shipping — rates, label purchase, address validation, batch labels, shipment tracking, return labels
- **Auth:** API token header (`Authorization: ShippoToken <API_TOKEN>`); live (`shippo_live_`) and test (`shippo_test_`) keys; JWT also available
- **Rate limits:** Per-endpoint (GET vs POST differ); returns HTTP 429
- **Pricing:** Pay-per-label; free dev/test mode; subscription billing direction as of 2025
- **Webhooks:** Yes — tracking events; expects 200 within 3 seconds
- **Notable:** Batch label creation; return label generation; Shippo carrier discounts; 40+ carriers; test/live mode separation

---

### AfterShip Tracking API

- **Docs:** https://www.aftership.com/docs/tracking
- **Base URL:** `https://api.aftership.com/tracking/2026-01`
- **What it does:** Multi-carrier shipment tracking — create/manage trackings, real-time status, push to customers
- **Auth:** `as-api-key` header; OAuth 2.0 also supported
- **Rate limits:** 5 req/s GET; HTTP error on breach
- **Pricing:** Min $99/month to use Tracking API; portal-only on free plan
- **Webhooks:** Yes — HMAC-SHA256 signed (`aftership-hmac-sha256` header); multiple webhook URLs; versioned independently
- **Notable:** 1,200+ carrier integrations; AI-powered EDD; branded tracking pages; courier auto-detection; Klaviyo integration; API versioned as `2026-01`

---

### 17track

- **Docs:** https://api.17track.net/en/doc
- **Base URL:** `https://api.17track.net/track/v2.4`
- **What it does:** Logistics tracking — register tracking numbers, poll status, webhook push; 3,186+ carriers globally; full lifecycle from InfoReceived through Delivered/Exception
- **Auth:** `17token` header; IP whitelist enforced
- **Rate limits:** 3 req/s; max 40 tracking numbers per request; ~400k registrations/hour throughput; HTTP 429
- **Pricing:** 200 free tracking numbers (one-time as of Jan 2026); paid quota packs for volume; real-time mode costs 10 quotas per request
- **Webhooks:** Yes — SHA256 signed; events `TRACKING_UPDATED`, `TRACKING_STOPPED`; 3 retries at 600s/1800s/3600s intervals
- **Notable:** 3,186+ carriers; real-time tracking mode; 9 main statuses + 30 sub-statuses; multi-language event translation; carrier auto-detection

---

### ParcelPanel (ParcelWILL)

- **Docs:** https://docs.parcelpanel.com/shopify/api-webhook/api-v2/
- **Base URL:** `https://open.parcelwill.com`
- **What it does:** Order tracking API for Shopify — tracking status, shipment checkpoints, carrier info, EDD, full order details
- **Auth:** `x-parcelpanel-api-key` header
- **Rate limits:** 120 req/min; HTTP 429
- **Pricing:** Bundled with ParcelPanel/ParcelWILL Shopify app subscription
- **Webhooks:** Yes — v2.0 real-time shipment events (v1.0 also supported)
- **Notable:** Order-level tracking (not just tracking number); React headless components for Shopify Hydrogen; rich customer/product data in response; SDKs for Python, Node.js, PHP, Go, Java, C#, Ruby

---

### Route (Package Protection)

- **Docs:** https://docs.route.com/
- **What it does:** Shipping insurance/package protection — opt-in widget at checkout, order/shipment creation in Route system, automated claim resolution for loss/theft/damage
- **Auth:** Merchant account credentials (onboarding at dashboard.route.com)
- **Rate limits:** Not documented
- **Pricing:** Free to merchants; Route earns from protection premium charged to customers (~1-2% of order or flat rate)
- **Webhooks:** Yes — refund and replacement events for automated claim resolution
- **Notable:** No per-call fees; client-side JS widget; covers loss/theft/damage; multi-shipment order support; BigCommerce, Shopify, WooCommerce native integrations

---

### Aggregator / Logistics Summary

| API | Type | Auth | Public API | Webhooks | Rate Limit | Pricing |
|---|---|---|---|---|---|---|
| Syncee | Aggregator | API Key | By tier | Not documented | Not documented | Subscription |
| Tradelle | Aggregator | N/A | No | No | N/A | Subscription |
| Doba | Aggregator | RSA key pair | Approval required | Not confirmed | Not documented | Subscription + approval |
| SaleHoo | Aggregator | Not specified | Approval required | Not documented | Not documented | Subscription + approval |
| Dropified | Aggregator | N/A | No | No | N/A | Subscription |
| AppScenic | Aggregator | Bearer Token | Yes (Supplier) | Yes | Not documented | Subscription |
| EasyPost | Shipping | API Key | Yes | Yes | 5 req/s | Pay-per-label; 3k free/month |
| Shippo | Shipping | API Token | Yes | Yes | Per-endpoint | Pay-per-label |
| AfterShip | Tracking | API Key / OAuth | Yes | Yes (HMAC-SHA256) | 5 req/s GET | $99/month min |
| 17track | Tracking | 17token header | Yes | Yes (SHA256) | 3 req/s, 40/req | Quota-based; 200 free |
| ParcelPanel | Tracking | API Key | Yes (Shopify) | Yes | 120 req/min | App subscription |
| Route | Protection | Account creds | Yes | Yes | Not documented | Free (revenue share) |

---

## Prioritized Integration Candidates

Based on research, the strongest candidates for integration into this project:

### Tier 1 — Best API quality + free access
| API | Reason |
|---|---|
| **CJDropshipping** | Full public docs, free with account, sandbox, webhooks, global sourcing |
| **Printful** | Industry standard POD, 120 req/min, 13+ webhook events, mockup generation |
| **Printify** | 600 req/min, HMAC webhooks, multi-provider, OpenAPI spec + Postman |
| **Gelato** | Global POD network (30+ countries), free, template-based products |
| **EasyPost** | 100+ carriers, 3k free/month labels, 99.99% SLA, rich client libraries |
| **17track** | 3,186 carriers, free quota, webhook-based, excellent tracking data |

### Tier 2 — Worth considering
| API | Reason |
|---|---|
| **Yakkyofy** | Public docs, 60 req/min, webhook-based, EU/COD order support |
| **BigBuy** | EU wholesale leader, 24-language data, REST API (paid plan required) |
| **AppScenic** | Supplier-facing API with webhooks, EU/US/UK products |
| **Shippo** | Solid shipping API, test/live separation, batch labels |
| **CustomCat** | Free plan, 500+ products, one of the fastest POD production times |

### Tier 3 — Approval-gated or limited
| API | Reason |
|---|---|
| AliExpress Open Platform | Powerful but approval process and new platform migration friction |
| Inventory Source | Enterprise-grade but expensive ($99–$150/month) |
| AfterShip | 1,200+ carriers but $99/month minimum is a barrier |
| Wholesale2B | Paid API plan; white-label use case |
