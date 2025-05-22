import sequelize from "../database/db.js";
import Product from "./product.js";
import Bid from "./bid.js";
import ProductBid from "./productBid.js";
import ProductCategory from "./productCategory.js";
import Category from "./category.js";

Bid.belongsToMany(Product, {
  through: ProductBid,
  foreignKey: "bidId",
  otherKey: "productId",
});

Product.belongsToMany(Bid, {
  through: ProductBid,
  foreignKey: "productId",
  otherKey: "bidId",
});

Category.belongsToMany(Product, {
  through: ProductCategory,
  foreignKey: "categoryId",
  otherKey: "productId",
});

Product.belongsToMany(Category, {
  through: ProductCategory,
  foreignKey: "productId",
  otherKey: "categoryId",
});

export { sequelize, Product, Bid, ProductBid, ProductCategory, Category };
