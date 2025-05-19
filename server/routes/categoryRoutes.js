import express from 'express';
import ProductCategory from '../../data_scrape/models/productCategory.js';
import Product from '../../data_scrape/models/product.js';

const router = express.Router();

router.get('/', async (req , res) =>{
    try {
        const categories = await ProductCategory.findAll();
        res.json(categories);
    } catch (error) {
        console.error('Lỗi khi lấy danh sách categories:', err);
    res.status(500).json({ message: 'Lỗi server' });
    }
})


export default router;