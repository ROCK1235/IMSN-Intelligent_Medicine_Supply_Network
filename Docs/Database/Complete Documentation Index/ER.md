# IMSN - ER Diagram & Visual Relationships

**Version:** 1.0  
**Created:** July 31, 2026

---

## Complete ER Diagram (ASCII)

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         IMSN DATABASE ARCHITECTURE                           ║
║                      Entity-Relationship Diagram (ERD)                        ║
╚═══════════════════════════════════════════════════════════════════════════════╝


                            ┌──────────────────┐
                            │    Roles         │
                            ├──────────────────┤
                            │ _id (PK)         │
                            │ name (U, I)      │
                            │ description      │
                            │ permissions[] ───┼──────┐
                            │ isActive         │      │
                            │ isSystem         │      │
                            │ createdAt        │      │
                            │ updatedAt        │      │
                            └──────────────────┘      │
                                                      │
                                                      │ 1:N
                                                      │
                            ┌──────────────────┐      │
                            │  Permissions     │◄─────┘
                            ├──────────────────┤
                            │ _id (PK)         │
                            │ name (U, I)      │
                            │ description      │
                            │ resource         │
                            │ action           │
                            │ scope            │
                            │ isActive         │
                            │ createdAt        │
                            │ updatedAt        │
                            └──────────────────┘


                            ┌──────────────────┐
                            │   Users          │
                            ├──────────────────┤
                            │ _id (PK)         │
                            │ firstName        │
                            │ lastName         │
                            │ email (U, I)     │
                            │ phoneNumber (U)  │
                            │ avatar           │
                            │ password (H)     │
                            │ role (FK) ───────┼──────────────┐
                            │ hospital (FK) ───┼──────┐       │
                            │ branch (FK)      │      │       │
                            │ isActive (I)     │      │       │
                            │ lastLoginAt      │      │       │
                            │ createdAt (I)    │      │       │
                            │ updatedAt        │      │       │
                            │ deletedAt        │      │       │
                            └──────────────────┘      │       │
                                   │                  │       │
                    ┌──────────────┬┼──────────┐      │       │
                    │              ││          │      │       │
                 1:N │          1:N ││      1:N │      │       │
                    │              ││          │      │       │
              ┌─────▼──────┐  ┌────▼─────┐  ┌─┴─────────────┐ │
              │ Branches   │  │ Inventory │  │  Refresh     │ │
              ├────────────┤  ├──────────┤  │  Tokens      │ │
              │ _id (PK)   │  │ _id (PK) │  ├──────────────┤ │
              │ name       │  │ hospital │  │ _id (PK)     │ │
              │ code (U,I) │  │ branch   │  │ token (U,I)  │ │
              │ hospital---┼─-┤ medicine │  │ user (FK)────┼─┘
              │ (FK,I)     │  │ (FK)     │  │ expiresAt(I) │
              │ address{}  │  │ batch    │  │ isRevoked    │
              │ contact    │  │ quantity │  │ revokedAt    │
              │ hours{}    │  │ _InStock │  │ ipAddress    │
              │ isActive   │  │ reserved │  │ userAgent    │
              │ createdAt  │  │ available│  │ createdAt    │
              │ updatedAt  │  │ (calc)   │  │ updatedAt    │
              └─────┬──────┘  │ expiryD  │  └──────────────┘
                    │         │ status   │
                    │         │ created  │
                    │         │ updated  │
                    │         └──────────┘
                    │
                    │
              ┌─────┴─────────────────────────┐
              │                               │
          1:N │                           1:N │
              │                               │
        ┌─────▼──────┐              ┌────────▼──┐
        │ Hospitals  │              │ Inventory │
        ├────────────┤              │ Transactions
        │ _id (PK)   │              ├───────────┤
        │ name (U,I) │              │ _id (PK)  │
        │ regNumber  │              │ hospital  │
        │ (U, I)     │              │ branch    │
        │ license    │              │ medicine  │
        │ (U, I)     │              │ inventory │
        │ type       │              │ type      │
        │ email (U)  │              │ quantity  │
        │ phone      │              │ before    │
        │ address{}  │              │ after     │
        │ beds       │              │ reason    │
        │ specs[]    │              │ performer │
        │ accredit[] │              │ cost      │
        │ taxId      │              │ createdAt │
        │ isActive   │              └───────────┘
        │ isVerified │
        │ createdAt  │
        │ updated    │
        └────────────┘
              │
              │ 1:N
              │
        ┌─────▼─────────────────────────────────────┐
        │                                           │
        │     ┌──────────────┐  ┌───────────────┐  │
        │     │ Manufacturers│  │ Med. Categories
        │     ├──────────────┤  ├───────────────┤  │
        │     │ _id (PK)     │  │ _id (PK)      │  │
        │     │ name (U, I)  │  │ name (U, I)   │  │
        │     │ license(U,I) │  │ code (U, I)   │  │
        │     │ regDate      │  │ description   │  │
        │     │ email        │  │ parent        │  │
        │     │ phone        │  │ isActive      │  │
        │     │ address{}    │  │ displayOrder  │  │
        │     │ certs[]      │  │ createdAt     │  │
        │     │ isActive     │  │ updatedAt     │  │
        │     │ createdAt    │  └───────────────┘  │
        │     │ updatedAt    │           ▲          │
        │     └──────────────┘           │          │
        │               ▲                │ 1:N      │
        │               │ 1:N            │          │
        │               │                │          │
        │     ┌─────────┴────────────────┴──────┐   │
        │     │                                 │   │
        │     │      ┌──────────────────────┐   │   │
        │     │      │   Medicines          │   │   │
        │     │      ├──────────────────────┤   │   │
        │     │      │ _id (PK)             │   │   │
        │     │      │ name (U, I)          │   │   │
        │     │      │ genericName          │   │   │
        │     │      │ category (FK, I)─────┼───┴───┤
        │     │      │ manufacturer (FK, I)-┼───────┤
        │     │      │ strength             │       │
        │     │      │ form                 │       │
        │     │      │ hsn_sac              │       │
        │     │      │ regNumber (U, I)     │       │
        │     │      │ shelfLife            │       │
        │     │      │ storage{}            │       │
        │     │      │ reorderLevel (I)     │       │
        │     │      │ maxStockLevel        │       │
        │     │      │ unitCost             │       │
        │     │      │ sellingPrice         │       │
        │     │      │ isActive             │       │
        │     │      │ createdAt (I)        │       │
        │     │      │ updatedAt            │       │
        │     │      └──────────────────────┘       │
        │     │                                     │
        │     └─────────────────────────────────────┘
        │
        └────────────────────────────────────────────┐
                                                     │
                                                 1:N │
                                                     │
                       ┌─────────────────────────────▼──────────────┐
                       │                                            │
                       │        ┌──────────────────────────┐        │
                       │        │ Exchange Requests        │        │
                       │        ├──────────────────────────┤        │
                       │        │ _id (PK)                 │        │
                       │        │ requestNumber (U, I)     │        │
                       │        │ initiatorHospital (FK,I)-┼────────┼─────────┐
                       │        │ recipientHospital (FK,I)-┼────────┼─────────┐
                       │        │ initiatorBranch (FK)     │        │         │
                       │        │ recipientBranch (FK)     │        │         │
                       │        │ createdBy (FK)           │        │         │
                       │        │ approvedBy (FK)          │        │         │
                       │        │ status (I)               │        │         │
                       │        │ statusHistory[]{}        │        │         │
                       │        │ requestDate              │        │         │
                       │        │ requiredByDate           │        │         │
                       │        │ approvalDate             │        │         │
                       │        │ totalItems               │        │         │
                       │        │ totalQuantity            │        │         │
                       │        │ notes                    │        │         │
                       │        │ createdAt (I)            │        │         │
                       │        │ updatedAt                │        │         │
                       │        └────────────────┬─────────┘        │         │
                       │                         │                  │         │
                       │                     1:N │                  │         │
                       │                         │                  │         │
                       │        ┌────────────────▼────────────┐     │         │
                       │        │ Exchange Items             │     │         │
                       │        ├────────────────────────────┤     │         │
                       │        │ _id (PK)                   │     │         │
                       │        │ exchangeRequest (FK, I)────┼─────┤         │
                       │        │ medicine (FK, I)           │     │         │
                       │        │ inventory (FK)             │     │         │
                       │        │ quantityRequested (I)      │     │         │
                       │        │ quantityApproved           │     │         │
                       │        │ quantityReceived           │     │         │
                       │        │ expiryDate                 │     │         │
                       │        │ daysToExpiry               │     │         │
                       │        │ status                     │     │         │
                       │        │ reason                     │     │         │
                       │        │ batchNumber                │     │         │
                       │        │ createdAt                  │     │         │
                       │        │ updatedAt                  │     │         │
                       │        └────────────────────────────┘     │         │
                       │                                            │         │
                       └────────────────────────────────────────────┴────────-┘


