import { Router } from "express";
import userRoutes from "../modules/user/route/user.route";
import hospitalRoutes from "../modules/hospitals/route/hospital.route";
import branchRoutes from "../modules/branches/route/branch.route";
import staffRoutes from "../modules/user/route/staff.route";
import manufacturerRoutes from "../modules/manufacturers/route/manufacturer.route";
import categoryRoutes from "../modules/medicineCategories/route/category.route";
import medicineRoutes from "../modules/medicine/route/medicine.route";
import inventoryRoutes from "../modules/inventery/route/inventory.route";
import inventoryReportsRoutes from "../modules/inventery/route/inventoryReports.route";
import exchangeRequestRoutes from "../modules/exchangeRequests/route/exchangeRequest.route";
import notificationRoutes from "../modules/notifications/route/notification.route";
import auditLogRoutes from "../modules/auditLogs/route/auditLog.route";
import auditLogHospitalRoutes from "../modules/auditLogs/route/auditLog.hospitalRoute";

const router = Router();

router.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Welcome to IMSN API"
    });
});

router.use("/users", userRoutes);
router.use("/hospitals", hospitalRoutes);
// Nested under /hospitals/:hospitalId/... — routers mounted here use
// Router({ mergeParams: true }) so :hospitalId (and :branchId, one level
// deeper) is visible to them.
router.use("/hospitals/:hospitalId/branches", branchRoutes);
router.use("/hospitals/:hospitalId/staff", staffRoutes);
router.use("/hospitals/:hospitalId/inventory", inventoryReportsRoutes);
router.use("/hospitals/:hospitalId/branches/:branchId/inventory", inventoryRoutes);
router.use("/hospitals/:hospitalId/audit-logs", auditLogHospitalRoutes);

router.use("/manufacturers", manufacturerRoutes);
router.use("/medicine-categories", categoryRoutes);
router.use("/medicines", medicineRoutes);
router.use("/exchange-requests", exchangeRequestRoutes);
router.use("/notifications", notificationRoutes);
router.use("/audit-logs", auditLogRoutes);

export default router;
