# Implementation Plan: "Magic Invoice" (Aggressive Auto-Save)

## Objective
Streamline the receipt import process to be zero-friction for the user. The system will automatically process the OCR data, match what it can, create new items for what it can't, and save the trip immediately without requiring user review.

## 1. New "Success" Page
Create a destination page for the user to land on immediately after the upload/processing hand-off.
- **File**: `app/receipts/upload-success/page.tsx`
- **UI**:
  - Celebration animation (e.g., Checkmark).
  - Message: "Receipt Saved! We've added [X] items to your pantry."
  - Primary Action: "View Trip" (Links to the specific trip details).
  - Secondary Action: "Scan Another".
  - Tertiary Action: "Go to Dashboard".

## 2. Refactor `app/receipts/import/[id]/page.tsx` ("The Engine")
Transform this page to support a "Headless" / "Auto-Pilot" mode. It will serve as the processing engine.

### A. New Query Param `?autopilot=true`
- Add logic to check for this URL search param.
- If present, hide the interactive Editor UI and show a "Processing..." overlay instead.

### B. Auto-Confirm Logic
Modify the `reconcile` (or post-reconcile) logic:
- **Matched Items**: Keep existing logic (Strategy 0-D). Mark `isConfirmed = true`.
- **Unmatched Items**: 
  - Instead of flagging as `status: 'new'`, status becomes `status: 'new_auto'`.
  - Copy `ocrName` to `newItemName`.
  - Mark `isConfirmed = true`.
- **Low Confidence**: Auto-confirm anyway (trust the AI/OCR best guess).

### C. Auto-Save Trigger
- Use a `useEffect` to monitor the reconciliation completion.
- If `autopilot=true` and `rows.length > 0` and `!saving`:
  - Trigger `handleSaveTrip()` immediately.

### D. Redirect
- On successful save, redirect to `/receipts/upload-success`.

## 3. Update Redirect Flow
Modify the entry point where the user takes the photo or uploads the file.
- **File**: `app/receipts/import-external/route.ts` usually handles external, but user flow is likely in `app/components/ReceiptPhotoCapture.tsx` or `app/receipts/page.tsx`.
- **Action**: Change the `router.push` destination from `/receipts/import/${id}` to `/receipts/import/${id}?autopilot=true`.

## 4. (Optional) Safety Valve
Add a "Stop Auto-Pilot" button on the processing overlay in case it hangs or the user *wants* to intervene manually (hidden under a "Review Manually" link).

## Risks & Mitigations
- **Duplicate Items**: "Oat Milk" vs "Oatmilk". 
  - *Mitigation*: We will build a separate "Item Merge Tool" for admins later.
- **Bad Prices**: AI reads $500 instead of $5.
  - *Mitigation*: The stored trip is editable. Users can fix it on the Trip Detail page if they care.

## Execution Order
1. Create `upload-success` page.
2. Modify `import/[id]/page.tsx` to handle `autopilot` param and auto-save logic.
3. Update `ReceiptPhotoCapture` / Upload flow to trigger autopilot.
4. Verify "Ground Beef" and other items still process correctly in this new mode.
