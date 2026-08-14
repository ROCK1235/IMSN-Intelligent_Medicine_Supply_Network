import { Router } from "express";
import * as exchangeRequestController from "../controller/exchangeRequest.controller";
import { validate, validateQuery } from "../../../middlewares/validate";
import { protect } from "../../../middlewares/authMiddleware";
import { authorize } from "../../../middlewares/authorize";
import { PERMISSIONS } from "../../../constants/permissions";
import {
  approveExchangeRequestSchema,
  cancelExchangeRequestSchema,
  createExchangeRequestSchema,
  listExchangeRequestsQuerySchema,
  receiveExchangeRequestSchema,
  rejectExchangeRequestSchema,
} from "../validator/exchangeRequest.validator";

// Mounted at /api/v1/exchange-requests (see routes/index.ts). Not nested
// under /hospitals/:hospitalId since a request always spans two hospitals —
// participant authorization is handled in exchangeRequest.service.ts
// (assertParticipant/assertInitiator/assertRecipient) instead of the
// route-level requireHospitalMatch used elsewhere.
const router = Router();

router.use(protect);

router.get("/", authorize(PERMISSIONS.VIEW_INVENTORY), validateQuery(listExchangeRequestsQuerySchema), exchangeRequestController.list);
router.get("/:requestId", authorize(PERMISSIONS.VIEW_INVENTORY), exchangeRequestController.getById);

router.post(
  "/",
  authorize(PERMISSIONS.CREATE_EXCHANGE_REQUEST),
  validate(createExchangeRequestSchema),
  exchangeRequestController.create
);

router.post(
  "/:requestId/approve",
  authorize(PERMISSIONS.APPROVE_EXCHANGE_REQUEST),
  validate(approveExchangeRequestSchema),
  exchangeRequestController.approve
);

router.post(
  "/:requestId/reject",
  authorize(PERMISSIONS.APPROVE_EXCHANGE_REQUEST),
  validate(rejectExchangeRequestSchema),
  exchangeRequestController.reject
);

router.post(
  "/:requestId/cancel",
  authorize(PERMISSIONS.CREATE_EXCHANGE_REQUEST),
  validate(cancelExchangeRequestSchema),
  exchangeRequestController.cancel
);

router.post(
  "/:requestId/ship",
  authorize(PERMISSIONS.MANAGE_INVENTORY),
  exchangeRequestController.ship
);

router.post(
  "/:requestId/receive",
  authorize(PERMISSIONS.MANAGE_INVENTORY),
  validate(receiveExchangeRequestSchema),
  exchangeRequestController.receive
);

export default router;
