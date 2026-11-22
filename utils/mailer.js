import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();    
const transporter=nodemailer.createTransport({
    service:"gmail",
    port:587,
    secure:false,
    auth:{
        user:process.env.EMAIL_USER,
        pass:process.env.EMAIL_PASS
    }
})

export async function sendMail({to,subject,html,text}){
    try{
        await transporter.sendMail({
            from:'"'+(process.env.SHOP_NAME || "Tekzo")+'" <'+process.env.EMAIL_USER+'>',
            to:to,
            subject:subject,
            html:html,
            text:text
        })
        return true
    }
    catch(err){
        console.log("Email Failed:",err.message)
        return false
    }
}