┌──────────────────────────────────────────────────────────────────────────────┐
│                          NOTIFICATIONS SUBSYSTEM                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│        ┌─────────────────────────────────────────────┐                      │
│        │        Notifications                        │                      │
│        ├─────────────────────────────────────────────┤                      │
│        │ _id (PK)                                    │                      │
│        │ recipient (FK, I) ──────────┐               │                      │
│        │ type (I)                    │               │                      │
│        │ title                       │               │                      │
│        │ message                     │               │                      │
│        │ relatedEntity{}             │               │                      │
│        │ isRead                      │ 1:N           │                      │
│        │ readAt                      │               │                      │
│        │ channels[]                  │       ┌───────▼────────────────┐     │
│        │ deliveryStatus{}            │       │ Users                  │     │
│        │ expiresAt (TTL)             │       │ (Already defined above) │     │
│        │ createdAt                   │       └────────────────────────┘     │
│        └─────────────────────────────┘                                      │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────────────┐
│                            AUDIT LOG SUBSYSTEM                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│        ┌──────────────────────────────────┐                                 │
│        │    Audit Logs                    │                                 │
│        ├──────────────────────────────────┤                                 │
│        │ _id (PK)                         │                                 │
│        │ actor (FK, I) ─────────┐         │                                 │
│        │ actorRole              │         │                                 │
│        │ action (I)             │         │                                 │
│        │ resource (I)           │         │                                 │
│        │ resourceId (I)         │         │                                 │
│        │ changes{}              │ 1:N     │                                 │
│        │ ipAddress              │         │                                 │
│        │ userAgent              │   ┌─────▼──────────────────┐              │
│        │ status                 │   │ Users                  │              │
│        │ errorMessage           │   │ (Already defined above) │              │
│        │ hospital (I)           │   └────────────────────────┘              │
│        │ branch                 │                                           │
│        │ retentionUntil         │                                           │
│        │ createdAt (I)          │                                           │
│        └──────────────────────────────────┘                                 │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘


