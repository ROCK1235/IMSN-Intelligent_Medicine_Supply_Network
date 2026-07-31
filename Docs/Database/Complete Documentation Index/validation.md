# IMSN - Validation Rules & Business Logic

**Version:** 1.0  
**Created:** July 31, 2026  
**For:** Frontend Validators & Backend DTOs

---

## Table of Contents

1. [User Management Validations](#user-management-validations)
2. [Hospital Management Validations](#hospital-management-validations)
3. [Medicine & Category Validations](#medicine--category-validations)
4. [Inventory Validations](#inventory-validations)
5. [Exchange Process Validations](#exchange-process-validations)
6. [Business Rule Validations](#business-rule-validations)
7. [Zod Schema Templates](#zod-schema-templates)

---

## User Management Validations

### User Creation & Registration

```yaml
Field: firstName
  Type: String
  Required: true
  Length: 2-50
  Pattern: /^[a-zA-Z\s'-]+$/
  Transform: trim()
  Error: "First name must be 2-50 characters, letters only"
  
Field: lastName
  Type: String
  Required: true
  Length: 2-50
  Pattern: /^[a-zA-Z\s'-]+$/
  Transform: trim()
  Error: "Last name must be 2-50 characters, letters only"
  
Field: email
  Type: String
  Required: true
  Unique: true
  Transform: lowercase(), trim()
  Pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  Validation: RFC 5322 compliant
  Error: "Invalid or already registered email address"
  Database Check: Case-insensitive unique index
  
Field: phoneNumber
  Type: String
  Required: false
  Unique: true (if provided)
  Length: 10-15 (international)
  Pattern: /^[\d\s\-\+\(\)]+$/
  Validation: E.164 format (international)
  Error: "Invalid phone number format"
  
Field: password
  Type: String
  Required: true (on signup)
  Length: 8-128
  Complexity Rules:
    - Must contain 1+ uppercase letter (A-Z)
    - Must contain 1+ lowercase letter (a-z)
    - Must contain 1+ digit (0-9)
    - Must contain 1+ special char (!@#$%^&*)
    - Cannot contain common passwords (top 10000)
  Hashing: bcrypt(rounds: 12)
  Error: "Password does not meet complexity requirements"
  
Field: role
  Type: ObjectId
  Required: true
  Validation: Must reference existing role
  Database Check: Foreign key constraint
  Error: "Invalid role selected"
  
Field: hospital
  Type: ObjectId
  Required: conditional
  Validation: 
    - If role = "hospital_manager" or "staff", required
    - If role = "admin", must be null
    - Hospital must exist and isActive = true
  Error: "Hospital assignment invalid for this role"
  
Field: branch
  Type: ObjectId
  Required: false
  Validation:
    - If provided, must reference existing branch
    - Branch must belong to assigned hospital
    - Branch must be isActive = true
  Error: "Branch must belong to assigned hospital"
```

### Password Management

```yaml
Login Attempt Validation:
  Max Failed attempts: 5
  Lockout duration: 15 minutes
  Response: "Account locked. Try again after 15 minutes"
  Reset procedure: Send unlock email or contact admin

Change Password Flow:
  Field: currentPassword
    Validation: Must match user's existing password
    Error: "Current password is incorrect"
    
  Field: newPassword
    Validation: Must meet complexity requirements (see above)
    Validation: Cannot be same as current password
    Validation: Cannot be in last 5 passwords (if implemented)
    Error: "New password does not meet requirements"
    
  Field: confirmPassword
    Validation: Must match newPassword exactly
    Error: "Passwords do not match"

Forgot Password Flow:
  Field: email
    Validation: Must exist in system
    Action: Send reset email with token
    
  Reset Token:
    Duration: 30 minutes (expires)
    One-time use: true
    Format: Secure random token, hashed for storage
    
  Field: newPassword
    Validation: Same as change password rules
    Action: Update password, invalidate all refresh tokens
```

---

## Hospital Management Validations

### Hospital Registration & Management

```yaml
Field: name
  Type: String
  Required: true
  Unique: true
  Length: 3-100
  Transform: trim()
  Error: "Hospital name must be 3-100 unique characters"

Field: registrationNumber
  Type: String
  Required: true
  Unique: true
  Length: 5-50
  Pattern: /^[A-Z0-9\-]+$/
  Validation: Format: [STATE_CODE]-[REG_NUMBER]
  Example: "AP-HC-0001234"
  Error: "Invalid registration number format"
  
Field: licenseNumber
  Type: String
  Required: true
  Unique: true
  Length: 5-50
  Validation: Must match state regulatory format
  Error: "Invalid license number"

Field: organizationType
  Type: String
  Required: true
  Enum: ["government", "private", "ngo", "research", "teaching"]
  Error: "Must select valid organization type"

Field: email
  Type: String
  Required: true
  Unique: true
  Pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  Error: "Invalid or duplicate email"

Field: phoneNumber
  Type: String
  Required: true
  Length: 10-15
  Pattern: /^[\d\s\-\+\(\)]+$/
  Error: "Invalid phone number"

Field: address.street
  Type: String
  Required: true
  Length: 5-100
  Error: "Street address required"

Field: address.city
  Type: String
  Required: true
  Length: 2-50
  Error: "City required"

Field: address.state
  Type: String
  Required: true
  Length: 2-50
  Validation: Valid Indian state
  Error: "Invalid state"

Field: address.postalCode
  Type: String
  Required: true
  Pattern: /^[0-9]{6}$/  # Indian PIN code
  Validation: Valid PIN code format
  Error: "Invalid postal code (6 digits required)"

Field: address.latitude
  Type: Number
  Required: true
  Range: -90 to 90
  Validation: Valid latitude coordinate
  Error: "Invalid latitude"

Field: address.longitude
  Type: Number
  Required: true
  Range: -180 to 180
  Validation: Valid longitude coordinate
  Error: "Invalid longitude"

Field: bedsCount
  Type: Number
  Required: true
  Min: 1
  Max: 10000
  Integer: true
  Error: "Beds count must be 1-10000"

Field: specializations
  Type: Array of String
  Required: false
  Max items: 20
  Pattern: /^[a-zA-Z\s]+$/
  Examples: ["cardiology", "neurology", "oncology", "orthopedics"]
  Error: "Invalid specialization format"

Field: accreditations
  Type: Array of String
  Required: false
  Enum: ["JCI", "NABH", "AABB", "CAP", "CLIA", "ISO"]
  Error: "Invalid accreditation"

Field: taxId (GSTIN)
  Type: String
  Required: true
  Pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[0-9]{1}$/
  Format: [State Code][Pan Part][Unit Code][Entity Type][Sub-type][Check Digit]
  Example: "27AABCT1234N1Z5"
  Validation: Valid GSTIN for India
  Error: "Invalid GSTIN format"

Hospital Status Workflow:
  New Registration:
    - isActive: false
    - isVerified: false
    - Status: "Pending verification"
    - Action: Admin reviews and verifies
    
  After Verification:
    - isActive: true
    - isVerified: true
    - verificationDate: (timestamp)
    - Status: "Active"
```

### Branch Management

```yaml
Field: name
  Type: String
  Required: true
  Length: 2-100
  Error: "Branch name required"

Field: code
  Type: String
  Required: true
  Unique: true (per hospital)
  Length: 3-20
  Pattern: /^[A-Z0-9\-]+$/
  Format: [HOSPITAL_ID]-[BRANCH_NUMBER]
  Example: "HOSP-001-MAIN", "HOSP-001-BRANCH2"
  Error: "Invalid branch code"

Field: branchType
  Type: String
  Required: true
  Enum: ["main", "satellite", "dispensary", "clinic", "pharmacy"]
  Error: "Invalid branch type"

Field: hospital
  Type: ObjectId
  Required: true
  Validation: Must reference existing hospital
  Error: "Hospital not found"

Field: address
  Type: Object (Embedded)
  Validation: Same as hospital address validation
  Required: true

Field: contactPerson
  Type: String
  Required: true
  Length: 2-100
  Pattern: /^[a-zA-Z\s'-]+$/

Field: email
  Type: String
  Required: true
  Pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Field: phoneNumber
  Type: String
  Required: true
  Length: 10-15
  Pattern: /^[\d\s\-\+\(\)]+$/

Field: bedsCount
  Type: Number
  Required: false
  Min: 0
  Integer: true

Field: operatingHours
  Type: Object (Embedded)
  Structure:
    monday:
      open: String (HH:MM)
      close: String (HH:MM)
    # ... tuesday through sunday
  Validation:
    - Format: "09:00", "17:00"
    - close time > open time
    - All days required

Field: medicineStorageCapacity
  Type: Number
  Required: false
  Min: 0
  Description: Storage units available

Field: refrigeratorCapacity
  Type: Number
  Required: false
  Min: 0
  Description: Cold storage units for temperature-sensitive medicines
```

---

## Medicine & Category Validations

### Medicine Category Validations

```yaml
Field: name
  Type: String
  Required: true
  Unique: true
  Length: 3-50
  Error: "Category name must be unique, 3-50 characters"

Field: code
  Type: String
  Required: true
  Unique: true
  Length: 3-20
  Pattern: /^[A-Z0-9\-]+$/
  Format: "ANTI-001" (Abbreviation + number)
  Error: "Invalid category code"

Field: description
  Type: String
  Required: false
  Length: max 500

Field: parentCategory
  Type: ObjectId
  Required: false
  Validation: Must reference existing category
  Validation: Cannot be circular (category → parent → ... → category)
  Error: "Invalid parent category"

Field: displayOrder
  Type: Number
  Required: false
  Default: 999
  Min: 0
  Description: For sorting categories in UI
```

### Medicine Master Validations

```yaml
Field: name
  Type: String
  Required: true
  Length: 2-100
  Unique with: manufacturer (compound unique)
  Error: "Medicine name required"

Field: genericName
  Type: String
  Required: true
  Length: 2-100
  Error: "Generic name required"

Field: strength
  Type: String
  Required: true
  Length: 2-20
  Pattern: /^[\d\.]+\s*(mg|mcg|g|ml|%|iu|mmol|meq)?$/
  Examples: "500mg", "10ml", "5%", "1000iu"
  Validation: Recognized units
  Error: "Invalid strength format. Use: 500mg, 10ml, 5%, etc."

Field: form
  Type: String
  Required: true
  Enum: ["tablet", "capsule", "injection", "syrup", "suspension", 
         "ointment", "lotion", "cream", "powder", "solution", 
         "inhaler", "patch", "drops", "spray"]
  Error: "Invalid medicine form"

Field: category
  Type: ObjectId
  Required: true
  Validation: Must reference existing category
  Error: "Invalid category"

Field: manufacturer
  Type: ObjectId
  Required: true
  Validation: Must reference existing manufacturer
  Error: "Invalid manufacturer"

Field: hsn_sac
  Type: String
  Required: true
  Pattern: /^[0-9]{8}[A-Z0-9]{0,2}$/
  Validation: Valid HSN/SAC code for India
  Example: "30049090AA"
  Error: "Invalid HSN/SAC code"

Field: gst_rate
  Type: Number
  Required: true
  Enum: [0, 5, 12, 18, 28]
  Description: GST percentage in India
  Error: "Invalid GST rate"

Field: registrationNumber
  Type: String
  Required: true
  Unique: true
  Length: 5-20
  Pattern: /^[A-Z0-9\-:]+$/
  Validation: Valid drug registration format
  Example: "IN-001:2024"
  Error: "Invalid registration number"

Field: isScheduled
  Type: Boolean
  Required: true
  Default: false
  
Field: scheduleType
  Type: String
  Required: conditional
  Required if: isScheduled = true
  Enum: ["H", "X", "L", "A", "C", "D", "E", "F", "G", "N"]
  Validation: India drug schedules
  Error: "Must specify schedule type for scheduled drugs"

Field: reorderLevel
  Type: Number
  Required: true
  Min: 0
  Integer: true
  Description: Trigger alert when stock falls below this
  Error: "Reorder level must be >= 0"

Field: maxStockLevel
  Type: Number
  Required: true
  Min: > reorderLevel
  Integer: true
  Description: Maximum recommended stock
  Error: "Max stock level must exceed reorder level"

Field: unitOfMeasure
  Type: String
  Required: true
  Enum: ["tablet", "capsule", "ml", "gm", "unit", "vial", "ampule", "strips"]
  Error: "Invalid unit of measure"

Field: shelfLife
  Type: Number
  Required: true
  Min: 1
  Max: 3650 (10 years)
  Unit: days
  Error: "Shelf life must be 1-3650 days"

Field: storageTemperature
  Type: String
  Required: true
  Enum: ["2-8°C", "15-25°C", "room_temperature", "below_25°C"]
  Examples:
    - "2-8°C": Refrigerated (vaccines, biologics)
    - "15-25°C": Room temperature with limits
    - "room_temperature": Standard room temp (no special care)
    - "below_25°C": Room temperature, don't exceed 25°C
  Error: "Invalid storage temperature"

Field: storageConditions
  Type: Array of String
  Required: false
  Enum: ["protect_from_light", "keep_dry", "protect_from_moisture", 
         "away_from_heat", "protect_from_air"]
  Max items: 5
  Error: "Invalid storage condition"

Field: unitCost
  Type: Number
  Required: true
  Min: 0.01
  Decimal places: 2
  Error: "Cost must be > 0"

Field: sellingPrice
  Type: Number
  Required: true
  Min: >= unitCost
  Decimal places: 2
  Validation: Price >= Cost (margin check)
  Error: "Selling price must be >= cost"
```

---

## Inventory Validations

### Stock In (Inventory Creation/Update)

```yaml
Field: hospital
  Type: ObjectId
  Required: true
  Validation: Must exist and be active

Field: branch
  Type: ObjectId
  Required: true
  Validation: Must exist, belong to hospital, be active

Field: medicine
  Type: ObjectId
  Required: true
  Validation: Must exist and be active

Field: quantityInStock
  Type: Number
  Required: true
  Min: 0
  Integer: true
  Validation: Non-negative count
  Error: "Quantity must be non-negative"

Field: quantityReserved
  Type: Number
  Required: true
  Default: 0
  Min: 0
  Max: quantityInStock
  Integer: true
  Validation: Reserved <= In Stock
  Error: "Reserved quantity cannot exceed stock"

Field: batchNumber
  Type: String
  Required: true
  Length: 5-50
  Pattern: /^[A-Z0-9\-]+$/
  Validation: Unique per medicine per hospital
  Error: "Invalid batch number"

Field: manufacturingDate
  Type: Date
  Required: true
  Validation: Must be in the past
  Validation: Must be before expiryDate
  Error: "Manufacturing date must be in past"

Field: expiryDate
  Type: Date
  Required: true
  Validation: Must be after manufacturingDate
  Validation: Must be in future (with warning if < 30 days)
  Business Rule: Cannot use medicines expiring in < 15 days for exchange
  Error: "Expiry date must be in future"

Field: storageLocation
  Type: String
  Required: false
  Length: max 50
  Format: "Shelf A3", "Freezer 2", "Cabinet 5B"
  Description: Physical storage location for tracking

Auto-calculated Fields:
  quantityAvailable = quantityInStock - quantityReserved
  status = calculate_status(expiryDate, quantityInStock)
    - "active": expiryDate > today + 30 days, quantity > 0
    - "expiring_soon": expiryDate within 30 days, quantity > 0
    - "expired": expiryDate < today
    - "obsolete": discontinuedDate is set
```

### Inventory Transaction Validations

```yaml
Field: transactionType
  Type: String
  Required: true
  Enum: ["stock_in", "stock_out", "adjustment", "exchange_sent", 
         "exchange_received", "expired_disposal"]
  
  Allowed Rules:
    stock_in:
      - Quantity: > 0
      - Reference: Purchase order/requisition
      - Requires approval: false
      
    stock_out:
      - Quantity: > 0
      - Validation: quantityBefore >= quantity
      - Reference: Patient use/manual removal
      - Requires approval: true (if > 100 units)
      
    exchange_sent:
      - Quantity: > 0
      - Validation: quantityBefore >= quantity
      - Validation: Medicine not expired
      - Validation: Days to expiry >= 15
      - Reference: Exchange request ID
      - Requires approval: true
      
    exchange_received:
      - Quantity: > 0
      - Quantity can be < requested (partial fulfillment)
      - Reference: Exchange request ID
      - Requires approval: false (automatic)
      
    expired_disposal:
      - Quantity: > 0
      - Validation: expiryDate < today
      - Requires approval: true
      - Automatic trigger: On scheduled check
      
    adjustment:
      - Quantity: any (+ or -)
      - Validation: quantityBefore + quantity >= 0
      - Reason: Required (damage, loss, count discrepancy)
      - Requires approval: true

Field: quantity
  Type: Number
  Required: true
  Integer: true
  Validation: Depends on transactionType
  
Field: quantityBefore
  Type: Number
  Required: true
  Integer: true
  Validation: Must match inventory.quantityInStock before transaction
  
Field: quantityAfter
  Type: Number
  Required: true
  Integer: true
  Validation: quantityAfter = quantityBefore ± quantity
  
Field: reason
  Type: String
  Required: true (for certain types)
  Length: 10-500
  
Field: performedBy
  Type: ObjectId
  Required: true
  Validation: Must be valid user with permission

Field: referenceId
  Type: ObjectId
  Required: conditional
  Validation: Depends on transactionType
    - exchange_sent: Must reference exchange_request
    - exchange_received: Must reference exchange_request
```

---

## Exchange Process Validations

### Exchange Request Creation

```yaml
Field: initiatorHospital
  Type: ObjectId
  Required: true
  Validation: Must exist, be active, be verified
  Validation: Cannot be same as recipientHospital
  Error: "Invalid requesting hospital"

Field: initiatorBranch
  Type: ObjectId
  Required: true
  Validation: Must belong to initiatorHospital
  Validation: Must be active
  Error: "Invalid requesting branch"

Field: recipientHospital
  Type: ObjectId
  Required: true
  Validation: Must exist, be active, be verified
  Validation: Cannot be same as initiatorHospital
  Error: "Invalid providing hospital"

Field: recipientBranch
  Type: ObjectId
  Required: true
  Validation: Must belong to recipientHospital
  Validation: Must be active
  Error: "Invalid providing branch"

Field: requiredByDate
  Type: Date
  Required: true
  Validation: Must be future date
  Validation: Must be <= today + 30 days
  Error: "Required date must be within 30 days"

Field: notes
  Type: String
  Required: false
  Length: max 500
  
Workflow Validation:
  Creation:
    - Status: "draft"
    - Only initiating hospital can edit
    - Sent to: "pending"
    
  Submission:
    - Must have at least 1 item
    - All required fields populated
    - Status: "pending"
    - Notification: Sent to recipient hospital
    
  Approval:
    - Can only be approved by recipient hospital
    - Approver must have APPROVE_EXCHANGE permission
    - Status: "approved"
    - Items approve/reject individually
    
  Fulfillment:
    - Status: "in_transit" or "completed"
    - Track quantities received
    - Create inventory transactions
    
  Rejection:
    - Requires rejection reason
    - Status: "rejected"
    - Notify initiator
```

### Exchange Items Validation

```yaml
Field: exchangeRequest
  Type: ObjectId
  Required: true
  Validation: Must reference existing exchange_request

Field: medicine
  Type: ObjectId
  Required: true
  Validation: Must reference existing medicine
  Validation: Must be active (not discontinued)

Field: inventory
  Type: ObjectId
  Required: true
  Validation: Must reference existing inventory
  Validation: Must belong to recipientHospital/recipientBranch
  Validation: Inventory.quantityAvailable >= quantityRequested

Field: quantityRequested
  Type: Number
  Required: true
  Min: 1
  Integer: true
  Validation: Cannot exceed inventory.quantityAvailable
  Error: "Quantity exceeds available stock"

Expiry-based Validations:
  Field: daysToExpiry
    Calculated: expiryDate - today
    Business Rules:
      - Cannot exchange if daysToExpiry < 15
      - Warning if daysToExpiry < 30
      - Alert if daysToExpiry < 7
      
  Rejected if:
    - expiryDate <= today (already expired)
    - daysToExpiry < 15 (too close to expiry)
    - Medicine is scheduled drug (requires extra approval)

Field: status
  Type: String
  Enum: ["pending", "approved", "rejected", "delivered", "received_partial"]
  
  Status Transitions:
    pending → approved (by recipient)
    pending → rejected (by recipient with reason)
    approved → delivered (marked by sender as delivered)
    delivered → received_partial (partial fulfillment) or received_full
```

---

## Business Rule Validations

### Exchange Eligibility Rules

```yaml
Medicine Eligibility:
  Can NOT exchange if:
    - Status: "expired" (expiryDate < today)
    - Status: "expiring_soon" AND daysToExpiry < 15
    - Status: "obsolete" or "discontinued"
    - Quantity available = 0
    - Medicine is strictly scheduled (requires special handling)
    
  Can exchange if:
    - Status: "active"
    - daysToExpiry >= 15
    - quantityAvailable >= quantityRequested
    - Both hospitals are verified and active

Quantity Rules:
  - Minimum quantity per item: 1 unit
  - Maximum per request: No limit (practical limit: warehouse capacity)
  - Reserved quantities: Cannot exceed available (quantityInStock - quantityReserved)

Hospital Eligibility:
  Can exchange if:
    - isActive = true
    - isVerified = true (admin verification)
    - No pending compliance violations
    - Not under sanctions/restrictions
    
  Cannot exchange with:
    - Itself (same hospital)
    - Inactive hospitals
    - Unverified hospitals

Exchange Window:
  - Future dated requests: Allowed up to 30 days
  - Past dated requests: Automatically rejected
  - Immediate need: Marked with requiredByDate = today
```

### Inventory Consistency Rules

```yaml
Real-time Constraints:
  1. quantityAvailable >= 0 always
  2. quantityAvailable = quantityInStock - quantityReserved
  3. quantityReserved <= quantityInStock
  4. For expired medicines: No further transactions allowed
  5. Batch numbers must be unique per (hospital, branch, medicine)

Automatic Transitions:
  If expiryDate <= today:
    - Status automatically set to "expired"
    - Cannot request for exchange
    - Marked for disposal
    - Transaction created: "expired_disposal"

Expiry Alerts:
  If expiryDate - today <= 30 days:
    - Status: "expiring_soon"
    - Generate notification to branch manager
    - Flag in exchange list (can exchange with warning)

  If expiryDate - today <= 7 days:
    - Critical alert
    - Multiple notifications
    - Recommend immediate disposal or exchange
    
  If expiryDate - today <= 0:
    - Automatic status: "expired"
    - Cannot exchange
    - Schedule disposal transaction

Reorder Level Alerts:
  If quantityAvailable <= medicine.reorderLevel:
    - Generate low stock alert
    - Notify inventory manager
    - Recommend purchase/exchange request
```

### Access Control Validations

```yaml
Hospital-level Isolation:
  Users from Hospital A:
    - Can view own hospital's inventory only
    - Can initiate exchange requests to other hospitals
    - Can approve/receive exchanges for own hospital
    - Cannot see Hospital B's inventory
    - Exception: System admin (can see all)

Role-based Permissions:
  admin:
    - Can view all hospitals, branches, inventory
    - Can manage users, roles, permissions
    - Can approve/reject all exchanges
    - Can view audit logs
    - Can configure system settings
    
  hospital_manager:
    - Can view own hospital's data
    - Can manage users within hospital
    - Can initiate exchanges
    - Can approve exchanges for own hospital
    - Can view own hospital's audit logs
    
  pharmacist:
    - Can view own branch's inventory
    - Can create stock transactions
    - Can see exchange requests for own branch
    - Cannot approve exchanges
    - Cannot manage other users
    
  viewer:
    - Read-only access to own hospital's data
    - Cannot create or modify data
    - Can view reports and dashboards

Exchange Request Permissions:
  Initiate (Create):
    - User from initiator hospital with appropriate role
    
  Approve/Reject:
    - User from recipient hospital
    - Must have APPROVE_EXCHANGE permission
    
  Fulfill:
    - User from recipient hospital
    - Update stock transactions
    - Mark as completed
    
  View:
    - Both initiator and recipient hospitals can view
    - Admins can view all
```

---

## Zod Schema Templates

### User Registration Schema

```typescript
import { z } from "zod";

export const createUserSchema = z.object({
  firstName: z
    .string()
    .min(2, "First name must be at least 2 characters")
    .max(50, "First name must not exceed 50 characters")
    .regex(/^[a-zA-Z\s'-]+$/, "First name must contain only letters, spaces, hyphens, or apostrophes"),
  
  lastName: z
    .string()
    .min(2, "Last name must be at least 2 characters")
    .max(50, "Last name must not exceed 50 characters")
    .regex(/^[a-zA-Z\s'-]+$/, "Last name must contain only letters, spaces, hyphens, or apostrophes"),
  
  email: z
    .string()
    .email("Invalid email address")
    .transform(val => val.toLowerCase()),
  
  phoneNumber: z
    .string()
    .regex(/^[\d\s\-\+\(\)]{10,15}$/, "Invalid phone number format")
    .optional(),
  
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/\d/, "Password must contain at least one digit")
    .regex(/[!@#$%^&*]/, "Password must contain at least one special character"),
  
  role: z.string().refine(async (id) => {
    // Validate against database
    const role = await Role.findById(id);
    return role !== null;
  }, "Invalid role"),
  
  hospital: z
    .string()
    .refine(async (id) => {
      const hospital = await Hospital.findById(id);
      return hospital?.isActive === true;
    }, "Hospital must exist and be active")
    .optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
```

### Exchange Request Schema

```typescript
export const createExchangeRequestSchema = z.object({
  initiatorHospital: z
    .string()
    .refine(async (id) => {
      const hospital = await Hospital.findById(id);
      return hospital?.isActive && hospital?.isVerified;
    }, "Invalid initiator hospital"),
  
  recipientHospital: z
    .string()
    .refine(async (id) => {
      const hospital = await Hospital.findById(id);
      return hospital?.isActive && hospital?.isVerified;
    }, "Invalid recipient hospital"),
  
  initiatorBranch: z.string(),
  recipientBranch: z.string(),
  
  requiredByDate: z
    .date()
    .refine(date => date > new Date(), "Required date must be in future")
    .refine(date => {
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 30);
      return date <= maxDate;
    }, "Required date must be within 30 days"),
  
  notes: z.string().max(500, "Notes must not exceed 500 characters").optional(),
  
  items: z.array(
    z.object({
      medicine: z.string(),
      inventory: z.string(),
      quantityRequested: z.number().int().min(1),
    })
  ).min(1, "Exchange must contain at least one item"),
}).refine(
  data => data.initiatorHospital !== data.recipientHospital,
  "Cannot exchange with same hospital"
);

export type CreateExchangeRequestInput = z.infer<typeof createExchangeRequestSchema>;
```

### Medicine Validation Schema

```typescript
export const createMedicineSchema = z.object({
  name: z.string().min(2).max(100),
  
  genericName: z.string().min(2).max(100),
  
  strength: z
    .string()
    .regex(/^[\d\.]+\s*(mg|mcg|g|ml|%|iu|mmol|meq)?$/, 
      "Invalid strength format. Use: 500mg, 10ml, 5%, etc."),
  
  form: z.enum(["tablet", "capsule", "injection", "syrup", "suspension",
    "ointment", "lotion", "cream", "powder", "solution", "inhaler"]),
  
  category: z.string().refine(async (id) => {
    const category = await MedicineCategory.findById(id);
    return category !== null;
  }, "Category not found"),
  
  manufacturer: z.string().refine(async (id) => {
    const manufacturer = await Manufacturer.findById(id);
    return manufacturer !== null;
  }, "Manufacturer not found"),
  
  reorderLevel: z.number().int().min(0),
  
  maxStockLevel: z.number().int(),
  
  shelfLife: z.number().int().min(1).max(3650),
  
  storageTemperature: z.enum(["2-8°C", "15-25°C", "room_temperature", "below_25°C"]),
  
  unitCost: z.number().min(0.01),
  
  sellingPrice: z.number(),
}).refine(
  data => data.sellingPrice >= data.unitCost,
  { message: "Selling price must be >= cost", path: ["sellingPrice"] }
).refine(
  data => data.maxStockLevel > data.reorderLevel,
  { message: "Max stock must exceed reorder level", path: ["maxStockLevel"] }
);

export type CreateMedicineInput = z.infer<typeof createMedicineSchema>;
```

---

## Summary

This validation rules document provides:

✅ **Field-level validation** for all collections  
✅ **Business logic rules** for exchange processes  
✅ **Access control** specifications  
✅ **Automatic status transitions** for inventory  
✅ **Alert thresholds** for expiry and stock  
✅ **Zod schema templates** for implementation  

**Use this for:**
- Frontend form validation
- Backend DTO/API validation
- Database constraint definition
- Business rule enforcement
- API error messages