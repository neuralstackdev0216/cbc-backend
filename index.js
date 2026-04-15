import express from 'express';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import productRouter from './routes/productRouter.js';
import userRouter from './routes/userRoute.js';
import jwt from 'jsonwebtoken'
import orderRouter from './routes/orderRoute.js';

const app=express();
app.use(bodyParser.json())
mongoose.connect("mongodb://admin:123@ac-qyvlmli-shard-00-00.ueqrlui.mongodb.net:27017,ac-qyvlmli-shard-00-01.ueqrlui.mongodb.net:27017,ac-qyvlmli-shard-00-02.ueqrlui.mongodb.net:27017/?ssl=true&replicaSet=atlas-kpfgqf-shard-0&authSource=admin&appName=Cluster0").then(() => {
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

        jwt.verify(token,"cbc-batch-five#@2025",(err,decoded)=>{
            if(decoded!=null){
                //console.log(decoded)
                req.user=decoded
                next()
            }
            else{
                console.log("Invalid Token");
                res.status(403).json({
                    message:"Invalid Token"
                })
            }
        })
        
    }else{
        next()
    }
    
})

app.use("/products",productRouter)
app.use("/users",userRouter)
app.use("/orders",orderRouter)


app.listen(5000,()=>{
    console.log("Server is running on port 5000");
})

// mongodb+srv://admin:123@cluster0.ueqrlui.mongodb.net/?appName=Cluster0