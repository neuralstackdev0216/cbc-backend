import express from 'express';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import productRouter from './routes/productRouter.js';
import userRouter from './routes/userRoute.js';
import jwt from 'jsonwebtoken'
import orderRouter from './routes/orderRoute.js';
import cors from 'cors';
import dotenv from 'dotenv'

dotenv.config();
const app=express();

app.use(cors())
app.use(bodyParser.json())
mongoose.connect(process.env.MONGODB_URL).then(() => {
    console.log("Connected to the database");
})
.catch((err) => {
    console.error("Database Connection Failed");
});

app.use((req,res,next)=>{
    const tokenString=req.header("Authorization")
    if(tokenString!=null){
        const token=tokenString.replace("Bearer ","")
        //console.log(token)

        jwt.verify(token,process.env.SECRET_KEY,(err,decoded)=>{
            if(decoded!=null){
                //console.log(decoded)
                req.user=decoded
                next()
            }
            else{
                console.log("Invalid Token");
                return res.status(403).json({
                    message:"Invalid Token"
                })
            }
        })
        
    }else{
        next()
    }
    
})

app.use("/api/products",productRouter)
app.use("/api/users",userRouter)
app.use("/api/orders",orderRouter)


app.listen(5000,()=>{
    console.log("Server is running on port 5000");
})

// mongodb+srv://admin:123@cluster0.ueqrlui.mongodb.net/?appName=Cluster0