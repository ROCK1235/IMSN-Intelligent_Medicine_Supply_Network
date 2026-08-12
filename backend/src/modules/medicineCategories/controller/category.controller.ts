import { Request, Response } from "express";
import * as categoryService from "../service/category.service";
import { HTTP_STATUS } from "../../../constants/http";
import { CATEGORY_MESSAGES } from "../../../constants/messages";
import { getParam } from "../../../utils/params";
import { ListCategoriesQuery } from "../validator/category.validator";

export async function create(req: Request, res: Response): Promise<void> {
  const category = await categoryService.createCategory(req.body);
  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: CATEGORY_MESSAGES.CREATE_SUCCESS,
    data: { category },
  });
}

export async function list(req: Request, res: Response): Promise<void> {
  const { page, limit, active, rootOnly } = req.validatedQuery as ListCategoriesQuery;
  const filter: { isActive?: boolean; parentCategory?: string | null } = {};
  if (active !== undefined) filter.isActive = active === "true";
  if (rootOnly === "true") filter.parentCategory = null;

  const { items, total } = await categoryService.listCategories(filter, page, limit);
  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: { categories: items, page, limit, total },
  });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const category = await categoryService.getCategoryById(getParam(req, "categoryId"));
  res.status(HTTP_STATUS.OK).json({ success: true, data: { category } });
}

export async function update(req: Request, res: Response): Promise<void> {
  const category = await categoryService.updateCategory(getParam(req, "categoryId"), req.body);
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: CATEGORY_MESSAGES.UPDATE_SUCCESS,
    data: { category },
  });
}

export async function deactivate(req: Request, res: Response): Promise<void> {
  const category = await categoryService.deactivateCategory(getParam(req, "categoryId"));
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: CATEGORY_MESSAGES.DEACTIVATE_SUCCESS,
    data: { category },
  });
}
