# Checkout Page Matching the Reference

## Goal
Replace the current small order-review popup with a full checkout experience matching the supplied TikoHUB screenshots on desktop and mobile.

## What will change
- Keep **Continue** below the combined ticket and merchandise total.
- Open checkout as a full page-style view with the existing TikoHUB header.
- Add the three-step progress indicator: Details, Payment, Confirm.
- Build a left-side **Order Summary** showing selected tickets, quantities, dates, selected jerseys, sizes, prices, and the combined total.
- Build the **Your Details** section with full name, email, phone number, discount code, promo/agent code, and terms agreement.
- Build the **Payment Method** section with selectable M-Pesa Paybill, Card, and M-Pesa Prompt options.
- Add Back and Pay controls styled and positioned like the reference.
- Preserve the user's ticket and merchandise selections when entering or leaving checkout.
- Stack sections cleanly on mobile while keeping the summary visible and readable.

## Interaction details
- Required fields and terms must be completed before payment can proceed.
- Payment options are selectable, with the active option clearly highlighted.
- Back returns to the event booking view without losing selections.
- Pay shows a confirmation state rather than attempting a real transaction.

## Validation
- Test ticket-only, merchandise-only, and combined orders.
- Verify the combined total and item details in checkout.
- Check desktop and mobile layouts and confirm there are no browser errors.
