import { Types } from "mongoose";
import { IMedicineCategory } from "../model/medicineCategories.model";
import { AppError } from "../../../utils/AppError";
import { HTTP_STATUS } from "../../../constants/http";
import { CATEGORY_MESSAGES } from "../../../constants/messages";
import * as categoryRepository from "../repository/category.repository";
import { CreateCategoryInput, UpdateCategoryInput } from "../validator/category.validator";

export async function createCategory(input: CreateCategoryInput): Promise<IMedicineCategory> {
  const [byName, byCode] = await Promise.all([
    categoryRepository.findByName(input.name),
    categoryRepository.findByCode(input.code),
  ]);
  if (byName) throw new AppError(HTTP_STATUS.CONFLICT, CATEGORY_MESSAGES.DUPLICATE_NAME);
  if (byCode) throw new AppError(HTTP_STATUS.CONFLICT, CATEGORY_MESSAGES.DUPLICATE_CODE);

  if (input.parentCategory) {
    const parent = await categoryRepository.findById(input.parentCategory);
    if (!parent || !parent.isActive) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, CATEGORY_MESSAGES.PARENT_NOT_FOUND);
    }
  }

  return categoryRepository.createCategory({
    ...input,
    parentCategory: input.parentCategory
      ? new Types.ObjectId(input.parentCategory)
      : undefined,
  });
}

export async function getCategoryById(id: string): Promise<IMedicineCategory> {
  const category = await categoryRepository.findById(id);
  if (!category) {
    throw new AppError(HTTP_STATUS.NOT_FOUND, CATEGORY_MESSAGES.NOT_FOUND);
  }
  return category;
}

export async function listCategories(
  filter: { isActive?: boolean; parentCategory?: string | null },
  page: number,
  limit: number
) {
  return categoryRepository.list(filter, page, limit);
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput
): Promise<IMedicineCategory> {
  const category = await getCategoryById(id);

  if (input.parentCategory !== undefined) {
    if (input.parentCategory === null) {
      category.parentCategory = undefined;
    } else {
      if (input.parentCategory === id) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, "A category cannot be its own parent");
      }
      const parent = await categoryRepository.findById(input.parentCategory);
      if (!parent || !parent.isActive) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, CATEGORY_MESSAGES.PARENT_NOT_FOUND);
      }
      category.parentCategory = new Types.ObjectId(input.parentCategory);
    }
  }

  if (input.name !== undefined) category.name = input.name;
  if (input.description !== undefined) category.description = input.description;
  if (input.displayOrder !== undefined) category.displayOrder = input.displayOrder;

  await categoryRepository.saveCategory(category);
  return category;
}

export async function deactivateCategory(id: string): Promise<IMedicineCategory> {
  const category = await getCategoryById(id);
  category.isActive = false;
  await categoryRepository.saveCategory(category);
  return category;
}
