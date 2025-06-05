import express from 'express';
import Categories from "../../data_scrape/models/category.js"

const router = express.Router();

router.get('/', async (req , res) =>{
    try {
        const categories = await Categories.findAll();
        res.json(categories);
    } catch (error) {
        console.error('Lỗi khi lấy danh sách categories:', err);
    res.status(500).json({ message: 'Lỗi server' });
    }
})

router.get('/:id', async (req, res) =>{
    try{
        const {id} = req.params;
        const category = await Categories.findByPk(id);

        if(!category){
            return res.status(404).json({message: 'Khong tim thay category'});
        }
        res.json(category);
    }catch(error){
        console.error("Loi khong tim thay category", error);
        res.status(500).json({message:"Loi server"});
    }
})


export default router;