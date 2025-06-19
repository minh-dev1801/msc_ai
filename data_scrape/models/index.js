import sequelize from "../database/db.js";
import Product from "./product.js";
import Bid from "./bid.js";
import ProductBid from "./productBid.js";
import Contractor from "./contractor.js";
import Category from "./category.js";
import ContractorBid from "./contractorBid.js";

// Nhiều-nhiều: Bid - Product qua ProductBid
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

// Nhiều-nhiều: Contractor - Bid qua ContractorBid
Contractor.belongsToMany(Bid, {
  through: ContractorBid,
  foreignKey: "contractorId",
  otherKey: "bidId",
  as: "participatedBids",
});

Bid.belongsToMany(Contractor, {
  through: ContractorBid,
  foreignKey: "bidId",
  otherKey: "contractorId",
  as: "participants",
});

// Một-nhiều: Category - Product
Category.hasMany(Product, {
  foreignKey: "categoryId",
  as: "products",
});

Product.belongsTo(Category, {
  foreignKey: "categoryId",
  as: "category",
});

export {
  sequelize,
  Product,
  Bid,
  ProductBid,
  Contractor,
  Category,
  ContractorBid,
};
