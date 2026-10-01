import mongoose from "mongoose";

const productSchema=mongoose.Schema({
    productId:{
        type:String,
        required:true,
        unique:true
    },
    name:{
        type:String,
        required:true,
    },
    altName:[
        {
            type:String
        }
    ],
    description:{
        type:String,
        required:true
    },
    images:[
        {
            type:String
        }
    ],
    labeledPrice:{
        type:Number,
        required:true
    },
    price:{
        type:Number,
        required:true
    },
    stock:{
        type:Number,
        required:true
    },
    isAvailable:{
        type:Boolean,
        required:true,
        default:true
    },
    brand:{
        type:String,
        default:"Others"
    },
    category:{
        type:String,
        default:"Smartphones"
    },
    specs:[
        {
            _id:false,
            label:{
                type:String
            },
            value:{
                type:String
            }
        }
    ]

});

const Product=mongoose.model("products",productSchema);

export default Product;