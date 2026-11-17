# Architecture Document 03: UI/UX & Storefront Design System Specification
## Design Tokens, Component Standards & Customer Journey Wireframes

---

### 1. Design System Philosophy: Modern, Accessible, Mobile-First

Our storefront design marries the high-conversion utility of global retail giants (Amazon/Shopify) with the sleek, polished aesthetics of modern tech brands (Apple/Vercel).

*   **Primary Design Goals:**
    1. **Sub-second perceived load time:** Skeleton placeholders, instant optimistic updates.
    2. **Frictionless checkout:** 1-click buy options, local payment emphasis (COD, JazzCash).
    3. **Category-Adaptive UX:** The UI adapts automatically whether the customer is browsing sneakers (visual swatches, size guides) or laptops (side-by-side spec comparisons, benchmark badges).

---

### 2. Design Tokens & Styling Foundation

#### 2.1 Color Palette
```css
/* Core Color Tokens (Tailwind CSS Mapping) */
:root {
  /* Brand Primary: Deep Slate Indigo (High trust, premium) */
  --primary: 222 47% 11%;          /* #0f172a */
  --primary-foreground: 210 40% 98%;

  /* Accent: Vibrant Electric Cobalt (Call-to-Actions, Badges) */
  --accent: 221 83% 53%;           /* #2563eb */
  --accent-foreground: 210 40% 98%;

  /* Secondary: Soft Slate */
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222 47% 11.2%;

  /* Status Colors */
  --success: 142 76% 36%;          /* #16a34a (In Stock, Paid) */
  --warning: 38 92% 50%;           /* #f59e0b (Low Stock, Pending) */
  --danger: 0 84% 60%;             /* #dc2626 (Out of Stock, Cancelled) */

  /* Surface & Background */
  --background: 0 0% 100%;         /* Crisp white */
  --card: 0 0% 100%;
  --border: 214.3 31.8% 91.4%;
  --radius: 0.5rem;                /* 8px standard rounded corner */
}
```

#### 2.2 Typography
*   **Primary English Font:** `Plus Jakarta Sans` or `Inter` (Geometric sans-serif, high readability on mobile screens).
*   **Urdu/Arabic Fallback:** `Noto Nastaliq Urdu` / `Noto Sans Arabic` (Smooth rendering for localized UI elements).
*   **Hierarchy:**
    *   `Display H1`: 32px / 40px (Bold) - Homepage hero headings.
    *   `H2`: 24px / 32px (Semi-bold) - Section & Category headers.
    *   `H3`: 18px / 24px (Medium) - Product card titles.
    *   `Body`: 14px / 20px (Regular) - Descriptions and specs.
    *   `Caption`: 12px / 16px (Medium) - Badges, SKUs, timestamps.

---

### 3. Storefront Screen Wireframes & UX Layouts

#### 3.1 Global Header & Navigation
```
+-----------------------------------------------------------------------------------------+
| [🇵🇰 PKR | Free Delivery over Rs. 2,999]                     [Track Order]  [Help]       |
+-----------------------------------------------------------------------------------------+
| [ BRAND LOGO ]   [ 🔍 Search 50,000+ Products or Ask AI...               ] [Wish] [Cart (2)] |
+-----------------------------------------------------------------------------------------+
| [☰ All Categories]  Fashion  |  Laptops & Tech  |  Mobiles  |  Accessories  |  Flash Deals 🔥|
+-----------------------------------------------------------------------------------------+
```
*   **Sticky Search with AI Trigger:** Customers can type traditional keywords or natural sentences (*"Best laptop under 150k PKR"*).
*   **Mega Menu:** Multi-column visual dropdown with category thumbnails.

---

#### 3.2 Product Listing Page (PLP) & Faceted Dynamic Filtering
The sidebar adapts in real-time based on the category:

```
+-----------------------+-----------------------------------------------------------------+
| FILTERS               | Category: Laptops (124 items)              [Sort: Popularity ▾] |
+-----------------------+-----------------------------------------------------------------+
| Price Range (PKR)     | +-------------------+  +-------------------+  +---------------+ |
| [ 50,000 - 300,000 ]  | | [ Laptop Image ]  |  | [ Laptop Image ]  |  | [ Image ]     | |
|                       | | ⭐ 4.8 (34)       |  | ⭐ 4.9 (12)       |  | ⭐ 4.6 (8)    | |
| Category: Tech        | | Ultrabook Pro 14  |  | ThinkPad Carbon 9 |  | Dell XPS 13   | |
| [ ] 8GB RAM           | | 16GB / 512GB SSD  |  | 32GB / 1TB SSD    |  | 16GB / 512GB  | |
| [x] 16GB RAM          | | Rs. 285,000       |  | Rs. 380,000       |  | Rs. 295,000   | |
| [ ] 32GB RAM          | | [⚡ Quick Add]    |  | [⚡ Quick Add]    |  | [⚡ Quick Add]| |
|                       | +-------------------+  +-------------------+  +---------------+ |
| Storage:              |                                                                 |
| [x] 512GB SSD         | +-------------------+  +-------------------+  +---------------+ |
| [ ] 1TB SSD           | | ...               |  | ...               |  | ...           | |
+-----------------------+-----------------------------------------------------------------+
```
*   **Fashion View:** Automatically swaps RAM/Storage filters for **Size (S, M, L, XL)** and **Color Swatches (Hex Circles)**.

