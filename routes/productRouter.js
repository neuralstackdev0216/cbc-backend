import express from 'express'
import { deleteProduct, getProductById, getProducts, saveProduct, updateProduct,searchProduct } from '../controllers/productController.js';

const productRouter=express.Router();

productRouter.get("/",getProducts)
productRouter.post("/",saveProduct)
productRouter.delete("/:productId",deleteProduct)
productRouter.put("/:productId",updateProduct)
productRouter.get("/search/:searchQuery",searchProduct)
productRouter.get("/:productId",getProductById)



export default productRouter