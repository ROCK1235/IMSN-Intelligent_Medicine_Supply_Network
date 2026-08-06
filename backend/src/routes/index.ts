import { Router } from "express";
import userRoutes from "../modules/user/route/user.route";

const router = Router();

router.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Welcome to IMSN API"
    });
});

router.use("/users", userRoutes);

export default router;