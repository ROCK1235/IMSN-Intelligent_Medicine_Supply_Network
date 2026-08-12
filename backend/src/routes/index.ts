import { Router } from "express";
import userRoutes from "../modules/user/route/user.route";
import hospitalRoutes from "../modules/hospitals/route/hospital.route";
import branchRoutes from "../modules/branches/route/branch.route";
import staffRoutes from "../modules/user/route/staff.route";

const router = Router();

router.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Welcome to IMSN API"
    });
});

router.use("/users", userRoutes);
router.use("/hospitals", hospitalRoutes);
// Nested under /hospitals/:hospitalId/... — both routers use
// Router({ mergeParams: true }) so :hospitalId is visible to them.
router.use("/hospitals/:hospitalId/branches", branchRoutes);
router.use("/hospitals/:hospitalId/staff", staffRoutes);

export default router;
