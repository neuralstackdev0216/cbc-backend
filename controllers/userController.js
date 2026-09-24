import User from "../models/user.js";
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import axios from "axios"
import nodemailer from "nodemailer"
import OTP from "../models/otp.js"

dotenv.config();

export function createUser(req,res){
    if(req.body.role=="admin"){
        if(req.user!=null){
            if(req.user.role !="admin"){
                res.status(403).json({
                message:"You are not authorized to create an admin account"
            })
            return
            }
        }
        else{
            res.status(403).json({
                message:"You are not authorized to create an admin account"
            })
            return
        }
    }
    const hashedPassword=bcrypt.hashSync(req.body.password,10)
    const user=new User({
        email:req.body.email,
        firstName:req.body.firstName,
        lastName:req.body.lastName,
        password:hashedPassword,
        role:req.body.role
    })

    user.save().then(()=>{
        res.json({
            message:"User Created Succesfully"
        })
    }).catch(()=>{
        res.json({
            message:"Failed to create the user"
        })
    })
}

export function loginUser(req,res){
    const email=req.body.email;
    const password=req.body.password;
    User.findOne({email:email}).then((user)=>{
        if(user == null){
            return res.status(404).json({
                message:"User not found"
            })
        }
        else{
            const isPasswordCorrect=bcrypt.compareSync(password,user.password)
            if(isPasswordCorrect){
                const token=jwt.sign({
                    firstName:user.firstName,
                    lastName:user.lastName,
                    email:user.email,
                    role:user.role,
                    img:user.img
                },
                process.env.SECRET_KEY
                )

            
                res.json({
                    message:"Login Successfull",
                    token:token,
                    role:user.role
                })
            }
            else{
                res.status(401).json({
                    message:"Invalid Password"
                })
            }
        }
    })

}

export async function loginWithGoogle(req,res){
 const token=req.body.accessToken
 if(token==null){
    res.status(400).json({
        message:"Access Token is required"
    })
    return
 }
const response=await axios.get("https://www.googleapis.com/oauth2/v3/userinfo",{
    headers:{
        Authorization:`Bearer ${token}`
    }
 })   
 console.log(response.data)
 const user=await User.findOne({
    email:response.data.email
 }) 

 if(user==null){
    const newUser=new User(
        {
            email:response.data.email,
            firstName:response.data.given_name,
            lastName:response.data.family_name,
            password:"googleUser",
            img:response.data.picture
        }
    )
    await newUser.save()
    const token = jwt.sign({
        firstName:newUser.firstName,
        lastName:newUser.lastName,
        email:newUser.email,
        role:newUser.role,
        img:newUser.img
    },
    process.env.SECRET_KEY 
    )
    res.json({
        message:"Login Successfull",
        token:token,
        role:newUser.role
    })
 }else{
    const token = jwt.sign({
        firstName:user.firstName,
        lastName:user.lastName,
        email:user.email,
        role:user.role,
        img:user.img
    },
    process.env.SECRET_KEY 
    )
    res.json({
        message:"Login Successfull",
        token:token,
        role:user.role
    })
 }
}
const transporter=nodemailer.createTransport(
    {
        service:"gmail",
        port:587,
        secure:false,
        auth:{
            user:"neuralstack.dev@gmail.com",
            pass:"ntznzjjavuweejro"
        }
    }
)
export async function sendOTP(req,res){
    const randomOTP=Math.floor(100000+Math.random()*900000)
    const email=req.body.email;
    if(email==null){
        res.status(400).json({
            message:"Email is required"
        })
        return
    }
    const user=await User.findOne({
        email:email
    })
    if(user==null){
        res.status(404).json({
            message:"User not found"
        })
        return
    }

    await OTP.deleteMany(
        {
            email:email
        }
    )

    const message={
        from:"neuralstack.dev@gmail.com",
        to:email,
        subject:"Resetting password for MobileShop clear.",
        text:"This your password rest OTP:"+randomOTP
    }

    const otp=new OTP({
        email:email,
        otp:randomOTP
    })
    await otp.save()
    

    transporter.sendMail(message,(err,info)=>{
        if(err){
            res.status(500).json({
                error:err,
                message:"Failed to send the OTP"
            })            
        }else{
            res.json({
                message:"OTP sent successfully",
                otp:randomOTP
            })
        }
    })
}

export async function resetPassword(req,res){
    const otp=req.body.otp;
    const email=req.body.email;
    const password=req.body.password;

    const response=await OTP.findOne({
        email:email,
    })

    if(response==null){
        res.status(500).json({
            message:"OTP not found"
        })
        return
    }
    if(response.otp==otp){
        await OTP.deleteMany({
            email:email
        })
        const hashedPassword=bcrypt.hashSync(password,10)
        const response2=await User.updateOne(
            {
                email:email
            },
            {
                
                password:hashedPassword
                
            }
        )
        res.json({
            message:"Password reset successfully"
        })


    }else{
        res.status(403 ).json({
            message:"Invalid OTP"
        })
        return
    }
}
export function isAdmin(req){
    if(req.user==null){
        return false
    }
    if(req.user.role != "admin"){
        return false
    }
    return true
}