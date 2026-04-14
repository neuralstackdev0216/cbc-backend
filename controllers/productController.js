import Product from "../models/product.js";
import { isAdmin } from "./userController.js";

export async function getProducts(req,res){
    // Product.find().then((data)=>{
    //     res.json(data)
    // }).catch((err)=>{
    //     res.json({
    //         message:"Failed to get Products",
    //         error:err
    //     })
    // })

    try{
        if(isAdmin(req)){
            const products=await Product.find()
            res.json(products)
        }
        else{
            const products=await Product.find({isAvailable:true})
            res.json(products)
        }
    }
    catch(err){
        res.json({
            message:"Failed to fetch the products",
            error:err
        })
    }
}

export function saveProduct(req,res){

    if(!isAdmin(req)){
        res.json({
            message:"You are not authorized to create a product"
        })
        return
    }
        
    const product=new Product(
        req.body
    )

    product.save().then(()=>{
        res.json({
            message:"Product added successfully"
        })
    }).catch(()=>{
        res.json({
            message:"failed to add the product"
        })
    })
}

export async function deleteProduct(req,res){
    if(!isAdmin(req)){
        res.json({
            message:"you are not authorized to delete product" 
        })
        return
    }
    try {
        await Product.deleteOne({productId:req.params.productId})
        res.json({
        message:"Product delete succesfully"
    })
    } catch (err) {
        res.status(500).json({
            message:"Failed to delete the product",
            error:err
        })
    }
}