---

#### 3.3 Product Detail Page (PDP) Architecture
Designed for maximum conversion with clear confidence indicators:

```
+-----------------------------------------------------------------------------------------+
| Home > Tech > Laptops > Ultrabook Pro 14                                                |
+-----------------------------------------+-----------------------------------------------+
|                                         | BRAND: ProTech                                |
|  +-----------------------------------+  | Ultrabook Pro 14 (OLED, Intel Ultra 7)       |
|  |                                   |  | ⭐⭐⭐⭐⭐ 4.8 (89 Verified Reviews)           |
|  |                                   |  +-----------------------------------------------+
|  |       HIGH-RES PRODUCT IMAGE      |  | Price: Rs. 285,000  (Was: Rs. 310,000) 8% OFF |
|  |           WITH ZOOM               |  +-----------------------------------------------+
|  |                                   |  | Choose RAM & Storage:                         |
|  +-----------------------------------+  | [ 16GB / 512GB ]  [ 32GB / 1TB ]              |
|                                         |                                               |
|  [Thumb 1] [Thumb 2] [Thumb 3] [Thumb 4]| Color: [ Space Gray ● ]  [ Midnight Black ● ] |
|                                         +-----------------------------------------------+
|                                         | Quantity: [ - ] 1 [ + ]   🟢 14 units in stock|
|                                         +-----------------------------------------------+
|                                         | [ 🛒 ADD TO CART ]    [ ⚡ BUY WITH 1-CLICK ] |
|                                         +-----------------------------------------------+
|                                         | 🚚 Delivery to Karachi/Lahore in 2-3 Days     |
|                                         | 🛡️ 1-Year Official Brand Warranty             |
|                                         | 🔄 7-Day Easy Return Policy                   |
+-----------------------------------------+-----------------------------------------------+
| SPECIFICATIONS TABLE                    | VERIFIED CUSTOMER REVIEWS                     |
| Processor: Intel Core Ultra 7 155H      | "Fast delivery to Islamabad, authentic item!" |
| Display: 14" OLED 120Hz 2.8K            |                                               |
+-----------------------------------------+-----------------------------------------------+
```

---

#### 3.4 Multi-Step Checkout Flow (Pakistan Optimized)

```
[ Step 1: Delivery Address ] ➔ [ Step 2: Shipping Method ] ➔ [ Step 3: Payment ] ➔ [ Confirm ]
```

*   **Step 1: Address:**
    *   City Autocomplete (Karachi, Lahore, Islamabad, Rawalpindi, Faisalabad, etc.).
    *   Phone number formatting with `+92` auto-prefix.
*   **Step 2: Shipping:**
    *   Standard Delivery (TCS / Leopards: 2-4 days) - Free or Flat Rs. 250.
    *   Express Same-Day Delivery (Major cities only).
*   **Step 3: Payment Selection:**
    *   🔘 **Cash on Delivery (COD)** (Verified with SMS OTP on orders above Rs. 10,000).
    *   🔘 **JazzCash** (Instant Mobile Wallet / Debit Card).
    *   🔘 **Easypaisa** (Instant Mobile Account / Debit Card).
    *   🔘 **Debit / Credit Card** (Visa / Mastercard via secure gateway).
*   **Order Confirmation Screen:**
    *   Shows Order Number (`ORD-202611-0012`), breakdown invoice, and real-time package tracking link.

---

### 4. Mobile Responsive Architecture (Bottom Navigation Bar)

On screen widths under 768px (Mobile), desktop navigation collapses into an intuitive native-app-style bottom navigation bar:

```
+-------------------------------------------------------+
|   🏠          📂           ❤️          🛒          👤   |
|  Home     Categories    Wishlist    Cart (2)    Account |
+-------------------------------------------------------+
```
*   **Mobile PDP:** Sticky bottom bar with **[ Price: Rs. 285,000 | Add to Cart ]** button always within thumb reach.
