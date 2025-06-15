import sequelize from "../database/db.js";
import Product from "./product.js";
import Bid from "./bid.js";
import ProductBid from "./productBid.js";

import Contractor from "./contractor.js";
import Category from "./category.js";

// Mối quan hệ nhiều-nhiều giữa Bid và Product thông qua ProductBid
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

// Mối quan hệ một-nhiều giữa Contractor và Bid
Contractor.hasMany(Bid, {
  foreignKey: "contractorId",
});

Bid.belongsTo(Contractor, {
  foreignKey: "contractorId",
});

export { sequelize, Product, Bid, ProductBid, Contractor, Category };
