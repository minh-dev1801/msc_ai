import sequelize from "../database/db.js";
import Product from "./product.js";
import Bid from "./bid.js";
import ProductBid from "./productBid.js";
import ProductCategory from "./productCategory.js";

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

Product.belongsTo(ProductCategory, {
  foreignKey: "productCategoryId",
});

ProductCategory.hasMany(Product, {
  foreignKey: "productCategoryId",
});

export { sequelize, Product, Bid, ProductBid, ProductCategory };
