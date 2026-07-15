# Mithila Enterprise Platform Overview

Mithila Enterprise is a full-stack, direct-to-consumer (D2C) and business-to-business (B2B) e-commerce platform built for artisan weavers, designers, and fabric buyers. It handles everything from public product catalogs to secure payments, B2B wholesale applications, and a complete administrative dashboard (Executive Ledger).

Here is a comprehensive, detailed breakdown of how the entire website works, its workflows, and its underlying architecture.

---

## 1. System Architecture

The application is built on a **modern Serverless + Backend-as-a-Service (BaaS)** stack. This architecture minimizes server maintenance while providing high performance and enterprise-grade security.

### Tech Stack Overview
- **Frontend & Backend Framework:** [Next.js 16 (App Router)](https://nextjs.org/)
- **Hosting & Compute:** [Vercel](https://vercel.com/) (Serverless Edge Functions)
- **Database & Authentication:** [Supabase](https://supabase.com/) (PostgreSQL & GoTrue Auth)
- **Payment Gateway:** [Razorpay](https://razorpay.com/)
- **Email Notifications:** [Resend](https://resend.com/)
- **WhatsApp API:** Meta Cloud Graph API
- **AI Integration:** Google Gemini (For automated fabric metadata extraction in the admin panel)

### How Data Flows (The "Brain" of the App)
1. **The Browser:** Customers interact with a React 19 interface. Pages are static (fast loading) where possible, and dynamic where required (like the cart or checkout).
2. **The Edge Proxy:** When a request hits the server, a Vercel Edge Proxy handles rate-limiting (preventing spam) and verifies the user's session before they can access protected routes like `/account` or `/admin`.
3. **Server Actions (Mutations):** When a user submits a form (e.g. updating an order), Next.js securely processes this directly on the server.
4. **The Database (PostgreSQL):** Supabase stores all data. The most critical design choice in this platform is that **all money, inventory, and security logic lives directly in the database using Row Level Security (RLS) and strict SQL functions**. 
   - *Example*: A compromised user account physically cannot force a discount or change a price because the database calculates the final price securely.

---

## 2. Core Workflows

### A. The Customer Shopping Journey (B2C)
1. **Discovery:** The user browses the storefront. The catalog is pre-rendered for SEO and speed. Users can filter by Categories (e.g., "Silk") or Collections (e.g., "Summer Edit").
2. **Cart:** The cart is managed entirely in the user's browser (using Zustand state management). Items in the cart are **not** reserved (Hard Allocation only happens at payment).
3. **Checkout & Payment:** 
   - The user proceeds to checkout. The server calculates the exact total (applying valid discounts). 
   - Razorpay opens and takes payment.
   - Razorpay sends a secure Webhook to the server confirming payment.
   - The server instantly decrements the stock in the database and marks the order as `paid`.
   - The user's order appears in `/account/orders`.

### B. Wholesale & B2B Inquiry Workflow
1. **Form Submission:** A business visits `/wholesale` or `/contact` and submits their details.
2. **Database Logging:** The submission is securely saved to the `wholesale_applications` or `contact_inquiries` tables.
3. **Instant Notifications:** 
   - An email is fired via **Resend** to the support team.
   - A WhatsApp message is instantly pushed to the admin's phone using the Meta API.
4. **Admin Review:** The admin opens the Executive Ledger (Dashboard), sees the pending application, and processes it offline.

### C. The Admin Experience (Executive Ledger)
The admin portal (`/admin`) is heavily guarded. It provides staff with:
- **Dashboard:** Live metrics for gross revenue, pending orders, and low-stock alerts.
- **Inventory Management:** Full control over product variants, categories, and stock counts.
- **AI Ingestion:** Admins can upload a fabric image, and **Google Gemini** will automatically generate SEO descriptions, detect weave structures, and draft the product variants.
- **Order Fulfillment:** Admins track orders, update their status to "Shipped", and handle partial cancellations or refunds.

---

## 3. Database Design & Security

### The Schema
The PostgreSQL database is heavily normalized. Key tables include:
- `profiles`: User accounts and roles (admin vs customer).
- `products` & `product_variants`: The catalog. Variants hold specific colors and the actual `stock_quantity`.
- `orders` & `order_items`: Customer purchases.
- `discounts`: Promotional codes.
- `wholesale_applications` & `contact_inquiries`: Lead generation tracking.

### The Security Model (Row Level Security)
The database acts as the ultimate security boundary:
- **Customers** can only `SELECT` their own orders. They cannot see anyone else's.
- **Admins** bypass these rules to see everything.
- **Atomic Transactions:** When an order is placed, the database locks the exact rows for those fabrics (`FOR UPDATE`). It checks the stock, applies the discount, and deducts the inventory in a single atomic sweep. This guarantees **zero overselling**, even if 100 people try to buy the last meter of silk at the exact same millisecond.

---

## 4. Key Business Rules
- **Inventory is measured in Meters:** A cart quantity of `5` means a continuous 5-meter cut, not 5 separate pieces.
- **Payment Timeouts:** If a user starts checkout but doesn't pay within 1 hour, a background job auto-cancels the pending order and releases the reserved stock back to the public.
- **Refunds (Shrinkage):** If fabric is returned damaged, admins can process a refund without putting the damaged fabric back into the active inventory pool.

---

## 5. Deployment & CI/CD
- **Continuous Integration (CI):** Every push to GitHub runs a rigorous Playwright End-to-End (E2E) testing suite to automatically browse the site like a real user and verify checkout still works.
- **Hosting:** Vercel automatically deploys the `master` branch.
- **Documentation:** The repository contains a `docs/` folder with detailed checklists (`pre_deploy_checklist.md`, `deployment.md`) to ensure operations are smooth.
