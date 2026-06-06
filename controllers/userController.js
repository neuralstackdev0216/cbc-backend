import User from "../models/user.js";
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

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
                    token:token
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

export function isAdmin(req){
    if(req.user==null){
        return false
    }
    if(req.user.role != "admin"){
        return false
    }
    return true
}