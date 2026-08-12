import { Request, Response } from "express";
import * as userService from "../service/user.service";
import { HTTP_STATUS } from "../../../constants/http";
import { AUTH_MESSAGES } from "../../../constants/messages";

const REFRESH_COOKIE = "refreshToken";
const REFRESH_COOKIE_PATH = "/api/v1/users";

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, mirrors default REFRESH_TOKEN_EXPIRY
  path: REFRESH_COOKIE_PATH,
};

//===================
//Meta Data
//===================

function getMeta(req: Request) {
  return {
    ipAddress: req.ip ?? "",
    userAgent: req.headers["user-agent"] ?? "",
  };
}
//Refresh Token
function getRefreshTokenFromRequest(req: Request): string | undefined {
  return req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
}

//===============================
//Sign-Up 
//===============================

export async function register(req: Request, res: Response): Promise<void> {
  const result = await userService.register(req.body, getMeta(req));

  res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions);
  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: AUTH_MESSAGES.REGISTER_SUCCESS,
    data: { user: result.user, accessToken: result.accessToken },
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await userService.login(req.body, getMeta(req));

  res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions);
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: AUTH_MESSAGES.LOGIN_SUCCESS,
    data: { user: result.user, accessToken: result.accessToken },
  });
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  const token = getRefreshTokenFromRequest(req);
  const result = await userService.refresh(token, getMeta(req));

  res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions);
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: AUTH_MESSAGES.REFRESH_SUCCESS,
    data: { accessToken: result.accessToken },
  });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = getRefreshTokenFromRequest(req);
  await userService.logout(token);

  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: AUTH_MESSAGES.LOGOUT_SUCCESS,
  });
}

export async function me(req: Request, res: Response): Promise<void> {
  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: { user: req.user },
  });
}

//===============================
//Email verification
//===============================

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  await userService.verifyEmail(req.body.token);
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: AUTH_MESSAGES.EMAIL_VERIFIED_SUCCESS,
  });
}

export async function resendVerification(req: Request, res: Response): Promise<void> {
  await userService.resendVerification(req.body.email);
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: AUTH_MESSAGES.VERIFICATION_EMAIL_SENT,
  });
}

//===============================
//Password reset
//===============================

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  await userService.forgotPassword(req.body.email);
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: AUTH_MESSAGES.PASSWORD_RESET_EMAIL_SENT,
  });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  await userService.resetPassword(req.body.token, req.body.password);
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: AUTH_MESSAGES.PASSWORD_RESET_SUCCESS,
  });
}
