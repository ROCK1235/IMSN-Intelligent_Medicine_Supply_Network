# IMSN Database Design Document

**Version:** 1.0  
**Last Updated:** July 31, 2026  
**Status:** Ready for Implementation  
**Database:** MongoDB  
**ODM:** Mongoose

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Database Architecture](#database-architecture)
3. [ER Diagram](#er-diagram)
4. [Collection Schemas](#collection-schemas)
5. [Relationships & Cardinality](#relationships--cardinality)
6. [Index Strategy](#index-strategy)
7. [Validation Rules](#validation-rules)
8. [Design Rationale](#design-rationale)

---

## Executive Summary

IMSN uses MongoDB with a modular schema design that balances normalization with query performance. The database is designed to:

- **Prevent medicine wastage** through efficient inventory tracking
- **Enable secure B2B exchanges** with comprehensive audit trails
- **Support multi-hospital operations** with role-based access
- **Scale horizontally** with proper indexing and query optimization
- **Maintain data integrity** through validation and constraints

### Design Principles Applied

✅ Use **references** for: Users, Hospitals, Medicines, Inventory, Exchange, Roles  
✅ **Embed** small objects: Address, Location, Settings  
✅ Avoid embedding large collections  
✅ Index frequently queried fields  
✅ Normalize for data consistency  
✅ Denormalize carefully for performance

---

## Database Architecture

### Collection Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│                    IMSN Database                        │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
    ┌─────────┐         ┌─────────┐        ┌─────────┐
    │   IAM   │         │ MASTER  │        │  CORE   │
    └─────────┘         │ DATA    │        │BUSINESS │
        │               └─────────┘        └─────────┘
        │                   │                   │
    • roles          • manufacturers     • hospitals
    • permissions    • medicine_         • branches
    • users          categories          • inventory
    • refresh_tokens • medicines         • medicine_
                                          transactions
                                         • exchange_
                                          requests
                                         • exchange_
                                          items
                                         • notifications
                                         • audit_logs
```

---

## ER Diagram

### Conceptual Model

```
                        ┌──────────────┐
                        │   Roles      │
                        └──────┬───────┘
                               │ has_many
                               │
                        ┌──────▼───────┐
                        │  Permissions │
                        └──────────────┘
                               ▲
                               │ assigned_to
                               │
                        ┌──────┴───────┐
                        │    Users     │
                        └──────┬───────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
          works_at       manages          receives
                │              │              │
        ┌───────▼──────┐ ┌────▼──────┐ ┌───▼────────┐
        │  Hospitals   │ │ Branches  │ │Refresh     │
        └───────┬──────┘ └───────────┘ │Tokens      │
                │                      └────────────┘
        ┌───────▼──────────┐
        │ Inventory        │
        └───────┬──────────┘
                │ contains
                │
        ┌───────▼──────────┐           ┌─────────────┐
        │   Medicines      │◄──────────┤Manufacturers│
        └───────┬──────────┘ made_by   └─────────────┘
                │
        ┌───────▼──────────┐           ┌──────────────┐
        │  Categories      │◄──────────┤  Inventory   │
        └──────────────────┘ belongs   │Transactions  │
                                       └──────────────┘

        ┌─────────────────────────────────────────────┐
        │         Exchange Request Flow               │
        ├─────────────────────────────────────────────┤
        │  Exchange Requests                          │
        │    ├── initiated_by (Hospital A)           │
        │    ├── requested_from (Hospital B)         │
        │    └── contains many Exchange Items        │
        │                                             │
        │  Exchange Items                             │
        │    ├── references Medicine                 │
        │    ├── quantity_requested                  │
        │    └── status (pending/approved/rejected)  │
        └─────────────────────────────────────────────┘

        ┌─────────────────────────────────────────────┐
        │      Audit & Notification System            │
        ├─────────────────────────────────────────────┤
        │  Audit Logs                                 │
        │    ├── actor (User)                        │
        │    ├── action (CRUD operation)             │
        │    └── changes (before/after data)         │
        │                                             │
        │  Notifications                              │
        │    ├── recipient (User)                    │
        │    ├── type (exchange_request/approval)   │
        │    └── metadata (related entity)           │
        └─────────────────────────────────────────────┘
```

---

## Collection Schemas

### 1. Roles Collection

**Purpose:** Define role types and permissions structure

```javascript
{
  _id: ObjectId,
  name: String,                  // "admin", "hospital_manager", "pharmacist", "viewer"
  description: String,
  permissions: [ObjectId],       // References to permissions collection
  isActive: Boolean,
  isSystem: Boolean,             // true for system roles (cannot be deleted)
  createdAt: Date,
  updatedAt: Date
}
```

**Sample Documents:**
- System Roles: `admin`, `hospital_manager`, `pharmacist`, `viewer`

---

### 2. Permissions Collection

**Purpose:** Define granular permissions for RBAC

```javascript
{
  _id: ObjectId,
  name: String,                  // "CREATE_EXCHANGE_REQUEST", "APPROVE_EXCHANGE", etc.
  description: String,
  resource: String,              // "exchange", "inventory", "hospital", "user"
  action: String,                // "CREATE", "READ", "UPDATE", "DELETE", "APPROVE"
  scope: String,                 // "own", "own_hospital", "all"
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

**Unique Index:** `{ name: 1 }`

---

### 3. Users Collection

**Purpose:** Store user accounts with authentication details

```javascript
{
  _id: ObjectId,
  
  // Identity
  firstName: String,
  lastName: String,
  email: String,                 // Unique, lowercase
  phoneNumber: String,           // Optional, unique
  avatar: String,                // URL to S3
  
  // Authentication
  password: String,              // bcrypt hashed
  passwordChangedAt: Date,       // For token validation
  passwordResetToken: String,    // Temporary token (hashed)
  passwordResetExpires: Date,
  
  // Authorization
  role: ObjectId,                // Reference to roles
  hospital: ObjectId,            // Reference to hospitals (may be null for admins)
  branch: ObjectId,              // Reference to branches (may be null)
  
  // Status & Settings
  isActive: Boolean,
  isEmailVerified: Boolean,
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  
  // Metadata
  lastLoginAt: Date,
  loginAttempts: Number,         // For brute force protection
  lockedUntil: Date,             // For account lockout
  loginHistory: [{               // Keep last 10 logins
    timestamp: Date,
    ipAddress: String,
    userAgent: String
  }],
  
  // Audit
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date                // Soft delete
}
```

**Unique Indexes:**
- `{ email: 1 }`
- `{ phoneNumber: 1 }` (sparse)

**Regular Indexes:**
- `{ hospital: 1 }`
- `{ role: 1 }`
- `{ isActive: 1 }`
- `{ createdAt: -1 }`

---

### 4. Refresh Tokens Collection

**Purpose:** Manage JWT refresh tokens for security

```javascript
{
  _id: ObjectId,
  
  // Token Details
  token: String,                 // Unique, hashed for storage
  user: ObjectId,                // Reference to users
  
  // Metadata
  expiresAt: Date,               // When token becomes invalid
  isRevoked: Boolean,            // For logout
  revokedAt: Date,
  
  // Device/Session Info
  ipAddress: String,
  userAgent: String,
  deviceId: String,              // Optional, for device tracking
  
  // Audit
  createdAt: Date,
  updatedAt: Date
}
```

**Unique Index:** `{ token: 1 }`

**TTL Index:** `{ expiresAt: 1 }` with expireAfterSeconds set to 0

---

### 5. Manufacturers Collection

**Purpose:** Store medicine manufacturer details

```javascript
{
  _id: ObjectId,
  
  // Basic Info
  name: String,                  // Unique
  licenseNumber: String,         // Unique
  registrationDate: Date,
  
  // Contact Details
  email: String,
  phoneNumber: String,
  
  // Address
  address: {                      // Embedded
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: String
  },
  
  // Business Info
  isActive: Boolean,
  certifications: [String],       // ISO, GMP, etc.
  
  // Audit
  createdAt: Date,
  updatedAt: Date
}
```

**Unique Indexes:**
- `{ name: 1 }`
- `{ licenseNumber: 1 }`

---

### 6. Medicine Categories Collection

**Purpose:** Organize medicines into categories

```javascript
{
  _id: ObjectId,
  
  name: String,                  // Unique, e.g., "Antibiotics", "Antivirals"
  description: String,
  code: String,                  // e.g., "ANTI-001" (Unique)
  
  // Hierarchy
  parentCategory: ObjectId,      // Reference to parent category (optional)
  
  // Settings
  isActive: Boolean,
  displayOrder: Number,          // For sorting
  
  // Audit
  createdAt: Date,
  updatedAt: Date
}
```

**Unique Indexes:**
- `{ name: 1 }`
- `{ code: 1 }`

---

### 7. Medicines Collection

**Purpose:** Store medicine master data

```javascript
{
  _id: ObjectId,
  
  // Identification
  name: String,
  genericName: String,
  hsn_sac: String,               // India-specific: HSN/SAC code
  gst_rate: Number,              // GST percentage
  
  // Medical Details
  category: ObjectId,            // Reference to medicine_categories
  manufacturer: ObjectId,        // Reference to manufacturers
  strength: String,              // e.g., "500mg", "10ml"
  form: String,                  // e.g., "tablet", "injection", "syrup"
  batchNumber: String,           // Optional
  
  // Regulatory
  registrationNumber: String,    // Drug registration
  isScheduled: Boolean,          // Scheduled drug (requires special handling)
  scheduleType: String,          // e.g., "H", "X", "L"
  
  // Inventory Metrics
  reorderLevel: Number,          // Minimum stock alert
  maxStockLevel: Number,         // Maximum stock capacity
  unitOfMeasure: String,         // "tablet", "ml", "unit", etc.
  
  // Expiry & Storage
  shelfLife: Number,             // In days
  storageTemperature: String,    // e.g., "2-8°C", "15-25°C"
  storageConditions: [String],   // e.g., ["protect_from_light", "keep_dry"]
  
  // Pricing
  unitCost: Number,              // Base cost per unit
  sellingPrice: Number,          // Recommended selling price
  
  // Status
  isActive: Boolean,
  discontinuedDate: Date,        // If discontinued
  
  // Audit
  createdAt: Date,
  updatedAt: Date
}
```

**Unique Indexes:**
- `{ name: 1, manufacturer: 1 }` (Compound: same medicine from different makers)
- `{ registrationNumber: 1 }`

**Regular Indexes:**
- `{ category: 1 }`
- `{ manufacturer: 1 }`
- `{ isActive: 1 }`
- `{ reorderLevel: 1 }` (For stock alerts)

---

### 8. Hospitals Collection

**Purpose:** Store hospital/organization details

```javascript
{
  _id: ObjectId,
  
  // Identity
  name: String,
  registrationNumber: String,    // Unique, hospital registration
  licenseNumber: String,         // Unique
  organizationType: String,      // "government", "private", "ngo"
  
  // Contact
  email: String,
  phoneNumber: String,
  website: String,
  
  // Address
  address: {                      // Embedded
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
    latitude: Number,
    longitude: Number             // For geographic queries
  },
  
  // Hospital Details
  bedsCount: Number,
  specializations: [String],     // e.g., ["cardiology", "neurology"]
  accreditations: [String],      // JCI, NABH, etc.
  
  // Business Info
  taxId: String,                 // GSTIN for India
  paymentTerms: String,          // Net 30, Net 45, etc.
  
  // Status
  isActive: Boolean,
  isVerified: Boolean,           // Verified by admin
  verificationDate: Date,
  
  // Metadata
  totalBranches: Number,         // Denormalized for quick access
  admissionCount: Number,        // Denormalized metrics
  
  // Audit
  createdAt: Date,
  updatedAt: Date
}
```

**Unique Indexes:**
- `{ name: 1 }`
- `{ registrationNumber: 1 }`
- `{ licenseNumber: 1 }`
- `{ email: 1 }`

**Geospatial Index:** `{ "address.location": "2dsphere" }`

**Regular Indexes:**
- `{ isActive: 1 }`
- `{ isVerified: 1 }`
- `{ createdAt: -1 }`

---

### 9. Branches Collection

**Purpose:** Manage hospital branches/departments

```javascript
{
  _id: ObjectId,
  
  // Identification
  name: String,
  code: String,                  // Unique per hospital: e.g., "HOSP-BRANCH-001"
  branchType: String,            // "main", "satellite", "dispensary"
  
  // Hospital Reference
  hospital: ObjectId,            // Reference to hospitals
  
  // Address
  address: {                      // Embedded
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
    latitude: Number,
    longitude: Number
  },
  
  // Contact
  contactPerson: String,
  email: String,
  phoneNumber: String,
  
  // Operational Details
  bedsCount: Number,
  operatingHours: {              // Embedded
    monday: { open: String, close: String },   // "09:00", "17:00"
    tuesday: { open: String, close: String },
    // ... other days
    sunday: { open: String, close: String }
  },
  
  // Status
  isActive: Boolean,
  
  // Metadata
  medicineStorageCapacity: Number,  // Units
  refrigeratorCapacity: Number,     // Units for cold storage
  
  // Audit
  createdAt: Date,
  updatedAt: Date
}
```

**Unique Index:** `{ code: 1 }`

**Regular Indexes:**
- `{ hospital: 1 }`
- `{ isActive: 1 }`
- `{ "address.city": 1 }` (For geographic queries)

---

### 10. Inventory Collection

**Purpose:** Track medicine stock at branch level

```javascript
{
  _id: ObjectId,
  
  // Key References
  hospital: ObjectId,            // Reference to hospitals
  branch: ObjectId,              // Reference to branches
  medicine: ObjectId,            // Reference to medicines
  
  // Stock Details
  quantityInStock: Number,       // Current quantity
  quantityReserved: Number,      // Reserved for exchanges
  quantityAvailable: Number,     // quantityInStock - quantityReserved (denormalized)
  
  // Batch Information
  batchNumber: String,
  manufacturingDate: Date,
  expiryDate: Date,              // Critical for medicine exchange logic
  
  // Location in Storage
  storageLocation: String,       // e.g., "Shelf A3", "Freezer 2"
  
  // Status Tracking
  status: String,                // "active", "expiring_soon", "expired", "obsolete"
  lastStockCheckDate: Date,
  lastStockCheckQuantity: Number,
  
  // Metadata
  cost: Number,                  // Total cost: quantityInStock * unitCost
  
  // Audit
  createdAt: Date,
  updatedAt: Date
}
```

**Compound Indexes:**
- `{ hospital: 1, branch: 1, medicine: 1 }` (Unique per location & medicine)
- `{ branch: 1, expiryDate: 1 }` (Find expiring soon)
- `{ medicine: 1, expiryDate: 1 }` (Global expiry tracking)

**Regular Indexes:**
- `{ expiryDate: 1 }` (Critical for expiry alerts)
- `{ status: 1 }`
- `{ quantityAvailable: 1 }` (For low stock alerts)

---

### 11. Inventory Transactions Collection

**Purpose:** Audit trail for all inventory changes

```javascript
{
  _id: ObjectId,
  
  // Transaction Identification
  transactionType: String,       // "stock_in", "stock_out", "adjustment", 
                                 // "exchange_sent", "exchange_received", "expired_disposal"
  referenceType: String,         // "purchase_order", "exchange_request", "manual_adjustment"
  referenceId: ObjectId,         // Link to related document
  
  // Inventory Reference
  hospital: ObjectId,            // Reference to hospitals
  branch: ObjectId,              // Reference to branches
  medicine: ObjectId,            // Reference to medicines
  inventory: ObjectId,           // Reference to inventory
  
  // Transaction Details
  quantity: Number,              // Quantity changed
  quantityBefore: Number,        // Stock before
  quantityAfter: Number,         // Stock after
  
  // Reason & Notes
  reason: String,                // Business reason for change
  notes: String,                 // Additional details
  
  // Responsible User
  performedBy: ObjectId,         // Reference to users
  
  // Metadata
  cost: Number,                  // Cost of transaction
  
  // Audit
  createdAt: Date
}
```

**Compound Indexes:**
- `{ hospital: 1, createdAt: -1 }` (Hospital transaction history)
- `{ medicine: 1, transactionType: 1 }` (Medicine movement tracking)
- `{ referenceId: 1 }` (Link exchanges to transactions)

**Regular Indexes:**
- `{ transactionType: 1 }`
- `{ createdAt: -1 }` (Recent transactions)

---

### 12. Exchange Requests Collection

**Purpose:** Manage medicine exchange requests between hospitals

```javascript
{
  _id: ObjectId,
  
  // Request Identification
  requestNumber: String,         // Unique: "ER-HOSP-2024-001"
  
  // Parties Involved
  initiatorHospital: ObjectId,   // Hospital requesting medicine (Reference)
  initiatorBranch: ObjectId,     // Branch in requesting hospital
  recipientHospital: ObjectId,   // Hospital providing medicine (Reference)
  recipientBranch: ObjectId,     // Branch in provider hospital
  
  // User References
  createdBy: ObjectId,           // User initiating exchange (Reference)
  approvedBy: ObjectId,          // User approving exchange (Reference)
  
  // Status Workflow
  status: String,                // "draft", "pending", "approved", "rejected", 
                                 // "in_transit", "completed", "cancelled"
  statusHistory: [{              // Embedded audit trail
    status: String,
    changedAt: Date,
    changedBy: ObjectId,
    reason: String
  }],
  
  // Dates
  requestDate: Date,
  requiredByDate: Date,          // When medicine is needed
  approvalDate: Date,
  rejectionDate: Date,
  completionDate: Date,
  
  // Exchange Details
  totalItems: Number,            // Count of exchange items (denormalized)
  totalQuantity: Number,         // Total quantity requested
  
  // Rejection/Cancellation
  rejectionReason: String,
  cancelledByUser: ObjectId,
  cancellationReason: String,
  
  // Notes & Communication
  notes: String,                 // Any special instructions
  internalNotes: String,         // For admin comments
  
  // Audit
  createdAt: Date,
  updatedAt: Date
}
```

**Compound Indexes:**
- `{ initiatorHospital: 1, status: 1 }` (Requests sent by hospital)
- `{ recipientHospital: 1, status: 1 }` (Requests received by hospital)
- `{ status: 1, requestDate: -1 }` (All exchanges by status)

**Regular Indexes:**
- `{ requestNumber: 1 }` (Unique search)
- `{ createdBy: 1 }`
- `{ approvalDate: 1 }` (For reporting)

---

### 13. Exchange Items Collection

**Purpose:** Individual medicines in an exchange request

```javascript
{
  _id: ObjectId,
  
  // Reference to Request
  exchangeRequest: ObjectId,     // Reference to exchange_requests
  
  // Medicine Details
  medicine: ObjectId,            // Reference to medicines
  inventory: ObjectId,           // Reference to specific inventory batch
  
  // Quantities
  quantityRequested: Number,
  quantityApproved: Number,      // May be less than requested
  quantityReceived: Number,      // After fulfillment
  
  // Expiry Information
  expiryDate: Date,              // Medicine expiry date
  daysToExpiry: Number,          // Calculated field for quick filtering
  
  // Item Status
  status: String,                // "pending", "approved", "rejected", "delivered", "received_partial"
  reason: String,                // For rejection
  
  // Batch & Tracking
  batchNumber: String,
  
  // Audit
  createdAt: Date,
  updatedAt: Date
}
```

**Compound Indexes:**
- `{ exchangeRequest: 1, medicine: 1 }` (Find items in exchange)
- `{ medicine: 1, status: 1 }` (Track specific medicine across exchanges)

**Regular Indexes:**
- `{ expiryDate: 1 }` (Sort by expiry)
- `{ status: 1 }`

---

### 14. Notifications Collection

**Purpose:** Store user notifications for real-time updates

```javascript
{
  _id: ObjectId,
  
  // Recipient
  recipient: ObjectId,           // Reference to users
  
  // Notification Details
  type: String,                  // "exchange_request_received", "exchange_approved", 
                                 // "medicine_expiring_soon", "low_stock_alert", 
                                 // "exchange_request_sent", "inventory_updated"
  
  // Content
  title: String,
  message: String,
  
  // Metadata
  relatedEntity: {               // Embedded, for linking to source
    entityType: String,          // "exchange_request", "inventory", "medicine"
    entityId: ObjectId
  },
  
  // Status
  isRead: Boolean,
  readAt: Date,
  
  // Delivery Channels
  channels: [String],            // ["in_app", "email", "sms"]
  
  // Delivery Status
  deliveryStatus: {              // Embedded
    in_app: { sent: Boolean, sentAt: Date },
    email: { sent: Boolean, sentAt: Date, bounced: Boolean },
    sms: { sent: Boolean, sentAt: Date }
  },
  
  // Retention
  expiresAt: Date,               // Auto-delete old notifications
  
  // Audit
  createdAt: Date
}
```

**Compound Indexes:**
- `{ recipient: 1, isRead: 1, createdAt: -1 }` (User's unread notifications)
- `{ recipient: 1, type: 1 }` (Notifications by type)

**TTL Index:** `{ expiresAt: 1 }` with expireAfterSeconds set to 0

**Regular Indexes:**
- `{ recipient: 1 }` (All notifications for user)
- `{ type: 1 }`

---

### 15. Audit Logs Collection

**Purpose:** Immutable audit trail for compliance

```javascript
{
  _id: ObjectId,
  
  // Actor Information
  actor: ObjectId,               // Reference to users (who performed action)
  actorRole: String,             // Snapshot of role at time of action
  
  // Action Details
  action: String,                // "CREATE", "UPDATE", "DELETE", "APPROVE", "REJECT"
  resource: String,              // "medicine", "inventory", "exchange_request", "user"
  resourceId: ObjectId,          // ID of affected resource
  
  // Data Changes
  changes: {                      // Embedded, before/after
    before: Object,              // Previous state (if applicable)
    after: Object                // New state
  },
  
  // Request Context
  ipAddress: String,
  userAgent: String,
  sessionId: String,             // Optional: link to login session
  
  // Status
  status: String,                // "success", "failure"
  errorMessage: String,          // If status is failure
  
  // Hospital Context
  hospital: ObjectId,            // Which hospital performed action
  branch: ObjectId,              // Which branch (if applicable)
  
  // Retention Policy
  retentionUntil: Date,          // When log can be deleted (usually 7 years for healthcare)
  
  // Audit
  createdAt: Date                // Immutable timestamp
}
```

**Compound Indexes:**
- `{ actor: 1, createdAt: -1 }` (User activity history)
- `{ resource: 1, resourceId: 1, createdAt: -1 }` (Changes to specific resource)
- `{ hospital: 1, action: 1, createdAt: -1 }` (Hospital activity audit)

**Regular Indexes:**
- `{ createdAt: -1 }` (Recent logs)
- `{ action: 1 }` (By action type)

---

## Relationships & Cardinality

### Core Relationship Matrix

```
┌─────────────────────────────────────────────────────────┐
│          RELATIONSHIP CARDINALITY MATRIX               │
├─────────────────────────────────────────────────────────┤
```

### 1. **Roles ↔ Permissions**
- **Type:** Many-to-Many (Through embedded reference)
- **Cardinality:** One Role : Many Permissions
- **Implementation:** Array of ObjectId in roles.permissions
- **Why Reference:** Roles need to be independent of permissions for flexibility

```
roles: [{
  _id: ObjectId,
  permissions: [ObjectId, ObjectId, ...]
}]
```

---

### 2. **Users ↔ Roles**
- **Type:** Many-to-One
- **Cardinality:** Many Users : One Role
- **Implementation:** Single ObjectId reference in users.role
- **Why Reference:** Users change roles; role is independent entity

```
users: [{
  _id: ObjectId,
  role: ObjectId  // Reference to roles
}]
```

---

### 3. **Users ↔ Hospitals**
- **Type:** Many-to-One
- **Cardinality:** Many Users : One Hospital
- **Implementation:** Single ObjectId reference in users.hospital
- **Why Reference:** Hospital is independent master data

```
users: [{
  _id: ObjectId,
  hospital: ObjectId,  // Reference to hospitals
  branch: ObjectId     // Reference to branches
}]
```

---

### 4. **Users ↔ Refresh Tokens**
- **Type:** One-to-Many
- **Cardinality:** One User : Many Tokens
- **Implementation:** ObjectId reference in refresh_tokens.user
- **Why Reference:** Tokens are temporary; users are permanent

```
refresh_tokens: [{
  _id: ObjectId,
  user: ObjectId  // Reference to users
}]
```

---

### 5. **Hospitals ↔ Branches**
- **Type:** One-to-Many
- **Cardinality:** One Hospital : Many Branches
- **Implementation:** ObjectId reference in branches.hospital
- **Why Reference:** Branches are independent entities that can be queried separately

```
branches: [{
  _id: ObjectId,
  hospital: ObjectId  // Reference to hospitals
}]
```

---

### 6. **Medicines ↔ Categories**
- **Type:** Many-to-One
- **Cardinality:** Many Medicines : One Category
- **Implementation:** ObjectId reference in medicines.category
- **Why Reference:** Categories are master data managed separately

```
medicines: [{
  _id: ObjectId,
  category: ObjectId  // Reference to medicine_categories
}]
```

---

### 7. **Medicines ↔ Manufacturers**
- **Type:** Many-to-One
- **Cardinality:** Many Medicines : One Manufacturer
- **Implementation:** ObjectId reference in medicines.manufacturer
- **Why Reference:** Manufacturers are independent master data

```
medicines: [{
  _id: ObjectId,
  manufacturer: ObjectId  // Reference to manufacturers
}]
```

---

### 8. **Branches ↔ Inventory**
- **Type:** One-to-Many
- **Cardinality:** One Branch : Many Inventory Items
- **Implementation:** ObjectId reference in inventory.branch
- **Why Reference:** Inventory is transaction-heavy; must be queryable by branch

```
inventory: [{
  _id: ObjectId,
  hospital: ObjectId,
  branch: ObjectId,   // Reference to branches
  medicine: ObjectId  // Reference to medicines
}]
```

---

### 9. **Inventory ↔ Medicines**
- **Type:** Many-to-One
- **Cardinality:** Many Inventory : One Medicine
- **Implementation:** ObjectId reference in inventory.medicine
- **Why Reference:** Medicines are master data

```
inventory: [{
  _id: ObjectId,
  medicine: ObjectId  // Reference to medicines
}]
```

---

### 10. **Inventory ↔ Inventory Transactions**
- **Type:** One-to-Many
- **Cardinality:** One Inventory : Many Transactions
- **Implementation:** ObjectId reference in inventory_transactions.inventory
- **Why Reference:** Transactions are immutable and must be queryable

```
inventory_transactions: [{
  _id: ObjectId,
  inventory: ObjectId  // Reference to inventory
}]
```

---

### 11. **Exchange Requests ↔ Exchange Items**
- **Type:** One-to-Many
- **Cardinality:** One Exchange Request : Many Exchange Items
- **Implementation:** ObjectId reference in exchange_items.exchangeRequest
- **Why Reference:** Items must be queryable independently

```
exchange_items: [{
  _id: ObjectId,
  exchangeRequest: ObjectId  // Reference to exchange_requests
}]
```

---

### 12. **Exchange Items ↔ Medicines**
- **Type:** Many-to-One
- **Cardinality:** Many Exchange Items : One Medicine
- **Implementation:** ObjectId reference in exchange_items.medicine
- **Why Reference:** Medicines are master data

```
exchange_items: [{
  _id: ObjectId,
  medicine: ObjectId  // Reference to medicines
}]
```

---

### 13. **Exchange Requests ↔ Hospitals**
- **Type:** Many-to-Many
- **Cardinality:** Many Exchange Requests : Many Hospitals
- **Implementation:** Two ObjectId references in exchange_requests
  - `initiatorHospital` (Reference to hospitals)
  - `recipientHospital` (Reference to hospitals)
- **Why Reference:** Hospitals are independent entities

```
exchange_requests: [{
  _id: ObjectId,
  initiatorHospital: ObjectId,   // Hospital requesting medicine
  recipientHospital: ObjectId    // Hospital providing medicine
}]
```

---

### 14. **Users ↔ Notifications**
- **Type:** One-to-Many
- **Cardinality:** One User : Many Notifications
- **Implementation:** ObjectId reference in notifications.recipient
- **Why Reference:** Notifications are independent entities

```
notifications: [{
  _id: ObjectId,
  recipient: ObjectId  // Reference to users
}]
```

---

### 15. **Users ↔ Audit Logs**
- **Type:** One-to-Many
- **Cardinality:** One User : Many Audit Logs
- **Implementation:** ObjectId reference in audit_logs.actor
- **Why Reference:** Audit logs are immutable records

```
audit_logs: [{
  _id: ObjectId,
  actor: ObjectId  // Reference to users
}]
```

---

## Index Strategy

### Indexing Philosophy

**Goals:**
1. Optimize query performance for frequently accessed data
2. Support sorting operations efficiently
3. Enable range queries on date fields
4. Support geospatial queries
5. Maintain write performance

**Principles:**
- Create composite indexes for queries filtering on multiple fields
- Order compound index fields by: Equality → Range → Sort
- Avoid indexes on fields with low selectivity
- Monitor index usage and remove unused indexes
- Balance between read performance and write overhead

---

### Index Summary Table

| Collection | Index Name | Type | Fields | Purpose |
|---|---|---|---|---|
| **roles** | idx_name | Unique | `name` | Unique role identification |
| **permissions** | idx_name | Unique | `name` | Unique permission identification |
| **users** | idx_email | Unique | `email` | Authentication & lookups |
| **users** | idx_phone | Unique (Sparse) | `phoneNumber` | Optional phone lookups |
| **users** | idx_hospital_user | Regular | `hospital` | Find users in hospital |
| **users** | idx_role | Regular | `role` | Find users by role |
| **users** | idx_active | Regular | `isActive` | Active user queries |
| **users** | idx_created | Regular | `createdAt desc` | Recent user registration |
| **refresh_tokens** | idx_token | Unique | `token` | Token validation |
| **refresh_tokens** | idx_user | Regular | `user` | Find tokens for user |
| **refresh_tokens** | idx_ttl | TTL | `expiresAt` | Auto-delete expired tokens |
| **manufacturers** | idx_name | Unique | `name` | Unique identification |
| **manufacturers** | idx_license | Unique | `licenseNumber` | Regulatory requirement |
| **medicine_categories** | idx_name | Unique | `name` | Unique category names |
| **medicine_categories** | idx_code | Unique | `code` | Master data lookup |
| **medicines** | idx_name_mfg | Unique | `name, manufacturer` | Unique medicine per manufacturer |
| **medicines** | idx_reg_number | Unique | `registrationNumber` | Regulatory lookup |
| **medicines** | idx_category | Regular | `category` | Find medicines in category |
| **medicines** | idx_manufacturer | Regular | `manufacturer` | Find medicines by maker |
| **medicines** | idx_active | Regular | `isActive` | Active medicines only |
| **medicines** | idx_reorder_level | Regular | `reorderLevel` | Stock alert queries |
| **hospitals** | idx_name | Unique | `name` | Hospital lookup |
| **hospitals** | idx_reg_number | Unique | `registrationNumber` | Regulatory identification |
| **hospitals** | idx_license | Unique | `licenseNumber` | License lookup |
| **hospitals** | idx_email | Unique | `email` | Email communication |
| **hospitals** | idx_verified | Regular | `isVerified` | Find verified hospitals |
| **hospitals** | idx_active | Regular | `isActive` | Active hospitals |
| **hospitals** | idx_geo | Geospatial | `address.location` (2dsphere) | Geographic queries |
| **hospitals** | idx_created | Regular | `createdAt desc` | Recent registrations |
| **branches** | idx_code | Unique | `code` | Unique branch code |
| **branches** | idx_hospital | Regular | `hospital` | Find hospital branches |
| **branches** | idx_city | Regular | `address.city` | Geographic queries |
| **branches** | idx_active | Regular | `isActive` | Active branches |
| **inventory** | idx_hospital_branch_medicine | Unique | `hospital, branch, medicine` | Unique per location |
| **inventory** | idx_expiry_branch | Regular | `branch, expiryDate` | Expiry tracking |
| **inventory** | idx_expiry_global | Regular | `expiryDate` | Global expiry alerts |
| **inventory** | idx_expiry_medicine | Regular | `medicine, expiryDate` | Medicine expiry tracking |
| **inventory** | idx_available | Regular | `quantityAvailable` | Low stock queries |
| **inventory** | idx_status | Regular | `status` | Status-based queries |
| **inventory_transactions** | idx_hospital | Composite | `hospital, createdAt desc` | Hospital transaction history |
| **inventory_transactions** | idx_medicine_type | Regular | `medicine, transactionType` | Medicine movement |
| **inventory_transactions** | idx_ref_id | Regular | `referenceId` | Link to related documents |
| **inventory_transactions** | idx_type | Regular | `transactionType` | Transaction filtering |
| **inventory_transactions** | idx_created | Regular | `createdAt desc` | Recent transactions |
| **exchange_requests** | idx_initiated_by | Regular | `initiatorHospital, status` | Requests sent |
| **exchange_requests** | idx_received_by | Regular | `recipientHospital, status` | Requests received |
| **exchange_requests** | idx_status | Composite | `status, requestDate desc` | Status-based queries |
| **exchange_requests** | idx_number | Unique | `requestNumber` | Lookup by request number |
| **exchange_requests** | idx_created_by | Regular | `createdBy` | User's exchanges |
| **exchange_requests** | idx_approval | Regular | `approvalDate` | Reporting & analytics |
| **exchange_items** | idx_request_medicine | Composite | `exchangeRequest, medicine` | Items in exchange |
| **exchange_items** | idx_medicine_status | Regular | `medicine, status` | Track medicine in exchanges |
| **exchange_items** | idx_expiry | Regular | `expiryDate` | Expiry sorting |
| **exchange_items** | idx_status | Regular | `status` | Item status queries |
| **notifications** | idx_recipient_unread | Composite | `recipient, isRead, createdAt desc` | User's unread notifications |
| **notifications** | idx_recipient_type | Regular | `recipient, type` | Notifications by type |
| **notifications** | idx_recipient | Regular | `recipient` | All user notifications |
| **notifications** | idx_type | Regular | `type` | Notification type queries |
| **notifications** | idx_ttl | TTL | `expiresAt` | Auto-delete old notifications |
| **audit_logs** | idx_actor | Composite | `actor, createdAt desc` | User activity history |
| **audit_logs** | idx_resource | Composite | `resource, resourceId, createdAt desc` | Changes to resource |
| **audit_logs** | idx_hospital | Composite | `hospital, action, createdAt desc` | Hospital audit trail |
| **audit_logs** | idx_created | Regular | `createdAt desc` | Recent logs |
| **audit_logs** | idx_action | Regular | `action` | Filter by action type |

---

### Index Creation Priority

**Phase 1 (Critical - Create First):**
- Authentication indexes (users, refresh_tokens)
- Unique constraints (prevent duplicates)
- Foreign key indexes for joins

**Phase 2 (High - Create During Development):**
- Query performance indexes
- Date-based indexes (expiryDate, createdAt)
- Status-based indexes

**Phase 3 (Medium - Create Before Production):**
- Composite indexes for complex queries
- Geospatial indexes
- TTL indexes

**Phase 4 (Monitor & Optimize):**
- Add indexes based on slow query logs
- Remove unused indexes
- Optimize existing indexes

---

## Validation Rules

### User Input Validation

#### 1. **Users Collection Validation**

```yaml
firstName:
  - Type: String
  - Required: true
  - Length: min 2, max 50
  - Pattern: /^[a-zA-Z\s'-]+$/
  - Trim: true
  - Lowercase: false

lastName:
  - Type: String
  - Required: true
  - Length: min 2, max 50
  - Pattern: /^[a-zA-Z\s'-]+$/
  - Trim: true

email:
  - Type: String
  - Required: true
  - Unique: true
  - Lowercase: true
  - Pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  - Trim: true
  - Validation: RFC 5322 compliant

phoneNumber:
  - Type: String
  - Required: false
  - Unique: true
  - Length: 10-15 (international)
  - Pattern: /^[\d\s\-\+\(\)]+$/
  - Validation: Valid international format

password:
  - Type: String
  - Required: true (on creation)
  - Length: min 8, max 128
  - Complexity: Must contain:
    - At least 1 uppercase letter
    - At least 1 lowercase letter
    - At least 1 digit
    - At least 1 special character (!@#$%^&*)
  - Not-in-list: Cannot be common passwords

role:
  - Type: ObjectId
  - Required: true
  - Reference: roles collection
  - Validation: Role must exist and be active

hospital:
  - Type: ObjectId
  - Required: false (null for admins)
  - Reference: hospitals collection
  - Validation: If provided, hospital must be active

isActive:
  - Type: Boolean
  - Required: true
  - Default: true
```

---

#### 2. **Hospitals Collection Validation**

```yaml
name:
  - Type: String
  - Required: true
  - Unique: true
  - Length: min 3, max 100
  - Trim: true

registrationNumber:
  - Type: String
  - Required: true
  - Unique: true
  - Length: min 5, max 50
  - Pattern: /^[A-Z0-9\-]+$/
  - Validation: Must match hospital registration format

licenseNumber:
  - Type: String
  - Required: true
  - Unique: true
  - Length: min 5, max 50
  - Validation: Must match license format

organizationType:
  - Type: String
  - Required: true
  - Enum: ["government", "private", "ngo"]

email:
  - Type: String
  - Required: true
  - Unique: true
  - Lowercase: true
  - Pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/

phoneNumber:
  - Type: String
  - Required: true
  - Length: 10-15
  - Pattern: /^[\d\s\-\+\(\)]+$/

address.street:
  - Type: String
  - Required: true
  - Length: min 5, max 100

address.city:
  - Type: String
  - Required: true
  - Length: min 2, max 50

address.state:
  - Type: String
  - Required: true
  - Length: min 2, max 50

address.postalCode:
  - Type: String
  - Required: true
  - Pattern: /^[0-9]{5,6}$/ (India)

address.latitude:
  - Type: Number
  - Required: true
  - Range: -90 to 90
  - Validation: Valid latitude

address.longitude:
  - Type: Number
  - Required: true
  - Range: -180 to 180
  - Validation: Valid longitude

bedsCount:
  - Type: Number
  - Required: true
  - Min: 1
  - Max: 10000

specializations:
  - Type: Array of String
  - Required: false
  - Min items: 0
  - Max items: 20
  - Pattern: /^[a-zA-Z\s]+$/

taxId:
  - Type: String
  - Required: true
  - Pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[0-9]{1}$/ (GSTIN format)
  - Validation: Valid GSTIN for India
```

---

#### 3. **Medicines Collection Validation**

```yaml
name:
  - Type: String
  - Required: true
  - Length: min 2, max 100
  - Trim: true
  - Unique-with: manufacturer

genericName:
  - Type: String
  - Required: true
  - Length: min 2, max 100
  - Trim: true

strength:
  - Type: String
  - Required: true
  - Pattern: /^[\d\.]+\s*(mg|mcg|g|ml|%|iu|mmol|meq)?$/
  - Examples: "500mg", "10ml", "5%", "1000iu"

form:
  - Type: String
  - Required: true
  - Enum: ["tablet", "capsule", "injection", "syrup", "suspension", 
           "ointment", "lotion", "cream", "powder", "solution", "inhaler"]

category:
  - Type: ObjectId
  - Required: true
  - Reference: medicine_categories
  - Validation: Category must exist and be active

manufacturer:
  - Type: ObjectId
  - Required: true
  - Reference: manufacturers
  - Validation: Manufacturer must exist and be active

reorderLevel:
  - Type: Number
  - Required: true
  - Min: 0
  - Validation: Min stock threshold for alerts

maxStockLevel:
  - Type: Number
  - Required: true
  - Min: greater than reorderLevel

shelfLife:
  - Type: Number
  - Required: true
  - Min: 1
  - Max: 3650 (10 years)
  - Unit: days

storageTemperature:
  - Type: String
  - Required: true
  - Enum: ["2-8°C", "15-25°C", "room_temperature", "below_25°C"]

storageConditions:
  - Type: Array of String
  - Required: false
  - Enum: ["protect_from_light", "keep_dry", "protect_from_moisture", 
           "away_from_heat", "protect_from_air"]

unitCost:
  - Type: Number
  - Required: true
  - Min: 0.01
  - Decimal places: 2

sellingPrice:
  - Type: Number
  - Required: true
  - Min: greater than or equal to unitCost
  - Decimal places: 2
```

---

#### 4. **Inventory Collection Validation**

```yaml
hospital:
  - Type: ObjectId
  - Required: true
  - Reference: hospitals
  - Validation: Must exist

branch:
  - Type: ObjectId
  - Required: true
  - Reference: branches
  - Validation: Must belong to same hospital

medicine:
  - Type: ObjectId
  - Required: true
  - Reference: medicines
  - Validation: Must exist and be active

quantityInStock:
  - Type: Number
  - Required: true
  - Min: 0
  - Integer: true

quantityReserved:
  - Type: Number
  - Required: true
  - Min: 0
  - Max: quantityInStock
  - Integer: true

batchNumber:
  - Type: String
  - Required: true
  - Length: min 5, max 50
  - Pattern: /^[A-Z0-9\-]+$/

manufacturingDate:
  - Type: Date
  - Required: true
  - Validation: Must be in past

expiryDate:
  - Type: Date
  - Required: true
  - Validation: Must be after manufacturingDate
  - Alert: If within 30 days

status:
  - Type: String
  - Required: true
  - Enum: ["active", "expiring_soon", "expired", "obsolete"]
  - Default: "active"

storageLocation:
  - Type: String
  - Required: false
  - Length: max 50
  - Format: "Shelf A3", "Freezer 2", etc.
```

---

#### 5. **Exchange Requests Collection Validation**

```yaml
initiatorHospital:
  - Type: ObjectId
  - Required: true
  - Reference: hospitals
  - Validation: Must be different from recipientHospital

recipientHospital:
  - Type: ObjectId
  - Required: true
  - Reference: hospitals
  - Validation: Must be different from initiatorHospital

requiredByDate:
  - Type: Date
  - Required: true
  - Validation: Must be in future

status:
  - Type: String
  - Required: true
  - Enum: ["draft", "pending", "approved", "rejected", "in_transit", "completed", "cancelled"]
  - Default: "draft"

notes:
  - Type: String
  - Required: false
  - Max length: 500
  - Trim: true

rejectionReason:
  - Type: String
  - Required: conditional (required if status = "rejected")
  - Min length: 10
  - Max length: 500
```

---

#### 6. **Exchange Items Collection Validation**

```yaml
exchangeRequest:
  - Type: ObjectId
  - Required: true
  - Reference: exchange_requests

medicine:
  - Type: ObjectId
  - Required: true
  - Reference: medicines
  - Validation: Must exist

inventory:
  - Type: ObjectId
  - Required: true
  - Reference: inventory
  - Validation: Must exist and belong to recipient hospital

quantityRequested:
  - Type: Number
  - Required: true
  - Min: 1
  - Max: inventory.quantityAvailable
  - Integer: true

quantityApproved:
  - Type: Number
  - Required: false (until approved)
  - Min: 0
  - Max: quantityRequested
  - Integer: true

expiryDate:
  - Type: Date
  - Required: true
  - Validation: Must match inventory.expiryDate

status:
  - Type: String
  - Required: true
  - Enum: ["pending", "approved", "rejected", "delivered", "received_partial"]
  - Default: "pending"
```

---

### Business Rule Validations

#### Exchange Process Validation

1. **Cannot exchange medicines:**
   - Already expired
   - Within 15 days of expiry (unless specified otherwise)
   - With status "expired", "obsolete", "discontinued"

2. **Exchange quantity validation:**
   - Cannot exceed available quantity
   - Must be at least 1 unit
   - Cannot exceed inventory.quantityAvailable

3. **Hospital validation:**
   - Both hospitals must be active
   - Both hospitals must be verified
   - Cannot exchange with itself

4. **Temporal validation:**
   - requiredByDate must be in future
   - Cannot cancel completed exchanges

---

#### Inventory Transaction Validation

```yaml
Allowed Transactions by Type:
  stock_in:
    - Description: Stock added to inventory
    - quantity: Must be > 0
    - reference: Purchase order
  
  stock_out:
    - Description: Stock removed from inventory
    - quantity: Must be > 0
    - quantityBefore: Must be >= quantity
    - reference: Manual removal
  
  exchange_sent:
    - Description: Stock sent to another hospital
    - quantity: Must be > 0
    - reference: exchange_request
    - Validation: Medicine must not be expired
  
  exchange_received:
    - Description: Stock received from another hospital
    - quantity: Must be > 0
    - reference: exchange_request
  
  expired_disposal:
    - Description: Expired medicine removed
    - quantity: Must be > 0
    - Validation: expiryDate must be in past
    - reference: Automatic or manual
  
  adjustment:
    - Description: Inventory count adjustment
    - quantity: Can be positive or negative
    - reference: Physical count or correction
    - Requires approval: true
```

---

### Data Integrity Rules

```yaml
Cascade Rules:
  Hospital Deletion:
    - Prevent if has active branches
    - Soft delete: Set deletedAt
    - Cascade to: branches (soft delete)
  
  Medicine Deletion:
    - Prevent if in active inventory
    - Soft delete only: Set discontinuedDate
  
  Inventory Deletion:
    - Not allowed (immutable)
    - Mark status as obsolete instead
  
  User Deletion:
    - Soft delete only: Set deletedAt
    - Keep audit logs intact
    - Revoke all refresh tokens

Uniqueness Constraints:
  - Email per system (case-insensitive)
  - Hospital registration number
  - Hospital license number
  - User phone number (if provided)
  - Medicine name per manufacturer
  - Branch code per hospital
  - Inventory per (hospital, branch, medicine)
  - Refresh token value
```

---

## Design Rationale

### 1. **Reference vs Embed Decision**

**References Used For:**
- **Users** → Roles: Roles change independently; users change roles frequently
- **Users** → Hospitals: Hospital is master data; multiple users per hospital
- **Medicines** → Manufacturers: Manufacturer is independent master; many medicines per manufacturer
- **Medicines** → Categories: Categories are independent; need independent querying
- **Inventory** → Medicines: Medicines are master data; inventory is transaction-heavy
- **Exchange** → Hospitals: Need to query hospitals independently; complex relationships
- **Notifications** → Users: Notifications are temporary; users are permanent

**Embeds Used For:**
- **Address** in Hospitals & Branches: Tightly coupled; always accessed together; rarely queries on address alone
- **Operating Hours** in Branches: Small, structured data; specific to branch
- **Status History** in Exchange Requests: Audit trail; related to entity lifecycle
- **Changes** in Audit Logs: Transaction-specific; small object

### 2. **Indexing Strategy Rationale**

**Compound Indexes:**
- `inventory (hospital, branch, medicine)`: Ensures unique stock per location; optimizes queries for branch inventory
- `exchange_requests (initiatorHospital, status)`: Finds requests sent by specific hospital with status filter
- `notifications (recipient, isRead, createdAt)`: Efficiently retrieves user's unread notifications in order

**TTL Indexes:**
- `refresh_tokens.expiresAt`: Auto-cleanup of expired tokens
- `notifications.expiresAt`: Auto-cleanup of old notifications (30-day retention)

**Unique Indexes:**
- Email, PhoneNumber: Prevent duplicate user accounts
- Medicine name + manufacturer: Allow same medicine name from different manufacturers
- Hospital registration/license: Regulatory requirement

### 3. **Denormalization Strategy**

**Denormalized Fields:**

| Field | Collection | Reason | Update Trigger |
|---|---|---|---|
| `hospital.totalBranches` | hospitals | Quick admin dashboard | Branch creation/deletion |
| `exchangeRequest.totalItems` | exchange_requests | UI display | Item added/removed |
| `exchangeRequest.totalQuantity` | exchange_requests | Reporting & analytics | Item quantity change |
| `inventory.quantityAvailable` | inventory | Performance (avoid calculation) | quantityInStock or quantityReserved change |

**Update Strategy:**
- Use application-level logic or database triggers
- Keep synchronized with transactions
- Always update atomically with source fields

### 4. **Security Considerations**

**Sensitive Data:**
- Passwords: Hashed with bcrypt, never returned in queries
- Refresh tokens: Hashed before storage
- Reset tokens: Hashed, short-lived (30 minutes)

**Audit Trail:**
- All mutations logged in audit_logs
- Immutable records with actor, action, timestamp
- Full before/after state captured
- Retention: 7 years (healthcare compliance)

**Access Control:**
- RBAC enforced at application layer
- Users cannot query other hospital's data (except admins)
- Hospitals cannot see other hospital's inventory

### 5. **Performance Optimization**

**Query Patterns Optimized:**
1. **Authentication:** `users.email + password` (indexed)
2. **Inventory alerts:** `inventory.expiryDate < now()` (indexed)
3. **Low stock:** `inventory.quantityAvailable < medicine.reorderLevel` (indexed)
4. **Exchange requests:** `exchangeRequest.status + hospital` (compound indexed)
5. **Audit queries:** `auditLogs.hospital + createdAt` (time-range queries)

**Write Optimization:**
- Separate inventory from transactions (queries on transactions won't lock inventory)
- Soft deletes prevent cascade issues
- TTL indexes handle cleanup

### 6. **Scalability Considerations**

**Collections by Transaction Volume:**
- High: `inventory`, `inventory_transactions`, `audit_logs` → Need sharding on hospital/branch
- Medium: `exchange_requests`, `notifications` → Index strategies critical
- Low: `medicines`, `hospitals`, `manufacturers` → Master data, cache-friendly

**Partitioning Strategy:**
- Future: Shard `inventory` and `inventory_transactions` by hospital
- Partition `audit_logs` by date (monthly chunks)
- Keep reference data in single partition initially

---

## Implementation Checklist

- [ ] ER Diagram approved by team
- [ ] Schema design reviewed by DBA
- [ ] Validation rules documented for frontend & backend
- [ ] Index strategy validated against query patterns
- [ ] Security review completed
- [ ] Mongoose models generated from this design
- [ ] Sample data created for testing
- [ ] Database performance tested (load test with 10K hospitals)
- [ ] Backup & recovery strategy defined
- [ ] Monitoring alerts configured for indexes

---

## Next Steps

1. **Review & Approval:** Submit this design for team review
2. **Mongoose Implementation:** Convert schemas to Mongoose models
3. **Seed Data:** Create test data for development
4. **Query Testing:** Test sample queries to verify index effectiveness
5. **Authentication Module:** Begin implementation using this schema
6. **Database Setup:** Create MongoDB collections with indexes
7. **Integration Testing:** Test with actual API endpoints

---

**Document Version:** 1.0  
**Created:** July 31, 2026  
**Status:** Ready for Implementation  
**Next Review:** After Mongoose model implementation