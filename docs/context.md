# Ubiquitous Language

- **Customer**: A retail (B2C) buyer interacting with the automated checkout flow. They browse the catalog, maintain a cart, and execute payments online. They are distinct from wholesale/B2B buyers, whose relationships and custom invoicing are handled entirely offline and manually.
- **Administrator**: An internal staff member with access to the dashboard. They fulfill orders, manage product inventory, and define promotions.
- **Partial Cancellation**: The act of cancelling and refunding an individual line-item within an order (e.g. due to localized stockouts), while allowing the rest of the order to proceed to fulfillment.
- **Inventory Unit (Meter)**: The fundamental unit of stock. A cart quantity of `5` represents a request for one continuous 5-meter cut of fabric from a larger roll, rather than 5 separate pre-cut pieces. The system tracks total available meters globally, leaving the physical management of individual rolls/bolts to the warehouse staff offline.
- **Minimum Order Quantity (MOQ)**: The smallest length of fabric a Customer is allowed to purchase in a single cut (e.g., 2 meters). This prevents unprofitable remnant orders and ensures fulfillment overhead is covered per line-item.
- **Discount Stacking**: The system evaluates promotional coupons against the final cart subtotal, meaning coupons stack cleanly on top of any direct product markdowns.
- **Hard Allocation**: Inventory is only decremented and secured for a Customer at the exact moment of checkout/payment. Items sitting in a cart are not reserved, meaning customers can be beaten to the punch for low-stock items.
- **Refund Only (Shrinkage)**: Processing a refund without incrementing the inventory back into the active pool. Used for damaged or unsellable returns.
- **Category vs Collection**: A Category is a strict 1-to-1 structural classification of a product (e.g., "Silk"). A Collection is a flexible many-to-many thematic grouping (e.g., "Summer Edit") that a product can be tagged into for marketing purposes.
- **Structured Content Block**: Pre-defined CMS schemas for marketing sections (e.g., expecting distinct `heading`, `image_url`, and `cta_link` fields) rather than raw HTML. This enforces design consistency and prevents layout breakage.
- **Auto-Capture**: Razorpay immediately withdraws funds upon successful checkout authorization, ensuring upfront cashflow.
- **Payment Timeout**: A strict 1-hour window for an order to move from 'pending' to 'paid'. If payment is not finalized in this window, the order auto-cancels and releases its Hard Allocated inventory.