Legend:
========
(PK)     = Primary Key
(FK)     = Foreign Key
(U)      = Unique Constraint
(I)      = Index
(H)      = Hashed (for security)
(TTL)    = Time To Live (auto-delete)
{}       = Embedded Object
[]       = Array
1:N      = One to Many relationship
N:M      = Many to Many relationship
```

---

## Detailed Relationship Descriptions

### **1. Roles ↔ Permissions**

```
┌─────────────────────────────────────────────────────────┐
│                    One-to-Many (1:N)                    │
├─────────────────────────────────────────────────────────┤
│ One Role has Many Permissions                          │
│                                                         │
│ Example:                                                │
│   Role: "hospital_manager"                              │
│   Permissions:                                          │
│     - CREATE_INVENTORY                                 │
│     - READ_INVENTORY                                   │
│     - APPROVE_EXCHANGE_REQUEST                         │
│     - VIEW_AUDIT_LOGS                                  │
│                                                         │
│ Implementation: Array of ObjectIds in roles.permissions │
│ Cardinality:   One role → Many permissions             │
│ Inverse:       Many permissions ← One role             │
└─────────────────────────────────────────────────────────┘
```

### **2. Users ↔ Roles**

```
┌─────────────────────────────────────────────────────────┐
│                    Many-to-One (N:1)                    │
├─────────────────────────────────────────────────────────┤
│ Many Users have One Role each                          │
│                                                         │
│ Example:                                                │
│   Role: "pharmacist"                                    │
│   Users:                                                │
│     - John (pharmacist at Hospital A)                  │
│     - Sarah (pharmacist at Hospital B)                 │
│     - Mike (pharmacist at Hospital A)                  │
│                                                         │
│ Implementation: ObjectId reference in users.role        │
│ Cardinality:   Many users → One role                   │
│ Query Pattern: Find all pharmacists                    │
│ Index:        users { role: 1 }                        │
└─────────────────────────────────────────────────────────┘
```

### **3. Users ↔ Hospitals**

```
┌─────────────────────────────────────────────────────────┐
│                    Many-to-One (N:1)                    │
├─────────────────────────────────────────────────────────┤
│ Many Users belong to One Hospital                      │
│                                                         │
│ Example:                                                │
│   Hospital: "City Medical Center"                       │
│   Users:                                                │
│     - Admin User (hospital_admin)                      │
│     - Pharmacy Manager (pharmacy_manager)              │
│     - Pharmacist 1 (pharmacist)                        │
│     - Pharmacist 2 (pharmacist)                        │
│                                                         │
│ Exception: System admins have hospital = null          │
│                                                         │
│ Implementation: ObjectId reference in users.hospital    │
│ Cardinality:   Many users → One hospital              │
│ Query Pattern: Find all staff at Hospital A            │
│ Index:        users { hospital: 1 }                    │
└─────────────────────────────────────────────────────────┘
```

### **4. Users ↔ Branches**

```
┌─────────────────────────────────────────────────────────┐
│                    Many-to-One (N:1)                    │
├─────────────────────────────────────────────────────────┤
│ Many Users work at One Branch                          │
│                                                         │
│ Structure:                                              │
│   Hospital                                              │
│     ├─ Main Branch                                     │
│     │    ├─ User 1 (works_here)                        │
│     │    ├─ User 2 (works_here)                        │
│     │    └─ User 3 (works_here)                        │
│     └─ Satellite Branch                                │
│          ├─ User 4 (works_here)                        │
│          └─ User 5 (works_here)                        │
│                                                         │
│ Implementation: ObjectId reference in users.branch      │
│ Cardinality:   Many users → One branch                │
│ Query Pattern: Find all staff at Branch A              │
│ Index:        users { branch: 1 }                      │
│ Constraint:   Branch must belong to users.hospital     │
└─────────────────────────────────────────────────────────┘
```

### **5. Users ↔ Refresh Tokens**

```
┌─────────────────────────────────────────────────────────┐
│                    One-to-Many (1:N)                    │
├─────────────────────────────────────────────────────────┤
│ One User has Many Refresh Tokens                       │
│                                                         │
│ Example:                                                │
│   User: john@hospital.com                              │
│   Tokens (active):                                      │
│     - Login from Desktop (Browser)                     │
│     - Login from Mobile (iOS App)                      │
│     - Login from Laptop (Chrome)                       │
│                                                         │
│ Purpose: Multi-device login; revoke specific tokens    │
│                                                         │
│ Implementation: ObjectId reference in tokens.user       │
│ Cardinality:   One user → Many tokens                  │
│ Query Pattern: Get all active tokens for user          │
│ Index:        refresh_tokens { user: 1 }              │
│ Cleanup:      Auto-delete on expiry (TTL index)       │
│ Revocation:   Mark isRevoked = true on logout          │
└─────────────────────────────────────────────────────────┘
```

### **6. Hospitals ↔ Branches**

```
┌─────────────────────────────────────────────────────────┐
│                    One-to-Many (1:N)                    │
├─────────────────────────────────────────────────────────┤
│ One Hospital has Many Branches                         │
│                                                         │
│ Hierarchy:                                              │
│   City Medical Center (Main Hospital)                  │
│     ├─ Main Branch (Downtown)          [200 beds]      │
│     ├─ North Branch (North City)       [150 beds]      │
│     ├─ South Satellite (South City)    [50 beds]       │
│     └─ East Dispensary (East Side)     [Clinic]        │
│                                                         │
│ Implementation: ObjectId reference in branches.hospital │
│ Cardinality:   One hospital → Many branches            │
│ Query Pattern: Find all branches of Hospital A         │
│ Index:        branches { hospital: 1 }                 │
│ Soft Constraint: All branches under same hospital      │
│ Inventory scoping: Inventory per branch for accuracy   │
└─────────────────────────────────────────────────────────┘
```

### **7. Medicines ↔ Categories**

```
┌─────────────────────────────────────────────────────────┐
│                    Many-to-One (N:1)                    │
├─────────────────────────────────────────────────────────┤
│ Many Medicines belong to One Category                  │
│                                                         │
│ Hierarchy:                                              │
│   ├─ Antibiotics                                       │
│   │    ├─ Amoxicillin (500mg)                          │
│   │    ├─ Azithromycin (250mg)                         │
│   │    └─ Cephalexin (500mg)                           │
│   ├─ Antivirals                                        │
│   │    ├─ Oseltamivir (75mg)                           │
│   │    └─ Acyclovir (400mg)                            │
│   └─ Antiemetics                                       │
│        ├─ Ondansetron (4mg)                            │
│        └─ Metoclopramide (10mg)                        │
│                                                         │
│ Implementation: ObjectId reference in medicines.category│
│ Cardinality:   Many medicines → One category           │
│ Query Pattern: Find all antibiotics in stock           │
│ Index:        medicines { category: 1 }                │
│ Hierarchy:    Optional parent category for sub-types   │
│ Use Case:     Filter medicines by category in UI       │
└─────────────────────────────────────────────────────────┘
```

### **8. Medicines ↔ Manufacturers**

```
┌─────────────────────────────────────────────────────────┐
│                    Many-to-One (N:1)                    │
├─────────────────────────────────────────────────────────┤
│ Many Medicines are made by One Manufacturer            │
│                                                         │
│ Example:                                                │
│   Manufacturer: "Pharma Corp Limited"                   │
│   Products:                                             │
│     - Aspirin (500mg) by Pharma Corp                   │
│     - Paracetamol (500mg) by Pharma Corp               │
│     - Ibuprofen (400mg) by Pharma Corp                 │
│                                                         │
│ Note: Same medicine can be made by different makers    │
│       (Amoxicillin by Company A, Company B, Company C) │
│                                                         │
│ Implementation: ObjectId reference in medicines.mfg    │
│ Cardinality:   Many medicines → One manufacturer       │
│ Uniqueness:    Compound unique: (name, manufacturer)   │
│ Query Pattern: Find all medicines by Pharma Corp       │
│ Index:        medicines { manufacturer: 1 }            │
│ Regulatory:   Track medicines by manufacturer          │
│ Compliance:   Recall specific manufacturer batch       │
└─────────────────────────────────────────────────────────┘
```

### **9. Branches ↔ Inventory**

```
┌──────────────────────────────────────────────────────────────┐
│                    One-to-Many (1:N)                         │
├──────────────────────────────────────────────────────────────┤
│ One Branch has Many Inventory Items                         │
│                                                              │
│ Structure:                                                   │
│   Hospital A → Main Branch                                  │
│     └─ Inventory (Stock of medicines):                      │
│          ├─ Aspirin 500mg Batch-2024-001  [500 units]      │
│          ├─ Paracetamol 500mg Batch-2024-002  [300 units]  │
│          ├─ Amoxicillin 250mg Batch-2024-003  [1000 units] │
│          └─ ...                                             │
│                                                              │
│ Implementation: ObjectId reference in inventory.branch       │
│ Cardinality:   One branch → Many inventory items           │
│ Query Pattern: Get all medicines in stock at Branch A       │
│ Index:        inventory { branch: 1 }                       │
│ Scope:        Inventory is branch-level (not hospital-wide) │
│ Reporting:    Calculate hospital-wide stock from branches   │
│ Exchange:     Only request from recipient branch's inv.     │
└──────────────────────────────────────────────────────────────┘
```

### **10. Medicines ↔ Inventory**

```
┌──────────────────────────────────────────────────────────────┐
│                    Many-to-One (N:1)                         │
├──────────────────────────────────────────────────────────────┤
│ Many Inventory Items reference One Medicine                 │
│                                                              │
│ Structure:                                                   │
│   Medicine: Amoxicillin 500mg                               │
│   ├─ Inventory A: Branch-1, Batch-2024-001, Exp-2025-01   │
│   ├─ Inventory B: Branch-1, Batch-2024-002, Exp-2025-06   │
│   ├─ Inventory C: Branch-2, Batch-2024-003, Exp-2025-03   │
│   └─ Inventory D: Branch-2, Batch-2024-004, Exp-2025-08   │
│                                                              │
│ Purpose: Same medicine in different batches/branches        │
│                                                              │
│ Implementation: ObjectId reference in inventory.medicine     │
│ Cardinality:   Many inventory → One medicine               │
│ Query Pattern: Find all stock of Amoxicillin 500mg         │
│ Index:        inventory { medicine: 1 }                     │
│ Compound:     inventory { medicine: 1, expiryDate: 1 }     │
│ Use Case:     Track medicine expiry across all branches     │
│ Reporting:    Total stock of medicine across hospital       │
└──────────────────────────────────────────────────────────────┘
```

### **11. Inventory ↔ Inventory Transactions**

```
┌──────────────────────────────────────────────────────────────┐
│                    One-to-Many (1:N)                         │
├──────────────────────────────────────────────────────────────┤
│ One Inventory Item has Many Transactions (Audit Trail)      │
│                                                              │
│ Structure:                                                   │
│   Inventory: Amoxicillin, Branch-1, Batch-2024-001          │
│   Current Stock: 200 units                                   │
│   Transaction History:                                       │
│     1. 2024-01-15 10:00 - Stock In: +500 (Purchase)        │
│     2. 2024-01-20 14:30 - Stock Out: -100 (Patient Use)    │
│     3. 2024-02-10 09:15 - Exchange Sent: -200 (To Hospital B)
│     4. 2024-02-15 16:45 - Adjustment: -50 (Damage/Loss)    │
│                                                              │
│ Result: 500 - 100 - 200 - 50 = 150 units                   │
│         But database shows 200 (implies +50 later)          │
│                                                              │
│ Implementation: ObjectId reference in transactions.inventory │
│ Cardinality:   One inventory → Many transactions            │
│ Immutability:  Transactions are write-once records          │
│ Audit Trail:   Complete history of stock changes           │
│ Query Pattern: Get all transactions for specific batch      │
│ Index:        inventory_transactions { inventory: 1 }       │
│ Traceability:  Link exchanges to stock movement             │
│ Compliance:    Complete audit trail for healthcare          │
└──────────────────────────────────────────────────────────────┘
```

### **12. Exchange Requests ↔ Exchange Items**

```
┌──────────────────────────────────────────────────────────────┐
│                    One-to-Many (1:N)                         │
├──────────────────────────────────────────────────────────────┤
│ One Exchange Request contains Many Exchange Items           │
│                                                              │
│ Structure:                                                   │
│   Exchange Request ER-HOSP-2024-001                         │
│   From: Hospital A (Main Branch)                            │
│   To: Hospital B (Main Branch)                              │
│   Requested: 2024-01-15, Required By: 2024-01-25            │
│   Status: Approved                                           │
│                                                              │
│   Items:                                                     │
│     1. Amoxicillin 500mg                                    │
│        - Requested: 100 units, Approved: 100, Received: 100 │
│        - Batch: AMOX-2024-001, Exp: 2025-06-15             │
│        - Status: Received                                    │
│                                                              │
│     2. Paracetamol 500mg                                    │
│        - Requested: 50 units, Approved: 40, Received: 40    │
│        - Batch: PARA-2024-002, Exp: 2025-08-20             │
│        - Status: Received                                    │
│                                                              │
│     3. Aspirin 500mg                                        │
│        - Requested: 75 units, Approved: 0, Received: 0      │
│        - Reason: "No stock available"                       │
│        - Status: Rejected                                    │
│                                                              │
│ Implementation: ObjectId reference in items.exchangeRequest  │
│ Cardinality:   One request → Many items                     │
│ Query Pattern: Get all items in exchange ER-HOSP-2024-001   │
│ Index:        exchange_items { exchangeRequest: 1 }         │
│ Workflow:     Items move through statuses independently     │
│ Partial Fulfillment: Items can have different statuses      │
└──────────────────────────────────────────────────────────────┘
```

### **13. Exchange Items ↔ Medicines**

```
┌──────────────────────────────────────────────────────────────┐
│                    Many-to-One (N:1)                         │
├──────────────────────────────────────────────────────────────┤
│ Many Exchange Items reference One Medicine                  │
│                                                              │
│ Example:                                                     │
│   Medicine: Amoxicillin 500mg                               │
│                                                              │
│   Exchange Item 1:                                           │
│   - Exchange Request: ER-HOSP-2024-001                      │
│   - Quantity: 100 units from Hospital A to Hospital B       │
│   - Batch: AMOX-2024-001, Exp: 2025-06-15                  │
│                                                              │
│   Exchange Item 2:                                           │
│   - Exchange Request: ER-HOSP-2024-002                      │
│   - Quantity: 50 units from Hospital C to Hospital D        │
│   - Batch: AMOX-2024-002, Exp: 2025-03-20                  │
│                                                              │
│ Implementation: ObjectId reference in items.medicine         │
│ Cardinality:   Many items → One medicine                    │
│ Query Pattern: Find all exchanges of Amoxicillin            │
│ Index:        exchange_items { medicine: 1 }                │
│ Tracking:     Monitor which hospitals need specific meds    │
│ Analytics:    Popular medicines in exchanges                │
└──────────────────────────────────────────────────────────────┘
```

### **14. Exchange Requests ↔ Hospitals (Bidirectional)**

```
┌──────────────────────────────────────────────────────────────┐
│                    Many-to-Many (N:M)                        │
├──────────────────────────────────────────────────────────────┤
│ Exchange connects Two Hospitals (Asymmetric)                │
│                                                              │
│ Structure:                                                   │
│   Hospital A ──(sends)──→ Exchange Request ──(receives)──→ Hospital B
│                                                              │
│ Example:                                                     │
│   Exchange ER-HOSP-2024-001                                 │
│   - initiatorHospital: City Medical Center (requests)       │
│   - recipientHospital: District Hospital (provides)         │
│                                                              │
│   Exchange ER-HOSP-2024-002                                 │
│   - initiatorHospital: District Hospital (requests)         │
│   - recipientHospital: City Medical Center (provides)       │
│                                                              │
│ Implementation:                                              │
│   exchange_requests.initiatorHospital (FK)                  │
│   exchange_requests.recipientHospital (FK)                  │
│                                                              │
│ Cardinality:                                                 │
│   Hospital A → Many exchange requests as initiator          │
│   Hospital A → Many exchange requests as recipient          │
│                                                              │
│ Indexes:                                                     │
│   {initiatorHospital: 1, status: 1}   - Requests sent      │
│   {recipientHospital: 1, status: 1}   - Requests received  │
│                                                              │
│ Query Patterns:                                              │
│   - All exchanges initiated by Hospital A                   │
│   - All pending exchanges to be fulfilled by Hospital A     │
│   - Exchange history between Hospital A and Hospital B      │
│   - Hospital A can see both sent and received requests      │
│                                                              │
│ Business Rules:                                              │
│   - Cannot exchange with itself                             │
│   - Both hospitals must be active and verified              │
│   - Only registered users can initiate exchanges            │
└──────────────────────────────────────────────────────────────┘
```

### **15. Users ↔ Notifications**

```
┌──────────────────────────────────────────────────────────────┐
│                    One-to-Many (1:N)                         │
├──────────────────────────────────────────────────────────────┤
│ One User receives Many Notifications                        │
│                                                              │
│ Example:                                                     │
│   User: john@hospitala.com (Hospital Manager)               │
│   Notifications:                                             │
│     1. Exchange request received from Hospital B            │
│        - Type: exchange_request_received                    │
│        - Created: 2024-01-20 10:00                          │
│        - Status: Unread                                     │
│                                                              │
│     2. Your exchange request was approved                   │
│        - Type: exchange_request_approved                    │
│        - Created: 2024-01-20 14:30                          │
│        - Status: Read                                       │
│                                                              │
│     3. Medicine expiring in 7 days                          │
│        - Type: medicine_expiring_soon                       │
│        - Created: 2024-01-25 09:00                          │
│        - Status: Unread                                     │
│                                                              │
│ Implementation: ObjectId reference in notifications.recipient│
│ Cardinality:   One user → Many notifications                │
│ Query Pattern: Get unread notifications for user            │
│ Index:        notifications {recipient: 1, isRead: 1}       │
│ TTL:          Auto-delete after 30 days                     │
│ Channels:     In-app, Email, SMS                            │
│ Use Case:     Real-time alerts on inventory and exchanges   │
└──────────────────────────────────────────────────────────────┘
```

### **16. Users ↔ Audit Logs**

```
┌──────────────────────────────────────────────────────────────┐
│                    One-to-Many (1:N)                         │
├──────────────────────────────────────────────────────────────┤
│ One User generates Many Audit Logs                          │
│                                                              │
│ Example:                                                     │
│   User: john@hospitala.com                                  │
│   Audit Trail:                                               │
│     1. Created exchange request ER-HOSP-2024-001            │
│        - Action: CREATE                                     │
│        - Resource: exchange_request                         │
│        - Timestamp: 2024-01-20 10:00:05                     │
│        - IP: 192.168.1.10                                   │
│                                                              │
│     2. Updated inventory for Amoxicillin                    │
│        - Action: UPDATE                                     │
│        - Resource: inventory                                │
│        - Before: {quantity: 500}                            │
│        - After: {quantity: 400}                             │
│        - Timestamp: 2024-01-20 11:30:15                     │
│                                                              │
│     3. Approved exchange request ER-HOSP-2024-001           │
│        - Action: APPROVE                                    │
│        - Resource: exchange_request                         │
│        - Timestamp: 2024-01-20 14:00:30                     │
│        - Hospital: City Medical Center                      │
│                                                              │
│ Implementation: ObjectId reference in audit_logs.actor       │
│ Cardinality:   One user → Many audit logs                   │
│ Immutability:  Logs cannot be modified/deleted              │
│ Retention:     7 years (healthcare compliance)              │
│ Query Pattern: Get all actions by user john for date range  │
│ Index:        audit_logs {actor: 1, createdAt: -1}          │
│ Compliance:   Complete accountability for all operations    │
│ Forensics:    Investigate data issues with full trail       │
└──────────────────────────────────────────────────────────────┘
```

---

## Relationship Cardinality Summary Table

| From Entity | To Entity | Type | Cardinality | Implementation | Use Case |
|---|---|---|---|---|---|
| roles | permissions | 1:N | 1 role : many perms | Array FK | Define role capabilities |
| users | roles | N:1 | many users : 1 role | FK reference | User authorization |
| users | hospitals | N:1 | many users : 1 hosp | FK reference | User assignment to hospital |
| users | branches | N:1 | many users : 1 branch | FK reference | User assignment to branch |
| users | refresh_tokens | 1:N | 1 user : many tokens | FK reference | Multi-device login |
| hospitals | branches | 1:N | 1 hosp : many branches | FK reference | Hospital structure |
| medicines | categories | N:1 | many meds : 1 cat | FK reference | Medicine organization |
| medicines | manufacturers | N:1 | many meds : 1 mfg | FK reference | Medicine sourcing |
| branches | inventory | 1:N | 1 branch : many inv | FK reference | Stock tracking |
| medicines | inventory | N:1 | many inv : 1 med | FK reference | Stock of medicine |
| inventory | inv_transactions | 1:N | 1 inv : many trans | FK reference | Audit trail |
| exchange_requests | exchange_items | 1:N | 1 req : many items | FK reference | Request details |
| exchange_items | medicines | N:1 | many items : 1 med | FK reference | Item details |
| hospitals | exchange_requests | N:M* | many : many (asym) | 2 FK references | Exchange parties |
| users | notifications | 1:N | 1 user : many notif | FK reference | User alerts |
| users | audit_logs | 1:N | 1 user : many logs | FK reference | Action tracking |

\* Asymmetric Many-to-Many: Each exchange has exactly 2 different hospitals (initiator and recipient)

---

## ER Diagram Notes

1. **Embedded Objects** (shown as `{}`):
   - Address (in Hospitals, Branches)
   - Operating Hours (in Branches)
   - Status History (in Exchange Requests)
   - Changes/Before-After (in Audit Logs)

2. **Arrays** (shown as `[]`):
   - Permissions array in Roles
   - Certifications in Manufacturers
   - Specializations in Hospitals
   - Storage conditions in Medicines
   - Channels in Notifications

3. **Indexes** (denoted by `(I)`):
   - Created on foreign keys for join performance
   - Created on frequently queried fields (status, dates)
   - Created on compound patterns for complex queries

4. **Unique Constraints** (denoted by `(U)`):
   - Prevent duplicates of critical master data
   - Email, registration numbers, license numbers
   - Compound unique for (medicine, manufacturer)

5. **TTL Indexes**:
   - Refresh tokens auto-delete after expiry
   - Notifications auto-delete after retention period

---

**This ER Diagram is ready for:**
✅ Mongoose model generation  
✅ Database implementation  
✅ API endpoint design  
✅ Frontend data modeling