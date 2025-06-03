import { Category, Product } from "../models/index.js";

async function createProduct() {
  try {
    // Tìm Category theo tên
    const category = await Category.findOne({
      where: { name: "Thiết bị định tuyến (Router)" },
    });

    if (!category) {
      throw new Error("Category not found");
    }

    // Tạo Product
    const product = await category.createProduct({
      name: "Router TP-Link AX3000",
      price: 89.99,
    });

    console.log("Product created:", product.toJSON());
  } catch (error) {
    console.error("Error creating product:", error);
  }
}

export default createProduct;

createProduct();
